"use strict";

/**
 * validate all schemas for a given version of CycloneDX.
 * call the script via `node -- <this-file> -v <CDX-version>`
 */


import {parseArgs} from "node:util";
import assert from 'node:assert'
import {readFile, stat} from 'node:fs/promises'
import {dirname, basename, join} from 'node:path'
import {fileURLToPath} from 'node:url'

import {glob} from 'glob'

import {alphaSort} from './_helpers.js'


const _thisDir = dirname(fileURLToPath(import.meta.url))

// region config

const testschemaVersion = (parseArgs({options: {v: {type: 'string', short: 'v'}}}).values.v ?? '').trim()
const schemaRootDir = join(_thisDir, '..', '..', '..', '..', '..', 'schema')
const schemaDir = join(schemaRootDir, testschemaVersion)
const schemaModelDir = join(schemaDir, `model`)

const schemaGlob = '*.schema.json'

if (testschemaVersion.length === 0) {
    throw new Error('missing testschemaVersion. expected via argument')
}
console.debug('DEBUG | testschemaVersion = ', testschemaVersion);

if (!await stat(schemaModelDir).then(s => s.isDirectory()).catch(() => false)) {
    throw new Error(`missing schemaModelDir: ${schemaModelDir}`);
}
console.debug('DEBUG | schemaModelDir = ', schemaModelDir);

const schemaFiles = Object.freeze([
    // test only the source schema, not the bundled for now ...
    join(schemaDir, `cyclonedx-${testschemaVersion}.schema.json`),
    ...(await glob(join(schemaDir, `model`, schemaGlob))).sort(alphaSort)
])
for (const schemaFile of schemaFiles) {
    if (!await stat(schemaFile).then(s => s.isFile()).catch(() => false)) {
        throw new Error(`missing schemaFile: ${schemaFile}`);
    }
}
console.debug('DEBUG | schemaFiles = ', schemaFiles);

// endregion config

// region tests

function assertBomRefRefTypes(schema, schemaFile) {
    // TODO
}

function assertAdditionalPropertiesFalse(schema) {
    // TODO
}

// endregion tests

// region main

const schemas = await Promise.all(schemaFiles.map(
    f => readFile(f).then(s => [f, JSON.parse(s)])
))

for (const [schemaFile, schema] of schemas) {
    console.log('assertBomRefRefTypes in', schemaFile)
    assertBomRefRefTypes(schema, schemaFile)

    console.log('assertAdditionalPropertiesFalse in', schemaFile)
    assertAdditionalPropertiesFalse(schema)
}

// endregion main





