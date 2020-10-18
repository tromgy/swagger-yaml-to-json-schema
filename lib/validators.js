'use strict';

require('colors');
const fs = require('fs');
const path = require('path');
const URL = require('url').URL;

const lib = require('./index');

let default$id = '';

const validation = {
  OK: 0,
  WARNING: 1,
  ERROR: 2,
};

/**
 * Read and validate the input YAML file
 *
 * @param {String} value - YAML file name, it should exist and be a valid Swagger/OpenAPI specificaiton
 *
 * @returns {String} value that was passed in
 *
 * @throws Error on validation failure
 */
function validateYAMLFile(value) {
  if (fs.existsSync(value)) {
    const swagger = lib.ingestYAML(value);

    if (swagger) {
      const result = validateSwagger(swagger);

      if (result.status === validation.ERROR) {
        throw new Error(result.msg.red);
      }

      if (result.status === validation.WARNING) {
        // This function is only used from the CLI
        console.log(result.msg.yellow);
      }

      return value;
    } else {
      throw new Error(`Input file ${value} does not appear to be a Swagger 2 or OpenAPI 3 specification.`.red);
    }
  }

  throw new Error(`Input file ${value} is not found.`.red);
}

/**
 * Validate output JSON file path
 *
 * @param {String} value - output file path to validate
 *
 * @returns {String} value that was passed in
 *
 * @throws Error on validation failure
 */
function validateJSONFile(value) {
  try {
    path.parse(value);
  } catch (typeErr) {
    throw new Error(typeErr.message.red);
  }
  return value;
}

/**
 * Validate JSON schema URL
 *
 * @param {String} value - JSON schema specification URL, it should start with 'http://json-schema.org'
 *
 * @returns {String} value that was passed in
 *
 * @throws Error on validation failure
 */
function validate$Schema(value) {
  if (value.startsWith('http://json-schema.org/')) {
    return value;
  }
  throw new Error('Invalid $schema -- must be a URL starting with "http://json-schema.org".'.red);
}

/**
 * Validate schema $id
 *
 * @param {String} value - schema id to validate, should be a valid URL
 *
 * @returns {String} value that was passed in
 *
 * @throws Error on validation failure
 */
function validate$Id(value) {
  if (value && value.length > 0) {
    try {
      new URL(value); // only for validation
    } catch (typeErr) {
      throw new Error(typeErr.message.red);
    }
  }

  return value;
}

/**
 * Validate JSON file indentation
 *
 * @param {String} value - Indent value for the JSON file, should be a string representing a number 0...10
 *
 * @returns {String} value that was passed in
 *
 * @throws Error on validation failure
 */
function validateIndent(value) {
  if (value) {
    const result = parseInt(value);

    if (isNaN(result)) {
      throw new TypeError('Indent is not a number.'.red);
    }

    if (result < 0 || result > 10) {
      throw new Error('Indent must be a positive number no larger than 10.'.red);
    }

    return value;
  } else if (value !== 0) {
    // If it is not explicitly set to zero, return the default
    return 2;
  }
}

/**
 * Swagger validation
 *
 * @param {Object} swagger - JSON representation of Swagger/OpenAPI specification
 *
 * @returns {Object} An Object { status: number, msg: string }
 */
function validateSwagger(swagger) {
  const result = { status: validation.OK, msg: '' };

  // Get the metadata
  if (swagger.info) {
    // Title is required
    if (!swagger.info.title) {
      result.status = validation.ERROR;
      result.msg = 'The title is missing in the Swagger YAML.';
    }

    // Description is not required
    if (!swagger.info.description) {
      result.status = validation.WARNING;
      result.msg = 'The description is missing in the Swagger YAML.';
    }

    // Version is required
    if (!swagger.info.version) {
      result.status = validation.ERROR;
      result.msg = 'The version is missing in the Swagger YAML.';
    }

    // Try to guess the URL to use as the default schema $id from the license spec
    if (swagger.info.license) {
      default$id = swagger.info.license.url || '';
    }
  } else {
    result.status = validation.ERROR;
    result.msg = 'The info object is missing in the Swagger YAML.';
  }

  return result;
}

module.exports = {
  default$Id: () => default$id,
  validation,
  yamlFile: validateYAMLFile,
  jsonFile: validateJSONFile,
  $schema: validate$Schema,
  $id: validate$Id,
  indent: validateIndent,
  validateSwagger: validateSwagger,
};
