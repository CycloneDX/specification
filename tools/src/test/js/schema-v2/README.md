# tests the CycloneDX JSON schemas

uses <https://ajv.js.org/> for validation of a schema
and for functional tests against test resources.

## requirements

* node >=26.0

## setup

```shell
npm install
```

## usage

Regular set of npm tests scripts.

Env var `TEST_BUNDLED` controls whether the bundled schemafiles shall be checked, too. Value must be `true` to enable it.  
Env var `TEST_BUNDLED_ONLY` controls whether only the bundled schemafiles shall be checked. Value must be `true` to enable it. Implies `TEST_BUNDLED=true`.

examples:
```shell
export TEST_BUNDLED=true
npm test # run all tests for all schemas
npm run test:v2.0 # run all tests for cyclonedx-2.0
```

