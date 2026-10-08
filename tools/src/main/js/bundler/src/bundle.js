import {basename, dirname, relative, resolve, sep} from 'node:path'
import {HOLLOW_COMMENT} from "./cleanup.js";

import {getJsonfile} from './helpers/common.js';
import {makeModuleName} from './helpers/cyclonedx.js';
import {escapeJsonPointer} from "./helpers/json-pointer-spec.js";
import {DATA_KEYWORDS, DEFS_KEYWORDS, REF_KEYWORDS, refSplit} from './helpers/json-schema-spec.js';

const FRAG_DEFS_PREFIX = `/${DEFS_KEYWORDS}/`;

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
    const targetDir = dirname(targetFile);
    const entryDir = dirname(entryFile);

    const fileModuleNames = Object.freeze(new Map(
        [entryFile, ...includeFiles].map(f => [f, makeModuleName(basename(f))])
    ));

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
                if (vSplit.path && (vSplit.path.includes(':') || vSplit.path.startsWith('/'))) {
                    // absolute (url) path -> external
                    external.add(v);
                    continue;
                }
                const refFile = vSplit.path
                    ? resolve(dirname(source), ...vSplit.path.split('/'))
                    : source;
                const moduleName = fileModuleNames.get(refFile);
                if (!moduleName) {
                    schema[k] = relative(targetDir, refFile).replace(sep, '/')
                        + (vSplit.frag ? `#${vSplit.frag}` : '');
                    // not rewired to bundled -> external
                    external.add(schema[k]);
                    continue
                }
                if (vSplit.frag && !vSplit.frag.startsWith('/')) {
                    // currently dont support anchors - only defs.
                    throw new Error(`Unexpected ref fragment: ${v}`);
                }
                schema[k] = (
                    refFile === entryFile && !vSplit.frag?.startsWith(FRAG_DEFS_PREFIX)
                        ? '#'
                        : `#${FRAG_DEFS_PREFIX}${escapeJsonPointer(moduleName)}`
                ) + (vSplit.frag ?? '');
                continue;
            }
            rewireRefs(v, source);
        }
    }

    const embedded = [];
    const seen = new Set();

    seen.add(entryFile);
    const schema = await getJsonfile(entryFile);
    const schemaDefsOrig = schema[DEFS_KEYWORDS];
    rewireRefs(schema, entryFile);
    schema[DEFS_KEYWORDS] = {};

    for (const [includeFile, moduleName] of fileModuleNames.entries()) {
        if (seen.has(includeFile)) continue;
        seen.add(includeFile);
        const includeSchema = await getJsonfile(includeFile);
        delete includeSchema.$schema;
        delete includeSchema.$id;
        rewireRefs(includeSchema, includeFile);
        schema[DEFS_KEYWORDS][moduleName] = includeSchema;
        embedded.push(includeFile);
    }

    if (schemaDefsOrig) {
        schema[DEFS_KEYWORDS][fileModuleNames.get(entryFile)] = {
            [DEFS_KEYWORDS]: schemaDefsOrig,
            not: {$comment: HOLLOW_COMMENT}
        };
    }

    return {
        schema,
        external: Object.freeze([...external].sort()),
        embedded: Object.freeze(embedded.sort().map(
            e => relative(entryDir, e).replaceAll(sep, '/')
        )),
    };
}
