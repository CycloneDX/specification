"use strict";

import assert from 'node:assert'
import {readFile} from 'node:fs/promises'
import {dirname, basename, join} from 'node:path'
import {fileURLToPath} from 'node:url'

import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import addFormats2019 from 'ajv-formats-draft2019'
import {glob} from 'glob'

// region config

const bomSchemasGlob = 'bom-*.schema.json'
const schemaDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'schema')

// endregion config

const [spdxSchema, jsfSchema, bomSchemas] = await Promise.all([
    readFile(join(schemaDir, 'spdx.schema.json'), 'utf-8').then(JSON.parse),
    readFile(join(schemaDir, 'jsf-0.82.schema.json'), 'utf-8').then(JSON.parse),
    glob(join(schemaDir, bomSchemasGlob)).then(l => l.sort())
])
assert.notStrictEqual(bomSchemas.length, 0)

/**
 * @param {boolean|"log"} strict
 * @return {Ajv}
 */
function getAjv(strict) {
    // see https://ajv.js.org/options.html
    const ajv = new Ajv({
        strict: strict,
        strictSchema: strict,
        strictNumbers: strict,
        strictTypes: strict,
        strictTuples: strict,
        /* This parser has issues with the oneOf-required in
         * `{ type: 'object', oneOf:[{required:['a']},{required:['b']}], properties:{a:{...},b:{...}} }`
         * So  `strictRequired` must be `false` tor our schema files.
         *
         * This is a known and expected behaviour.
         * see https://ajv.js.org/strict-mode.html#defined-required-properties
         * > Property defined in parent schema
         * > There are cases when property defined in the parent schema will not be taken into account.
         */
        strictRequired: false,
        validateFormats: true,
        allowMatchingProperties: true,
        addUsedSchema: false,
        allowUnionTypes: false,
        keywords: ["meta:enum"],
        schemas: {
            'http://cyclonedx.org/schema/spdx.schema.json': spdxSchema,
            'http://cyclonedx.org/schema/jsf-0.82.schema.json': jsfSchema
        }
    });
    addFormats(ajv)
    addFormats2019(ajv, {formats: ['idn-email']})
    // there is just no working implementation for format "iri-reference"
    // see https://github.com/luzlab/ajv-formats-draft2019/issues/22
    ajv.addFormat('iri-reference', true)
    return ajv
}

let errCnt = 0

for (const bomSchemaFile of bomSchemas) {
    console.log('\n> SchemaFile: ', bomSchemaFile);
    const v = /^bom-(\d)\.(\d)/.exec(basename(bomSchemaFile)) ?? []
    if (!v[0]) {
        // test match failed
        console.log('> Skipped.')
        continue
    }

    const cdxVersion = [Number(v[1]), Number(v[2])]
    const strict = cdxVersion >= [1, 5]
        ? true
        : 'log'
    console.debug('> strict: ', strict)
    const ajv = getAjv(strict)

    if (cdxVersion[0] === 1 &&  cdxVersion[1] === 2) {
        // CycloneDX 1.2 had a wrong undefined format `string`.
        // Let's ignore this format only for this special version.
        ajv.addFormat('string', true)
    }

    let bomSchema
    try {
        bomSchema = await readFile(bomSchemaFile, 'utf-8').then(JSON.parse)
    } catch (err) {
        ++errCnt
        console.error('!!! JSON DECODE ERROR:', err)
        continue
    }

    console.group(`> compile schema, log warnings ...`)
    try {
        ajv.compile(bomSchema)
    } catch (err) {
        ++errCnt
        console.groupEnd()
        console.error(`!!! SCHEMA ERROR: ${err}`)
        continue
    }
    console.groupEnd()
    console.log('> SCHEMA OK.')
}

// Exit statuses should be in the range 0 to 254.
// The status 0 is used to terminate the program successfully.
process.exitCode = Math.min(errCnt, 254)