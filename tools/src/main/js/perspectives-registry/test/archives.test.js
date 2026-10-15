"use strict";

/**
 * Unit tests for the archive of earlier perspective versions.
 * Each test builds a small repository layout in a temporary directory.
 * Run via `npm test` in this tool's directory.
 */

import assert from 'node:assert/strict'
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {dirname, join} from 'node:path'
import {afterEach, beforeEach, test} from 'node:test'

import {
    State, archiveFileOf, archiveProblems, assess, catalogFileOf, readCatalogDocument, sha256Of, strayArchiveProblems,
} from '../perspectives-registry.js'

const ID = 'cdx:perspectives:example'

/**
 * @param {number} version
 * @param {string} [name]
 * @return {object} a minimal catalog document
 */
function catalog(version, name = `Example v${version}`) {
    return {
        specFormat: 'CycloneDX',
        specVersion: '2.0',
        version,
        perspectives: [{name, mappings: [{expression: '$.components[*]'}]}],
    }
}

/**
 * @param {...object} docs registered catalog documents, version 1 first
 * @return {object} registry entry
 */
function entryOf(...docs) {
    return {
        predefined: ID,
        file: catalogFileOf(ID),
        versions: docs.map(d => ({version: d.version, sha256: sha256Of(d), date: '2026-10-15T00:00:00Z'})),
    }
}

let root

/**
 * @param {string} file path relative to the repository root
 * @param {object|string} content JSON value, or raw text
 */
async function put(file, content) {
    const path = join(root, ...file.split('/'))
    await mkdir(dirname(path), {recursive: true})
    await writeFile(path, typeof content === 'string' ? content : JSON.stringify(content, null, 2))
}

async function check(entry) {
    const current = await readCatalogDocument(root, ID)
    return {state: assess(current, entry).state, problems: await archiveProblems(root, current, entry)}
}

beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'perspectives-registry-'))
})

afterEach(async () => {
    await rm(root, {recursive: true, force: true})
})

test('first version needs no archive', async () => {
    const v1 = catalog(1)
    await put(catalogFileOf(ID), v1)
    assert.deepEqual(await check(entryOf(v1)), {state: State.UNCHANGED, problems: []})
})

test('new version with the previous one archived is pending', async () => {
    const v1 = catalog(1)
    await put(catalogFileOf(ID), catalog(2))
    await put(archiveFileOf(ID, 1), v1)
    assert.deepEqual(await check(entryOf(v1)), {state: State.PENDING, problems: []})
})

test('registered latest with all earlier versions archived is unchanged', async () => {
    const [v1, v2, v3] = [catalog(1), catalog(2), catalog(3)]
    await put(catalogFileOf(ID), v3)
    await put(archiveFileOf(ID, 1), v1)
    await put(archiveFileOf(ID, 2), v2)
    assert.deepEqual(await check(entryOf(v1, v2, v3)), {state: State.UNCHANGED, problems: []})
})

test('new version without the previous one archived fails', async () => {
    await put(catalogFileOf(ID), catalog(2))
    const {problems} = await check(entryOf(catalog(1)))
    assert.equal(problems.length, 1)
    assert.match(problems[0], /registered version 1 is not archived/)
    assert.match(problems[0], /perspectives\/archives\/example-perspective\/example-perspective-1\.json/)
})

test('an archived version that changed fails', async () => {
    await put(catalogFileOf(ID), catalog(2))
    await put(archiveFileOf(ID, 1), catalog(1, 'edited after publication'))
    const {problems} = await check(entryOf(catalog(1)))
    assert.equal(problems.length, 1)
    assert.match(problems[0], /differs from registered version 1/)
})

test('formatting of an archived version does not matter', async () => {
    const v1 = catalog(1)
    await put(catalogFileOf(ID), catalog(2))
    await put(archiveFileOf(ID, 1), JSON.stringify({perspectives: v1.perspectives, version: 1, specVersion: '2.0', specFormat: 'CycloneDX'}))
    assert.deepEqual((await check(entryOf(v1))).problems, [])
})

test('an archived file whose version does not match its name fails', async () => {
    await put(catalogFileOf(ID), catalog(3))
    await put(archiveFileOf(ID, 1), catalog(2))
    await put(archiveFileOf(ID, 2), catalog(2))
    const {problems} = await check(entryOf(catalog(1), catalog(2)))
    assert.equal(problems.length, 1)
    assert.match(problems[0], /declares `version` 2, its file name says 1/)
})

test('files in the archive directory other than earlier versions fail', async () => {
    const v1 = catalog(1)
    await put(catalogFileOf(ID), v1)
    await put(archiveFileOf(ID, 1), v1)
    await put('perspectives/archives/example-perspective/notes.txt', 'not a version')
    const {problems} = await check(entryOf(v1))
    assert.equal(problems.length, 2)
    assert.ok(problems.every(p => /is not an archived earlier version/.test(p)))
})

test('a change at a registered version names the archive to create', async () => {
    await put(catalogFileOf(ID), catalog(1, 'edited'))
    const current = await readCatalogDocument(root, ID)
    const {state, detail} = assess(current, entryOf(catalog(1)))
    assert.equal(state, State.MODIFIED)
    assert.match(detail, /bump `version` to 2 and archive version 1 as perspectives\/archives\/example-perspective\/example-perspective-1\.json/)
})

test('archive directories that belong to no identity fail', async () => {
    await put('perspectives/archives/example-perspective/example-perspective-1.json', catalog(1))
    await put('perspectives/archives/unknown-perspective/unknown-perspective-1.json', catalog(1))
    assert.deepEqual(await strayArchiveProblems(root, [ID]), [
        'perspectives/archives/unknown-perspective does not belong to any identity in the enum',
    ])
})
