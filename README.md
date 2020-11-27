# swagger-yaml-to-json-schema (ytoj)

[![Codacy Badge](https://api.codacy.com/project/badge/Grade/4dcd37137a0e44a7b3f3933491b04385)](https://app.codacy.com/app/tromgy/swagger-yaml-to-json-schema?utm_source=github.com&utm_medium=referral&utm_content=tromgy/swagger-yaml-to-json-schema&utm_campaign=Badge_Grade_Dashboard)

[![Total alerts](https://img.shields.io/lgtm/alerts/g/tromgy/swagger-yaml-to-json-schema.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/tromgy/swagger-yaml-to-json-schema/alerts/)

[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/tromgy/swagger-yaml-to-json-schema.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/tromgy/swagger-yaml-to-json-schema/context:javascript)

[![Build Status](https://travis-ci.org/tromgy/swagger-yaml-to-json-schema.png?branch=master)](https://travis-ci.org/tromgy/swagger-yaml-to-json-schema)

[![Known Vulnerabilities](https://snyk.io/test/github/tromgy/swagger-yaml-to-json-schema/badge.svg?targetFile=package.json)](https://snyk.io/test/github/tromgy/swagger-yaml-to-json-schema?targetFile=package.json)

This tool can be used to generate the JSON schema from a Swagger version 2 or 3 (OpenAPI) or AsyncAPI 2  YAML file.

## Pre-requisites

Node.js version 7.0 (in theory) or newer. Tested with 8.12.0, 10.13.0, 10.14.1, 13.11.0, and 14.15.1

**npm** version 6.1.0 or newer. Tested with 6.1.0, 6.4.1, 6.14.7, and 6.14.8

## Installation

If you want the tool to be available globally:

```Shell
    npm install ytoj -g
```

or install it locally in your project:

```Shell
    npm install ytoj --save-dev
```

## Usage


### CLI

The first time you run the tool:

```Shell
    ytoj
```

or (if not installed globally)

```Shell
    npx ytoj
```

the tool will run interactively collecting some information:

```Text
Generate JSON schema from Swagger or OpenAPI or AsyncAPI YAML document.

Swagger YAML file:  sample/petstore-simple.yaml
Output JSON schema:  schema/petstore-simple.json
$schema: (http://json-schema.org/draft-07/schema#)
$id: () http://my.schema.com
Resolve $refs? (n) n
Allow additionalProperties? (n) n
Indent size in the output JSON file (2): 3

        Input:                sample/petstore-simple.yaml
        Output:               schema/petstore-simple.json
        $schema:              http://json-schema.org/draft-07/schema#
        $id:                  http://my.schema.com
        Resolve $refs:        false
        additionalProperties: false
        Indent size:          3

Does everything look good (y)?  y
Save these settings in ytoj.json (y)? y
```

If you answer yes to the last question this information will be saved in the configuration file called **ytoj.json**, so the next time the tool is run it can read it from there and will _not_ ask for it again. This way you can incorporate it in a build process.

If you want to go back to the interactive mode, just delete **ytoj.json**

## Configuration parameters

- Input: the path to the YAML file containing Swagger specification.
- Output: file containing JSON schema based on Swagger specification.
- **\$schema** (required): The URI defining the (meta-)schema for the generated JSON schema. Defaults to draft-07 of JSON schema [http://json-schema.org/draft-07/schema#]('http://json-schema.org')
- **\$id** (optional): The URI defining the instance of the generated schema. If specified, it is expected to be something that identifies your application/project/organization.
- Resolve **\$refs**: Specifies whether to resolve `$ref`s in the schema. Defaults to "no".
- **additionalProperties**: Specifies whether the genereated schema allows `additionalProperties` in JSON instances. Defaults to "no".
- **Indent size**: Formatting indent for the output JSON file. Default is 2 (spaces).

### API

The functionality is also available as an API. To use it, `import` or `require` this package,
and then just call the `ytoj` function. Here is an example:

```JavaScript
const { ytoj } = require('ytoj');

async function convertSwagger(input) {
  try {
    const schema = await ytoj(input, { id: 'http://example.com/my-swagger', resolveRefs: true });

    console.log(JSON.stringify(schema, null, 2));
  } catch (e) {
    console.log(e.message);
  }
}
```

#### Syntax

```JavaScript
const schemaObj = await ytoj(yamlString, options);
```

**yamlString**

> A `String` that contains some Swagger/OpenAPI/AsyncAPI YAML specification.

**options**

> An optional `Object` that may supply configuration parameters (all optional):

- `schema` - The URI defining the (meta-)schema for the generated JSON schema. Defaults to draft-07 of JSON schema: [`'http://json-schema.org/draft-07/schema#'`]('http://json-schema.org').
- `id` - The URI defining the instance of the generated schema. If specified, it is expected to be something that identifies your application/project/organization.
- `resolveRefs` - Specifies whether to resolve `$ref`s in the schema. Defaults to `false`.
- `additionalProperties` - Specifies whether the genereated schema allows `additionalProperties` in JSON instances. Defaults to `false`.

The function returns a `Promise<Object>`, where the `Object` represents the JSON schema corresponding to the input Swagger/OpenAPI specification.
Note that the function is `async`, and so it must be called with `await` within a `try` block or with `.then().catch()`. It throws
in case of invalid input or options.
