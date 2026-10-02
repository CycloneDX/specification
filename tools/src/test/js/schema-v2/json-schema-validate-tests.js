"use strict";

/**
 * validate all schemas for a given version of CycloneDX.
 * call the script via `node -- <this-file> -v <CDX-version>`
 */

import {parseArgs} from "node:util";
import {readFile, stat} from 'node:fs/promises'
import {dirname, basename, join} from 'node:path'
import {fileURLToPath} from 'node:url'

import Ajv2020 from "ajv/dist/2020.js"
import draft7MetaSchema from "ajv/dist/refs/json-schema-draft-07.json" with {type: "json"};
import addFormats from 'ajv-formats'
import addFormats2019 from 'ajv-formats-draft2019'
import {glob} from 'glob'


const _thisDir = dirname(fileURLToPath(import.meta.url))

// region config

const testschemaVersion = (parseArgs({options: {v: {type: 'string', short: 'v'}}}).values.v ?? '').trim()
const schemaRootDir = join(_thisDir, '..', '..', '..', '..', '..', 'schema')
const schemaDir = join(schemaRootDir, testschemaVersion)

const schemaFiles = [join(schemaDir, `cyclonedx-${testschemaVersion}.schema.json`)]
if (process.env['VALIDATE_BUNDLED'] === 'true') {
    schemaFiles.push(join(schemaDir, `cyclonedx-${testschemaVersion}-bundled.schema.json`))
    schemaFiles.push(join(schemaDir, `cyclonedx-${testschemaVersion}-bundled.min.schema.json`))
}

const schemaFilesBundleMatcher = /-bundled/
const schemaModelDir = join(schemaDir, `model`)
const testdataDir = join(_thisDir, '..', '..', 'resources', testschemaVersion)

const schemaGlob = '*.schema.json'

if (testschemaVersion.length === 0) {
    throw new Error('missing testschemaVersion. expected via argument')
}
console.debug('DEBUG | testschemaVersion = ', testschemaVersion);

for (const schemaFile of schemaFiles) {
    if (!await stat(schemaFile).then(s => s.isFile()).catch(() => false)) {
        throw new Error(`missing schemaFile: ${schemaFile}`);
    }
}
console.debug('DEBUG | schemaFiles = ', schemaFiles);

if (!await stat(schemaModelDir).then(s => s.isDirectory()).catch(() => false)) {
    throw new Error(`missing schemaModelDir: ${schemaModelDir}`);
}
console.debug('DEBUG | schemaModelDir = ', schemaModelDir);

// endregion config

const [spdxSchema, cryptoDefsSchema, behaviorTaxonomySchema, perspectivesDefsSchema, schemas, schemaModules] = await Promise.all([
    readFile(join(schemaRootDir, 'spdx.schema.json'), 'utf-8').then(JSON.parse),
    readFile(join(schemaRootDir, 'cryptography-defs.schema.json'), 'utf-8').then(JSON.parse),
    readFile(join(schemaRootDir, 'behavior-taxonomy.schema.json'), 'utf-8').then(JSON.parse),
    readFile(join(schemaRootDir, 'perspectives-defs.schema.json'), 'utf-8').then(JSON.parse),
    Promise.all(schemaFiles.map(
        f => readFile(f, 'utf-8').then(s => [f, JSON.parse(s)])
    )),
    glob(join(schemaModelDir, schemaGlob)).then(fs => Promise.all(fs.map(
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
        keywords: ["meta:enum"],
        // see https://ajv.js.org/options.html#strict-mode-options
        strict: true,
        strictSchema: true,
        strictNumbers: true,
        strictTypes: true,
        strictTuples: true,
        strictRequired: true,
        validateFormats: true,
        allowMatchingProperties: true,
        allowUnionTypes: true,
    });
    // some ref'd schemas mightbe draft-07
    ajv.addMetaSchema(draft7MetaSchema);
    ajv.addSchema(spdxSchema, 'https://cyclonedx.org/schema/spdx.schema.json')
    ajv.addSchema(cryptoDefsSchema, 'https://cyclonedx.org/schema/cryptography-defs.schema.json')
    ajv.addSchema(behaviorTaxonomySchema, 'https://cyclonedx.org/schema/behavior-taxonomy.schema.json')
    ajv.addSchema(perspectivesDefsSchema, 'https://cyclonedx.org/schema/perspectives-defs.schema.json')
    if (!bundled) {
        for (const [f, s] of schemaModules) {
            ajv.addSchema(s, `https://cyclonedx.org/schema/${testschemaVersion}/model/${f}`)
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
    console.log('\n> SchemaFile: ', schemaFile);
    const ajv = getAjv(schemaFilesBundleMatcher.test(basename(schemaFile)))

    console.group(`> compile schema, log warnings ...`)
    try {
        ajv.compile(schema)
    } catch (err) {
        ++errCnt
        console.groupEnd()
        console.error(
            `!!! SCHEMA ERROR:`, String(err),
            '\n   in file:', `file://${schemaFile}`,
        )
        continue
    }
    console.groupEnd()
    console.log('> SCHEMA OK.')
}


console.log('\n\n> found', errCnt, 'errors')
// Exit statuses should be in the range 0 to 254.
// The status 0 is used to terminate the program successfully.
process.exitCode = Math.min(errCnt, 254)

