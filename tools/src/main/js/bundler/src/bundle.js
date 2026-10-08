import {stat} from 'node:fs/promises';
import {basename, dirname, relative, resolve} from 'node:path'

import {getJsonfile, unixPath} from './helpers/common.js';
import {makeModuleName} from './helpers/cyclonedx.js';
import {escapeJsonPointer} from "./helpers/json-pointer-spec.js";
import {
    DEFS_KEYWORDS, REF_KEYWORDS,
    subschemas,
    refIsAbsolute, refSplit
} from './helpers/json-schema-spec.js';

const HOLLOW_COMMENT =
    "This schema is hollow: it remains as a container for definitions. " +
    "Itself must not be used for validation.";


const FRAG_DEFS_PREFIX = `/${DEFS_KEYWORDS}/`;

/**
 * Load and bundle a schema.
 *
 * Does not convert between meta-schemas.
 * Bundles ALL `includeFiles`.
 * References are rewired.
 * - Absolutes are kept untouched and treated as externals.
 * - External file paths become relative to `targetFile`.
 * - Bundled support JSON pointers only, no support for anchors, yet.
 *
 * @param {string} entryFile Absolute path to entry point schema file.
 * @param {Iterable<string>} includeFiles Absolute path to schema files that shall be bundled.
 * @param {string} targetFile Absolute path to target schema file.
 * @return {Promise<{schema: *, external: ReadonlyArray<string>, embedded: ReadonlyArray<string>}>}
 */
export async function bundle(entryFile, includeFiles, targetFile) {
    const targetDir = dirname(targetFile);
    const entryDir = dirname(entryFile);

    const fileModuleNames = Object.freeze(new Map(
        [entryFile, ...includeFiles].map(f => [f, makeModuleName(basename(f))])
    ));
    const entryModuleName = fileModuleNames.get(entryFile);

    const external = new Set();

    /**
     * @param {*} schema
     * @param {string} sourceFile
     * @return {Promise<void>}
     */
    async function rewireRefs(schema, sourceFile) {
        for (const k of REF_KEYWORDS) {
            const v = schema[k];
            if (typeof v !== 'string') continue;
            if (refIsAbsolute(v)) {
                external.add(v);
                continue;
            }
            const {path, frag} = refSplit(v);
            const refFile = path
                ? resolve(dirname(sourceFile), ...path.split('/'))
                : sourceFile;
            const moduleName = fileModuleNames.get(refFile);
            if (!moduleName) {
                if (!(await stat(refFile)).isFile()) {
                    throw new Error(`Not a file: ${refFile}`);
                }
                schema[k] = unixPath(relative(targetDir, refFile))
                    + (frag ? `#${frag}` : '');
                // not rewired to bundled -> external
                external.add(schema[k]);
                continue
            }
            if (frag && !frag.startsWith('/')) {
                // currently dont support anchors - only defs.
                throw new Error(`Unsupported ref fragment: ${v}`);
            }
            schema[k] = (
                refFile === entryFile && !frag?.startsWith(FRAG_DEFS_PREFIX)
                    ? '#'
                    : `#${FRAG_DEFS_PREFIX}${escapeJsonPointer(moduleName)}`
            ) + (frag ?? '');
        }
        await Promise.all(
            subschemas(schema).map(s => rewireRefs(s, sourceFile))
        );
    }

    const schema = await getJsonfile(entryFile);
    if (URL.canParse(schema.$id)) {
        schema.$id = new URL(
            unixPath(relative(entryDir, targetFile)),
            schema.$id
        ).toString();
    }
    await rewireRefs(schema, entryFile);
    const schemaDefsOrig = schema[DEFS_KEYWORDS];
    schema[DEFS_KEYWORDS] = Object.fromEntries( // deterministic order
        [...fileModuleNames.values()].sort().map(m => [m, undefined]));

    const embedded = new Map();
    await Promise.all(
        fileModuleNames.entries().filter(([f,]) => f !== entryFile).map(
            async ([includeFile, moduleName]) => {
                const includeSchema = await getJsonfile(includeFile);
                delete includeSchema.$schema;
                delete includeSchema.$id;
                delete includeSchema.$comment;
                await rewireRefs(includeSchema, includeFile);
                schema[DEFS_KEYWORDS][moduleName] = includeSchema;
                embedded.set(includeFile, `#${FRAG_DEFS_PREFIX}${escapeJsonPointer(moduleName)}`);
            }
        )
    );
    if (schemaDefsOrig) {
        schema[DEFS_KEYWORDS][entryModuleName] = {
            [DEFS_KEYWORDS]: schemaDefsOrig,
            not: {$comment: HOLLOW_COMMENT}
        };
        embedded.set(`${entryFile}#${FRAG_DEFS_PREFIX}`, `#${FRAG_DEFS_PREFIX}${escapeJsonPointer(entryModuleName)}`);
    } else {
        delete schema[DEFS_KEYWORDS][entryModuleName];
    }

    return {
        schema,
        external: Object.freeze([...external].sort()),
        embedded: Object.freeze(Array.from(embedded.entries(),
            ([f, d]) => `${unixPath(relative(entryDir, f))} -> ${d}`
        ).sort())
    };
}
