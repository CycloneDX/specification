import {objectGetOwnPath, PATH_NOT_FOUND} from './helpers/common.js';
import {
    escapeJsonPointer, isJsonPointer,
    jsonPointer2stack, jsonPointer4stack,
    hasAncestorIn,
    PREFIX as JP_PREFIX, ROOT_POINTER
} from './helpers/json-pointer-spec.js';
import {
    ANCHOR_KEYWORDS, COMMENT_KEYWORD, DEFS_KEYWORD, DESCRIPTION_KEYWORD, NOT_KEYWORD, REF_KEYWORDS, TITLE_KEYWORD,
    REF_FRAG_SEP,
    isSchemaObject, subschemas,
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
    'and only remains as a container for definitions that are still in use. ' +
    'Itself must not be used for validation.';

const VOID_COMMENT =
    'This schema is void: it was not referenced and was removed. ' +
    'It only remains as a placeholder to keep sibling positions stable. ' +
    'Itself must not be used for validation.';


/** @typedef {import('./helpers/json-pointer-spec.js').JsonPointer} JsonPointer */

/**
 * Local reference: a JSON Pointer prefixed with {@link REF_FRAG_SEP}.
 * @typedef {string} LocalRef
 */

/**
 * @param {string} s
 * @return {LocalRef}
 */
const makeLocalRef = (s) => `${REF_FRAG_SEP}${s}`;


/**
 * @typedef {object} TreeShakeResult
 * @property {LocalRef[]} reached
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
const makeTreeShakeResult = (reached, hollowed, voided, removed) => {
    const gone = removed.union(voided);
    return {
        reached: Array.from(reached, makeLocalRef).sort(),
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
     * JSON Pointers of everything reached from the root:
     * schemas, and non-schema values that are ref targets.
     * @type {Set<JsonPointer>}
     */
    const reached = new Set();

    /**
     * Mark phase: walk a schema and everything it references.
     *
     * Does NOT descend into `$defs` - definitions are only reached via refs.
     *
     * @param {Readonly<Schema>} s
     * @param {JsonPointer} p
     * @returns {void}
     * @throws {RangeError} on a local ref whose fragment is not a JSON Pointer
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
            if (tSchema === PATH_NOT_FOUND) {
                throw RangeError('Missing target for LocalRef');
            }
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
     * Cache of {@link sweepSchema} verdicts, keyed by pointer.
     * Lets {@link _sweepObject} reuse the result for subschemas that {@link sweepSchema}
     * already processed, instead of sweeping them a second time.
     * @type {Map<JsonPointer, boolean>}
     */
    const _sweepSchemaRes = new Map();
    const _sweepValue = (v, p) => {
        if (typeof v === 'object' && v !== null) {
            if (Array.isArray(v)) {
                if (_sweepArray(v, p)) {
                    return true;
                }
            } else {
                if (_sweepObject(v, p)) {
                    return true;
                }
            }
        } else {
            if (reached.has(p)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Sweep phase: sweep an object.
     *
     * Since a {@link Schema} is an object, we utilize {@link _sweepSchemaRes}.
     *
     * @param {object} o
     * @param {JsonPointer} p
     * @return {boolean}
     */
    const _sweepObject = (o, p) => {
        const sweepSchemaRes = _sweepSchemaRes.get(p);
        if (sweepSchemaRes !== undefined) return sweepSchemaRes;
        if (reached.has(p)) return true;
        for (const [k, v] of Object.entries(o)) {
            const kP = `${p}${JP_PREFIX}${escapeJsonPointer(k)}`;
            if (!_sweepValue(v, kP)) {
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
    const _sweepArray = (a, p) => {
        if (reached.has(p)) return true;
        let kept = false;
        for (const [k, v] of a.entries()) {
            const kP = `${p}${JP_PREFIX}${k}`;
            if (_sweepValue(v, kP)) {
                kept = true;
            } else {
                a[k] = {[NOT_KEYWORD]: {[COMMENT_KEYWORD]: VOID_COMMENT}};
                voided.add(kP);
            }
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
            _sweepSchemaRes.set(p, true);
            return true;
        }
        const isReached = reached.has(p);
        const candidates = new Set(isReached
            ? [DEFS_KEYWORD]
            : Object.keys(s).filter(k => !treeShakeSchemaKeep.has(k)));
        // 1. sweep sub-schemas & fill `_sweepSchemaRes`; nothing is removed here.
        for (const [sSchema, sRel] of subschemas(s)) {
            sweepSchema(sSchema, `${p}${jsonPointer4stack(sRel)}`);
        }
        // 2. sweep the candidates; remove unused candidates
        for (const k of candidates) {
            if (!Object.hasOwn(s, k)) continue;
            const kP = `${p}${JP_PREFIX}${escapeJsonPointer(k)}`;
            const v = s[k];
            if (!_sweepValue(v, kP)) {
                delete s[k];
                removed.add(kP);
            }
        }
        const kept = isReached || Object.keys(s).some(k => !treeShakeSchemaKeep.has(k));
        // 3. mark hollow
        if (!isReached) {
            if (Object.hasOwn(s, NOT_KEYWORD)) {
                throw new HollowCollisionError(`Collision ${p}${JP_PREFIX}${NOT_KEYWORD}`);
            }
            s[NOT_KEYWORD] = {[COMMENT_KEYWORD]: HOLLOW_COMMENT};
            hollowed.add(p);
        }
        _sweepSchemaRes.set(p, kept);
        return kept;
    };

    markReached(schema, ROOT_POINTER);
    sweepSchema(schema, ROOT_POINTER);

    return makeTreeShakeResult(
        reached,
        hollowed,
        voided,
        removed);
};
