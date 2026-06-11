"use strict";

/**
 * validate all test data for a given version of CycloneDX.
 * call the script via `node <this-file> -v <CDX-version>`
 */

import {readFile, stat} from 'node:fs/promises'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {parseArgs} from 'node:util'

import addFormats from "ajv-formats"
import addFormats2019 from "ajv-formats-draft2019"
import {globSync} from 'glob'


const _thisDir = dirname(fileURLToPath(import.meta.url))

// region config

const testschemaVersion = (parseArgs({options: {v: {type: 'string', short: 'v'}}}).values.v ?? '').trim()
const schemaDir = join(_thisDir, '..', '..', '..', '..', 'schema')
// 2.0 uses bundled schema (draft 2020-12, no external $refs); 1.x uses schema/bom-<v>.schema.json
const schemaFile = testschemaVersion === '2.0'
    ? join(schemaDir, '2.0', 'cyclonedx-2.0-bundled.schema.json')
    : join(schemaDir, `bom-${testschemaVersion}.schema.json`)
const testdataDir = join(_thisDir, '..', 'resources', testschemaVersion)

if (testschemaVersion.length === 0) {
    throw new Error('missing testschemaVersion. expected via argument')
}
console.debug('DEBUG | testschemaVersion = ', testschemaVersion);

if (!await stat(schemaFile).then(s => s.isFile()).catch(() => false)) {
    throw new Error(`missing schemaFile: ${schemaFile}`);
}
console.debug('DEBUG | schemaFile = ', schemaFile);

if (!await stat(testdataDir).then(s => s.isDirectory()).catch(() => false)) {
    throw new Error(`missing testdataDir: ${testdataDir}`);
}
console.debug('DEBUG | testdataDir = ', testdataDir);

// endregion config

// region validator

// 2.0 schema uses draft 2020-12; 1.x use draft-07. Use the matching Ajv build.
const Ajv = testschemaVersion === '2.0'
    ? (await import('ajv/dist/2020.js')).default
    : (await import('ajv')).default

const [spdxSchema, jsfSchema, cryptoDefsSchema, bomSchema] = await Promise.all([
    readFile(join(schemaDir, 'spdx.schema.json'), 'utf-8').then(JSON.parse),
    readFile(join(schemaDir, 'jsf-0.82.schema.json'), 'utf-8').then(JSON.parse),
    readFile(join(schemaDir, 'cryptography-defs.schema.json'), 'utf-8').then(JSON.parse),
    readFile(schemaFile, 'utf-8').then(JSON.parse)
])

// Register each ref schema under both http and https so refs resolve regardless of base $id scheme.
const schemasObj = {
    'http://cyclonedx.org/schema/spdx.schema.json': spdxSchema,
    'https://cyclonedx.org/schema/spdx.schema.json': spdxSchema,
    'http://cyclonedx.org/schema/jsf-0.82.schema.json': jsfSchema,
    'https://cyclonedx.org/schema/jsf-0.82.schema.json': jsfSchema,
    'http://cyclonedx.org/schema/cryptography-defs.schema.json': cryptoDefsSchema,
    'https://cyclonedx.org/schema/cryptography-defs.schema.json': cryptoDefsSchema,
}
const ajv = new Ajv({
    // not running in strict - this is done in the linter-test already
    strict: false,
    validateFormats: true,
    addUsedSchema: false,
    // Disable schema meta-validation for 2.0 harness to allow draft-07 referenced schemas to be registered under Ajv2020.
    ...(testschemaVersion === '2.0' && { validateSchema: false }),
    schemas: schemasObj
})
addFormats(ajv)
addFormats2019(ajv, {formats: ['idn-email']})
// there is just no working implementation for format "iri-reference"
// see https://github.com/luzlab/ajv-formats-draft2019/issues/22
ajv.addFormat('iri-reference', true)
if (testschemaVersion === '1.2') {
    // CycloneDX 1.2 had a wrong undefined format `string`.
    // Let's ignore this format only for this special version.
    ajv.addFormat('string', true)
}
const _ajvValidate = ajv.compile(bomSchema)

/**
 * @param {string} file - file path to validate
 * @return {null|object}
 */
async function validateFile(file) {
    return _ajvValidate(await readFile(file, 'utf-8').then(JSON.parse))
        ? null
        : _ajvValidate.errors
}

// endregion validator

let errCnt = 0

for (const file of globSync(join(testdataDir, 'valid-*.json'))) {
    console.log('\ntest', file, '...');
    const validationErrors = await validateFile(file)
    if (validationErrors === null) {
        console.log('OK.')
    } else {
        ++errCnt;
        console.error('ERROR: Unexpected validation error for file:', file);
        console.error(validationErrors)
    }
}

for (const file of globSync(join(testdataDir, 'invalid-*.json'))) {
    console.log('\ntest', file, '...');
    const validationErrors = await validateFile(file)
    if (validationErrors === null) {
        ++errCnt;
        console.error('ERROR: Missing expected validation error for file:', file);

    } else {
        console.log('OK.')
    }
}


// Exit statuses should be in the range 0 to 254.
// The status 0 is used to terminate the program successfully.
process.exitCode = Math.min(errCnt, 254)
