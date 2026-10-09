import {basename, dirname, relative, resolve} from 'node:path'

import {JSON_SCHEMA_RE, getJsonfile, unixPath} from './helpers/common.js';
import {escapeJsonPointer} from './helpers/json-pointer-spec.js';
import {
    ANCHOR_KEYWORDS, ID_KEYWORD, NOT_KEYWORD, SCHEMA_KEYWORD, COMMENT_KEYWORD, DEFS_KEYWORDS, REF_KEYWORDS,
    subschemas,
    refIsAbsolute, refSplit, refJoin,
} from './helpers/json-schema-spec.js';


const HOLLOW_COMMENT =
    'This schema is hollow: it is as a container for definitions. ' +
    'Itself must not be used for validation.';


const FRAG_DEFS_PREFIX = `/${DEFS_KEYWORDS}/`;

/**
 * @param {string} f
 * @return {string}
 */
const makeModuleName = (f) =>
    f.replace(JSON_SCHEMA_RE, '');


/**
 * @typedef {object} BundleResult
 * @property {*} schema
 * @property {string[]} embedded embedded schema files
 * @property {Array<[string, string]>} external external refs
 * @property {Array<[string, string]>} rewired rewired refs
 */

/**
 * Load and bundle a schema.
 *
 * Does not convert between meta-schemas.
 * Bundles ALL `includeFiles`.
 * References are rewired.
 * - Absolutes are kept untouched and treated as externals.
 * - External file paths become relative to `targetFile`.
 * - Bundled support JSON pointers.
 * - Bundler does not support anchors.
 * - Bundler is not aware of IDs.
 *
 * The bundler does not check if the old references existed in the first place, and therefore it does not check if th rewired ones exist either.
 *
 * @param {string} entryFile Absolute path to entry point schema file.
 * @param {Iterable<string>} includeFiles Absolute path to schema files that shall be bundled.
 * @param {string} targetFile Absolute path to target schema file.
 * @return {Promise<BundleResult>}
 */
export const bundle = async (entryFile, includeFiles, targetFile) => {
    const targetDir = dirname(targetFile);
    const entryDir = dirname(entryFile);

    const fileModuleNames = Object.freeze(new Map(
        [entryFile, ...includeFiles].map(f => [f, makeModuleName(basename(f))])
    ));
    const entryModuleName = fileModuleNames.get(entryFile);

    /** @type {Map<string, string>} */
    const embeddedMap = new Map();
    /** @type {Set<string>} */
    const externals = new Set();
    /** @type {Map<string, string>} */
    const rewiredMap = new Map();

    /**
     * @param {*} schema
     * @param {string} sourceFile
     * @return {Promise<void>}
     */
    const rewireRefs = async (schema, sourceFile) => {
        for (const k of REF_KEYWORDS) {
            const v = schema[k];
            if (typeof v !== 'string') continue;
            if (refIsAbsolute(v)) {
                externals.add(v);
                continue;
            }
            let rewired
            const {path, frag} = refSplit(v);
            const refFile = path
                ? resolve(dirname(sourceFile), ...path.split('/'))
                : sourceFile;
            const moduleName = fileModuleNames.get(refFile);
            if (moduleName) {
                if (frag && !frag.startsWith('/')) {
                    // currently dont support anchors - only JSON pointer.
                    throw new RangeError(`Unsupported ref fragment: ${v}`);
                }
                rewired = {
                    path: null,
                    frag: (refFile === entryFile && !frag?.startsWith(FRAG_DEFS_PREFIX)
                            ? ''
                            : `${FRAG_DEFS_PREFIX}${escapeJsonPointer(moduleName)}`
                    ) + (frag ?? '')
                };
            } else {
                rewired = {
                    path: unixPath(relative(targetDir, refFile)),
                    frag
                };
            }
            rewiredMap.set(
                refJoin({path: refFile, frag}),
                schema[k] = refJoin(rewired));
            if (rewired.path) {
                externals.add(schema[k]);
            }
        }
        await Promise.all(
            subschemas(schema).map(s => rewireRefs(s, sourceFile))
        );
    }

    const schema = await getJsonfile(entryFile);
    if (URL.canParse(schema[ID_KEYWORD])) {
        schema[ID_KEYWORD] = new URL(
            unixPath(relative(entryDir, targetFile)),
            schema[ID_KEYWORD]
        ).toString();
    }
    await rewireRefs(schema, entryFile);
    const schemaDefsOrig = schema[DEFS_KEYWORDS];
    schema[DEFS_KEYWORDS] = Object.fromEntries( // deterministic order
        [...fileModuleNames.values()].sort().map(m => [m, undefined]));
    if (schemaDefsOrig) {
        schema[DEFS_KEYWORDS][entryModuleName] = {
            [DEFS_KEYWORDS]: schemaDefsOrig,
            [NOT_KEYWORD]: {$comment: HOLLOW_COMMENT}
        };
        embeddedMap.set(`${entryFile}#${FRAG_DEFS_PREFIX}`, `#${FRAG_DEFS_PREFIX}${escapeJsonPointer(entryModuleName)}`);
    } else {
        delete schema[DEFS_KEYWORDS][entryModuleName];
    }

    for (const [includeFile, moduleName] of fileModuleNames.entries()) {
        if (includeFile === entryFile) continue;
        if (schema[DEFS_KEYWORDS][moduleName] !== undefined) {
            throw new Error(`Collision: ${moduleName}`);
        }
        const includeSchema = await getJsonfile(includeFile);
        delete includeSchema[SCHEMA_KEYWORD];
        delete includeSchema[ID_KEYWORD];
        delete includeSchema[COMMENT_KEYWORD];
        await rewireRefs(includeSchema, includeFile);
        schema[DEFS_KEYWORDS][moduleName] = includeSchema;
        embeddedMap.set(includeFile, `#${FRAG_DEFS_PREFIX}${escapeJsonPointer(moduleName)}`);
    }

    return {
        schema,
        external: Array.from(externals),
        embedded: Array.from(embeddedMap.entries(),
            ([f, d]) => [unixPath(relative(entryDir, f)), d]),
        rewired: Array.from(rewiredMap.entries(),
            ([f, t]) => {
                if (!f.startsWith('#')) {
                    const {path, frag} = refSplit(f);
                    f = refJoin({path: unixPath(relative(entryDir, path)), frag});
                }
                return [f, t];
            }
        ),
    };
};
