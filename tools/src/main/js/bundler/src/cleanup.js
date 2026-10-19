import {objectGetOwnPath, PATH_NOT_FOUND} from "./helpers/common.js";
import {
    escapeJsonPointer,
    isJsonPointer,
    jsonPointer2stack,
    jsonPointer4stack,
    PREFIX as JP_PREFIX, ROOT_POINTER
} from "./helpers/json-pointer-spec.js";
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


/** @typedef {import('./helpers/json-pointer-spec.js').JsonPointer} JsonPointer */
/** @typedef {import('./helpers/json-pointer-spec.js').JsonPointerStack} JsonPointerStack */

/**
 * @typedef {object} TreeShakeResult
 * @property {JsonPointer[]} reached
 * @property {JsonPointer[]} hollowed
 * @property {JsonPointer[]} removed
 */


const JP_DEFS_PREFIX = `${JP_PREFIX}${DEFS_KEYWORD}${JP_PREFIX}`;

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
     * @param {JsonPointer} p
     * @returns {void}
     */
    const markReached = (s, p) => {
        if (reached.has(p)) return;
        reached.add(p);
        for (const k of REF_KEYWORDS) {
            const v = s[k];
            if (typeof v !== 'string' || !v.startsWith(REF_FRAG_SEP)) {
                continue; // non-local ref -> out of scope
            }
            const frag = v.slice(REF_FRAG_SEP.length);
            if (!isJsonPointer(frag)) {
                // currently dont support anchors - only JSON pointer.
                throw new RangeError(`Unsupported ref fragment: ${v}`);
            }
            const tSchema = objectGetOwnPath(schema, jsonPointer2stack(frag));
            if (tSchema === PATH_NOT_FOUND) continue;
            if (isSchemaObject(tSchema)) {
                markReached(tSchema, frag);
            } else {
                reached.add(frag);
            }
        }
        subschemas(s).forEach(([sSchema, sRel]) => {
            if (sRel[0] === DEFS_KEYWORD) return;
            markReached(sSchema, `${p}${jsonPointer4stack(sRel)}`);
        });
    };

    /**
     * Sweep phase: remove or hollow non-reached definitions.
     * @param {*} s
     * @param {JsonPointer} p
     * @returns {void}
     */
    const sweepDefs = (s, p) => {
        const defs = s[DEFS_KEYWORD];
        if (!defs) return;
        for (const [dName, def] of Object.entries(defs)) {
            if (!isSchemaObject(def)) continue;
            const dPtr = `${p}${JP_DEFS_PREFIX}${escapeJsonPointer(dName)}`
            if (reached.has(dPtr)) {
                sweepDefs(def, dPtr);
                continue;
            }
            if (ANCHOR_KEYWORDS.values().some(k => Object.hasOwn(def, k))) {
                // we do NOT support anchors, yet -> leave untouched for now
                continue;
            }
            // def itself is unused
            const belowPrefix = `${dPtr}${JP_PREFIX}`;
            const belowReached = Object.freeze(reached.values().filter(r => r.startsWith(belowPrefix)).toArray());
            if (belowReached.length === 0) {
                delete defs[dName];
                removed.push(dPtr);
                continue;
            }
            // something beneath is still in use
            sweepDefs(def, dPtr);
            const belowPrefixDefs = `${belowPrefix}${DEFS_KEYWORD}${JP_PREFIX}`;
            if (belowReached.every(r => r.startsWith(belowPrefixDefs))) {
                // only defs are referenced -> make hollow
                Object.keys(def).forEach(k => {
                    if (k !== DEFS_KEYWORD) delete def[k];
                });
                def[NOT_KEYWORD] = {[COMMENT_KEYWORD]: HOLLOW_COMMENT};
                hollowed.push(dPtr);
            }
        }
        if (Object.keys(defs).length === 0) {
            delete s[DEFS_KEYWORD];
        }
    };

    markReached(schema, ROOT_POINTER);
    Object.freeze(reached);
    sweepDefs(schema, ROOT_POINTER);

    return {
        reached: Array.from(reached, r => `${REF_FRAG_SEP}${r}`).sort(),
        hollowed: hollowed.map(r => `${REF_FRAG_SEP}${r}`).sort(),
        removed: removed.map(r => `${REF_FRAG_SEP}${r}`).sort()
    };
};
