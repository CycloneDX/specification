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
 * Make a value constraints test for a specific node.
 * @param {*} node
 * @return {function(*): boolean} value constraints test
 * @private
 */
function _makeValueConstraintTest(node) {
    if (node.type === undefined) return () => true
    const typeChecks = [...new Set(
        Array.isArray(node.type)
            ? node.type
            : [node.type]
    )].map(type => {
        const constraints = []
        switch (type) {
            case 'array':
                // https://json-schema.org/understanding-json-schema/reference/array
                constraints.push(v => Array.isArray(v))
                if ('minItems' in node) {
                    const minItems = node.minItems
                    constraints.push(v => v.length >= minItems)
                }
                if ('maxItems' in node) {
                    const maxItems = node.maxItems
                    constraints.push(v => v.length <= maxItems)
                }
                if (node.uniqueItems === true) {
                    // TODO: current implementation only works for primitives
                    constraints.push(v => v.length === new Set(v).size)
                }
                // TODO: node.prefixItems
                // TODO: tuple array
                break
            case 'boolean':
                // https://json-schema.org/understanding-json-schema/reference/boolean
                constraints.push(v => (v === true || v === false))
                break
            case 'null':
                // https://json-schema.org/understanding-json-schema/reference/null
                constraints.push(v => v === null)
                break
            case 'integer':
                // https://json-schema.org/understanding-json-schema/reference/numeric#integer
                constraints.push(v => Number.isInteger(v))
            // falls through to 'number'
            case 'number':
                // https://json-schema.org/understanding-json-schema/reference/numeric
                constraints.push(v => typeof v === 'number')
                if ('minimum' in node) {
                    const minimum = node.minimum
                    constraints.push(v => v >= minimum)
                }
                if ('exclusiveMinimum' in node) {
                    const exclusiveMinimum = node.exclusiveMinimum
                    constraints.push(v => v > exclusiveMinimum)
                }
                if ('exclusiveMaximum' in node) {
                    const exclusiveMaximum = node.exclusiveMaximum
                    constraints.push(v => v < exclusiveMaximum)
                }
                if ('maximum' in node) {
                    const maximum = node.maximum
                    constraints.push(v => v <= maximum)
                }
                if ('multipleOf' in node) {
                    const multipleOf = node.multipleOf
                    constraints.push(
                        /* The mathematical correct version:
                         *      v => v % node.multipleOf === 0
                         *  has implementational issues -- as an example:
                         *      0.3 % 0.1 = 0.09999999999999998
                         *  So we use a tolerance or a rounding check instead.
                         */
                        v => Math.abs(v / multipleOf - Math.round(v / multipleOf)) < 1e-9
                    )
                }
                break
            case 'object':
                constraints.push(v => typeof v === 'object' && v !== null && !Array.isArray(v))
                // TODO: required
                // TODO: properties
                // TODO: minProperties
                // TODO: maxProperties
                // TODO: patternProperties
                break
            case 'string':
                // https://json-schema.org/understanding-json-schema/reference/string
                constraints.push(v => typeof v === 'string')
                if ('minLength' in node) {
                    const minLength = node.minLength
                    constraints.push(v => v.length >= minLength)
                }
                if ('maxLength' in node) {
                    const maxLength = node.maxLength
                    constraints.push(v => v.length <= maxLength)
                }
                if ('pattern' in node) {
                    // https://json-schema.org/understanding-json-schema/reference/string#regexp
                    const pattern = new RegExp(node.pattern)
                    constraints.push(v => pattern.test(v))
                }
                // TODO: node.format
                break
            default:
                throw new Error(`Unsupported type: ${JSON.stringify(node.type)}`)
        }
        return constraints
    })
    return v => typeChecks.some(ts => ts.every(t => t(v)))
}

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
    n => 'enum' in n)

const _findObjectWithDefault = (schema) => _findNodes(schema,
    n => 'default' in n)

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

const _REF_ALLOWED_SIBLINGS = Object.freeze(new Set([
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
 * `$ref` must follow JSON schema best-practice.
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
                ? ref
                : ref.slice(0, hashPos)
            if (filePart !== '') {
                const resolved = join(dirname(schemaFile), filePart)
                if (resolved === schemaFile) {
                    ++errCnt
                    const fragment = hashPos === -1
                        ? '#'
                        : ref.slice(hashPos)
                    _printError(
                        ref, fragment,
                        'same-file $ref must start with "#"',
                        schemaFile, path)
                }
            }
        }

        const otherKeys = new Set(Object.keys(node))
        for (const key of otherKeys.difference(_REF_ALLOWED_SIBLINGS)) {
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
            continue
        }

        const commentLC = typeof node['$comment'] === 'string'
            ? node['$comment'].toLowerCase()
            : ''

        if (commentLC.includes('this is a mixin')) {
            // This is a mixin. It intentionally does NOT restrict additional/unevaluated properties itself; schemas composing it via `allOf` are expected to close themselves with `unevaluatedProperties: false` so that both their own defined properties and these patternProperties remain usable.
            continue
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
 * Enum values adheres constraints.
 * @param {*} schema
 * @param {string} schemaFile
 * @return {number} number of errors found
 */
function testEnumValues(schema, schemaFile) {
    let errCnt = 0
    for (const [path, node] of _findObjectWithEnum(schema)) {
        const valueConstraintTest = _makeValueConstraintTest(node)
        for (const enumValue of node.enum) {
            if (!valueConstraintTest(enumValue)) {
                ++errCnt
                _printError(
                    enumValue, `in range of type and constraints`,
                    'enum value out of range',
                    schemaFile, `${path}.enum`)
            }
        }
    }
    return errCnt
}

/**
 * Default values adheres constraints.
 * @param {*} schema
 * @param {string} schemaFile
 * @return {number} number of errors found
 */
function testDefaultValues(schema, schemaFile) {
    let errCnt = 0
    for (const [path, node] of _findObjectWithDefault(schema)) {
        if (path.endsWith('.properties')) continue;
        const defaultValue = node.default
        if ('const' in node) {
            if (defaultValue !== node.const) {
                ++errCnt
                _printError(
                    defaultValue, node.const,
                    'default value out of range',
                    schemaFile, `${path}.default`)
            }
            continue
        }
        if ('enum' in node) {
            if (undefined === node.enum.find(e => e === defaultValue)) {
                ++errCnt
                _printError(
                    defaultValue, `one of ${JSON.stringify(node.enum)}`,
                    'default value out of range',
                    schemaFile, `${path}.default`)
            }
            continue
        }
        if (!_makeValueConstraintTest(node)(defaultValue)) {
            ++errCnt
            _printError(
                defaultValue, `in range of type and constraints`,
                'default value out of range',
                schemaFile, `${path}.default`)
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
    'enum value in range': testEnumValues,
    'default value in range': testDefaultValues,
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
