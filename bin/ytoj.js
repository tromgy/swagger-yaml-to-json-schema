#!/usr/bin/env node

'use strict';

const _ = require('lodash');
require('colors');
const fs = require('fs');
const yaml = require('js-yaml');
const refParser = require('json-schema-ref-parser');
const path = require('path');
const promptly = require('promptly');
const URL = require('url').URL;

let swaggerObj = null;
let default$id = '';

// This initialization is to insure that these two keywords
// appear first in the resulting file -- it is only for aesthetic purposes
let schema = {
  $schema: null,
  $id: null,
};

// Input file reader and validator
const ingestYAML = function (yamlFile) {
  // Read YAML
  const swaggerYAML = fs.readFileSync(yamlFile).toString();

  // Convert to JSON
  const swaggerJSON = yaml.safeLoad(swaggerYAML);

  // Determine the spec version (supported Swagger 2.* or OpenAPI 3.*)
  const swaggerVersion = swaggerJSON.swagger;
  const openAPIVersion = swaggerJSON.openapi;

  if (swaggerVersion) {
    if (swaggerVersion.toString().startsWith('2')) {
      return swaggerJSON;
    } else {
      return null;
    }
  } else if (openAPIVersion) {
    if (openAPIVersion.toString().startsWith('3')) {
      return swaggerJSON;
    } else {
      return null;
    }
  } else {
    return null;
  }
};

// Validators for input parameters (used by promptly and when reading config file)
const yamlFileValidator = function (value) {
  if (fs.existsSync(value)) {
    // Check that it appears to be a Swagger/OpenAPI file
    swaggerObj = ingestYAML(value);

    if (swaggerObj) {
      // Get the metadata
      if (swaggerObj.info) {
        // Title is required
        if (swaggerObj.info.title) {
          schema.title = swaggerObj.info.title;
        } else {
          throw new Error('The title is missing in the Swagger YAML'.red);
        }

        // Description is not required
        if (swaggerObj.info.description) {
          schema.description = swaggerObj.info.description;
        } else {
          console.log('The description is missing in the Swagger YAML'.yellow);
        }

        // Version is required
        if (swaggerObj.info.version) {
          schema.version = swaggerObj.info.version;
        } else {
          throw new Error('The version is missing in the Swagger YAML'.red);
        }

        // Try to guess the URL to use as the default schema $id from the license spec
        if (swaggerObj.info.license) {
          default$id = swaggerObj.info.license.url ? swaggerObj.info.license.url : '';
        }

      } else {
        throw new Error('The info object is missing in the Swagger YAML'.red);
      }

      return value;
    } else {
      throw new Error(`Input file ${value} does not appear to be a Swagger 2 or OpenAPI 3 specification.`.red);
    }
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

// Function to find all nested sub-objects by the key
// Credit: Bergi (https://stackoverflow.com/users/1048572/bergi)
// Borrowed from: https://stackoverflow.com/questions/15642494/find-property-by-name-in-a-deep-object
function findInNested(obj, key) {
  if (_.has(obj, key)) return [obj]; // array of containing objects

  return _.flatten(_.map(obj, v => (typeof v === 'object' ? findInNested(v, key) : [])), true);
}

// Generate "properties" from Swagger paths
function addSchemaProps(swagger, schemaProps) {

  try {
    // Find all "schema" sub-objects in Swagger JSON
    const result = findInNested(swagger, 'schema');

    let primitiveId = 0;

    for (const container of result) {
      let propPath = '';
      let propName = '';

      if (container.name) {
        propName = container.name;
      }

      if (container.schema.type) {
        if (container.schema.type === 'array') {
          propPath = container.schema.items.$ref;

          if (!propName) {
            propName = 'arrayOf'.concat(propPath.slice(propPath.lastIndexOf('/') + 1));
          }
        } else {
          // For primitive types if we can't find the property name,
          // use the unique number with the type name
          if (!propName) {
            propName = `${container.schema.type}-${++primitiveId}`;
          }
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

// Convert Swagger "nullable" to "type": "null" in JSON schema
function convertNullables(schemaObj) {
  const withNullables = findInNested(schemaObj, 'nullable');

  for (let item of withNullables) {
    delete item.nullable;
    item.type = [item.type, 'null'];
  }
}

// Main
(async function () {
  const configFile = './ytoj.json';
  let configuration = {};

  try {
    // If no configuration file is found, work interactively, otherwise silently
    if (!fs.existsSync(configFile)) {
      do {
        console.log('\nGenerate JSON schema from Swagger or OpenAPI YAML document.\n');

        configuration.yaml = await promptly.prompt('Swagger YAML file: '.cyan, { validator: yamlFileValidator });
        configuration.json = await promptly.prompt('Output JSON schema: '.cyan, { validator: jsonFileValidator });
        configuration.schema = await promptly.prompt('$schema: (http://json-schema.org/draft-07/schema#) '.cyan,
          {
            default: 'http://json-schema.org/draft-07/schema#',
            validator: $schemaValidator,
          });
        configuration.id = await promptly.prompt(`$id: (${default$id})`.cyan,
          {
            default: default$id,
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
      } while (!await promptly.confirm('\nDoes everything look good (y)? '.cyan, { default: 'y' }));

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
        yamlFileValidator(configuration.yaml);
        jsonFileValidator(configuration.json);
        $schemaValidator(configuration.schema);
        $idValidator(configuration.id);
      } catch (err) {
        console.error(`Could not get configuration: ${err}`.red);
        return;
      }
    }

    // Extract schema
    let schemaPart = null;

    // At this point we can be sure that it's either Swagger 2 or OpenAPI 3
    // as it already has been validated
    if (swaggerObj.swagger) {                 // Swagger 2
      schemaPart = swaggerObj.definitions;
    } else {                                  // OpenAPI 3
      schemaPart = swaggerObj.components.schemas;
    }

    // Create JSON schema
    schema.$schema = configuration.schema;

    // If no id is given, remove it from the schema -- empty strings not allowed
    if (configuration.id) {
      schema.$id = configuration.id;
    } else {
      delete schema.$id;
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
    addSchemaProps(swaggerObj, schema.properties);

    // Add all entity defintions
    schema.definitions = schemaPart;

    // Process nullable types
    convertNullables(schema.definitions);

    // If this is an OpenAPI 3 spec, we need to change all $refs from
    // #/components/schemas to #/definitions
    // this we can do by simply doing text search and replace
    if (swaggerObj.openapi) {
      let oldSchemaText = JSON.stringify(schema);
      let newSchemaText = oldSchemaText.replace(new RegExp('#/components/schemas', 'g'), '#/definitions');
      schema = JSON.parse(newSchemaText);
    }

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
}
)();
