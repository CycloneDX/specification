"use strict";

/**
 * validate all test data for a given version of CycloneDX.
 * call the script via `node -- <this-file> -v <CDX-version>`
 */

import {readFile, stat} from 'node:fs/promises'
import {dirname, basename, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {parseArgs} from 'node:util'

import Ajv2020 from "ajv/dist/2020.js"
import draft7MetaSchema from "ajv/dist/refs/json-schema-draft-07.json" with {type: "json"};
import addFormats from "ajv-formats"
import addFormats2019 from "ajv-formats-draft2019"
import {glob} from 'glob'

import {alphaSort} from './_helpers.js'


const _thisDir = dirname(fileURLToPath(import.meta.url))

// region config

const testschemaVersion = (parseArgs({options: {v: {type: 'string', short: 'v'}}}).values.v ?? '').trim()
const schemaRootDir = join(_thisDir, '..', '..', '..', '..', '..', 'schema')
const schemaDir = join(schemaRootDir, testschemaVersion)
// test only the source schema, not the bundled for now ...
const schemaFile = join(schemaDir, `cyclonedx-${testschemaVersion}.schema.json`)
const schemaModelDir = join(schemaDir, `model`)
const testdataDir = join(_thisDir, '..', '..', 'resources', testschemaVersion)

const schemaGlob = '*.schema.json'

if (testschemaVersion.length === 0) {
    throw new Error('missing testschemaVersion. expected via argument')
}
console.debug('DEBUG | testschemaVersion = ', testschemaVersion);

if (!await stat(schemaFile).then(s => s.isFile()).catch(() => false)) {
    throw new Error(`missing schemaFile: ${schemaFile}`);
}
console.debug('DEBUG | schemaFile = ', schemaFile);

if (!await stat(schemaModelDir).then(s => s.isDirectory()).catch(() => false)) {
    throw new Error(`missing schemaModelDir: ${schemaModelDir}`);
}
console.debug('DEBUG | schemaModelDir = ', schemaModelDir);


if (!await stat(testdataDir).then(s => s.isDirectory()).catch(() => false)) {
    throw new Error(`missing testdataDir: ${testdataDir}`);
}
console.debug('DEBUG | testdataDir = ', testdataDir);

// endregion config

// region validator

const [spdxSchema, cryptoDefsSchema, behaviorTaxonomySchema, bomSchema, bomSchemaModules] = await Promise.all([
    readFile(join(schemaRootDir, 'spdx.schema.json'), 'utf-8').then(JSON.parse),
    readFile(join(schemaRootDir, 'cryptography-defs.schema.json'), 'utf-8').then(JSON.parse),
    readFile(join(schemaRootDir, 'behavior-taxonomy.schema.json'), 'utf-8').then(JSON.parse),
    readFile(schemaFile, 'utf-8').then(JSON.parse),
    glob(join(schemaModelDir, schemaGlob)).then(fs => Promise.all(fs.map(
        f => readFile(f, 'utf-8').then(s => [basename(f), JSON.parse(s)])
    )))
])

const ajv = new Ajv2020({
    verbose: true,
    addUsedSchema: false,
    // not running in strict - this is done in the linter-test already
    strict: false,
    validateFormats: true,
});
// some ref'd schemas mightbe draft-07
ajv.addMetaSchema(draft7MetaSchema);
ajv.addSchema(spdxSchema, 'https://cyclonedx.org/schema/spdx.schema.json')
ajv.addSchema(cryptoDefsSchema, 'https://cyclonedx.org/schema/cryptography-defs.schema.json')
ajv.addSchema(behaviorTaxonomySchema, 'https://cyclonedx.org/schema/behavior-taxonomy.schema.json')
for (const [f, s] of bomSchemaModules) {
    ajv.addSchema(s, `https://cyclonedx.org/schema/${testschemaVersion}/model/${f}`)
}

addFormats(ajv)
addFormats2019(ajv, {formats: ['idn-email']})
// there is just no working implementation for format "iri-reference"
// see https://github.com/luzlab/ajv-formats-draft2019/issues/22
ajv.addFormat('iri-reference', true)

const _ajvValidate = ajv.compile(bomSchema)


/**
 * @param {string} file - file path to validate
 * @return {null|object}
 */
async function validateFile(file) {
    let parsed
    try {
        parsed = JSON.parse(await readFile(file, 'utf-8'))
    } catch (err) {
        throw new Error(`Failed parsing JSON file://${file}`, {cause: err})
    }
    return _ajvValidate(parsed)
        ? null
        : _ajvValidate.errors
}

// endregion validator

let errCnt = 0

for (const file of (await glob(join(testdataDir, 'valid-*.json'))).sort(alphaSort)) {
    console.log('\ntest', file, '...');
    const validationErrors = await validateFile(file)
    if (validationErrors === null) {
        console.log('OK.')
    } else {
        ++errCnt;
        console.error(
            '!!! ERROR: Unexpected validation error',
            '\n  for file:', `file://${file}`,
            '\n     error:', validationErrors
        );
    }
}

for (const file of (await glob(join(testdataDir, 'invalid-*.json'))).sort(alphaSort)) {
    console.log('\ntest', file, '...');
    const validationErrors = await validateFile(file)
    if (validationErrors === null) {
        ++errCnt;
        console.error(
            '!!! ERROR: Missing expected validation error',
            '\n  for file:', `file://${file}`,);

    } else {
        console.log('OK.')
    }
}

console.log('\n\n> found', errCnt, 'errors')
// Exit statuses should be in the range 0 to 254.
// The status 0 is used to terminate the program successfully.
process.exitCode = Math.min(errCnt, 254)
