"use strict";

/**
 * validate all schemas for a given version of CycloneDX.
 * call the script via `node -- <this-file> -v <CDX-version>`
 */


import {parseArgs, styleText} from "node:util";
import {readFile, stat} from 'node:fs/promises'
import {dirname, basename, join, relative} from 'node:path'
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
console.debug('DEBUG | schemaModelDir = ', schemaModelDir);

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

// region tests

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

/**
 * @param {*} node
 * @param {string} path
 * @return {Generator<Generator<*|[string,*], void, any&any>|(string|*)[], void, *>}
 * @private
 */
function* _findBomRefProperties(node, path = '$') {
    if (Array.isArray(node)) {
        for (const [i, item] of node.entries()) {
            yield* _findBomRefProperties(item, `${path}[${i}]`);
        }
    } else if (node !== null && typeof node === 'object') {
        if (node.properties?.['bom-ref'] !== undefined) {
            yield [`${path}.properties.bom-ref`, node.properties['bom-ref']];
        }
        for (const [key, value] of Object.entries(node)) {
            yield* _findBomRefProperties(value, `${path}.${key}`);
        }
    }
}

/**
 * @param {string} schema
 * @param {string} schemaFile
 * @return {number}
 */
function testBomRefRefTypes(schema, schemaFile) {
    const expected = (
        schemaFile === expectedRefTypeFP[0]
            ? ''
            : relative(dirname(schemaFile), expectedRefTypeFP[0])
    ) + expectedRefTypeFP[1]

    let errCnt = 0
    for (const [path, node] of _findBomRefProperties(schema)) {
        const actual = node['$ref']
        if (actual !== expected) {
            ++errCnt
            _printError(
                actual, expected,
                'wrong .$ref',
                schemaFile, path)
        }
    }
    return errCnt
}


/**
 * @param node
 * @param path
 * @return {Generator<Generator<*|[string,*], void, any&any>|(string|*)[], void, *>}
 * @private
 */
function* _findRefs(node, path = '$') {
    if (Array.isArray(node)) {
        for (const [i, item] of node.entries()) {
            yield* _findRefs(item, `${path}[${i}]`);
        }
    } else if (node !== null && typeof node === 'object') {
        if (typeof node['$ref'] === 'string') {
            yield [path, node['$ref']];
        }
        for (const [key, value] of Object.entries(node)) {
            if (key === 'enum' || key === 'const' || key === 'examples' || key === 'default') continue;
            yield* _findRefs(value, `${path}.${key}`);
        }
    }
}

/**
 * @param {*} schema
 * @param {string} schemaFile
 * @return {number}
 */
function testRefTypeOnlyForBomRef(schema, schemaFile) {
    const refTypeRef = (
        schemaFile === expectedRefTypeFP[0]
            ? ''
            : relative(dirname(schemaFile), expectedRefTypeFP[0])
    ) + expectedRefTypeFP[1]

    let errCnt = 0
    for (const [path, ref] of _findRefs(schema)) {
        if (ref !== refTypeRef) continue
        // TODO: refLinkType itself should be allowed for inheritance
        if (!path.endsWith('.properties.bom-ref')) {
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
 * @param {*} node
 * @param {string} path
 * @return {Generator<(string|*)[]|Generator<*|[string,*], void, any&any>, void, *>}
 * @private
 */
function* _findObjectSchemas(node, path = '$') {
    if (Array.isArray(node)) {
        for (const [i, item] of node.entries()) {
            yield* _findObjectSchemas(item, `${path}[${i}]`);
        }
    } else if (node !== null && typeof node === 'object') {
        const isObjectSchema = node.type === 'object'
            || (Array.isArray(node.type) && node.type.includes('object'))
        if (isObjectSchema) {
            yield [path, node];
        }
        for (const [key, value] of Object.entries(node)) {
            // don't descend into keys whose values aren't schemas
            if (key === 'enum' || key === 'const' || key === 'examples' || key === 'default') continue;
            yield* _findObjectSchemas(value, `${path}.${key}`);
        }
    }
}


/**
 * @param {*} schema
 * @param {string} schemaFile
 * @return {number}
 */
function testAdditionalPropertiesFalse(schema, schemaFile) {
    const expected = false

    let errCnt = 0
    for (const [path, node] of _findObjectSchemas(schema)) {
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


// endregion tests


const schemas = await Promise.all(schemaFiles.map(
    f => readFile(f).then(s => [f, JSON.parse(s)])
))

let errCnt = 0
for (const [schemaFile, schema] of schemas) {
    console.log('\ntest `bom-ref` is `refType` in', schemaFile, '...')
    const bomRefTypeErrors = testBomRefRefTypes(schema, schemaFile)
    if (bomRefTypeErrors === 0) {
        console.log('OK.')
    }
    errCnt += bomRefTypeErrors

    console.log('\ntest `refType` only for `bom-ref` in', schemaFile, '...')
    const refTypeErrors = testRefTypeOnlyForBomRef(schema, schemaFile)
    if (refTypeErrors === 0) {
        console.log('OK.')
    }
    errCnt += refTypeErrors

    console.log('\ntest additionalProperties is `false` in', schemaFile, '...')
    const additioanlPropsErrors = testAdditionalPropertiesFalse(schema, schemaFile)
    if (additioanlPropsErrors === 0) {
        console.log('OK.')
    }
    errCnt += additioanlPropsErrors
}


console.log('\n\n> found', errCnt, 'errors')
// Exit statuses should be in the range 0 to 254.
// The status 0 is used to terminate the program successfully.
process.exitCode = Math.min(errCnt, 254)
