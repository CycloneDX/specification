#!/usr/bin/env node

import {writeFile, stat} from 'node:fs/promises';

import {bundle} from './src/bundle.js';
import {dropCommentsExceptRoot} from './src/cleanup.js';
import {treeShake} from './src/tree-shake.js';
import {EXT_JSON, EXT_SCHEMA_RE} from './src/helpers/common.js';

/** `…/foo.schema.json` -> `…/foo-bundled.schema.json` */
const toBundledName = (s) => {
    if (!s.endsWith(EXT_JSON)) {
        throw new Error(`expected "*${EXT_JSON}", got ${s}`);
    }
    return s.replace(EXT_SCHEMA_RE, '-bundled$&');
};

/** `…/foo.schema.json` -> `…/foo.min.schema.json` */
const toMinifiedName = (s) => {
    if (!s.endsWith(EXT_JSON)) {
        throw new Error(`expected "*${EXT_JSON}", got ${s}`);
    }
    return s.replace(EXT_SCHEMA_RE, '.min$&');
};

const main = async (entryFile, includeDir) => {
    const bundledFile = toBundledName(entryFile);
    const minifiedFile = toMinifiedName(bundledFile);

    const {schema, ...bundled} = await bundle(entryFile, includeDir);
    schema.$id = (schema.$id);

    const shaken = treeShake(schema);

    await writeFile(bundledFile, JSON.stringify(schema, null, 2));

    dropCommentsExceptRoot(schema);

    await writeFile(minifiedFile, JSON.stringify({
        ...schema,
        $id: toMinifiedName(schema.$id)
    }));

    return {
        bundled,
        shaken,
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
        const entry = './schema/2.0/cyclonedx-2.0.schema.json';
        const bundled = toBundledName(entry);
        const minified = toMinifiedName(bundled);
        console.log('Usage: node cli.js <modules-directory> <root-schema-path>');
        console.log('');
        console.log('Example:');
        console.log(`  node cli.js \\`);
        console.log('    ./schema/2.0/modules \\');
        console.log(`    ${entry}`);
        console.log('');
        console.log('This will create:');
        console.log(`  ${bundled} (pretty-printed with all $comment)`);
        console.log(`  ${minified} (minified, root $comment only)`);
        process.exit(E_INVALID);
    }
    main(entryFile, includeDir)
        .then(async res => {
            const {bundled, shaken, bundledFile, minifiedFile} = res;

            console.info(`bundler: embedded (${bundled.embedded.length}):`, bundled.embedded);
            console.info(`bundler: external (${bundled.external.length}):`, bundled.external);

            console.info(`tree-shake: removed (${shaken.removed.length}):`, shaken.removed);
            console.info(`tree-shake: hollowed (${shaken.hollowed.length}):`, shaken.hollowed);

            const {size: bundledSize} = await stat(bundledFile);
            console.log(`wrote ${bundledFile} (${bundledSize} bytes)`);

            const {size: minifiedSize} = await stat(minifiedFile);
            console.log(`wrote ${minifiedFile} (${minifiedSize} bytes)`);

            const minifiedDiff = bundledSize - minifiedSize;
            console.info(`minification saved ${minifiedDiff} bytes ~ ${((bundledSize / minifiedDiff) * 100).toFixed(2)} %`);
        })
        .catch(err => {
            console.error(err);
            process.exitCode = E_ERROR;
        });
}
