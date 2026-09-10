"use strict";

/**
 * Shared logic for the CycloneDX pre-defined perspectives registry.
 *
 * Used by the generator (tools/src/main/js/perspectives-registry) and by the
 * schema-v2 test suite, so that both hash catalog documents and judge
 * version states the same way.
 *
 * Conventions:
 *  - identities are `cdx:perspectives:<name>` (the enum in
 *    schema/perspectives-defs.schema.json is the hand-maintained source)
 *  - the catalog document defining `cdx:perspectives:<name>` is
 *    `perspectives/<name>-perspective.json` (naming convention, no mapping)
 *  - a catalog document is a CycloneDX document defining exactly one inline
 *    perspective; its `version` is the perspective version referenced by
 *    `predefinedVersion`
 *  - the registry (schema/perspectives-defs.json) is GENERATED and records,
 *    per identity, every published version with the sha256 of the catalog
 *    document's canonical JSON and the commit that introduced it; once
 *    registered, a version's content is immutable
 */

import {createHash} from 'node:crypto'
import {readFile, stat} from 'node:fs/promises'
import {join} from 'node:path'

export const IDENTITY_PREFIX = 'cdx:perspectives:'
export const CATALOG_DIR = 'perspectives'
export const CATALOG_FILE_SUFFIX = '-perspective.json'
export const REGISTRY_SCHEMA_FILE = join('schema', 'perspectives-defs.schema.json')
export const REGISTRY_DATA_FILE = join('schema', 'perspectives-defs.json')
export const ENUM_POINTER = Object.freeze(['definitions', 'preDefinedPerspectivesEnum', 'enum'])

/**
 * Version states of a catalog document relative to the registry.
 * @readonly
 * @enum {string}
 */
export const State = Object.freeze({
    /** identity in the enum, no catalog document yet */
    RESERVED: 'reserved',
    /** first version (1) of a not-yet-registered perspective; the generator will register it */
    NEW: 'new',
    /** version equals the registered latest and the content is unchanged */
    UNCHANGED: 'unchanged',
    /** version equals registered latest + 1; the generator will register it */
    PENDING: 'pending',
    /** version equals the registered latest but the content differs: change without a version bump */
    MODIFIED: 'modified',
    /** version is lower than the registered latest */
    REGRESSED: 'regressed',
    /** version skips ahead of registered latest + 1 (or a new perspective not starting at 1) */
    SKIPPED: 'skipped',
    /** a registered perspective whose catalog document no longer exists */
    REMOVED: 'removed',
})

/** states that are acceptable in a pull request / on the base branch */
export const OK_STATES = Object.freeze(new Set([State.RESERVED, State.NEW, State.UNCHANGED, State.PENDING]))

/**
 * @param {string} identity
 * @return {string} catalog document path relative to the repository root, using `/` separators
 */
export function catalogFileOf(identity) {
    if (typeof identity !== 'string' || !identity.startsWith(IDENTITY_PREFIX)) {
        throw new Error(`not a pre-defined perspective identity: ${identity}`)
    }
    const name = identity.slice(IDENTITY_PREFIX.length)
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
        throw new Error(`identity name is not lowercase-kebab-case: ${identity}`)
    }
    return `${CATALOG_DIR}/${name}${CATALOG_FILE_SUFFIX}`
}

/**
 * Canonical JSON: object keys sorted, no insignificant whitespace.
 * Formatting-only edits of a catalog document therefore do not change its hash.
 * @param {*} value
 * @return {string}
 */
export function canonicalize(value) {
    if (Array.isArray(value)) {
        return `[${value.map(canonicalize).join(',')}]`
    }
    if (value !== null && typeof value === 'object') {
        return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(',')}}`
    }
    return JSON.stringify(value)
}

/**
 * @param {*} doc parsed catalog document
 * @return {string} lowercase hex sha256 of the canonical JSON
 */
export function sha256Of(doc) {
    return createHash('sha256').update(canonicalize(doc), 'utf-8').digest('hex')
}

/**
 * @param {object} schema parsed registry governing schema
 * @return {string[]} the identity enum
 */
export function identitiesOf(schema) {
    const values = ENUM_POINTER.reduce((node, key) => node?.[key], schema)
    if (!Array.isArray(values)) {
        throw new Error(`missing enum at /${ENUM_POINTER.join('/')} in registry schema`)
    }
    return values
}

/**
 * @typedef {object} CatalogDocument
 * @property {string} identity
 * @property {string} file path relative to repository root
 * @property {string} path absolute path
 * @property {boolean} exists
 * @property {*} [doc] parsed document (when it exists and is JSON)
 * @property {number} [version]
 * @property {object} [perspective] the single inline perspective
 * @property {string} [sha256]
 * @property {string[]} problems structural problems of an existing document
 */

/**
 * Read and structurally check the catalog document of an identity.
 * @param {string} repoRoot
 * @param {string} identity
 * @return {Promise<CatalogDocument>}
 */
export async function readCatalogDocument(repoRoot, identity) {
    const file = catalogFileOf(identity)
    const path = join(repoRoot, ...file.split('/'))
    const result = {identity, file, path, exists: false, problems: []}
    if (!await stat(path).then(s => s.isFile()).catch(() => false)) {
        return result
    }
    result.exists = true
    let doc
    try {
        doc = JSON.parse(await readFile(path, 'utf-8'))
    } catch (err) {
        result.problems.push(`not valid JSON: ${err}`)
        return result
    }
    result.doc = doc
    result.sha256 = sha256Of(doc)
    if (!Number.isInteger(doc?.version) || doc.version < 1) {
        result.problems.push('shall declare an integer `version` >= 1 (the value referenced by `predefinedVersion`)')
    } else {
        result.version = doc.version
    }
    const perspectives = Array.isArray(doc?.perspectives) ? doc.perspectives : []
    if (perspectives.length !== 1) {
        result.problems.push(`shall define exactly one perspective, found ${perspectives.length}`)
    } else {
        const p = perspectives[0]
        if (p?.predefined !== undefined || p?.predefinedVersion !== undefined) {
            result.problems.push('shall define its perspective inline, not by pre-defined reference (`predefined` / `predefinedVersion`)')
        }
        result.perspective = p
    }
    return result
}

/**
 * @param {object[]|undefined} versions registered version records of the identity
 * @return {number} registered latest version, 0 when unregistered
 */
export function latestOf(versions) {
    return Array.isArray(versions) && versions.length > 0 ? Math.max(...versions.map(v => v.version)) : 0
}

/**
 * Judge a catalog document against its registry entry.
 * @param {CatalogDocument} catalog
 * @param {object|undefined} entry registry entry of the identity
 * @return {{state: State, latest: number, detail: string}}
 */
export function assess(catalog, entry) {
    const latest = latestOf(entry?.versions)
    if (!catalog.exists) {
        return latest > 0
            ? {state: State.REMOVED, latest, detail: `registered up to version ${latest} but ${catalog.file} does not exist`}
            : {state: State.RESERVED, latest, detail: `${catalog.file} does not exist (yet)`}
    }
    const {version, sha256} = catalog
    if (latest === 0) {
        return version === 1
            ? {state: State.NEW, latest, detail: 'version 1, not registered yet'}
            : {state: State.SKIPPED, latest, detail: `not registered yet, so it shall start at version 1, found ${version}`}
    }
    if (version === latest) {
        const registered = entry.versions.find(v => v.version === latest)
        return registered.sha256 === sha256
            ? {state: State.UNCHANGED, latest, detail: `version ${version}, content matches the registry`}
            : {state: State.MODIFIED, latest, detail: `content differs from registered version ${latest} (${registered.commit}); bump \`version\` to ${latest + 1}`}
    }
    if (version === latest + 1) {
        return {state: State.PENDING, latest, detail: `version ${version} bumped from registered ${latest}, not registered yet`}
    }
    if (version < latest) {
        return {state: State.REGRESSED, latest, detail: `version ${version} is below registered latest ${latest}`}
    }
    return {state: State.SKIPPED, latest, detail: `version ${version} skips ahead of registered latest ${latest}; next is ${latest + 1}`}
}

/**
 * Structural problems of a registry entry that the governing schema cannot express.
 * @param {object} entry
 * @return {string[]}
 */
export function entryProblems(entry) {
    const problems = []
    let expectedFile
    try {
        expectedFile = catalogFileOf(entry.predefined)
    } catch (err) {
        problems.push(String(err.message))
    }
    if (expectedFile !== undefined && entry.file !== expectedFile) {
        problems.push(`\`file\` is ${entry.file}, naming convention expects ${expectedFile}`)
    }
    const numbers = (entry.versions ?? []).map(v => v.version)
    for (let i = 0; i < numbers.length; ++i) {
        if (numbers[i] !== i + 1) {
            problems.push(`\`versions\` shall be contiguous from 1 in ascending order, found [${numbers.join(', ')}]`)
            break
        }
    }
    return problems
}
