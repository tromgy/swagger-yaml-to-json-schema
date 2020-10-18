#!/usr/bin/env node

'use strict';

require('colors');
const fs = require('fs');
const path = require('path');
const promptly = require('promptly');

const lib = require('../lib');
const validators = require('../lib/validators');

(async function() {
  const configFile = './ytoj.json';
  let configuration = {};

  try {
    // If no configuration file is found, work interactively, otherwise silently
    if (!fs.existsSync(configFile)) {
      do {
        console.log('\nGenerate JSON schema from Swagger or OpenAPI YAML document.\n\nVersion 2.0\n');

        configuration.yaml = await promptly.prompt('Swagger YAML file: '.cyan, { validator: validators.yamlFile });
        configuration.json = await promptly.prompt('Output JSON schema: '.cyan, { validator: validators.jsonFile });
        configuration.schema = await promptly.prompt('$schema: (http://json-schema.org/draft-07/schema#) '.cyan, {
          default: 'http://json-schema.org/draft-07/schema#',
          validator: validators.$schema,
        });
        configuration.id = await promptly.prompt(`$id: (${validators.default$Id()})`.cyan, {
          default: validators.default$Id(),
          validator: validators.$id,
        });
        configuration.resolveRefs = await promptly.confirm('Resolve $refs? (n)'.cyan, { default: 'n' });
        configuration.additionalProperties = await promptly.confirm(
          'Allow '.cyan.concat('additionalProperties'.bold.green).concat('? (n)'.cyan),
          { default: 'n' }
        );
        configuration.indent = parseInt(
          await promptly.prompt('Indent size in the output JSON file (2):'.cyan, {
            default: '2',
            validator: validators.indent,
          })
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

      if (await promptly.confirm('Save these settings in ytoj.json (y)?'.cyan, { default: 'y' })) {
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
