import {objectGetOwnPath} from "./helpers/common.js";
import {isJsonPointer, jsonPointer2stack, jsonPointer4stack, PREFIX as JP_PREFIX} from "./helpers/json-pointer-spec.js";
import {
    ANCHOR_KEYWORDS,
    COMMENT_KEYWORD,
    DEFS_KEYWORD,
    isSchemaObject, NOT_KEYWORD,
    REF_FRAG_SEP,
    REF_KEYWORDS,
    subschemas
} from './helpers/json-schema-spec.js';

/**
 * Remove $comment in place
 * @param {*} schema
 * @returns {void}
 */
export const dropComments = (schema) => {
    delete schema[COMMENT_KEYWORD];
    subschemas(schema).forEach(([s]) => dropComments(s));
}

const HOLLOW_COMMENT =
    'This schema is hollow: it was not referenced ' +
    'and only remains as a container for definitions that are still in use. ' +
    'Itself must not be used for validation.';

/** @typedef {import('./helpers/json-pointer-spec.js').JsonPointerStack} JsonPointerStack */


/**
 * @typedef {object} TreeShakeResult
 * @property {JsonPointer[]} hollowed
 * @property {JsonPointer[]} removed
 */

/**
 * Tree-shake a schema in place.
 *
 * References support JSON pointer only, no support for anchors, yet.
 *
 * Removes non-reached definitions.
 * Hollows non-reached definitions, when sub-definitions are kept.
 * - Hollowed schemas are marked with `"not":{"$comment":HOLLOW_COMMENT}`.
 *
 * @param {*} schema
 * @returns {TreeShakeResult}
 */
export const treeShake = (schema) => {
    /** @type {JsonPointer[]} */
    const removed = [];
    /** @type {JsonPointer[]} */
    const hollowed = [];

    /**
     * JSON pointers of all reached schemas.
     * @type {Set<JsonPointer>}
     */
    const reached = new Set();

    /**
     * Mark phase: walk a schema and everything it references.
     *
     * Does NOT descend into `$defs` - definitions are only reached via refs.
     *
     * @param {Readonly<*>} s
     * @param {JsonPointerStack} stack
     * @returns {void}
     */
    const markReached = (s, stack) => {
        const p = jsonPointer4stack(stack);
        if (reached.has(p)) return;
        reached.add(p);

        for (const k of REF_KEYWORDS) {
            const v = s[k];
            if (typeof v !== 'string' || !v.startsWith(REF_FRAG_SEP)) continue;
            const frag = v.slice(REF_FRAG_SEP.length);
            if (!isJsonPointer(frag)) {
                // anchors are not supported - leave untouched
                continue;
            }
            const tStack = jsonPointer2stack(frag);
            const tSchema = objectGetOwnPath(schema, tStack);
            if (isSchemaObject(tSchema)) {
                markReached(tSchema, tStack);
            }
        }

        subschemas(s).forEach(([sub, rel]) => {
            if (rel[0] === DEFS_KEYWORD) return;
            markReached(sub, [...stack, ...rel]);
        });
    };

    /**
     * Sweep phase: remove or hollow non-reached definitions.
     * @param {*} s
     * @param {JsonPointerStack} stack
     * @returns {void}
     */
    const sweep = (s, stack) => {
        const defs = s[DEFS_KEYWORD];
        if (!defs) return;
        for (const [dName, def] of Object.entries(defs)) {
            if (!isSchemaObject(def)) continue;

            const dStack = [...stack, DEFS_KEYWORD, dName];
            const dPtr = jsonPointer4stack(dStack);
            if (reached.has(dPtr)) {
                sweep(def, dStack);
                continue;
            }
            // definition itself is unused

            if (ANCHOR_KEYWORDS.values().some(k => def.hasOwnProperty(k))) {
                // we do NOT support anchors -> leave untouched for now
                continue;
            }

            const belowPrefix = `${dPtr}${JP_PREFIX}`;
            const below = reached.values().filter(r => r.startsWith(belowPrefix)).toArray();
            if (below.length === 0) {
                delete defs[dName];
                removed.push(`${REF_FRAG_SEP}${dPtr}`);
                continue;
            }
            // something beneath is still in use

            sweep(def, dStack);

            const belowPrefixDefs = `${belowPrefix}${DEFS_KEYWORD}${JP_PREFIX}`;
            if (below.every(r => r.startsWith(belowPrefixDefs))) {
                Object.keys(def).forEach(k => {
                    if (k === DEFS_KEYWORD) return;
                    delete def[k];
                });
                def[NOT_KEYWORD] = {[COMMENT_KEYWORD]: HOLLOW_COMMENT};
                hollowed.push(`${REF_FRAG_SEP}${dPtr}`);
            }
            // else: a non-$defs sub-path is referenced - must keep the schema intact
        }

        if (Object.keys(defs).length === 0) {
            delete s[DEFS_KEYWORD];
        }
    };

    markReached(schema, []);
    sweep(schema, []);

    return {
        hollowed: hollowed.sort(),
        removed: removed.sort()
    };
};
