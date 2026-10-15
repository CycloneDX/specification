"use strict";

/**
 * Shared logic for the CycloneDX pre-defined perspectives registry.
 *
 * Used by the generator (generate-perspectives-registry.js) and by the
 * registry check (test/run.js), so that both hash catalog documents and judge
 * version states the same way.
 *
 * Conventions:
 *  - identities are `cdx:perspectives:<name>` (the enum in
 *    schema/perspectives-defs.schema.json is the hand-maintained source)
 *  - the catalog document defining `cdx:perspectives:<name>` is
 *    `perspectives/<name>-perspective.json` (naming convention, no mapping);
 *    it holds the latest version
 *  - every earlier version is kept, unchanged, as
 *    `perspectives/archives/<name>-perspective/<name>-perspective-<version>.json`
 *  - a catalog document is a CycloneDX document defining exactly one inline
 *    perspective; its `version` is the perspective version referenced by
 *    `predefinedVersion`
 *  - the registry (schema/perspectives-defs.json) is GENERATED and records,
 *    per identity, every published version with the sha256 of the catalog
 *    document's canonical JSON and the date it was registered; once
 *    registered, a version's content is immutable, which the recorded hash
 *    enforces for the current document and for every archived one
 */

import {createHash} from 'node:crypto'
import {readdir, readFile, stat} from 'node:fs/promises'
import {join} from 'node:path'

export const IDENTITY_PREFIX = 'cdx:perspectives:'
export const CATALOG_DIR = 'perspectives'
export const CATALOG_FILE_SUFFIX = '-perspective.json'
export const ARCHIVES_DIR = `${CATALOG_DIR}/archives`
export const REGISTRY_SCHEMA_FILE = join('schema', 'perspectives-defs.schema.json')
export const REGISTRY_DATA_FILE = join('schema', 'perspectives-defs.json')
export const ENUM_POINTER = Object.freeze(['$defs', 'preDefinedPerspectivesEnum', 'enum'])

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
 * @return {string} the base name of the identity's catalog files, `<name>-perspective`
 */
function baseNameOf(identity) {
    if (typeof identity !== 'string' || !identity.startsWith(IDENTITY_PREFIX)) {
        throw new Error(`not a pre-defined perspective identity: ${identity}`)
    }
    const name = identity.slice(IDENTITY_PREFIX.length)
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
        throw new Error(`identity name is not lowercase-kebab-case: ${identity}`)
    }
    return `${name}${CATALOG_FILE_SUFFIX.replace(/\.json$/, '')}`
}

/**
 * @param {string} identity
 * @return {string} catalog document path relative to the repository root, using `/` separators
 */
export function catalogFileOf(identity) {
    return `${CATALOG_DIR}/${baseNameOf(identity)}.json`
}

/**
 * @param {string} identity
 * @return {string} directory holding the identity's earlier versions, relative to the repository root
 */
export function archiveDirOf(identity) {
    return `${ARCHIVES_DIR}/${baseNameOf(identity)}`
}

/**
 * @param {string} identity
 * @param {number} version
 * @return {string} path of the archived catalog document of that version, relative to the repository root
 */
export function archiveFileOf(identity, version) {
    return `${archiveDirOf(identity)}/${baseNameOf(identity)}-${version}.json`
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
    return readDocument(repoRoot, identity, catalogFileOf(identity))
}

/**
 * Read and structurally check a catalog document file.
 * @param {string} repoRoot
 * @param {string} identity
 * @param {string} file path relative to repository root
 * @return {Promise<CatalogDocument>}
 */
async function readDocument(repoRoot, identity, file) {
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
            : {state: State.MODIFIED, latest, detail: `content differs from registered version ${latest}; bump \`version\` to ${latest + 1} and archive version ${latest} as ${archiveFileOf(catalog.identity, latest)}`}
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

/**
 * Check the archived earlier versions of an identity against the registry.
 *
 * Every registered version below the current catalog document's version shall
 * be archived at its conventional path, unchanged: its content hash equals the
 * registered one, and its own `version` matches. The archive directory holds
 * nothing else.
 *
 * @param {string} repoRoot
 * @param {CatalogDocument} catalog the identity's current catalog document
 * @param {object|undefined} entry registry entry of the identity
 * @return {Promise<string[]>} problems, empty when the archive is consistent
 */
export async function archiveProblems(repoRoot, catalog, entry) {
    const identity = catalog.identity
    const registered = Array.isArray(entry?.versions) ? entry.versions : []
    const below = catalog.version ?? latestOf(registered)
    const expected = new Map(registered
        .filter(v => v.version < below)
        .map(v => [archiveFileOf(identity, v.version), v]))
    const problems = []
    for (const [file, v] of expected) {
        const archived = await readDocument(repoRoot, identity, file)
        if (!archived.exists) {
            problems.push(`registered version ${v.version} is not archived: copy it, unchanged, to ${file}`)
        } else if (archived.problems.length > 0) {
            problems.push(`${file}: ${archived.problems.join('; ')}`)
        } else if (archived.version !== v.version) {
            problems.push(`${file} declares \`version\` ${archived.version}, its file name says ${v.version}`)
        } else if (archived.sha256 !== v.sha256) {
            problems.push(`${file} differs from registered version ${v.version}; archived versions shall not change`)
        }
    }
    const dir = archiveDirOf(identity)
    for (const name of await listDir(repoRoot, dir)) {
        if (!expected.has(`${dir}/${name}`)) {
            problems.push(`${dir}/${name} is not an archived earlier version of ${identity}`)
        }
    }
    return problems
}

/**
 * @param {string} repoRoot
 * @param {string[]} identities the identity enum
 * @return {Promise<string[]>} problems for entries of the archives directory that belong to no identity
 */
export async function strayArchiveProblems(repoRoot, identities) {
    const known = new Set()
    for (const identity of identities) {
        try {
            known.add(archiveDirOf(identity))
        } catch {
            // an invalid identity is reported elsewhere
        }
    }
    return (await listDir(repoRoot, ARCHIVES_DIR))
        .filter(name => !known.has(`${ARCHIVES_DIR}/${name}`))
        .map(name => `${ARCHIVES_DIR}/${name} does not belong to any identity in the enum`)
}

/**
 * @param {string} repoRoot
 * @param {string} dir path relative to repository root
 * @return {Promise<string[]>} entry names, sorted; empty when the directory does not exist
 */
async function listDir(repoRoot, dir) {
    try {
        return (await readdir(join(repoRoot, ...dir.split('/')))).sort()
    } catch (err) {
        if (err.code === 'ENOENT') return []
        throw err
    }
}
