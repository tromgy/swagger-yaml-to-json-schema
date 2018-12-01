#!/usr/bin/env node

'use strict';

const _ = require('lodash');
require('colors');
const fs = require('fs');
const yaml = require('js-yaml');
const refParser = require('json-schema-ref-parser');
const path = require('path');
const promptly = require('promptly');
require('url');

// Validators for input parameters (used by promptly and when reading config file)
const yamlFileValidator = function (value) {
  if (fs.existsSync(value)) {
    return value;
  }
  throw new Error(`Input file ${value} is not found.`.red);
};

const jsonFileValidator = function (value) {
  try {
    path.parse(value);
  } catch (typeErr) {
    throw new Error(typeErr.message.red);
  }
  return value;
};

const $schemaValidator = function (value) {
  if (value.startsWith('http://json-schema.org/')) {
    return value;
  }
  throw new Error('Invalid $schema -- must be a URL starting with "http://json-schema.org"'.red);
};

const $idValidator = function (value) {
  if (value && value.length > 0) {
    try {
      new URL(value); // only for validation
    } catch (typeErr) {
      throw new Error(typeErr.message.red);
    }
  }

  return value;
};

// Generate "properties" from Swagger paths
function addSchemaProps(swagger, schemaProps) {
  // Function to find all nested sub-objects by the key
  // Credit: Bergi (https://stackoverflow.com/users/1048572/bergi)
  // Borrowed from: https://stackoverflow.com/questions/15642494/find-property-by-name-in-a-deep-object
  function findInNested(obj, key) {
    if (_.has(obj, key)) return [obj]; // array of containing objects

    return _.flatten(_.map(obj, v => (typeof v === 'object' ? findInNested(v, key) : [])), true);
  }

  try {
    // Find all "schema" sub-objects in Swagger JSON
    const result = findInNested(swagger, 'schema');

    let primitiveId = 0;

    for (const container of result) {
      let propPath = '';
      let propName = '';

      if (container.schema.type) {
        if (container.schema.type === 'array') {
          propPath = container.schema.items.$ref;
          propName = 'arrayOf'.concat(propPath.slice(propPath.lastIndexOf('/') + 1));
        } else {
          // For primitive types we can't infer the property name,
          // so just use the unique number with the type name
          propName = `${container.schema.type}-${++primitiveId}`;
        }
      } else {
        propPath = container.schema.$ref;
        propName = propPath.slice(propPath.lastIndexOf('/') + 1);

        // lowercase the first letter
        propName = propName.charAt(0).toLocaleLowerCase().concat(propName.slice(1));
      }

      schemaProps[propName] = container.schema;
      schemaProps[propName].description = container.description;
    }
  } catch (err) {
    console.error(`Could not parse Swagger paths: ${err}`.red);
  }
}

// Main
const ytoj = async function () {
  const configFile = './ytoj.json';
  let configuration = {};
  let schema = {};

  try {
    // If no configuration file is found, work interactively, otherwise silently
    if (!fs.existsSync(configFile)) {
      do {
        console.log('\nGenerate JSON schema from Swagger YAML document.\n');

        configuration.yaml = await promptly.prompt('Swagger YAML file: '.cyan, { validator: yamlFileValidator });
        configuration.json = await promptly.prompt('Output JSON schema: '.cyan, { validator: jsonFileValidator });
        configuration.schema = await promptly.prompt('$schema: (http://json-schema.org/draft-07/schema#) '.cyan,
          {
            default: 'http://json-schema.org/draft-07/schema#',
            validator: $schemaValidator,
          });
        configuration.id = await promptly.prompt('$id: '.cyan,
          {
            default: '',
            validator: $idValidator,
          });
        configuration.resolveRefs = await promptly.confirm('Resolve $refs? (n)'.cyan, { default: 'n' });
        configuration.additionalProperties = await promptly.confirm('Allow '.cyan.concat('additionalProperties'.bold.green).concat('? (n)'.cyan), { default: 'n' });

        console.log('');
        console.log('\tInput:                '.green.concat(configuration.yaml));
        console.log('\tOutput:               '.green.concat(configuration.json));
        console.log('\t$schema:              '.green.concat(configuration.schema));
        console.log('\t$id:                  '.green.concat(configuration.id));
        console.log('\tResolve $refs:        '.green.concat(configuration.resolveRefs));
        console.log('\tadditionalProperties: '.green.concat(configuration.additionalProperties));
      } while (!await promptly.confirm('\nDoes everything look good? '.cyan));

      if (await promptly.confirm('Save these settings in ytoj.json? '.cyan)) {
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
        yamlFileValidator(configuration.yaml);
        jsonFileValidator(configuration.json);
        $schemaValidator(configuration.schema);
        $idValidator(configuration.id);
      } catch (err) {
        console.error(`Could not get configuration: ${err}`.red);
        return;
      }
    }

    // Read YAML
    const swaggerYAML = fs.readFileSync(configuration.yaml).toString();

    // Convert to JSON
    const swaggerJSON = yaml.safeLoad(swaggerYAML);

    // Extract definitions
    const schemaPart = swaggerJSON.definitions;

    // Create JSON schema
    schema.$schema = configuration.schema;

    // If no id is given, don't add it to the schema -- empty strings not allowed
    if (configuration.id) {
      schema.$id = configuration.id;
    }

    // Get the metadata
    if (swaggerJSON.info) {
      // Title is required
      if (swaggerJSON.info.title) {
        schema.title = swaggerJSON.info.title;
      } else {
        console.error('The title is missing in the Swagger YAML'.red);
        return;
      }

      // Description is not required
      if (swaggerJSON.info.description) {
        schema.description = swaggerJSON.info.description;
      } else {
        console.error('The description is missing in the Swagger YAML'.yellow);
      }

      // Version is required
      if (swaggerJSON.info.version) {
        schema.version = swaggerJSON.info.version;
      } else {
        console.error('The version is missing in the Swagger YAML'.red);
      }
    } else {
      console.error('The info object is missing in the Swagger YAML'.red);
      return;
    }

    schema.additionalProperties = configuration.additionalProperties;

    schema.properties = {
      schemaVersion: {
        type: 'string',
        description: 'The version of this schema that will be used to validate JSON data',
      },
    };

    schema.required = ['schemaVersion'];

    // Find "schema"s in the "paths" -- they will go to the properties key
    addSchemaProps(swaggerJSON, schema.properties);

    // Add all entity defintions
    schema.definitions = schemaPart;

    // Resolve $refs if specified
    if (configuration.resolveRefs) {
      await refParser.dereference(schema, (err, resolvedSchema) => {
        if (err) {
          console.error(`Could not resolve $refs: ${err}`);
        } else {
          schema = resolvedSchema;
        }
      });
    }

    // Create directory for output file if needed
    const outputDir = path.parse(configuration.json).dir;

    if (outputDir && !fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    // Write the schema
    fs.writeFileSync(configuration.json, JSON.stringify(schema, null, 2));

    console.log(`\nWritten JSON schema to ${configuration.json}`.green);
  } catch (err) {
    console.error('\n'.concat(err.message.red));
  }
};

// Run it
ytoj();
