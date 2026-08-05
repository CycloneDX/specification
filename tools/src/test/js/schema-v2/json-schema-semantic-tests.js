"use strict";

/**
 * validate all schemas for a given version of CycloneDX.
 * call the script via `node -- <this-file> -v <CDX-version>`
 */


import {parseArgs} from 'node:util'
import {readFile, stat} from 'node:fs/promises'
import {dirname, join, relative} from 'node:path'
import {fileURLToPath} from 'node:url'

import {glob} from 'glob'

import {alphaSort} from './_helpers.js'


const _thisDir = dirname(fileURLToPath(import.meta.url))

// region config

const testschemaVersion = (parseArgs({options: {v: {type: 'string', short: 'v'}}}).values.v ?? '').trim()
const schemaRootDir = join(_thisDir, '..', '..', '..', '..', '..', 'schema')
const schemaDir = join(schemaRootDir, testschemaVersion)
const schemaModelDir = join(schemaDir, `model`)

const schemaGlob = '*.schema.json'

const expectedRefTypeFP = Object.freeze([
    join(schemaModelDir, `cyclonedx-common-${testschemaVersion}.schema.json`),
    '#/$defs/refType'
])

if (testschemaVersion.length === 0) {
    throw new Error('missing testschemaVersion. expected via argument')
}
console.debug('DEBUG | testschemaVersion = ', testschemaVersion);

if (!await stat(schemaModelDir).then(s => s.isDirectory()).catch(() => false)) {
    throw new Error(`missing schemaModelDir: ${schemaModelDir}`);
}
console.debug('DEBUG | schemaModelDir = ', schemaModelDir);

if (!await stat(expectedRefTypeFP[0]).then(s => s.isFile()).catch(() => false)) {
    throw new Error(`missing expectedRefTypeFP file: ${expectedRefTypeFP[0]}`);
}
console.debug('DEBUG | expectedRefTypeFP = ', expectedRefTypeFP);

const schemaFiles = Object.freeze([
    // test only the source schema, not the bundled for now ...
    join(schemaDir, `cyclonedx-${testschemaVersion}.schema.json`),
    ...(await glob(join(schemaDir, `model`, schemaGlob))).sort(alphaSort)
])
for (const schemaFile of schemaFiles) {
    if (!await stat(schemaFile).then(s => s.isFile()).catch(() => false)) {
        throw new Error(`missing schemaFile: ${schemaFile}`);
    }
}
console.debug('DEBUG | schemaFiles = ', schemaFiles);

// endregion config

// region utils

const __FINDNODES_SKIP_KEYS = Object.freeze(new Set(
    ['enum', 'const', 'examples', 'default', 'meta:enum']))

/**
 * Walks a schema, yields [path, node] for every node the matcher accepts.
 * @param {*} node
 * @param {function(*): boolean} matcher
 * @param {string} path
 * @return {Generator<[string, *], void, *>}
 * @private
 */
function* _findNodes(node, matcher, path = '$') {
    if (Array.isArray(node)) {
        for (const [i, item] of node.entries()) {
            yield* _findNodes(item, matcher, `${path}[${i}]`);
        }
    } else if (node !== null && typeof node === 'object') {
        if (matcher(node)) {
            yield [path, node];
        }
        for (const [key, value] of Object.entries(node)) {
            // don't descend into keys whose values aren't schemas
            if (__FINDNODES_SKIP_KEYS.has(key)) continue;
            yield* _findNodes(value, matcher, `${path}.${key}`);
        }
    }
}

/**
 * @function
 * @param {*} schema
 * @return {Generator<[string, *], void, *>} every node that has a string `$ref`
 * @private
 */
const _findRefs = (schema) => _findNodes(schema,
    n => typeof n['$ref'] === 'string')

/**
 * @function
 * @param {*} schema
 * @return {Generator<[string, *], void, *>} every node that is an object schema
 * @private
 */
const _findObjectSchemas = (schema) => _findNodes(schema,
    n => n.type === 'object' || (Array.isArray(n.type) && n.type.includes('object')))

/**
 * @param {string} schemaFile
 * @return {string} the expected `$ref` value pointing at refType, relative to schemaFile
 * @private
 */
function _refTypeRefFor(schemaFile) {
    return (
        schemaFile === expectedRefTypeFP[0]
            ? ''
            : relative(dirname(schemaFile), expectedRefTypeFP[0])
    ) + expectedRefTypeFP[1]
}

/**
 * @function
 * @param {*} schema
 * @return {Generator<[string, *], void, *>} every node that has an `enum` or a `meta:enum`
 * @private
 */
const _findObjectWithEnum = (schema) => _findNodes(schema,
    n => 'enum' in n || 'meta:enum' in n)


/**
 * @param {*} actual
 * @param {*} expected
 * @param {string} msg
 * @param {string} schemaFile
 * @param {string} schemaPath
 * @private
 */
function _printError(actual, expected, msg, schemaFile, schemaPath) {
    console.error(
        '!!! ERROR:', msg,
        '\n   in file:', `file://${schemaFile}`,
        '\n  for path:', schemaPath,
        '\n    actual:', actual,
        '\n  expected:', expected
    )
}

// endregion utils

// region tests

/**
 * `$ref` must not reference its own file by name/path;
 * self-references must use the plain `#...` fragment form.
 * @param {*} schema
 * @param {string} schemaFile
 * @return {number} number of errors found
 */
function testNoSelfRefByFile(schema, schemaFile) {
    let errCnt = 0
    for (const [path, node] of _findRefs(schema)) {
        const ref = node['$ref']
        const hashPos = ref.indexOf('#')
        const filePart = hashPos === -1
            ? ref
            : ref.slice(0, hashPos)
        if (filePart === '') continue;
        const resolved = join(dirname(schemaFile), filePart)
        if (resolved === schemaFile) {
            ++errCnt
            const fragment = hashPos === -1
                ? '#'
                : ref.slice(hashPos)
            _printError(
                ref, fragment,
                'self-$ref must start with "#"',
                schemaFile, path)
        }
    }
    return errCnt
}

/**
 * `bom-ref` properties must `$ref` refType — and nothing else may.
 * @param {*} schema
 * @param {string} schemaFile
 * @return {number} number of errors found
 */
function testRefTypeUsage(schema, schemaFile) {
    const refTypeRef = _refTypeRefFor(schemaFile)
    // 'refLinkType' is the only allowed exception - it inherits from 'refType'
    const exceptionPath = schemaFile === expectedRefTypeFP[0]
        ? '$.$defs.refLinkType'
        : undefined

    let errCnt = 0
    for (const [path, node] of _findRefs(schema)) {
        const ref = node['$ref']
        if (path.endsWith('.properties.bom-ref')) {
            if (ref !== refTypeRef) {
                ++errCnt
                _printError(
                    ref, refTypeRef,
                    'wrong .$ref',
                    schemaFile, path)
            }
            continue
        }
        if (ref === refTypeRef && path !== exceptionPath) {
            ++errCnt
            _printError(
                ref, `different from: ${refTypeRef}`,
                'wrong use of refType - did you mean refLinkType?',
                schemaFile, path)
        }
    }
    return errCnt
}

/**
 * object schemas must have `additionalProperties: false`,
 * unless explicitly allowed via `$comment`.
 * @param {*} schema
 * @param {string} schemaFile
 * @return {number} number of errors found
 */
function testAdditionalPropertiesFalse(schema, schemaFile) {
    let errCnt = 0
    for (const [path, node] of _findObjectSchemas(schema)) {
        if (path.endsWith('.if') || path.endsWith('.not')) continue;
        const expected = typeof node['$comment'] === 'string'
            && node['$comment'].includes('additionalProperties explicitly allowed')
        const actual = node['additionalProperties']
        if (actual !== expected) {
            ++errCnt
            _printError(
                actual, expected,
                'wrong .additionalProperties',
                schemaFile, path)
        }
    }
    return errCnt
}

/**
 * `meta:enum` must be an object,
 * and every `enum` value must exist as a key in it.
 * @param {*} schema
 * @param {string} schemaFile
 * @return {number} number of errors found
 */
function testMetaEnum(schema, schemaFile) {
    let errCnt = 0
    for (const [path, node] of _findObjectWithEnum(schema)) {
        const metaEnum = node['meta:enum']
        if (metaEnum === undefined) {
            // metaEnum is optional
            continue
        }
        if (typeof metaEnum !== 'object' || metaEnum === null || Array.isArray(metaEnum)) {
            ++errCnt
            _printError(
                metaEnum, 'an object',
                'meta:enum must be an object',
                schemaFile, `${path}.meta:enum`)
            continue
        }
        const enumValues = node['enum']
        if (!Array.isArray(enumValues)) {
            ++errCnt
            _printError(
                enumValues, 'an array',
                'meta:enum without a sibling enum array',
                schemaFile, `${path}.enum`)
            continue
        }
        for (const value of enumValues) {
            if (!Object.hasOwn(metaEnum, value)) {
                ++errCnt
                _printError(
                    undefined, `a key ${JSON.stringify(String(value))}`,
                    'enum value missing in meta:enum',
                    schemaFile, `${path}.meta:enum`)
            }
        }
    }
    return errCnt
}

// endregion tests

// region main

/** @type {Readonly<Record<string, function(*, string): number>>} */
const tests = Object.freeze({
    'no self-$ref by file': testNoSelfRefByFile,
    'refType usage (`bom-ref` <-> refType)': testRefTypeUsage,
    'additionalProperties is `false`': testAdditionalPropertiesFalse,
    'meta:enum completeness': testMetaEnum,
})

const schemas = await Promise.all(schemaFiles.map(
    f => readFile(f, 'utf8').then(s => [f, JSON.parse(s)])
))

let errCnt = 0
for (const [schemaFile, schema] of schemas) {
    for (const [name, testFn] of Object.entries(tests)) {
        console.log('\ntest', name, 'in', schemaFile, '...')
        const errors = testFn(schema, schemaFile)
        if (errors === 0) {
            console.log('OK.')
        }
        errCnt += errors
    }
}

console.log('\n\n> found', errCnt, 'errors')
// Exit statuses should be in the range 0 to 254.
// The status 0 is used to terminate the program successfully.
process.exitCode = Math.min(errCnt, 254)

// endregion main