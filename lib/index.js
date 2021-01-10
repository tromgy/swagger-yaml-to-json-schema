'use strict';

const fs = require('fs');
const yaml = require('js-yaml');
const refParser = require('json-schema-ref-parser');
const util = require('util');

const helpers = require('./helpers');

const DESCRIPTION = 'Generate JSON schema from Swagger, OpenAPI, or AsyncAPI YAML document';

// Promisify ref parser
refParser.parseRefs = util.promisify(refParser.dereference);

// Store Swagger/OpenAPI JSON representation
let swagger = {};

/**
 * Input file reader
 *
 * @param {String} yamlFile - Swagger/OpenAPI YAML file name
 *
 * @returns {Object} JSON representation of the Swagger/OpenAPI specification
 */
function ingestYAML(yamlFile) {
  const swaggerYAML = fs.readFileSync(yamlFile).toString();

  swagger = toJSON(swaggerYAML);

  return swagger;
}

/**
 * YAML to JSON converter
 *
 * @param {String} fromYAML - Swagger/OpenAPI YAML specification
 *
 * @returns {Object} JSON representation of the input
 */
function toJSON(fromYAML) {
  // Convert to JSON
  const swaggerJSON = yaml.safeLoad(fromYAML);

  // Determine the spec version (supported Swagger 2.* or OpenAPI 3.* or AsyncAPI 2.*)
  const swaggerVersion = swaggerJSON.swagger;
  const openAPIVersion = swaggerJSON.openapi;
  const asyncAPIVersion = swaggerJSON.asyncapi;

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
  } else if (asyncAPIVersion) {
    if (asyncAPIVersion.toString().startsWith('2')) {
      return swaggerJSON;
    } else {
      return null;
    }
  } else {
    return null;
  }
}

/**
 * Schema generator
 *
 * @param {Object} swagger - JSON representation of the Swagger/OpenAPI specification
 * @param {Object} configuration - configuration object
 *
 * @returns {Promise<Object>} Promise that resolves to the JSON schema object
 *
 * @throws Error on dereferencing failure
 */
async function makeSchema(swagger, configuration) {
  // This initialization is to insure that these two keywords
  // appear first in the resulting file -- it is only for aesthetic purposes
  let schema = {
    $schema: null,
    $id: null,
    title: swagger.info.title,
    version: swagger.info.version,
    description: swagger.info.description || 'No description provided',
  };

  // Extract schema
  let schemaPart = null;
  let schemaProperties = {};

  // At this point we can be sure that it's either Swagger 2 or OpenAPI 3
  // as it already has been validated
  if (swagger.swagger) {
    // Swagger 2
    schemaPart = swagger.definitions;
  } else if (swagger.asyncapi) {
    // AsyncAPI 2
    schemaPart = swagger.components.schemas;
    schemaProperties = extractSchemaPropertiesFromAsyncAPI(swagger.components.messages);
  } else {
    // OpenAPI 3
    schemaPart = swagger.components.schemas;
  }

  // Create JSON schema
  schema.$schema = configuration.schema;

  // If no id is given, remove it from the schema -- empty strings are not allowed
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
    ...schemaProperties,
  };

  schema.required = ['schemaVersion'];

  // Find "schema"s in the "paths" -- they will go to the properties key
  helpers.addSchemaProps(swagger, schema.properties);

  // Add all entity defintions
  schema.definitions = schemaPart;

  // Process nullable types
  helpers.convertNullables(schema.definitions);

  // If this is an OpenAPI 3 spec, we need to change all $refs from
  // #/components/schemas to #/definitions
  // this we can do by simply doing text search and replace
  if (swagger.openapi || swagger.asyncapi) {
    let oldSchemaText = JSON.stringify(schema);
    let newSchemaText = oldSchemaText.replace(new RegExp('#/components/schemas', 'g'), '#/definitions');
    schema = JSON.parse(newSchemaText);
  }

  // Resolve $refs if specified
  if (configuration.resolveRefs) {
    try {
      schema = await refParser.parseRefs(schema);
    } catch (err) {
      throw new Error(`Could not resolve $refs\n  ${err}`);
    }
  }

  return schema;
}

function extractSchemaPropertiesFromAsyncAPI(messages) {
  return Array.from(Object.entries(messages)).reduce((r, [key, value]) => {
    if (typeof value.payload === 'object') {
      r[key] = {
        ...value,
        ...value.payload,
      };
      delete r[key].payload;
    }
    return r;
  }, {});
}

module.exports = {
  swagger: () => swagger,
  ingestYAML,
  toJSON,
  makeSchema,
  DESCRIPTION,
};
