#!/usr/bin/env node

import {glob, stat, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';

import {bundle} from './src/bundle.js';
import {dropComments, treeShake} from './src/cleanup.js';
import {ID_KEYWORD, subschemas} from './src/helpers/json-schema-spec.js';
import {validateSchema} from './src/sanity.js';
import {JSON_SCHEMA_RE, JSON_SCHEMA_EXT} from './src/helpers/common.js';

/**
 * Suffix basename with `-bundled`.
 *
 *  `…/foo.schema.json` -> `…/foo-bundled.schema.json`
 *
 * @param {string} s
 * @return {string}
 */
const toBundledName = (s) => {
    if (!s.endsWith(JSON_SCHEMA_EXT)) {
        throw new Error(`expected "*${JSON_SCHEMA_EXT}", got ${JSON.stringify(s)}`);
    }
    return s.replace(JSON_SCHEMA_RE, '-bundled$&');
};

/**
 * Suffix basename with `.min`.
 *
 * `…/foo.schema.json` -> `…/foo.min.schema.json`
 *
 * @param {string} s
 * @return {string}
 */
const toMinifiedName = (s) => {
    if (!s.endsWith(JSON_SCHEMA_EXT)) {
        throw new Error(`expected "*${JSON_SCHEMA_EXT}", got ${JSON.stringify(s)}`);
    }
    return s.replace(JSON_SCHEMA_RE, '.min$&');
};

class ValidationError extends Error {
    /** @type {Array<string>} */
    errors;

    /**
     * @param {Iterable<string>} errors
     * @param {ErrorOptions} [options]
     */
    constructor(errors, options) {
        super(undefined, options);
        delete this.message;
        this.errors = [...errors];
    }

    get message() {
        return 'Validation Errors:\n'
            + this.errors.map(e => `- ${e}`).sort().join('\n');
    }
}

/**
 * @typedef {object} MainResult
 * @property {import('./src/bundle.js').BundleResult} bundled
 * @property {import('./src/cleanup.js').TreeShakeResult} shaken
 * @property {import('./src/sanity.js').ValidationResult.warnings} validationWarnings
 * @property {string} bundledFile
 * @property {string} minifiedFile
 */

/**
 * @param {string} entryFile absolute path to entry file.
 * @param {string} includeDir absolute path to include dir.
 * @return {Promise<MainResult>}
 */
const main = async (entryFile, includeDir) => {
    const bundledFile = toBundledName(entryFile);
    const minifiedFile = toMinifiedName(bundledFile);

    const {schema, ...bundled} = await bundle(
        entryFile,
        (await Array.fromAsync(glob(join(includeDir, `**/*${JSON_SCHEMA_EXT}`)))),
        bundledFile);

    const shaken = treeShake(schema);

    const validationResult = validateSchema(schema);
    if (validationResult.errors.length) {
        throw new ValidationError(validationResult.errors);
    }

    await writeFile(bundledFile, JSON.stringify(schema, null, 2));

    subschemas(schema).forEach(s => dropComments(s));
    await writeFile(minifiedFile, JSON.stringify({
        ...schema,
        [ID_KEYWORD]: schema[ID_KEYWORD]
            ? toMinifiedName(schema[ID_KEYWORD])
            : undefined
    }));

    return {
        bundled,
        shaken,
        validationWarnings: validationResult.warnings,
        bundledFile,
        minifiedFile,
    };
};
export default main;

if (import.meta.main) {
    const E_INVALID = 1;
    const E_ERROR = 2;
    const [, , includeDir, entryFile] = process.argv;
    if (!includeDir || !entryFile) {
        const modules = join('schema', '2.0', 'modules');
        const entry = join('schema', '2.0', 'cyclonedx-2.0.schema.json');
        const bundled = toBundledName(entry);
        const minified = toMinifiedName(bundled);
        console.log('Usage: node cli.js <modules-directory> <root-schema-path>');
        console.log('');
        console.log('Example:');
        console.log(`  node cli.js \\`);
        console.log(`    ${modules} \\`);
        console.log(`    ${entry}`);
        console.log('');
        console.log('This will create:');
        console.log(`  ${bundled} (pretty-printed with all $comment)`);
        console.log(`  ${minified} (minified, root $comment only)`);
        process.exit(E_INVALID);
    }
    main(resolve(entryFile), resolve(includeDir))
        .then(async res => {
            const {bundled, shaken, validationWarnings, bundledFile, minifiedFile} = res;

            console.info(`bundler: embedded (${bundled.embedded.length}):`, bundled.embedded);
            console.info(`bundler: external (${bundled.external.length}):`, bundled.external);

            console.info(`tree-shake: removed (${shaken.removed.length}):`, shaken.removed);
            console.info(`tree-shake: hollowed (${shaken.hollowed.length}):`, shaken.hollowed);

            console.warn(`validation warnings (${validationWarnings.length}):`, validationWarnings);

            const {size: bundledSize} = await stat(bundledFile);
            console.log(`wrote ${bundledFile} (${bundledSize} bytes)`);

            const {size: minifiedSize} = await stat(minifiedFile);
            console.log(`wrote ${minifiedFile} (${minifiedSize} bytes)`);

            const minifiedDiff = bundledSize - minifiedSize;
            console.info(`minification saved ${minifiedDiff} bytes ~ ${((minifiedDiff / bundledSize) * 100).toFixed(2)} %`);
        })
        .catch(err => {
            console.error(err);
            process.exitCode = E_ERROR;
        });
}
