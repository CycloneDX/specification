import {basename, dirname, relative, resolve} from 'node:path'

import {JSON_SCHEMA_RE, getJsonfile, posixPath, findDuplicateValues} from './helpers/common.js';
import {escapeJsonPointer, PREFIX as JP_REFIX} from './helpers/json-pointer-spec.js';
import {
    ID_KEYWORD, NOT_KEYWORD, SCHEMA_KEYWORD, COMMENT_KEYWORD, DEFS_KEYWORD, REF_KEYWORDS,
    subschemas,
    refIsAbsolute, refSplit, refJoin, FRAG_SEP,
} from './helpers/json-schema-spec.js';
import {PATH_SEP as URI_PATH_SEP} from './helpers/uri.js';


const HOLLOW_COMMENT =
    'This schema is hollow: it is as a container for definitions. ' +
    'Itself must not be used for validation.';


const FRAG_DEFS_PREFIX = `${JP_REFIX}${DEFS_KEYWORD}${JP_REFIX}`;

/**
 * @param {string} f
 * @returns {string}
 */
const makeModuleName = (f) =>
    f.replace(JSON_SCHEMA_RE, '');

class ModuleNameCollisionError extends Error {
    /** @type {Map<string, string[]>} */
    collisions;

    /**
     * @param {Map<string, string[]>} collisions
     * @param {ErrorOptions} [options]
     */
    constructor(collisions, options) {
        super(undefined, options);
        delete this.message;
        this.collisions = collisions;
    }

    get message() {
        return 'ModuleName collisions:\n'
            + Array.from(this.collisions,
                ([m, ds]) => `- ${m} -> ${JSON.stringify(ds)}`
            ).sort().join('\n');
    }
}

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
 * Works file-based, not ID based.
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
 * @returns {Promise<BundleResult>}
 */
export const bundle = async (entryFile, includeFiles, targetFile) => {
    const entryDir = dirname(entryFile);
    const targetDir = dirname(targetFile);

    /** @type {ReadonlyMap<string, string>} */
    const fileModuleNames = Object.freeze(new Map(
        [entryFile, ...includeFiles].map(f => [f, makeModuleName(basename(f))])
    ));
    const _dupModuleNames = findDuplicateValues(fileModuleNames)
    if (_dupModuleNames.size) {
        throw new ModuleNameCollisionError(_dupModuleNames);
    }

    /**
     * Keys are source schema ref with absolute fs path.
     * Values are target schema local ref.
     * @type {Map<string, string>}
     */
    const embeddedMap = new Map();
    /**
     * Values relative to `targetFile`.
     * @type {Set<string>}
     */
    const externals = new Set();
    /**
     * Keys are source schema ref with absolute fs path.
     * Values are target schema ref.
     * @type {Map<string, string>}
     */
    const rewiredMap = new Map();

    /**
     * Rewire refs in place.
     *
     * No URI Decoding is done on refs, as out own cases just don't need it.
     *
     * @param {*} schema
     * @param {string} sourceFile
     * @returns {void}
     */
    const rewireRefs = (schema, sourceFile) => {
        const sourceDir = dirname(sourceFile);
        for (const k of REF_KEYWORDS) {
            const v = schema[k];
            if (typeof v !== 'string') continue;
            if (refIsAbsolute(v)) {
                externals.add(v);
                continue;
            }
            /** @type {import('./helpers/json-schema-spec.js').RefSplit} */
            let rewiredRS;
            const {path, frag} = refSplit(v);
            const refFile = path
                ? resolve(sourceDir, ...path.split(URI_PATH_SEP))
                : sourceFile;
            const moduleName = fileModuleNames.get(refFile);
            if (moduleName) {
                if (frag && !frag.startsWith(JP_REFIX)) {
                    // currently dont support anchors - only JSON pointer.
                    throw new RangeError(`Unsupported ref fragment: ${v}`);
                }
                rewiredRS = {
                    path: null,
                    frag: (refFile === entryFile && !frag?.startsWith(FRAG_DEFS_PREFIX)
                            ? ''
                            : `${FRAG_DEFS_PREFIX}${escapeJsonPointer(moduleName)}`
                    ) + (frag ?? '')
                };
            } else {
                rewiredRS = {
                    path: posixPath(relative(targetDir, refFile)),
                    frag
                };
            }
            const rewired = refJoin(rewiredRS);
            schema[k] = rewired;
            rewiredMap.set(refJoin({path: refFile, frag}), rewired);
            if (rewiredRS.path) {
                externals.add(rewired);
            }
        }
        subschemas(schema).forEach(s => rewireRefs(s, sourceFile));
    }

    const schema = await getJsonfile(entryFile);
    if (URL.canParse(schema[ID_KEYWORD])) {
        schema[ID_KEYWORD] = new URL(
            posixPath(relative(entryDir, targetFile)),
            schema[ID_KEYWORD]
        ).toString();
    }
    rewireRefs(schema, entryFile);
    const schemaDefsOrig = schema[DEFS_KEYWORD];
    schema[DEFS_KEYWORD] = Object.fromEntries( // sort for deterministic order
        [...fileModuleNames.values()].sort().map(m => [m, undefined]));

    const entryModuleName = fileModuleNames.get(entryFile);
    if (schemaDefsOrig) {
        schema[DEFS_KEYWORD][entryModuleName] = {
            [DEFS_KEYWORD]: schemaDefsOrig,
            [NOT_KEYWORD]: {[COMMENT_KEYWORD]: HOLLOW_COMMENT}
        };
        embeddedMap.set(`${entryFile}${FRAG_SEP}${JP_REFIX}${DEFS_KEYWORD}`, `${FRAG_SEP}${FRAG_DEFS_PREFIX}${escapeJsonPointer(entryModuleName)}`);
    } else {
        delete schema[DEFS_KEYWORD][entryModuleName];
    }

    for (const [includeFile, moduleName] of fileModuleNames) {
        if (includeFile === entryFile) continue;
        const includeSchema = await getJsonfile(includeFile);
        delete includeSchema[SCHEMA_KEYWORD];
        delete includeSchema[ID_KEYWORD];
        delete includeSchema[COMMENT_KEYWORD];
        rewireRefs(includeSchema, includeFile);
        schema[DEFS_KEYWORD][moduleName] = includeSchema;
        embeddedMap.set(includeFile, `${FRAG_SEP}${FRAG_DEFS_PREFIX}${escapeJsonPointer(moduleName)}`);
    }

    return {
        schema,
        external: Array.from(externals),
        embedded: Array.from(embeddedMap,
            ([f, d]) => {
                const {path, frag} = refSplit(f);
                return [refJoin({path: posixPath(relative(entryDir, path)), frag}), d];
            }),
        rewired: Array.from(rewiredMap,
            ([f, t]) => {
                const {path, frag} = refSplit(f);
                return [refJoin({path: posixPath(relative(entryDir, path)), frag}), t];
            }
        ),
    };
};
