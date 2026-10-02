"use strict";

/**
 * validate the pre-defined perspectives registry.
 * call the script via `node -- <this-file>`
 *
 * The registry is not tied to a CycloneDX version: it lives at the schema root
 * (schema/perspectives-defs.json, generated) and is governed by
 * schema/perspectives-defs.schema.json, whose hand-maintained `preDefinedPerspectivesEnum`
 * is referenced by the versioned perspective schema. This test asserts:
 *  - the registry data validates against its governing schema
 *  - every registered identity is in the enum, without duplicates on either side;
 *    entries follow the naming convention and list contiguous versions from 1
 *  - for every identity in the enum, the catalog document (perspectives/<name>-perspective.json)
 *    is in an acceptable state relative to the registry: reserved (no document yet), new
 *    (version 1, not registered), unchanged (registered content), or pending (registered
 *    latest + 1). A document changed at an already registered version, a regressed or
 *    skipped version, or a removed registered document fails.
 * Shared logic lives in tools/src/main/js/perspectives-registry/perspectives-registry.js.
 */

import {readFile, stat} from 'node:fs/promises'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

import Ajv2020 from "ajv/dist/2020.js"
import draft7MetaSchema from "ajv/dist/refs/json-schema-draft-07.json" with {type: "json"};
import addFormats from 'ajv-formats'

import {
    REGISTRY_DATA_FILE, REGISTRY_SCHEMA_FILE, State, OK_STATES,
    assess, entryProblems, identitiesOf, readCatalogDocument,
} from '../../../main/js/perspectives-registry/perspectives-registry.js'


const _thisDir = dirname(fileURLToPath(import.meta.url))

// region config

const repoRootDir = join(_thisDir, '..', '..', '..', '..', '..')
const registrySchemaFile = join(repoRootDir, REGISTRY_SCHEMA_FILE)
const registryDataFile = join(repoRootDir, REGISTRY_DATA_FILE)

for (const file of [registrySchemaFile, registryDataFile]) {
    if (!await stat(file).then(s => s.isFile()).catch(() => false)) {
        throw new Error(`missing file: ${file}`);
    }
}
console.debug('DEBUG | registrySchemaFile = ', registrySchemaFile);
console.debug('DEBUG | registryDataFile = ', registryDataFile);

// endregion config

const [registrySchema, registryData] = await Promise.all([
    readFile(registrySchemaFile, 'utf-8').then(JSON.parse),
    readFile(registryDataFile, 'utf-8').then(JSON.parse),
])

let errCnt = 0

/**
 * @param {string} message
 * @param {...*} details
 */
function fail(message, ...details) {
    ++errCnt
    console.error('!!! ERROR:', message, ...details)
}

// region schema conformance

console.log('\n> validate registry data against its governing schema ...')
{
    // same strict setup as the schema validation tests
    const ajv = new Ajv2020({
        verbose: true,
        addUsedSchema: false,
        keywords: ["meta:enum"],
        strict: true,
        strictSchema: true,
        strictNumbers: true,
        strictTypes: true,
        strictTuples: true,
        strictRequired: true,
        validateFormats: true,
    });
    // the registry schema is draft-07
    ajv.addMetaSchema(draft7MetaSchema);
    addFormats(ajv)
    let validate
    try {
        validate = ajv.compile(registrySchema)
    } catch (err) {
        fail('failed compiling registry schema', '\n  in file:', `file://${registrySchemaFile}`, '\n    error:', String(err))
    }
    if (validate !== undefined) {
        if (validate(registryData)) {
            console.log('OK.')
        } else {
            fail('registry data does not conform to its governing schema',
                '\n  for file:', `file://${registryDataFile}`,
                '\n     error:', validate.errors)
        }
    }
}

// endregion schema conformance

// region registry entries

console.log('\n> check registry entries against the enum and the naming convention ...')
const identities = identitiesOf(registrySchema)
const entries = Array.isArray(registryData.perspectives) ? registryData.perspectives : []
const entryById = new Map()
{
    const dupEnum = identities.filter((v, i) => identities.indexOf(v) !== i)
    if (dupEnum.length > 0) {
        fail('duplicate values in enum', dupEnum, '\n  in file:', `file://${registrySchemaFile}`)
    }
    let entryErrors = 0
    for (const entry of entries) {
        if (entryById.has(entry?.predefined)) {
            ++entryErrors
            fail('duplicate registry entry for', entry.predefined)
            continue
        }
        entryById.set(entry?.predefined, entry)
        if (!identities.includes(entry?.predefined)) {
            ++entryErrors
            fail('registered identity is not in the enum:', entry?.predefined, '\n  add it to', `file://${registrySchemaFile}`)
        }
        const problems = entryProblems(entry)
        if (problems.length > 0) {
            ++entryErrors
            fail(`registry entry ${entry?.predefined}:`, '\n  - ' + problems.join('\n  - '))
        }
    }
    if (dupEnum.length === 0 && entryErrors === 0) {
        console.log('OK.', entries.length, 'registered of', identities.length, 'identities')
    }
}

// endregion registry entries

// region catalog documents

console.log('\n> check catalog documents against the registry ...')
for (const identity of identities) {
    let catalog
    try {
        catalog = await readCatalogDocument(repoRootDir, identity)
    } catch (err) {
        fail(`${identity}:`, String(err.message))
        continue
    }
    console.log('\ntest', identity, '->', catalog.file, '...')
    if (catalog.problems.length > 0) {
        fail(`catalog document of ${identity}:`, '\n  file:', `file://${catalog.path}`, '\n  - ' + catalog.problems.join('\n  - '))
        continue
    }
    const {state, detail} = assess(catalog, entryById.get(identity))
    if (!OK_STATES.has(state)) {
        fail(`${identity} is ${state}:`, detail, '\n  file:', `file://${catalog.path}`)
    } else if (state === State.RESERVED) {
        console.warn(`WARNING: ${identity} is reserved:`, detail)
    } else if (state === State.UNCHANGED) {
        console.log('OK.', detail)
    } else {
        console.log(`OK (${state}).`, detail, '- the registry generator will register it after merge')
    }
}

// endregion catalog documents

console.log('\n\n> found', errCnt, 'errors')
// Exit statuses should be in the range 0 to 254.
// The status 0 is used to terminate the program successfully.
process.exitCode = Math.min(errCnt, 254)
