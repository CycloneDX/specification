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
const testBundledOnly = process.env['TEST_BUNDLED_ONLY'] === 'true'
const testBundled = testBundledOnly || process.env['TEST_BUNDLED'] === 'true'

const schemaRootDir = join(_thisDir, '..', '..', '..', '..', '..', 'schema')
const schemaDir = join(schemaRootDir, testschemaVersion)
const schemaFilesBundleMatcher = Object.freeze(/-bundled/)
const schemaModulesDir = join(schemaDir, `modules`)
const testdataDir = join(_thisDir, '..', '..', 'resources', testschemaVersion)
const schemaGlob = '*.schema.json'

if (testschemaVersion.length === 0) {
    throw new Error('missing testschemaVersion. expected via argument')
}
console.debug('DEBUG | testschemaVersion = ', testschemaVersion);

const schemaFiles = []
if (!testBundledOnly) {
    schemaFiles.push(
        join(schemaDir, `cyclonedx-${testschemaVersion}.schema.json`)
    )
}
if (testBundled) {
    schemaFiles.push(
        join(schemaDir, `cyclonedx-${testschemaVersion}-bundled.schema.json`),
        join(schemaDir, `cyclonedx-${testschemaVersion}-bundled.min.schema.json`)
    )
}
Object.freeze(schemaFiles)
for (const schemaFile of schemaFiles) {
    if (!await stat(schemaFile).then(s => s.isFile()).catch(() => false)) {
        throw new Error(`missing schemaFile: ${schemaFile}`)
    }
}
console.debug('DEBUG | schemaFiles = ', schemaFiles)

if (!await stat(schemaModulesDir).then(s => s.isDirectory()).catch(() => false)) {
    throw new Error(`missing schemaModulesDir: ${schemaModulesDir}`);
}
console.debug('DEBUG | schemaModulesDir = ', schemaModulesDir);


if (!await stat(testdataDir).then(s => s.isDirectory()).catch(() => false)) {
    throw new Error(`missing testdataDir: ${testdataDir}`);
}
console.debug('DEBUG | testdataDir = ', testdataDir);

// endregion config

const [spdxSchema, cryptoDefsSchema, behaviorTaxonomySchema, schemas, schemaModules] = await Promise.all([
    readFile(join(schemaRootDir, 'spdx.schema.json'), 'utf-8').then(JSON.parse),
    readFile(join(schemaRootDir, 'cryptography-defs.schema.json'), 'utf-8').then(JSON.parse),
    readFile(join(schemaRootDir, 'behavior-taxonomy.schema.json'), 'utf-8').then(JSON.parse),
    Promise.all(schemaFiles.map(
        f => readFile(f, 'utf-8').then(s => [f, JSON.parse(s)])
    )),
    testBundledOnly ? [] : glob(join(schemaModulesDir, schemaGlob)).then(fs => Promise.all(fs.map(
        f => readFile(f, 'utf-8').then(s => [f, JSON.parse(s)])
    )))
])

/**
 * @param {boolean} bundled
 * @param {boolean|"log"} strict
 * @return {Ajv}
 */
function getAjv(bundled) {
    // see https://ajv.js.org/options.html
    const ajv = new Ajv2020({
        verbose: true,
        addUsedSchema: false,
        // not running in strict - this is done in the "validate" test already
        strict: false,
        validateFormats: true,
    });
    // some ref'd schemas might be of draft-07
    ajv.addMetaSchema(draft7MetaSchema);
    ajv.addSchema(spdxSchema, 'https://cyclonedx.org/schema/spdx.schema.json')
    ajv.addSchema(cryptoDefsSchema, 'https://cyclonedx.org/schema/cryptography-defs.schema.json')
    ajv.addSchema(behaviorTaxonomySchema, 'https://cyclonedx.org/schema/behavior-taxonomy.schema.json')
    if (!bundled) {
        for (const [f, s] of schemaModules) {
            console.log(f)
            ajv.addSchema(s, `https://cyclonedx.org/schema/${testschemaVersion}/modules/${basename(f)}`)
        }
    }
    addFormats(ajv)
    addFormats2019(ajv, {formats: ['idn-email']})
    // there is just no working implementation for format "iri-reference"
    // see https://github.com/luzlab/ajv-formats-draft2019/issues/22
    ajv.addFormat('iri-reference', true)
    return ajv
}

let errCnt = 0
for (const [schemaFile, schema] of schemas) {
    console.log()
    console.group('schemaFile:', schemaFile)

    // region validator
    const _ajvValidate = getAjv(
        schemaFilesBundleMatcher.test(basename(schemaFile))
    ).compile(schema)
    /**
     * @param {string} file - file path to validate
     * @return {null|object}
     */
    const validateFile = async (file) => {
        let parsed
        try {
            parsed = JSON.parse(await readFile(file, 'utf-8'))
        } catch (err) {
            throw new Error(`Failed parsing JSON ${file}`, {cause: err})
        }
        return _ajvValidate(parsed)
            ? null
            : _ajvValidate.errors
    }

    // endregion validator

    for (const file of (await glob(join(testdataDir, 'valid-*.json'))).sort(alphaSort)) {
        console.log('\ntest', file, '...');
        const validationErrors = await validateFile(file)
        if (validationErrors === null) {
            console.log('OK.')
        } else {
            ++errCnt;
            console.error(
                '!!! ERROR: Unexpected validation error',
                '\n    schema:', schemaFile,
                '\n  for file:', file,
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
                '\n  for file:', file)
        } else {
            console.log('OK.')
        }
    }

    console.groupEnd()
}

console.log('\n\n> found', errCnt, 'errors')
// Exit statuses should be in the range 0 to 254.
// The status 0 is used to terminate the program successfully.
process.exitCode = Math.min(errCnt, 254)
