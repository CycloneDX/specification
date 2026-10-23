import {objectGetOwnPath, PATH_NOT_FOUND} from './helpers/common.js';
import {
    escapeJsonPointer, isJsonPointer,
    jsonPointer2stack, jsonPointer4stack,
    hasAncestorIn,
    PREFIX as JP_PREFIX, ROOT_POINTER
} from './helpers/json-pointer-spec.js';
import {
    ANCHOR_KEYWORDS, COMMENT_KEYWORD, DEFS_KEYWORD, DESCRIPTION_KEYWORD, NOT_KEYWORD, REF_KEYWORDS, TITLE_KEYWORD,
    isSchemaObject, subschemas,
    makeLocalRef, SCHEMA_ARRAY, SCHEMA_MAP, refIsLocal, refSplit
} from './helpers/json-schema-spec.js';


/** @typedef {import('./helpers/json-schema-spec.js').Schema} Schema */


/**
 * Remove $comment in place
 * @param {Schema} schema
 * @returns {void}
 */
export const dropComments = (schema) => {
    delete schema[COMMENT_KEYWORD];
    subschemas(schema).forEach(([s]) => dropComments(s));
}

const HOLLOW_COMMENT =
    'This schema is hollow: it was not referenced ' +
    'and only remains as a container for structures that are still in use. ' +
    'Itself must not be used for validation.';

const VOID_COMMENT =
    'This schema is void: it was not referenced and was removed. ' +
    'It only remains as a placeholder to keep sibling positions stable. ' +
    'Itself must not be used for validation.';


/** @typedef {import('./helpers/json-pointer-spec.js').JsonPointer} JsonPointer */

/** @typedef {import('./helpers/json-schema-spec.js').LocalRef} LocalRef */

/**
 * @typedef {object} TreeShakeResult
 * @property {LocalRef[]} hollowed
 * @property {LocalRef[]} voided
 * @property {LocalRef[]} removed
 */

/**
 * @param {ReadonlySet<JsonPointer>} reached
 * @param {ReadonlySet<JsonPointer>} hollowed
 * @param {ReadonlySet<JsonPointer>} voided
 * @param {ReadonlySet<JsonPointer>} removed
 * @return {TreeShakeResult}
 */
const makeTreeShakeResult = (hollowed, voided, removed) => {
    const gone = removed.union(voided);
    return {
        hollowed: Array.from(
            hollowed.values().filter(p =>
                !gone.has(p) && !hasAncestorIn(p, gone)),
            makeLocalRef).sort(),
        voided: Array.from(
            voided.values().filter(p => !hasAncestorIn(p, gone)),
            makeLocalRef).sort(),
        removed: Array.from(
            removed.values().filter(p => !hasAncestorIn(p, gone)),
            makeLocalRef).sort()
    };
}

/**
 * Annotation keywords that are kept on hollowed schemas,
 * and that do not count when deciding whether a schema is empty.
 * @type {ReadonlySet<string>}
 */
const treeShakeSchemaKeep = Object.freeze(new Set([
    TITLE_KEYWORD, DESCRIPTION_KEYWORD, COMMENT_KEYWORD,
]));


class HollowCollisionError extends Error {
}


/**
 * Tree-shake a schema in place.
 *
 * Mark-and-sweep:
 * - Mark: walk all subschemas from the root and follow every local ref.
 *   `$defs` are not walked - definitions are only reached via refs.
 * - Sweep: remove everything that was not reached.
 *   - Reached schemas only lose their non-reached `$defs`.
 *   - Non-reached schemas lose every key except {@link treeShakeSchemaKeep}
 *     and the paths leading to reached parts.
 *     If anything structural remains, the schema is hollowed:
 *     marked with `"not":{"$comment":HOLLOW_COMMENT}` so it never validates.
 *   - Schemas declaring an anchor are kept untouched - anchors are not supported, yet.
 *
 * References are supported as JSON Pointer fragments only, no anchors.
 *
 * @param {Schema} schema
 * @returns {TreeShakeResult}
 * @throws {RangeError} on a local ref whose fragment is not a JSON Pointer (e.g. an anchor)
 * @throws {HollowCollisionError} if a schema to be hollowed already has a `not` keyword
 */
export const treeShake = (schema) => {
    /** @type {Set<JsonPointer>} */
    const removed = new Set();
    /** @type {Set<JsonPointer>} */
    const hollowed = new Set();
    /** @type {Set<JsonPointer>} */
    const voided = new Set();

    /**
     * @type {WeakSet<Schema>}
     */
    const schemas = new WeakSet();
    /**
     * @param {Readonly<Schema>} s
     * @return {void}
     */
    const markSchemas = (s) => {
        schemas.add(s);
        subschemas(s).forEach(([sSub]) => markSchemas(sSub));
    }

    /**
     * @type {Set<JsonPointer>}
     */
    const reached = new Set();
    /**
     * @param {Readonly<Schema>} s
     * @param {JsonPointer} p
     * @returns {void}
     * @throws {RangeError} on a local ref whose fragment is not a JSON Pointer
     * @throws {RangeError} on a local ref whose JSON Pointer does not exist
     */
    const markReached = (s, p) => {
        if (reached.has(p)) return;
        reached.add(p);
        for (const k of REF_KEYWORDS) {
            const v = s[k];
            if (typeof v !== 'string' || !refIsLocal(v)) {
                continue; // non-local ref -> out of scope
            }
            const frag = refSplit(v).frag ?? ROOT_POINTER;
            if (!isJsonPointer(frag)) {
                // currently dont support anchors - only JSON pointer.
                throw new RangeError(`Unsupported ref fragment: ${v}`);
            }
            const tSchema = objectGetOwnPath(schema, jsonPointer2stack(frag));
            if (tSchema === PATH_NOT_FOUND) {
                throw RangeError(`Missing target for LocalRef: ${v}`);
            }
            if (isSchemaObject(tSchema)) {
                markReached(tSchema, frag);
            } else {
                // not supported, yet
                throw new RangeError(`Unsupported ref fragment: ${v}`);
            }
        }
        subschemas(s).forEach(([sSchema, sRel]) => {
            if (sRel[0] === DEFS_KEYWORD) return;
            markReached(sSchema, `${p}${jsonPointer4stack(sRel)}`);
        });
    };

    /**
     * @param {unknown} v
     * @param {string} p
     * @return {boolean}
     */
    const sweepValue = (v, p) => {
        if (typeof v === 'object' && v !== null) {
            return (Array.isArray(v) ? sweepArray : sweepObject)(v, p);
        }
        return reached.has(p);
    }
    /**
     * @param {object} o
     * @param {JsonPointer} p
     * @return {boolean}
     */
    const sweepObject = (o, p) => {
        if (schemas.has(o)) return sweepSchema(o, p);
        if (reached.has(p)) return true;
        for (const [k, v] of Object.entries(o)) {
            const kP = `${p}${JP_PREFIX}${escapeJsonPointer(k)}`;
            if (!sweepValue(v, kP)) {
                delete o[k];
                removed.add(kP);
            }
        }
        return Object.keys(o).length > 0;
    };
    /**
     * Sweep phase: sweep an array and void its items needed.
     * @param {Array} a
     * @param {JsonPointer} p
     * @return {boolean}
     */
    const sweepArray = (a, p) => {
        if (reached.has(p)) return true;
        let kept = false;
        for (const [k, v] of a.entries()) {
            const kP = `${p}${JP_PREFIX}${k}`;
            if (sweepValue(v, kP)) {
                kept = true;
                continue;
            }
            if (schemas.has(v)) {
                a[k] = {[NOT_KEYWORD]: {[COMMENT_KEYWORD]: VOID_COMMENT}};
                schemas.add(a[k]);
                schemas.add(a[k][NOT_KEYWORD]);
            }
            voided.add(kP);
        }
        return kept;
    };
    /**
     * Sweep phase: sweep a schema and hollow it if needed.
     *
     * - Schemas declaring an anchor are kept untouched.
     * - Reached schemas: only `$defs` is swept.
     * - Non-reached schemas: every key except {@link treeShakeSchemaKeep} is swept;
     *   if structural content remains, the schema is hollowed.
     *
     * @param {Schema} s
     * @param {JsonPointer} p
     * @returns {boolean} whether anything besides {@link treeShakeSchemaKeep} keys remains
     * @throws {Error} if the schema is to be hollowed but already has a `not` keyword
     */
    const sweepSchema = (s, p) => {
        if (Object.keys(s).some(k => ANCHOR_KEYWORDS.has(k))) {
            // we do NOT support anchors, yet -> keep as is for now
            return true;
        }
        const isReached = reached.has(p);
        for (const [k, v] of Object.entries(s)) {
            const kP = `${p}${JP_PREFIX}${escapeJsonPointer(k)}`;
            if (reached.has(kP)) continue;
            if (typeof v === 'object') {
                if (Array.isArray(v)) {
                    if (SCHEMA_ARRAY.has(k)) {
                        //
                    } else {
                        if(sweepArray(v, kP))continue;
                    }
                } else if (v!== null) {
                    if (SCHEMA_MAP.has(k)) {
                        //
                    } else {
                        if(sweepObject(v, kP))continue;
                    }
                }
            }
            delete s[k];
        }
        subschemas(s).forEach(([ss, sp]) => sweepSchema(ss, sp));
        const kept = isReached || Object.keys(s).some(k => !treeShakeSchemaKeep.has(k));
        if (!isReached) {
            if (Object.hasOwn(s, NOT_KEYWORD)) {
                throw new HollowCollisionError(`Collision ${p}${JP_PREFIX}${NOT_KEYWORD}`);
            }
            s[NOT_KEYWORD] = {[COMMENT_KEYWORD]: HOLLOW_COMMENT};
            schemas.add(s[NOT_KEYWORD]);
            hollowed.add(p);
        }
        return kept;
    };

    markSchemas(schema);
    markReached(schema, ROOT_POINTER);
    sweepSchema(schema, ROOT_POINTER);

    return makeTreeShakeResult(
        hollowed,
        voided,
        removed);
};
