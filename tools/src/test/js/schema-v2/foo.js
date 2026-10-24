import {readFileSync} from 'node:fs';

import  Ajv2020 from "ajv/dist/2020.js";

const ajv = new Ajv2020({ allErrors: true });

const schema = JSON.parse(readFileSync('/home/flow/Documents/Coding/cyclonedx-spec/tools/src/main/js/bundler/test/snapshot/main-bundled.schema.json', 'utf8'));

if (ajv.validateSchema(schema)) {
    console.log("The schema is valid");
} else {
    console.error("Invalid schema:", ajv.errors);
}

