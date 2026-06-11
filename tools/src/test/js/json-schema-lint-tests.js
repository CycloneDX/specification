"use strict";

import assert from 'node:assert'
import {readFile, access} from 'node:fs/promises'
import {dirname, basename, join} from 'node:path'
import {fileURLToPath} from 'node:url'

import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import addFormats2019 from 'ajv-formats-draft2019'
import {glob} from 'glob'

// region config

const bomSchemasGlob = 'bom-*.schema.json'
const schemaDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'schema')
const schema20BundledPath = join(schemaDir, '2.0', 'cyclonedx-2.0-bundled.schema.json')

// endregion config

const [spdxSchema, jsfSchema, cryptoDefsSchema, bomSchemas] = await Promise.all([
    readFile(join(schemaDir, 'spdx.schema.json'), 'utf-8').then(JSON.parse),
    readFile(join(schemaDir, 'jsf-0.82.schema.json'), 'utf-8').then(JSON.parse),
    readFile(join(schemaDir, 'cryptography-defs.schema.json'), 'utf-8').then(JSON.parse),
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
            'http://cyclonedx.org/schema/jsf-0.82.schema.json': jsfSchema,
            'http://cyclonedx.org/schema/cryptography-defs.schema.json': cryptoDefsSchema,
        }
    });
    addFormats(ajv)
    addFormats2019(ajv, {formats: ['idn-email']})
    // there is just no working implementation for format "iri-reference"
    // see https://github.com/luzlab/ajv-formats-draft2019/issues/22
    ajv.addFormat('iri-reference', true)
    return ajv
}

/**
 * Ajv for draft 2020-12 (CycloneDX 2.0). Registers ref schemas (spdx, jsf, crypto) under http and https
 * so the 2.0 bundled schema's relative refs resolve. validateSchema: false for draft-07 refs.
 * @param {typeof import('ajv').default} Ajv2020Class - dynamically imported ajv/dist/2020.js
 * @param {boolean|"log"} strict
 * @param {{ spdx: object, jsf: object, crypto: object }} refSchemas
 * @returns {import('ajv').default}
 */
function getAjv2020(Ajv2020Class, strict, refSchemas) {
    const ids = [
        'http://cyclonedx.org/schema/spdx.schema.json',
        'https://cyclonedx.org/schema/spdx.schema.json',
        'http://cyclonedx.org/schema/jsf-0.82.schema.json',
        'https://cyclonedx.org/schema/jsf-0.82.schema.json',
        'http://cyclonedx.org/schema/cryptography-defs.schema.json',
        'https://cyclonedx.org/schema/cryptography-defs.schema.json',
    ]
    const schemas = {
        [ids[0]]: refSchemas.spdx,
        [ids[1]]: refSchemas.spdx,
        [ids[2]]: refSchemas.jsf,
        [ids[3]]: refSchemas.jsf,
        [ids[4]]: refSchemas.crypto,
        [ids[5]]: refSchemas.crypto,
    }
    const ajv = new Ajv2020Class({
        strict,
        strictSchema: strict,
        strictNumbers: strict,
        strictTypes: strict,
        strictTuples: strict,
        strictRequired: false,
        validateFormats: true,
        allowMatchingProperties: true,
        addUsedSchema: false,
        allowUnionTypes: true,
        validateSchema: false, // ref schemas are draft-07
        keywords: ['meta:enum'],
        schemas,
    })
    addFormats(ajv)
    addFormats2019(ajv, { formats: ['idn-email'] })
    ajv.addFormat('iri-reference', true)
    return ajv
}

let errCnt = 0

for (const bomSchemaFile of bomSchemas) {
    console.log('\n> SchemaFile: ', bomSchemaFile);
    const v = /^bom-(\d+)\.(\d+)/.exec(basename(bomSchemaFile)) ?? []
    if (!v[0]) {
        // test match failed
        console.log('> Skipped.')
        continue
    }

    const major = Number(v[1])
    const minor = Number(v[2])
    // strict mode for CycloneDX >= 1.5 (numeric comparison, not array string coercion)
    const strict = (major > 1) || (major === 1 && minor >= 5) ? true : 'log'
    console.debug('> strict: ', strict)
    const ajv = getAjv(strict)

    if (major === 1 && minor === 2) {
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

// CycloneDX 2.0 (draft 2020-12): compile bundled schema with Ajv2020 (non-strict for compilability only)
const has20Schema = await access(schema20BundledPath).then(() => true).catch(() => false)
if (has20Schema) {
    const Ajv2020 = (await import('ajv/dist/2020.js')).default
    console.log('\n> SchemaFile: ', schema20BundledPath)
    const ajv20 = getAjv2020(Ajv2020, false, { spdx: spdxSchema, jsf: jsfSchema, crypto: cryptoDefsSchema })
    let bomSchema20
    try {
        bomSchema20 = await readFile(schema20BundledPath, 'utf-8').then(JSON.parse)
    } catch (err) {
        errCnt++
        console.error('!!! JSON DECODE ERROR:', err)
    }
    if (bomSchema20) {
        console.group('> compile schema (2.0 draft 2020-12), log warnings ...')
        try {
            ajv20.compile(bomSchema20)
            console.groupEnd()
            console.log('> SCHEMA OK.')
        } catch (err) {
            errCnt++
            console.groupEnd()
            console.error(`!!! SCHEMA ERROR: ${err}`)
        }
    }
} else {
    console.log('\n> 2.0 schema not found (skipped):', schema20BundledPath)
}

// Exit statuses should be in the range 0 to 254.
// The status 0 is used to terminate the program successfully.
process.exitCode = Math.min(errCnt, 254)
