'use strict';

const lib = require('./lib');
const validators = require('./lib/validators');

module.exports = {
  /**
   * Convert Swagger/OpenAPI YAML specification to JSON schema
   *
   * @param {String} input - Swagger/OpenAPI specification
   * @param {Object} options - Configuration options
   *
   * @returns {Promise<Object>} A promise that resolves to the JSON schema object
   * @throws {TypeError} Error on invalid input or options
   */
  ytoj: async function(input, options = {}) {
    if (!(typeof input === 'string')) {
      throw new TypeError('Expected the input to be a string.');
    }

    const configuration = {
      schema: 'http://json-schema.org/draft-07/schema#',
      id: '',
      resolveRefs: false,
      additionalProperties: false,
      ...options,
    };

    try {
      validators.$id(configuration.id);
    } catch (e) {
      throw new TypeError('Invalid schema id - must be a URL.');
    }

    const swagger = lib.toJSON(input);

    if (!swagger) {
      throw new TypeError('Cannot convert input to JSON.');
    }

    const result = validators.validateSwagger(swagger);

    if (result.status == validators.validation.ERROR) {
      throw new TypeError(result.msg);
    }

    // If no id is configured, use the one derived from the spec (license URL)
    configuration.id = configuration.id || lib.default$Id();

    return await lib.makeSchema(swagger, configuration);
  },
};
