import {basename, dirname, relative, resolve, sep} from 'node:path'

import {getJsonfile} from './helpers/common.js';
import {makeModuleName} from './helpers/cyclonedx.js';
import {DATA_KEYWORDS, DEFS_KEYWORDS, REF_KEYWORDS, refSplit} from './helpers/json-schema-spec.js';

/**
 * Load and bundle a schema.
 *
 * Supports references only, no support for anchors, yet.
 *
 * @param {string} entryFile Absolute entry point schema file.
 * @param {Iterable<string>} includeFiles Absolute dir to schema files that shall be bundled.
 * @param {string} targetFile Absolute target schema file.
 */
export async function bundle(entryFile, includeFiles, targetFile) {
    const entryDir = dirname(entryFile);
    const includeFileSet = Object.freeze(new Set(includeFiles));

    const external = new Set();

    function rewireRefs(schema, source) {
        if (typeof schema !== 'object' || schema === null) return;
        if (Array.isArray(schema)) {
            return schema.forEach(v => rewireRefs(v, source));
        }
        for (const [k, v] of Object.entries(schema)) {
            if (DATA_KEYWORDS.has(k)) continue;
            if (REF_KEYWORDS.has(k)) {
                if (typeof v !== 'string') continue;
                const vSplit = refSplit(v);
                if (vSplit.frag && !vSplit.frag.startsWith('/')) {
                    throw new Error(`Malformed ref: ${v}`);
                }
                if (vSplit.path.includes(':')) {
                    // absolute (url) path -> external
                    external.add(v);
                    continue;
                }
                const refFile = vSplit.path === ''
                    ? source
                    : resolve(dirname(source), ...vSplit.path.split('/'));
                if (refFile === entryFile) {
                    schema[k] = `#${vSplit.frag ?? ''}`;
                } else if (includeFileSet.has(refFile)) {
                    schema[k] = `#/${DEFS_KEYWORDS}/${makeModuleName(basename(refFile))}${vSplit.frag ?? ''}`;
                } else {
                    schema[k] = relative(dirname(targetFile), refFile)
                    + (vSplit.frag === undefined ? '' : `#${vSplit.frag}`);
                    // not rewired to bundled -> external
                    external.add(refFile);
                }
                continue;
            }
            rewireRefs(v, source);
        }
    }

    const embedded = [];
    const seen = new Set();

    seen.add(entryFile);
    const schema = await getJsonfile(entryFile);
    rewireRefs(schema, entryFile);

    for (const includeFile of includeFileSet) {
        if (seen.has(includeFiles)) continue;
        seen.add(includeFile);
        const includeSchema = await getJsonfile(includeFile);
        delete includeSchema.$schema;
        delete includeSchema.$id;
        rewireRefs(includeSchema, includeFile);
        const moduleName = makeModuleName(basename(includeFile));
        schema[DEFS_KEYWORDS][moduleName] = includeSchema;
        embedded.push(includeFile);
    }

    return {
        schema,
        external: Object.freeze([...external].sort()),
        embedded: Object.freeze(embedded.sort().map(
            e => relative(entryDir, e).replaceAll(sep, '/')
        )),
    };
}
