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
    n => '$ref' in n)

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

const _RefBestPracticeAllowedSiblings = Object.freeze(new Set([
    '$ref', // the $ref itself
    '$comment', 'title', 'description', 'examples', // documentational
    /* do NOT add any non-documentationals
       instead, use:
       { "allOf": { "$ref": ... }, "$id" ..., "$anchor": ... }
       { "allOf": { "$ref": ... }, "default" ... }
       instead of additionalProperties -- { "allOf": { "$ref": ... }, "unevaluatedItems" ... }
     */
]))

/**
 * `$ref` must follow JSON schema best-practice,
 * based on {@link _RefBestPracticeAllowedSiblings}
 * @param {*} schema
 * @param {string} schemaFile
 * @return {number} number of errors found
 */
function testRefBestPractice(schema, schemaFile) {
    let errCnt = 0
    for (const [path, node] of _findRefs(schema)) {
        const ref = node['$ref']

        if (typeof ref !== 'string') {
            ++errCnt
            _printError(
                ref, 'a string',
                'unexpected type of $ref',
                schemaFile, `${path}.$ref`)
            continue
        }

        if (ref.startsWith('/')) {
            ++errCnt
            _printError(
                ref, 'a string',
                'absolute $ref',
                schemaFile, `${path}.$ref`)
        } else {
            const hashPos = ref.indexOf('#')
            const filePart = hashPos === -1
                ? ''
                : ref.slice(0, hashPos)
            if (filePart !== '') {
                const resolved = join(dirname(schemaFile), filePart)
                if (resolved === schemaFile) {
                    ++errCnt
                    const fragment = hashPos === -1
                        ? ref
                        : ref.slice(hashPos)
                    _printError(
                        ref, fragment,
                        'same-file $ref must start with "#"',
                        schemaFile, path)
                }
            }
        }

        const otherKeys = new Set(Object.keys(node))
        for (const key of otherKeys.difference(_RefBestPracticeAllowedSiblings)) {
            ++errCnt
            _printError(
                'present', 'absent',
                'unexpected key along with $ref',
                schemaFile, `${path}.${key}`)
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
        if (ref === refTypeRef) {
            if (exceptionPath && path.startsWith(exceptionPath)) continue;
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
 * object schemas must have `additionalProperties` set,
 * unless `unevaluatedProperties` is set,
 * or `$comment` containing 'this is a mixin',
 * or explicitly allowed via `$comment` containing 'additionalproperties explicitly allowed'.
 * @param {*} schema
 * @param {string} schemaFile
 * @return {number} number of errors found
 */
function testAdditionalProperties(schema, schemaFile) {
    let errCnt = 0
    for (const [path, node] of _findObjectSchemas(schema)) {
        if (Object.keys(node).join('|') === 'type') {
            // this is a sole type constraint
            continue
        }

        const unevaluatedProperties = node.unevaluatedProperties
        const additionalProperties = node.additionalProperties

        if (unevaluatedProperties !== undefined) {
            // Don't need 'additionalProperties', since 'unevaluatedProperties' takes care.
            // see https://json-schema.org/draft/2020-12/json-schema-core#section-11.3
            if (additionalProperties !== undefined) {
                ++errCnt
                _printError(
                    'both set', 'exactly one set',
                    'either .additionalProperties or .unevaluatedProperties should be set',
                    schemaFile, path)
            }
            continue;
        }

        const commentLC = typeof node['$comment'] === 'string'
            ? node['$comment'].toLowerCase()
            : ''

        if (commentLC.includes('this is a mixin')) {
            // This is a mixin. It intentionally does NOT restrict additional/unevaluated properties itself; schemas composing it via `allOf` are expected to close themselves with `unevaluatedProperties: false` so that both their own defined properties and these patternProperties remain usable.
            continue;
        }

        const expected = commentLC.includes('additionalproperties explicitly allowed')
        const actual = additionalProperties
        if (actual !== expected) {
            ++errCnt
            _printError(
                actual, expected,
                'either .additionalProperties or .unevaluatedProperties must be set',
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
        const enumSet = new Set(enumValues)
        const metaSet = new Set(Object.keys(metaEnum))

        for (const value of enumSet.difference(metaSet)) {
            ++errCnt
            _printError(
                undefined, `a key ${JSON.stringify(value)}`,
                'enum value missing in meta:enum',
                schemaFile, `${path}.meta:enum`)
        }
        for (const value of metaSet.difference(enumSet)) {
            ++errCnt
            _printError(
                undefined, `a string ${JSON.stringify(value)}`,
                'meta:enum value missing in enum',
                schemaFile, `${path}.enum`)
        }
    }
    return errCnt
}

// endregion tests

// region main

/** @type {Readonly<Record<string, function(*, string): number>>} */
const tests = Object.freeze({
    '$ref best practice': testRefBestPractice,
    'refType usage (`bom-ref` <-> refType)': testRefTypeUsage,
    'additionalProperties is `false`': testAdditionalProperties,
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
