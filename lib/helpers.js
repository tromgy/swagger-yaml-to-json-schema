'use strict';

const _ = require('lodash');

/**
 * Find all nested sub-objects by the key
 * Credit: Bergi (https://stackoverflow.com/users/1048572/bergi)
 * Borrowed from: https://stackoverflow.com/questions/15642494/find-property-by-name-in-a-deep-object
 *
 * @param {Object} obj - The parent object to search
 * @param {String} key - The key to search for
 *
 * @returns {Array} An array of sub-objects that match the key
 */
function findInNested(obj, key) {
  if (_.has(obj, key)) return [obj]; // array of containing objects

  return _.flatten(
    _.map(obj, (v) => (typeof v === 'object' ? findInNested(v, key) : [])),
    true
  );
}

/**
 * Generate "properties" from Swagger paths
 *
 * @param {Object} swagger - Swagger/OpenAPI specification
 * @param {Object} schemaProps - Schema "properties" object
 */
function addSchemaProps(swagger, schemaProps) {
  try {
    // Find all "schema" sub-objects in Swagger JSON
    const result = findInNested(swagger, 'schema');

    let scalarId = 0;

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
          // For scalar types if we can't find the property name,
          // use the unique number with the type name
          if (!propName) {
            propName = `${container.schema.type}-${++scalarId}`;
          }
        }
      } else {
        propPath = container.schema.$ref;
        propName = propPath.slice(propPath.lastIndexOf('/') + 1);

        // lowercase the first letter
        propName = propName
          .charAt(0)
          .toLocaleLowerCase()
          .concat(propName.slice(1));
      }

      schemaProps[propName] = container.schema;
      schemaProps[propName].description = container.description;
    }
  } catch (err) {
    throw new Error(
      `Could not parse Swagger paths, make sure that each schema that is not a $ref has a type.\n  ${err}`
    );
  }
}

/**
 * Convert Swagger "nullable" to "type": "null" in a JSON schema
 *
 * @param {Object} schemaObj - An Object representing the JSON schema
 */
function convertNullables(schemaObj) {
  const withNullables = findInNested(schemaObj, 'nullable');

  for (let item of withNullables) {
    delete item.nullable;
    item.type = [item.type, 'null'];
  }
}

module.exports = {
  addSchemaProps,
  convertNullables,
};
