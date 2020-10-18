'use strict';

const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const test = require('tape-catch');

const api = require('..');

const appCmd = 'bin/ytoj.js';
const configFile = 'ytoj.json';
let configuration = {};

// #region CLI tests

function setup(fixtures) {
  // Default configuration
  configuration = {
    yaml: '',
    json: '',
    schema: 'http://json-schema.org/draft-07/schema#',
    id: 'tel:123-456-7890',
    resolveRefs: false,
    additionalProperties: false,
  };

  // Update configuration with the specific test fixture
  fixtures.forEach((fixture) => {
    configuration[fixture.key] = fixture.value;
  });

  // Write configuration
  fs.writeFileSync(configFile, JSON.stringify(configuration));
}

function setup_invalid_config() {
  fs.writeFileSync(configFile, 'At vero eos et accusamus et iusto odio dignissimos ducimus');
}

function teardown(config) {
  if (config) {
    // Delete the output file, if it exists
    // and remove the output directory
    const output = config.json;

    if (fs.existsSync(output)) {
      fs.unlinkSync(output);

      const outDir = path.dirname(output);

      if (outDir !== '.') {
        fs.rmdirSync(outDir);
      }
    }
  }

  // Delete configuration
  if (fs.existsSync(configFile)) {
    fs.unlinkSync(configFile);
  }
}

// Make sure the teardown happens even if there's an exception in the test
// (caught by tape-catch and reported as test failure)
// "Normal" failures should result in teardown at the end of the test anyway
test.onFailure(teardown);

test('Invalid Configuration', (t) => {
  t.plan(1);

  setup_invalid_config();

  // Expect with colors!
  const expected = '\x1b[31mCould not get configuration:';

  // Start our app as a child process
  cp.execFile('node', [appCmd], (error, childOut, childErr) => {
    if (error) {
      throw error; // Something really unexpected happened
    }

    const actual = childErr.toString();
    t.equal(actual.startsWith(expected), true, 'Should see error when configuration file is invalid.');

    teardown();
  });
});

test('Non-existent YAML File', (t) => {
  t.plan(1);

  const existMeNot = 'never.yaml';

  setup([{ key: 'yaml', value: existMeNot }]);

  // Expect with colors!
  const expected = `\u001b[31mCould not get configuration: Error: \u001b[31mInput file ${existMeNot} is not found.\u001b[39m[39m\n`;

  // Start our app as a child process
  cp.execFile('node', [appCmd], (error, childOut, childErr) => {
    if (error) {
      throw error; // Something really unexpected happened
    }

    const actual = childErr.toString();
    t.equal(actual, expected, 'Should see error when YAML file does not exist.');

    teardown();
  });
});

test('Invalid YAML File', (t) => {
  t.plan(1);

  const invalidAPI = '.travis.yml';

  setup([{ key: 'yaml', value: invalidAPI }]);

  // Expect with colors!
  const expected = `\u001b[31mCould not get configuration: Error: \u001b[31mInput file ${invalidAPI} does not appear to be a Swagger 2 or OpenAPI 3 specification.\u001b[39m[39m\n`;

  // Start our app as a child process
  cp.execFile('node', [appCmd], (error, childOut, childErr) => {
    if (error) {
      throw error; // Something really unexpected happened
    }

    const actual = childErr.toString();
    t.equal(actual, expected, 'Should see error when YAML file is invalid.');

    teardown();
  });
});

test('Output to Current Working Directory', (t) => {
  t.plan(2);

  const input = 'sample/petstore-simple.yaml';
  const output = 'here.json';

  setup([
    { key: 'yaml', value: input },
    { key: 'json', value: output },
  ]);

  // Start our app as a child process
  cp.execFile('node', [appCmd], (error, childOut, childErr) => {
    if (error) {
      throw error; // Something really unexpected happened
    }

    // Verify that no errors reported by ytoj
    t.equals(childErr, '', 'There should not be any errors reported by the program.');

    // Verify that the output path exists
    t.equals(fs.existsSync(output), true, 'Output file should have been created.');

    teardown(configuration);
  });
});

test('Non-existent Output Path', (t) => {
  t.plan(3);

  const input = 'sample/petstore-simple.yaml';
  const output = 'never/never.json';

  setup([
    { key: 'yaml', value: input },
    { key: 'json', value: output },
  ]);

  // Verify that the output path does not yet exist
  t.equals(fs.existsSync(output), false, 'Output directory should not yet exist.');

  // Start our app as a child process
  cp.execFile('node', [appCmd], (error, childOut, childErr) => {
    if (error) {
      throw error; // Something really unexpected happened
    }

    // Verify that no errors reported by ytoj
    t.equals(childErr, '', 'There should not be any errors reported by the program.');

    // Verify that the output path exists
    t.equals(fs.existsSync(output), true, 'Output directory and file should have been created.');

    teardown(configuration);
  });
});

test('Existing Output File', (t) => {
  t.plan(2);

  const originalContent = 'Lorem ipsum dolor sit amet';
  const input = 'sample/petstore-simple.yaml';
  const output = 'out/ever.json';

  setup([
    { key: 'yaml', value: input },
    { key: 'json', value: output },
  ]);

  // Create dummy output file
  fs.mkdirSync(path.dirname(output));
  fs.writeFileSync(output, originalContent);

  // Start our app as a child process
  cp.execFile('node', [appCmd], (error, childOut, childErr) => {
    if (error) {
      throw error; // Something really unexpected happened
    }

    // Verify that no errors reported by ytoj
    t.equals(childErr, '', 'There should not be any errors reported by the program.');

    // Verify that the output file got overwritten
    const newContent = fs.readFileSync(output);
    t.notEquals(originalContent, newContent, 'Output file should have been overwritten.');

    teardown(configuration);
  });
});

test('Invalid $schema', (t) => {
  t.plan(1);

  const input = 'sample/petstore-simple.yaml';
  const output = 'out/nofile.json';

  setup([
    { key: 'yaml', value: input },
    { key: 'json', value: output },
    { key: 'schema', value: 'http://www.example.com' },
  ]);

  // Start our app as a child process
  cp.execFile('node', [appCmd], (error, childOut, childErr) => {
    if (error) {
      throw error; // Something really unexpected happened
    }

    const expected = 'Invalid $schema';
    const actual = childErr.toString();
    t.equal(actual.includes(expected), true, 'Should see error when specified $schema is invalid.');

    teardown(configuration);
  });
});

test('Invalid $id', (t) => {
  t.plan(1);

  const input = 'sample/petstore-simple.yaml';
  const output = 'out/nofile.json';

  setup([
    { key: 'yaml', value: input },
    { key: 'json', value: output },
    { key: 'id', value: 'not.a.uri' },
  ]);

  // Start our app as a child process
  cp.execFile('node', [appCmd], (error, childOut, childErr) => {
    if (error) {
      throw error; // Something really unexpected happened
    }

    const expected = 'Invalid URL';
    const actual = childErr.toString();
    t.equal(actual.includes(expected), true, 'Should see error when specified $id is not a valid URI.');

    teardown(configuration);
  });
});

test('Generate Schema', (t) => {
  t.plan(2);

  const input = 'sample/petstore-simple.yaml';
  const output = 'out/petstore-simple-generated.json';
  const id = 'https://github.com/tromgy/swagger-yaml-to-json-schema';

  setup([
    { key: 'yaml', value: input },
    { key: 'json', value: output },
    { key: 'id', value: id },
  ]);

  // Start our app as a child process
  cp.execFile('node', [appCmd], (error, childOut, childErr) => {
    if (error) {
      throw error; // Something really unexpected happened
    }

    const expected = '';
    const actual = childErr.toString();
    t.equal(actual, expected, 'Should see no errors.');

    // Compare generated schema to the known "good" schema validated by https://www.jsonschemavalidator.net
    const standardSchema = JSON.parse(fs.readFileSync('sample/petstore-simple-schema.json'));
    const generatedSchema = JSON.parse(fs.readFileSync(output));
    t.deepEqual(generatedSchema, standardSchema, 'Generated schema should be the same as known "good" schema.');

    teardown(configuration);
  });
});

test('Generate Schema: additionalProperties === true', (t) => {
  t.plan(2);

  const input = 'sample/petstore-simple.yaml';
  const output = 'out/petstore-simple-generated.json';
  const id = 'https://github.com/tromgy/swagger-yaml-to-json-schema';

  setup([
    { key: 'yaml', value: input },
    { key: 'json', value: output },
    { key: 'id', value: id },
    { key: 'additionalProperties', value: true },
  ]);

  // Start our app as a child process
  cp.execFile('node', [appCmd], (error, childOut, childErr) => {
    if (error) {
      throw error; // Something really unexpected happened
    }

    const expected = '';
    const actual = childErr.toString();
    t.equal(actual, expected, 'Should see no errors.');

    const generatedSchema = JSON.parse(fs.readFileSync(output));
    t.equal(generatedSchema.additionalProperties, true, 'Generated schema should allow additional properties.');

    teardown(configuration);
  });
});

test('Generate Schema: resolve $refs', (t) => {
  t.plan(2);

  const input = 'sample/petstore-simple.yaml';
  const output = 'out/petstore-simple-generated.json';
  const id = 'https://github.com/tromgy/swagger-yaml-to-json-schema';

  setup([
    { key: 'yaml', value: input },
    { key: 'json', value: output },
    { key: 'id', value: id },
    { key: 'resolveRefs', value: true },
  ]);

  // Start our app as a child process
  cp.execFile('node', [appCmd], (error, childOut, childErr) => {
    if (error) {
      throw error; // Something really unexpected happened
    }

    const expected = '';
    const actual = childErr.toString();
    t.equal(actual, expected, 'Should see no errors.');

    const generatedData = fs.readFileSync(output);

    t.equal(generatedData.includes('$ref'), false, 'Generated schema should have no $refs.');

    teardown(configuration);
  });
});

// #endregion CLI tests

// #region API tests

test('API Invalid Options - invalid schema id', async (t) => {
  try {
    await api.ytoj('does not matter', { id: 'my schema' });

    t.fail('The API did not throw an exception on invalid options.'.red);
    t.end();
  } catch (e) {
    t.plan(2);

    t.equal(e.name, 'TypeError', 'Should throw "TypeError".');
    t.equal(
      e.message,
      'Invalid schema id - must be a URL.',
      'The exception should have the error message indicating that the schema id must be a URL.'
    );
  }
});

test('API Invalid Input - not a string', async (t) => {
  const invalidInput = { a: 1 };

  try {
    await api.ytoj(invalidInput);

    t.fail('The API did not throw an exception on invalid input.'.red);
    t.end();
  } catch (e) {
    t.plan(2);

    t.equal(e.name, 'TypeError', 'Should throw "TypeError".');
    t.equal(
      e.message,
      'Expected the input to be a string.',
      'The exception should have the error message indicating expected input.'
    );
  }
});

test('API Invalid Input', async (t) => {
  const invalidInput = 'Eros in cursus turpis massa.';

  try {
    await api.ytoj(invalidInput);

    t.fail('The API did not throw an exception on invalid input.'.red);
    t.end();
  } catch (e) {
    t.plan(2);

    t.equal(e.name, 'TypeError', 'Should throw "TypeError".');
    t.equal(
      e.message,
      'Cannot convert input to JSON.',
      'The exception should have the error message indicating expected input.'
    );
  }
});

test('API Invalid Input - missing info', async (t) => {
  const inputFile = 'sample/petstore-simple.yaml';

  const input = fs.readFileSync(inputFile).toString();

  // Remove description
  const badInput = input.replace(/^info[\s\S]*?MIT(\r\n|\n|\r)/gm, '');

  try {
    await api.ytoj(badInput);

    t.fail('The API did not throw an exception on invalid input.'.red);
    t.end();
  } catch (e) {
    t.plan(2);

    t.equal(e.name, 'TypeError', 'Should throw "TypeError".');
    t.equal(
      e.message,
      'The info object is missing in the Swagger YAML.',
      'The exception should have the error message indicating that the info is missing.'
    );
  }
});

test('API Invalid Input - missing title', async (t) => {
  const inputFile = 'sample/petstore-simple.yaml';

  const input = fs.readFileSync(inputFile).toString();

  // Remove description
  const badInput = input.replace(/.*title.*(\r\n|\n|\r)/g, '');

  try {
    await api.ytoj(badInput);

    t.fail('The API did not throw an exception on invalid input.'.red);
    t.end();
  } catch (e) {
    t.plan(2);

    t.equal(e.name, 'TypeError', 'Should throw "TypeError".');
    t.equal(
      e.message,
      'The title is missing in the Swagger YAML.',
      'The exception should have the error message indicating that the title is missing.'
    );
  }
});

test('API Invalid Input - missing version', async (t) => {
  const inputFile = 'sample/petstore-simple.yaml';

  const input = fs.readFileSync(inputFile).toString();

  // Remove description
  const badInput = input.replace(/.*version.*(\r\n|\n|\r)/g, '');

  try {
    await api.ytoj(badInput);

    t.fail('The API did not throw an exception on invalid input.'.red);
    t.end();
  } catch (e) {
    t.plan(2);

    t.equal(e.name, 'TypeError', 'Should throw "TypeError".');
    t.equal(
      e.message,
      'The version is missing in the Swagger YAML.',
      'The exception should have the error message indicating that the version is missing.'
    );
  }
});

test('API Happy Path', async (t) => {
  t.plan(1);

  const inputFile = 'sample/petstore-simple.yaml';

  const input = fs.readFileSync(inputFile).toString();

  // Compare generated schema to the known "good" schema validated by https://www.jsonschemavalidator.net
  const standardSchema = JSON.parse(fs.readFileSync('sample/petstore-simple-schema.json'));
  const generatedSchema = await api.ytoj(input, {
    id: 'https://github.com/tromgy/swagger-yaml-to-json-schema',
    indent: 8,
  });

  t.deepEqual(generatedSchema, standardSchema, 'Generated schema should be the same as known "good" schema.');
});

// #endregion API tests
