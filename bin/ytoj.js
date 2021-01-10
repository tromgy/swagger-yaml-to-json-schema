#!/usr/bin/env node

'use strict';

require('colors');
const fs = require('fs');
const path = require('path');
const promptly = require('promptly');
const version = require('../package.json').version;
const program = require('commander');

const lib = require('../lib');
const validators = require('../lib/validators');

const DEFAULT_SCHEMA = 'http://json-schema.org/draft-07/schema#';
const DEFAULT_CONFIG = 'ytoj.json';

let cmdLineConfig;

program
  .description(`${lib.DESCRIPTION}.\n\nVersion ${version}`)
  .option('-i, --input <file path>', `YAML input file (${'required'.bold})`)
  .option('-o, --output <file path>', `JSON schema output file (${'required'.bold})`)
  .option('-s, --schema <url>', `${'$schema'.bold.blue} (default ${DEFAULT_SCHEMA.underline})`)
  .option('-d, --id <url>', `${'$id'.bold.blue}`)
  .option('-r, --resolve-refs', `resolve ${'$ref'.bold.blue}s in the schema`)
  .option('-a, --additional-properties', `allow ${'additionalProperties'.bold.blue} in the schema`)
  .option('-t, --indent <number>', `indent size in the output JSON file (default ${'2'.bold})`)
  .option('-c, --config <file path>', 'use settings from this file')
  .option('--save-settings', 'save parameters to the configuration file and exit');

// Let commander parse the command line only if there are arguments
if (process.argv.length > 2) {
  program.parse(process.argv);

  // If the '--config (-c)' option is specified and no '--save-settings',
  // ignore any others, the configuration will be read from that file
  if (!program.config || program.saveSettings) {
    let validConfig = true;

    if (!program.input) {
      console.log('The input file parameter is required.'.red);
      validConfig = false;
    }

    if (!program.output) {
      console.log('The output file parameter is required.'.red);
      validConfig = false;
    }

    if (validConfig) {
      cmdLineConfig = {
        yaml: program.input,
        json: program.output,
        schema: program.schema || DEFAULT_SCHEMA,
        id: program.id || '',
        resolveRefs: program.resolveRefs,
        additionalProperties: program.additionalProperties,
        indent: program.indent ? parseInt(program.indent, 10) : 2,
      };

      if (program.saveSettings) {
        const file = program.config || DEFAULT_CONFIG;

        console.log(`Saving settings to ${file}...\n`);

        saveConfiguration(cmdLineConfig, file);

        process.exit(0);
      }
    } else {
      // Invalid configuration
      process.exit(1);
    }
  }
}

/**
 * Main
 */
(async function () {
  const configFile = program.config || DEFAULT_CONFIG;
  let configuration = {};

  try {
    // If there's neither command line parameters nor config file, work interactively, otherwise silently
    if (!(fs.existsSync(configFile) || cmdLineConfig)) {
      do {
        console.log(`\n${lib.DESCRIPTION}.\n\nVersion ${version}`);
        console.log('\nInteractive mode. For command line parameters run with --help\n');

        configuration.yaml = await promptly.prompt('Swagger YAML file: '.cyan, { validator: validators.yamlFile });
        configuration.json = await promptly.prompt('Output JSON schema: '.cyan, { validator: validators.jsonFile });
        configuration.schema = await promptly.prompt(`${'$schema'.bold.blue}: (${DEFAULT_SCHEMA})`.cyan, {
          default: DEFAULT_SCHEMA,
          validator: validators.$schema,
        });
        configuration.id = await promptly.prompt(`${'$id'.bold.blue}: (${validators.default$Id()})`.cyan, {
          default: validators.default$Id(),
          validator: validators.$id,
        });
        configuration.resolveRefs = await promptly.confirm(`Resolve ${'$refs'.bold.blue}? (n)`.cyan, { default: 'n' });
        configuration.additionalProperties = await promptly.confirm(
          `Allow ${'additionalProperties'.bold.blue}? (n)`.cyan,
          { default: 'n' }
        );
        configuration.indent = parseInt(
          await promptly.prompt(
            'Indent size in the output JSON file (2):'.cyan,
            {
              default: '2',
              validator: validators.indent,
            },
            10
          )
        );

        console.log('');
        console.log('\tInput:                '.green.concat(configuration.yaml));
        console.log('\tOutput:               '.green.concat(configuration.json));
        console.log('\t$schema:              '.green.concat(configuration.schema));
        console.log('\t$id:                  '.green.concat(configuration.id));
        console.log('\tResolve $refs:        '.green.concat(configuration.resolveRefs));
        console.log('\tadditionalProperties: '.green.concat(configuration.additionalProperties));
        console.log('\tIndent size:          '.green.concat(configuration.indent));
      } while (!(await promptly.confirm('\nDoes everything look good (y)? '.cyan, { default: 'y' })));

      if (await promptly.confirm(`Save these settings in ${configFile} (y)?`.cyan, { default: 'y' })) {
        saveConfiguration(configuration, configFile);
      }
    } else if (fs.existsSync(configFile)) {
      try {
        configuration = JSON.parse(fs.readFileSync(configFile));
        console.log(`Using configuration from ${configFile}...`.cyan);
      } catch (err) {
        console.error(`Cannot read configuration: ${err}`.red);
        return;
      }
    } else {
      // Use configuration specified on the command line
      configuration = cmdLineConfig;
    }

    // Validate configuration
    try {
      configuration.yaml = validators.yamlFile(configuration.yaml);
      configuration.json = validators.jsonFile(configuration.json);
      configuration.schema = validators.$schema(configuration.schema);
      configuration.id = validators.$id(configuration.id);
      configuration.indent = validators.indent(configuration.indent);
    } catch (err) {
      console.error(`Invalid configuration: ${err}`.red);
      return;
    }

    // Create directory for output file if needed
    const outputDir = path.parse(configuration.json).dir;

    if (outputDir && !fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    // Make the schema
    const schema = await lib.makeSchema(lib.swagger(), configuration);

    // Write the schema
    fs.writeFileSync(configuration.json, JSON.stringify(schema, null, configuration.indent));

    console.log(`\nWritten JSON schema to ${configuration.json}`.green);
  } catch (err) {
    console.error('\n'.concat(err.message.red));
  }
})();

/**
 *
 * Saves configuration object in the specified file
 *
 * @param {Object} configuration
 * @param {string} configFile
 *
 */
function saveConfiguration(configuration, configFile) {
  try {
    fs.writeFileSync(configFile, JSON.stringify(configuration, null, 2));
    console.log(`Configuration is saved in ${configFile}`.green);
  } catch (err) {
    console.error(`Could not save configuration file: ${err}`.red);
  }
}
