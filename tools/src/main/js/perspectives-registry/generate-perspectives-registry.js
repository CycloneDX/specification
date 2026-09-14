#!/usr/bin/env node
"use strict";

/**
 * Generate schema/perspectives-defs.json, the pre-defined perspectives registry.
 * call the script via `node -- <this-file>` from anywhere inside the repository.
 *
 * Sources: the identity enum in schema/perspectives-defs.schema.json (hand-maintained)
 * and the catalog documents under perspectives/ (hand-maintained, naming convention).
 * Registers every catalog document version that is not registered yet, recording the
 * sha256 of the document's canonical JSON and the commit that last touched the document.
 * Never rewrites a registered version: a document whose content changed at an already
 * registered version is an error, and so is any version that is not exactly the
 * registered latest + 1 (or 1 for a new perspective).
 *
 * Exit code is the number of errors (0 = success), capped at 254.
 */

import {execFile} from 'node:child_process'
import {readFile, writeFile} from 'node:fs/promises'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {promisify} from 'node:util'

import {
    REGISTRY_DATA_FILE, REGISTRY_SCHEMA_FILE, State, OK_STATES,
    assess, identitiesOf, readCatalogDocument,
} from './perspectives-registry.js'

const _thisDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(_thisDir, '..', '..', '..', '..', '..')
const schemaFile = join(repoRoot, REGISTRY_SCHEMA_FILE)
const dataFile = join(repoRoot, REGISTRY_DATA_FILE)
const execFileP = promisify(execFile)

/**
 * @param {string} file path relative to repository root
 * @return {Promise<{commit: string, date: string}>} last commit touching the file, date in UTC
 */
async function lastCommitOf(file) {
    const {stdout} = await execFileP('git', ['log', '-1', '--format=%H%n%cI', '--', file], {cwd: repoRoot})
    const [commit, date] = stdout.trim().split('\n')
    if (!/^[0-9a-f]{40}$/.test(commit ?? '')) {
        throw new Error(`no commit found for ${file}; the document shall be committed before it is registered`)
    }
    return {commit, date: new Date(date).toISOString().replace(/\.\d{3}Z$/, 'Z')}
}

const schema = JSON.parse(await readFile(schemaFile, 'utf-8'))
const identities = identitiesOf(schema)
const previous = await readFile(dataFile, 'utf-8').then(JSON.parse).catch(err => {
    if (err.code === 'ENOENT') return {perspectives: []}
    throw err
})
const previousEntries = new Map((previous.perspectives ?? []).map(e => [e.predefined, e]))

let errCnt = 0
const entries = []

for (const [id] of previousEntries) {
    if (!identities.includes(id)) {
        ++errCnt
        console.error(`!!! ERROR: registered identity ${id} is not in the enum of ${REGISTRY_SCHEMA_FILE}; registered versions are never dropped`)
    }
}

for (const identity of [...identities].sort()) {
    const entry = previousEntries.get(identity)
    let catalog
    try {
        catalog = await readCatalogDocument(repoRoot, identity)
    } catch (err) {
        ++errCnt
        console.error(`!!! ERROR: ${identity}: ${err.message}`)
        if (entry !== undefined) entries.push(entry)
        continue
    }
    if (catalog.problems.length > 0) {
        ++errCnt
        console.error(`!!! ERROR: ${identity}: ${catalog.file}\n  - ${catalog.problems.join('\n  - ')}`)
        if (entry !== undefined) entries.push(entry)
        continue
    }
    const {state, detail} = assess(catalog, entry)
    console.log(`${identity}: ${state} (${detail})`)
    if (!OK_STATES.has(state)) {
        ++errCnt
        console.error(`!!! ERROR: ${identity}: ${detail}`)
        if (entry !== undefined) entries.push(entry)
        continue
    }
    if (state === State.RESERVED) {
        continue
    }
    const versions = [...(entry?.versions ?? [])]
    if (state === State.NEW || state === State.PENDING) {
        const {commit, date} = await lastCommitOf(catalog.file)
        versions.push({version: catalog.version, sha256: catalog.sha256, commit, date})
        console.log(`  registering version ${catalog.version} from commit ${commit}`)
    }
    entries.push({
        predefined: identity,
        file: catalog.file,
        name: catalog.perspective.name,
        description: catalog.perspective.description,
        versions,
    })
}

if (errCnt === 0) {
    const lastUpdated = entries.flatMap(e => e.versions.map(v => v.date)).sort().at(-1) ?? previous.lastUpdated
    const registry = {
        $schema: 'http://cyclonedx.org/schema/perspectives-defs.schema.json',
        ...(lastUpdated !== undefined ? {lastUpdated} : {}),
        perspectives: entries,
    }
    const output = JSON.stringify(registry, null, 2) + '\n'
    if (output === await readFile(dataFile, 'utf-8').catch(() => undefined)) {
        console.log('\nregistry unchanged:', dataFile)
    } else {
        await writeFile(dataFile, output, 'utf-8')
        console.log('\nregistry written:', dataFile)
    }
}

console.log('\n> found', errCnt, 'errors')
process.exitCode = Math.min(errCnt, 254)
