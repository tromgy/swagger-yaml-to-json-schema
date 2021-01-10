'use strict';

const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const test = require('tape-catch');

const api = require('..');

const appCmd = 'bin/ytoj.js';
const configFile = 'ytoj.json';
const customConfigFile = 'custom.json';
let configuration = {};

function setup(fixture, custom = false) {
  // Default configuration
  configuration = {
    yaml: '',
    json: '',
    schema: 'http://json-schema.org/draft-07/schema#',
    id: 'tel:123-456-7890',
    resolveRefs: false,
    additionalProperties: false,
  };

  // Merge in supplied config
  configuration = { ...configuration, ...fixture };

  // Write configuration
  fs.writeFileSync(custom ? customConfigFile : configFile, JSON.stringify(configuration));
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

  if (fs.existsSync(customConfigFile)) {
    fs.unlinkSync(customConfigFile);
  }
}

// #region interactive mode tests

// Make sure the teardown happens even if there's an exception in the test
// (caught by tape-catch and reported as test failure)
// "Normal" failures should result in teardown at the end of the test anyway
test.onFailure(teardown);

test('Invalid Configuration', (t) => {
  t.plan(1);

  setup_invalid_config();

  // Expect with colors!
  const expected = '\x1b[31mCannot read configuration:';

  // Start our app as a child process
  cp.execFile('node', [appCmd], (error, _, childErr) => {
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

  setup({ yaml: existMeNot });

  // Expect with colors!
  const expected = `\x1b[31mInvalid configuration: Error: \x1b[31mInput file ${existMeNot} is not found.\x1b[39m[39m\n`;

  // Start our app as a child process
  cp.execFile('node', [appCmd], (error, _, childErr) => {
    if (error) {
      throw error; // Something really unexpected happened
    }

    t.equal(childErr.toString(), expected, 'Should see error when YAML file does not exist.');

    teardown();
  });
});

test('Invalid YAML File', (t) => {
  t.plan(1);

  const invalidAPI = '.travis.yml';

  setup({ yaml: invalidAPI });

  // Expect with colors!
  const expected = `\x1b[31mInvalid configuration: Error: \x1b[31mInput file ${invalidAPI} does not appear to be a Swagger 2 or OpenAPI 3 specification.\x1b[39m[39m\n`;

  // Start our app as a child process
  cp.execFile('node', [appCmd], (error, _, childErr) => {
    if (error) {
      throw error; // Something really unexpected happened
    }

    t.equal(childErr.toString(), expected, 'Should see error when YAML file is invalid.');

    teardown();
  });
});

test('Output to Current Working Directory', (t) => {
  t.plan(2);

  const output = 'here.json';

  setup({ yaml: 'sample/petstore-simple.yaml', json: output });

  // Start our app as a child process
  cp.execFile('node', [appCmd], (error, _, childErr) => {
    if (error) {
      throw error; // Something really unexpected happened
    }

    // Verify that no errors reported by ytoj
    t.equals(childErr.toString(), '', 'There should not be any errors reported by the program.');

    // Verify that the output path exists
    t.equals(fs.existsSync(output), true, 'Output file should have been created.');

    teardown(configuration);
  });
});

test('Non-existent Output Path', (t) => {
  t.plan(3);

  const output = 'never/never.json';

  setup({ yaml: 'sample/petstore-simple.yaml', json: output });

  // Verify that the output path does not yet exist
  t.equals(fs.existsSync(output), false, 'Output directory should not yet exist.');

  // Start our app as a child process
  cp.execFile('node', [appCmd], (error, _, childErr) => {
    if (error) {
      throw error; // Something really unexpected happened
    }

    // Verify that no errors reported by ytoj
    t.equals(childErr.toString(), '', 'There should not be any errors reported by the program.');

    // Verify that the output path exists
    t.equals(fs.existsSync(output), true, 'Output directory and file should have been created.');

    teardown(configuration);
  });
});

test('Existing Output File', (t) => {
  t.plan(2);

  const originalContent = 'Lorem ipsum dolor sit amet';
  const output = 'out/ever.json';

  setup({ yaml: 'sample/petstore-simple.yaml', json: output });

  // Create dummy output file
  fs.mkdirSync(path.dirname(output));
  fs.writeFileSync(output, originalContent);

  // Start our app as a child process
  cp.execFile('node', [appCmd], (error, _, childErr) => {
    if (error) {
      throw error; // Something really unexpected happened
    }

    // Verify that no errors reported by ytoj
    t.equals(childErr.toString(), '', 'There should not be any errors reported by the program.');

    // Verify that the output file got overwritten
    const newContent = fs.readFileSync(output);
    t.notEquals(originalContent, newContent, 'Output file should have been overwritten.');

    teardown(configuration);
  });
});

test('Invalid $schema', (t) => {
  t.plan(1);

  setup({ yaml: 'sample/petstore-simple.yaml', json: 'out/nofile.json', schema: 'http://www.example.com' });

  // Start our app as a child process
  cp.execFile('node', [appCmd], (error, _, childErr) => {
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

  setup({ yaml: 'sample/petstore-simple.yaml', json: 'out/nofile.json', id: 'not.a.uri' });

  // Start our app as a child process
  cp.execFile('node', [appCmd], (error, _, childErr) => {
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

  const output = 'out/petstore-simple-generated.json';

  setup({
    yaml: 'sample/petstore-simple.yaml',
    json: output,
    id: 'https://github.com/tromgy/swagger-yaml-to-json-schema',
  });

  // Start our app as a child process
  cp.execFile('node', [appCmd], (error, _, childErr) => {
    if (error) {
      throw error; // Something really unexpected happened
    }

    t.equal(childErr.toString(), '', 'Should see no errors.');

    // Compare generated schema to the known "good" schema validated by https://www.jsonschemavalidator.net
    const standardSchema = JSON.parse(fs.readFileSync('sample/petstore-simple-schema.json'));
    const generatedSchema = JSON.parse(fs.readFileSync(output));
    t.deepEqual(generatedSchema, standardSchema, 'Generated schema should be the same as known "good" schema.');

    teardown(configuration);
  });
});

test('Generate Schema: additionalProperties === true', (t) => {
  t.plan(2);

  const output = 'out/petstore-simple-generated.json';

  setup({
    yaml: 'sample/petstore-simple.yaml',
    json: output,
    id: 'https://github.com/tromgy/swagger-yaml-to-json-schema',
    additionalProperties: true,
  });

  // Start our app as a child process
  cp.execFile('node', [appCmd], (error, _, childErr) => {
    if (error) {
      throw error; // Something really unexpected happened
    }

    t.equal(childErr.toString(), '', 'Should see no errors.');

    const generatedSchema = JSON.parse(fs.readFileSync(output));
    t.equal(generatedSchema.additionalProperties, true, 'Generated schema should allow additional properties.');

    teardown(configuration);
  });
});

test('Generate Schema: resolve $refs', (t) => {
  t.plan(2);

  const output = 'out/petstore-simple-generated.json';

  setup({
    yaml: 'sample/petstore-simple.yaml',
    json: output,
    id: 'https://github.com/tromgy/swagger-yaml-to-json-schema',
    resolveRefs: true,
  });

  // Start our app as a child process
  cp.execFile('node', [appCmd], (error, _, childErr) => {
    if (error) {
      throw error; // Something really unexpected happened
    }

    t.equal(childErr.toString(), '', 'Should see no errors.');

    const generatedData = fs.readFileSync(output).toString();

    t.equal(generatedData.includes('$ref'), false, 'Generated schema should have no $refs.');

    teardown(configuration);
  });
});

// #endregion interactive mode tests

// #region CLI tests

test('Complete command line', (t) => {
  t.plan(6);

  const input = 'sample/petstore-simple.yaml';
  const output = 'out/petstore-simple-generated.json';
  const id = 'https://github.com/tromgy/swagger-yaml-to-json-schema';
  const fakeSchema = 'http://json-schema.org/draft-999/fake-schema#';

  // Start our app as a child process
  cp.execFile(
    'node',
    [appCmd, '-i', input, '-o', output, '-s', fakeSchema, '-d', id, '-r', '-a', '-t', '4'],
    (error, _, childErr) => {
      if (error) {
        throw error; // Something really unexpected happened
      }

      t.equal(childErr.toString(), '', 'Should see no errors.');

      const generatedData = fs.readFileSync(output).toString();

      t.notEqual(
        generatedData.match(/{[^] {4}"\$schema"/),
        null,
        'Generated schema JSON should be indented as specified on the command line'
      );

      t.equal(generatedData.includes('$ref'), false, 'Generated schema should have no $refs.');

      const generatedSchema = JSON.parse(generatedData);
      t.equal(generatedSchema.additionalProperties, true, 'Generated schema should allow additional properties.');
      t.equal(generatedSchema.$id, id, 'Generated schema should have an id set that was set on the command line');
      t.equal(
        generatedSchema.$schema,
        fakeSchema,
        'Generated schema should have $schema that was set on the command line'
      );

      teardown(configuration);
    }
  );
});

test('Save the command line parameters in the configuration file', (t) => {
  t.plan(4);

  const config = {
    yaml: 'sample/petstore-simple.yaml',
    json: 'sample/petstore-simple.json',
    schema: 'http://json-schema.org/draft-07/schema#',
    id: 'http://petstore.example.com',
    resolveRefs: true,
    additionalProperties: true,
    indent: 3,
  };

  const args = [
    appCmd,
    '--input',
    config.yaml,
    '--output',
    config.json,
    '--schema',
    config.schema,
    '--id',
    config.id,
    config.resolveRefs && '--resolve-refs',
    config.additionalProperties && '--additional-properties',
    '--indent',
    config.indent.toString(10),
    '--save-settings',
  ];

  // Scenario 1: saving from the command line to the default config file

  // Start our app as a child process
  cp.execFile('node', args, (error, _, childErr) => {
    if (error) {
      throw error; // Something really unexpected happened
    }

    t.equal(childErr.toString(), '', 'Should see no errors.');

    const savedConfig = JSON.parse(fs.readFileSync(configFile));

    t.deepEqual(savedConfig, config, 'Saved configuration should match given command line parameters');
  });

  // Scenario 2: Saving from the command line to a custom config file

  // Start our app as a child process
  cp.execFile('node', [...args, '-c', customConfigFile], (error, _, childErr) => {
    if (error) {
      throw error; // Something really unexpected happened
    }

    t.equal(childErr.toString(), '', 'Should see no errors.');

    const savedConfig = JSON.parse(fs.readFileSync(customConfigFile));

    t.deepEqual(savedConfig, config, 'Saved configuration should match given command line parameters');

    teardown(configuration);
  });
});

test('Read configuration file specified on the command line', (t) => {
  t.plan(2);

  const output = 'out/petstore-simple-generated.json';

  // Setup custom config
  setup(
    {
      yaml: 'sample/petstore-simple.yaml',
      json: output,
      id: 'https://github.com/tromgy/swagger-yaml-to-json-schema',
    },
    true
  );

  // Start our app as a child process
  cp.execFile('node', [appCmd, '-c', customConfigFile], (error, _, childErr) => {
    if (error) {
      throw error; // Something really unexpected happened
    }

    t.equal(childErr.toString(), '', 'Should see no errors.');

    // Compare generated schema to the known "good" schema validated by https://www.jsonschemavalidator.net
    const standardSchema = JSON.parse(fs.readFileSync('sample/petstore-simple-schema.json'));
    const generatedSchema = JSON.parse(fs.readFileSync(output));
    t.deepEqual(generatedSchema, standardSchema, 'Generated schema should be the same as known "good" schema.');

    teardown(configuration);
  });
});

test('Invalid configuration - no input file', (t) => {
  t.plan(1);

  const expected = 'Error: Command failed';
  const output = 'out/petstore-simple-generated.json';
  const id = 'https://github.com/tromgy/swagger-yaml-to-json-schema';
  const fakeSchema = 'http://json-schema.org/draft-999/fake-schema#';

  // Start our app as a child process
  cp.execFile('node', [appCmd, '-o', output, '-s', fakeSchema, '-d', id, '-r', '-a', '-t', '4'], (error) => {
    const actual = error.toString();

    t.equal(actual.startsWith(expected), true, 'Should see error when the configuration file is invalid.');

    teardown();
  });
});

test('Invalid configuration - no output file', (t) => {
  t.plan(1);

  const expected = 'Error: Command failed';
  const input = 'sample/petstore-simple.yaml';
  const id = 'https://github.com/tromgy/swagger-yaml-to-json-schema';
  const fakeSchema = 'http://json-schema.org/draft-999/fake-schema#';

  // Start our app as a child process
  cp.execFile('node', [appCmd, '-i', input, '-s', fakeSchema, '-d', id, '-r', '-a', '-t', '4'], (error) => {
    const actual = error.toString();

    t.equal(actual.startsWith(expected), true, 'Should see error when the configuration file is invalid.');

    teardown();
  });
});

test('Invalid configuration - invalid $schema', (t) => {
  t.plan(1);

  const expected =
    '\x1b[31mInvalid configuration: Error: \x1b[31mInvalid $schema -- must be a URL starting with "http://json-schema.org".\x1b[39m\x1b[39m\n';
  const input = 'sample/petstore-simple.yaml';
  const output = 'out/petstore-simple-generated.json';
  const id = 'https://github.com/tromgy/swagger-yaml-to-json-schema';
  const fakeSchema = 'http://fake-json-schema.org/draft-999/fake-schema#';

  // Start our app as a child process
  cp.execFile(
    'node',
    [appCmd, '-i', input, '-o', output, '-s', fakeSchema, '-d', id, '-r', '-a', '-t', '4'],
    (error, _, childErr) => {
      if (error) {
        throw error; // Something really unexpected happened
      }

      t.equal(childErr.toString(), expected, 'Should an see error that the schema is invalid.');

      teardown();
    }
  );
});

test('Invalid configuration - invalid $id', (t) => {
  t.plan(1);

  const expected = '\x1b[31mInvalid configuration: Error: \x1b[31mInvalid URL: fake-id\x1b[39m\x1b[39m\n';
  const input = 'sample/petstore-simple.yaml';
  const output = 'out/petstore-simple-generated.json';
  const fakeId = 'fake-id';
  const fakeSchema = 'http://json-schema.org/draft-999/fake-schema#';

  // Start our app as a child process
  cp.execFile(
    'node',
    [appCmd, '-i', input, '-o', output, '-s', fakeSchema, '-d', fakeId, '-r', '-a', '-t', '4'],
    (error, _, childErr) => {
      if (error) {
        throw error; // Something really unexpected happened
      }

      t.equal(childErr.toString(), expected, 'Should an see error that the schema is invalid.');

      teardown();
    }
  );
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

test('API Happy Path AsyncAPI', async (t) => {
  t.plan(1);

  const inputFile = 'sample/asyncapi.yaml';

  const input = fs.readFileSync(inputFile).toString();

  // Compare generated schema to the known "good" schema validated by https://www.jsonschemavalidator.net
  const standardSchema = JSON.parse(fs.readFileSync('sample/asyncapi.json'));
  const generatedSchema = await api.ytoj(input, {
    id: 'https://github.com/tromgy/swagger-yaml-to-json-schema',
    indent: 8,
  });
  t.deepEqual(generatedSchema, standardSchema, 'Generated schema should be the same as known "good" schema.');
});

test('API Happy Path AsyncAPI resolve refs', async (t) => {
  t.plan(1);

  const inputFile = 'sample/asyncapi_ref.yaml';

  const input = fs.readFileSync(inputFile).toString();

  // Compare generated schema to the known "good" schema validated by https://www.jsonschemavalidator.net
  const standardSchema = JSON.parse(fs.readFileSync('sample/asyncapi_ref.json'));
  const generatedSchema = await api.ytoj(input, {
    id: 'https://github.com/tromgy/swagger-yaml-to-json-schema',
    indent: 8,
    resolveRefs: true,
  });
  t.deepEqual(generatedSchema, standardSchema, 'Generated schema should be the same as known "good" schema.');
});

// #endregion API tests
