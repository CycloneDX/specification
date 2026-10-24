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
    makeLocalRef, refIsLocal, refSplit
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
    'This schema is hollow: it is not referenced ' +
    'and only remains as a container for structures that are still in use. ' +
    'Itself must not be used for validation.';

const VOID_COMMENT =
    'This schema is void: it is not referenced and was removed. ' +
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
 * @template T
 * @param {T} v
 * @return {T}
 */
const getVoid = (v) => {
    switch (typeof v) {
        case 'boolean':
            return v;
        case 'string':
            return '';
        case "bigint":
        case 'number':
            return 0;
        case "object":
            if (v === null) return v;
            if (Array.isArray(v)) return [];
            return {};
        default:
            throw TypeError(`Unsupported type ${typeof v}`)
    }
};

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
     * Pointer of known schemas - they can be objects or boolean.
     * @type {Set<JsonPointer>}
     */
    const schemas = new Set();
    /**
     * Mark known schemas.
     * @param {Readonly<Schema>} s
     * @return {void}
     */
    const markSchemas = (s, p) => {
        if (schemas.has(p)) return;
        schemas.add(p);
        subschemas(s, false).forEach(([sSchema, sRel]) => {
            const sP = `${p}${jsonPointer4stack(sRel)}`;
            if (isSchemaObject(sSchema)) {
                markSchemas(sSchema, sP);
            } else {
                schemas.add(sP);
            }
        });
    }

    /** @type {Set<JsonPointer>} */
    const reached = new Set();
    /**
     * Mark reached.
     * Since reached are expected to be schemas, we mark them on the way as refs may go out of order.
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
                markSchemas(tSchema, frag);
                markReached(tSchema, frag);
            } else {
                if (typeof tSchema === 'boolean') schemas.add(frag);
                reached.add(frag);
            }
        }
        subschemas(s, false).forEach(([sSchema, sRel]) => {
            if (sRel[0] === DEFS_KEYWORD) return;
            const sP = `${p}${jsonPointer4stack(sRel)}`;
            if (isSchemaObject(sSchema)) {
                markSchemas(sSchema, sP);
                markReached(sSchema, sP);
            } else {
                schemas.add(sP);
                reached.add(sP);
            }
        });
    };

    /**
     * @param {unknown} v
     * @param {JsonPointer} p
     * @return {boolean} whether anything remains
     */
    const sweepValue = (v, p) => {
        if (typeof v === 'object' && v !== null) {
            return (Array.isArray(v) ? sweepArray : sweepObject)(v, p);
        }
        return reached.has(p);
    }
    /**
     * Sweep phase: sweep an object and removes unused children.
     * Utilizes {@link sweepSchema} when `o` is a schema.
     * @param {object} o
     * @param {JsonPointer} p
     * @return {boolean} whether anything remains
     */
    const sweepObject = (o, p) => {
        if (schemas.has(p)) return sweepSchema(o, p);
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
     * Unused trailing items are dropped; unused middle items are voided.
     * @param {Array} a
     * @param {JsonPointer} p
     * @return {boolean} whether anything remains
     */
    const sweepArray = (a, p) => {
        let lastKeptIndex = -1;
        for (let i = a.length - 1; i >= 0; --i) {
            const v = a[i];
            const iP = `${p}${JP_PREFIX}${i}`;
            if (sweepValue(v, iP)) {
                lastKeptIndex = Math.max(lastKeptIndex, i);
                continue;
            }
            if (lastKeptIndex < i) {
                delete a[i];
                removed.add(iP);
                continue;
            }
            a[i] = schemas.has(iP) && isSchemaObject(v)
                ? {[NOT_KEYWORD]: {[COMMENT_KEYWORD]: VOID_COMMENT}}
                : getVoid(v);
            voided.add(iP);
        }
        a.length = 1 + lastKeptIndex;
        return a.length > 0;
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
     * @throws {HollowCollisionError} if the schema is to be hollowed but already has a `not` keyword
     */
    const sweepSchema = (s, p) => {
        if (Object.keys(s).some(k => ANCHOR_KEYWORDS.has(k))) {
            // we do NOT support anchors, yet -> keep as is for now
            return true;
        }
        const isReached = reached.has(p);
        if (isReached) {
            subschemas(s).forEach(([sSchema, sRef]) => {
                if (sRef[0] === DEFS_KEYWORD) return;
                sweepSchema(sSchema, `${p}${jsonPointer4stack(sRef)}`)
            });
            const defs = s[DEFS_KEYWORD];
            if (typeof defs === 'object' && defs !== null) {
                const dP = `${p}${JP_PREFIX}${DEFS_KEYWORD}`
                if (!sweepObject(defs, dP)) {
                    delete s[DEFS_KEYWORD];
                    removed.add(dP);
                }
            }
        } else {
            for (const [k, v] of Object.entries(s)) {
                if (treeShakeSchemaKeep.has(k)) continue;
                const kP = `${p}${JP_PREFIX}${escapeJsonPointer(k)}`;
                if (!sweepValue(v, kP)) {
                    delete s[k];
                    removed.add(kP);
                }
            }
        }
        const kept = isReached || Object.keys(s).some(k => !treeShakeSchemaKeep.has(k));
        if (!isReached) {
            if (Object.hasOwn(s, NOT_KEYWORD)) {
                throw new HollowCollisionError(`Collision: ${makeLocalRef(p)}${JP_PREFIX}${NOT_KEYWORD}`);
            }
            s[NOT_KEYWORD] = {[COMMENT_KEYWORD]: HOLLOW_COMMENT};
            hollowed.add(p);
        }
        return kept;
    };

    markSchemas(schema, ROOT_POINTER);
    markReached(schema, ROOT_POINTER);
    sweepSchema(schema, ROOT_POINTER);

    return makeTreeShakeResult(
        hollowed,
        voided,
        removed);
};
