#!/usr/bin/env node

'use strict';

require('colors');
const fs = require('fs');
const path = require('path');
const promptly = require('promptly');

const yargs = require('yargs');

const lib = require('../lib');
const validators = require('../lib/validators');

const argv = yargs
  .options({
    'input': {
      alias: 'i',
      describe: 'Swagger YAML input file',
    },
    'output': {
      alias: 'o',
      describe: 'JSON schema output file',
    },
    'schema': {
      alias: 's',
      describe: '$schema',
      default: 'http://json-schema.org/draft-07/schema#'
    },
    'id': {
      describe: '$id',
      default: validators.default$Id()
    },
    'resolve-refs': {
      alias: 'r',
      describe: 'Resolve $refs',
      default: false,
      type: 'boolean'
    },
    'allow-additional-properties': {
      alias: 'a',
      describe: 'Allow additionalProperties',
      default: false,
      type: 'boolean'

    },
    'indent': {
      alias: 't',
      describe: 'Indent sixe in output JSON file',
      type: 'number',
      default: 2,
    },
    'config': {
      alias: 'c',
      describe: 'Config file for settings',
      default: 'ytoj.json'
    },
    'yes': {
      alias: 'y',
      describe: 'Assume yes to "Does everything look good?"',
      type: 'boolean'
    },
    'save-settings': {
      describe: 'Save configuration to --config file',
      type: 'boolean'
    }
  })
  .argv;

function printConfig(configuration) {
  console.log('\tInput:                '.green.concat(configuration.yaml));
  console.log('\tOutput:               '.green.concat(configuration.json));
  console.log('\t$schema:              '.green.concat(configuration.schema));
  console.log('\t$id:                  '.green.concat(configuration.id));
  console.log('\tResolve $refs:        '.green.concat(configuration.resolveRefs));
  console.log('\tadditionalProperties: '.green.concat(configuration.additionalProperties));
  console.log('\tIndent size:          '.green.concat(configuration.indent));
}

(async function() {
  const configFile = argv.config;
  let configuration = {};

  try {
    // If no configuration file is found, work interactively, otherwise silently
    if (!fs.existsSync(configFile) && (argv.input === undefined || argv.output === undefined )) {
      do {
        console.log('\nGenerate JSON schema from Swagger or OpenAPI YAML document.\n\nVersion 2.0\n');

        configuration.yaml = await promptly.prompt(`Swagger YAML file (${argv.input || ''}): `.cyan, {
          default: argv.input,
          validator: validators.yamlFile,
        });
        configuration.json = await promptly.prompt(`Output JSON schema (${argv.output || ''}): `.cyan, {
          default: argv.output,
          validator: validators.jsonFile
        });
        configuration.schema = await promptly.prompt(`$schema: (${argv.schema}) `.cyan, {
          default: argv.schema,
          validator: validators.$schema,
        });
        configuration.id = await promptly.prompt(`$id: (${argv.id})`.cyan, {
          default: argv.id,
          validator: validators.$id,
        });
        configuration.resolveRefs = await promptly.confirm(`Resolve $refs? (${argv['resolve-refs'] ? 'y':  'n'})`.cyan, { default: 'n' });
        configuration.additionalProperties = await promptly.confirm(
          'Allow '.cyan.concat('additionalProperties'.bold.green).concat(`? (${argv['allow-additional-properties'] ? 'y':  'n'})`.cyan),
          { default: 'n' }
        );
        configuration.indent = parseInt(
          await promptly.prompt(
            `Indent size in the output JSON file (${argv.indent}):`.cyan,
            {
              default: String(argv.indent),
              validator: validators.indent,
            },
            10
          )
        );

        console.log('');
        printConfig(configuration);
      } while (!argv.yes && !(await promptly.confirm('\nDoes everything look good (y)? '.cyan, { default: 'y' })));

      if (argv['save-settings'] || await promptly.confirm(`Save these settings in ${configFile} (y)?`.cyan, { default: 'y' })) {
        try {
          fs.writeFile(configFile, JSON.stringify(configuration, null, 2), (err) => {
            if (err) {
              console.error(`Could not save configuration file: ${err}`.red);
            } else {
              console.log(`Configuration is saved in ${configFile}`.green);
            }
          });
        } catch (err) {
          console.error(`Invalid configuration: ${err}`.red);
        }
      }
    } else {
      if (argv.input && argv.output) {
        configuration = {
          yaml: validators.yamlFile(argv.input),
          json: validators.jsonFile(argv.output),
          schema: validators.$schema(argv.schema),
          id: validators.$id(argv.id),
          resolveRefs: argv['resolve-refs'],
          additionalProperties: argv['allow-additional-properties'],
          indent: validators.indent(argv.indent)
        };
        console.log('CLI args:'.green);
        printConfig(configuration);
      } else {
        try {
          configuration = JSON.parse(fs.readFileSync(configFile));
          console.log(`Using configuration from ${configFile}...`.cyan);

          // Validate configuration
          configuration.yaml = validators.yamlFile(configuration.yaml);
          configuration.json = validators.jsonFile(configuration.json);
          configuration.schema = validators.$schema(configuration.schema);
          configuration.id = validators.$id(configuration.id);
          configuration.indent = validators.indent(configuration.indent);
        } catch (err) {
          console.error(`Could not get configuration: ${err}`.red);
          return;
        }
      }
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
