# swagger-yaml-to-json-schema (ytoj)

[![Build Status](https://travis-ci.org/tromgy/swagger-yaml-to-json-schema.png?branch=master)](https://travis-ci.org/tromgy/swagger-yaml-to-json-schema)

[![Known Vulnerabilities](https://snyk.io/test/github/tromgy/swagger-yaml-to-json-schema/badge.svg?targetFile=package.json)](https://snyk.io/test/github/tromgy/swagger-yaml-to-json-schema?targetFile=package.json)

This CLI tool can be used to generate JSON schema from Swagger YAML file.

## Pre-requisites

Node.js version 7.0 (in theory) or newer. Tested with 8.12.0, 10.13.0, 10.14.1

**npm** version 6.1.0 or newer. Tested with 6.1.0 and 6.4.1

## Installation

If you want the tool to be available globally:

```
    npm install ytoj -g
```

or install it locally in your project:

```
    npm install ytoj --save-dev
```

## Usage

The first time you run the tool:

```
    ytoj
```

or (for local installation)

```
    npx ytoj
```

the tool will run interactively collecting some information:

```
Generate JSON schema from Swagger YAML document.

Swagger YAML file:  sample/petstore-simple.yaml
Output JSON schema:  schema/petstore-simple.json
$schema: (http://json-schema.org/draft-07/schema#)  
$id:  http://my.schema.com
Resolve $refs? (n) n
Allow additionalProperties? (n) n

	Input:                sample/petstore-simple.yaml
	Output:               schema/petstore-simple.json
	$schema:              http://json-schema.org/draft-07/schema#
	$id:                  http://my.schema.com
	Resolve $refs:        false
	additionalProperties: false

Does everything look good?  y
Save these settings in ytoj.json?  y
```

If you answer yes to the last question this information will be saved in the configuration file called **ytoj.json**, so the next time the tool is run it can read it from there and will _not_ ask for it again. This way you can incorporate it in a build process.

If you want to go back to interactive mode, just delete **ytoj.json**

## Configuration parameters

- Input: the path to the YAML file containing Swagger specification.
- Output: file containing JSON schema based on Swagger specification.
- **$schema** (required): The URI defining the (meta-)schema for the generated JSON schema. Defaults to draft-07 of JSON schema (http://json-schema.org)
- **$id** (optional): The URI defining the instance of the generated schema. If specified, it is expected to be something that identifies your application/project/organization.
- Resolve **$refs**: Specifies whether to resolve `$ref`s in the schema. Defaults to "no".
- **additionalProperties**: Specifies whether the genereated schema allows `additionalProperties` in JSON instances. Defaults to "no".
