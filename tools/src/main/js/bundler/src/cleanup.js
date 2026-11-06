import {objectGetOwnPath, PATH_NOT_FOUND} from './helpers/common.js';
import {
    escapeJsonPointer, isJsonPointer,
    jsonPointer2stack,
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
 * Annotation keywords that are kept on hollowed schemas,
 * and that do not count when deciding whether a schema is empty.
 * @type {ReadonlySet<string>}
 */
const treeShakeSchemaKeep = Object.freeze(new Set([
    TITLE_KEYWORD, DESCRIPTION_KEYWORD, COMMENT_KEYWORD,
]));


/**
 * Whether a schema accepts every instance: `true`, `{}` or annotations-only.
 * Covers not the entire JSON schema spec, only the domain of this module.
 * @param {unknown} s
 * @return {boolean}
 */
const acceptsAnything = (s) => s === true || (
    isSchemaObject(s) && Object.keys(s).every(k => treeShakeSchemaKeep.has(k))
);

/**
 * Get a type-preserving, minimal-footprint placeholder for a non-schema value.
 * @template T
 * @param {T} v
 * @return {T}
 */
const voidPlaceholder = (v) => {
    switch (typeof v) {
        case 'boolean':
            return v;
        case 'string':
            return '';
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

class HollowCollisionError extends Error {
}


/**
 * @typedef {object} TreeShakeResult
 * @property {LocalRef[]} hollowed schemas that now reject everything but still exist as containers
 * @property {LocalRef[]} voided array items replaced by a placeholder to keep sibling indices stable
 * @property {LocalRef[]} removed pointers that no longer exist
 */


/**
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
 * Tree-shake a schema in place.
 *
 * Mark-and-sweep:
 * - Mark: two walks from the root, both following every local ref.
 *   `markSchemas` registers every schema object (including `$defs`) so the sweep can tell
 *   schemas from plain data. `markReffed` collects the pointers of all ref targets;
 *   it does not descend into `$defs` - definitions are only reached via refs.
 * - Sweep: walk the whole document and drop everything that is not reached.
 *   - Reached schemas only lose their non-reached `$defs`.
 *   - Non-reached schemas lose every key except {@link treeShakeSchemaKeep} and the paths
 *     leading to reached parts. If nothing structural remains, the schema is removed.
 *     Otherwise it is hollowed: `"not":{"$comment":HOLLOW_COMMENT}` is set so it never validates.
 *     A pre-existing, non-reached `not` is replaced by that marker; if it already rejected
 *     everything (`not` of {@link acceptsAnything}), the schema is not reported as hollowed.
 *   - Non-reached array items before the last reached one are voided, not removed, so that
 *     indices and pointers stay stable; trailing ones are removed.
 *   - Schemas declaring an anchor are kept untouched - anchors are not supported, yet.
 *
 * References are supported as JSON Pointer fragments only, no anchors.
 * `$dynamicRef` is NOT supported with dynamic-scope semantics: it is treated like a plain `$ref`
 * and resolved statically. A `$dynamicRef` with an anchor fragment (the usual case) is rejected
 * with a RangeError.
 *
 * @param {Schema} schema
 * @returns {TreeShakeResult}
 * @throws {RangeError} on a local ref whose fragment is not a JSON Pointer (e.g. an anchor),
 *   whose target does not exist, or whose target is neither a schema object nor a boolean
 * @throws {HollowCollisionError} if a schema to be hollowed has a `not` that still contains reached parts
 */
export const treeShake = (schema) => {
    /** @type {Set<JsonPointer>} */
    const hollowed = new Set();
    /** @type {Set<JsonPointer>} */
    const voided = new Set();
    /** @type {Set<JsonPointer>} */
    const removed = new Set();

    /**
     * Every schema object in the document, including the ones in `$defs` and ref targets.
     * @type {WeakSet<Schema>}
     */
    const schemas = new WeakSet();
    /**
     * Mark phase: register `s` and all schema objects below it or reachable from it via local refs,
     * so the sweep can tell schema objects from plain data objects.
     * @param {Readonly<Schema>} s
     * @return {void}
     * @throws {RangeError} on a local ref whose fragment is not a JSON Pointer
     */
    const markSchemas = (s) => {
        if (schemas.has(s)) return;
        schemas.add(s);
        for (const k of REF_KEYWORDS) {
            const v = s[k];
            if (typeof v !== 'string' || !refIsLocal(v)) {
                continue; // non-local ref -> out of scope
            }
            const frag = refSplit(v).frag ?? ROOT_POINTER;
            if (!isJsonPointer(frag)) {
                // currently dont support anchors - only JSON pointer.
                // this also rejects every `$dynamicRef` that targets a `$dynamicAnchor`.
                throw new RangeError(`Unsupported ref fragment: ${v}`);
            }
            const tSchema = objectGetOwnPath(schema, jsonPointer2stack(frag));
            if (isSchemaObject(tSchema)) {
                markSchemas(tSchema);
            }
        }
        subschemas(s).forEach(([sSchema]) => markSchemas(sSchema));
    }

    /**
     * Pointers of all local ref targets - schema objects or booleans - reachable from the root.
     * @type {Set<JsonPointer>}
     */
    const reffed = new Set();
    /** @type {WeakSet<Schema>} */
    const _markReffedSeen = new WeakSet();
    /**
     * Mark phase: walk the reachable subschemas of `s` - skipping `$defs` - and record every
     * local ref target in {@link reffed}.
     * @param {Readonly<Schema>} s
     * @returns {void}
     * @throws {RangeError} on a local ref whose fragment is not a JSON Pointer
     * @throws {RangeError} on a local ref whose JSON Pointer does not exist
     * @throws {RangeError} on a local ref whose JSON Pointer does not target {@link Schema}|`boolean`
     */
    const markReffed = (s) => {
        if (_markReffedSeen.has(s)) return;
        _markReffedSeen.add(s);
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
                reffed.add(frag);
                markReffed(tSchema);
            } else if (typeof tSchema === 'boolean') {
                reffed.add(frag);
            } else {
                throw new RangeError(`Ref target is not schema nor boolean: ${v}`)
            }
        }
        subschemas(s).forEach(([sSchema, sRel]) => {
            if (sRel[0] === DEFS_KEYWORD) return;
            markReffed(sSchema);
        });
    };

    /**
     * Sweep phase: dispatch to {@link sweepArray}/{@link sweepObject}.
     * Scalars have no children, so they remain iff `used`.
     * @param {unknown} v
     * @param {JsonPointer} p
     * @param {boolean} used whether `v` is reached (directly reffed or inside a reached schema)
     * @return {boolean} whether anything remains
     */
    const sweepValue = (v, p, used) => {
        if (typeof v === 'object' && v !== null) {
            return (Array.isArray(v) ? sweepArray : sweepObject)(v, p, used);
        }
        return used;
    }
    /**
     * Sweep phase: sweep a non-schema object (property map, `$defs` container, data map)
     * and remove its unused children. Delegates to {@link sweepSchema} if `o` is a schema.
     * @param {object} o
     * @param {JsonPointer} p
     * @param {boolean} used whether `o` is reached (directly reffed or inside a reached schema)
     * @return {boolean} whether anything remains
     */
    const sweepObject = (o, p, used) => {
        if (schemas.has(o)) return sweepSchema(o, p, used);
        for (const [k, v] of Object.entries(o)) {
            const kP = `${p}${JP_PREFIX}${escapeJsonPointer(k)}`;
            if (!sweepValue(v, kP, used || reffed.has(kP))) {
                delete o[k];
                removed.add(kP);
            }
        }
        return used || Object.keys(o).length > 0;
    };
    /**
     * Sweep phase: sweep an array back to front.
     * Unused trailing items are removed; unused items before the last kept one are voided -
     * schemas become a `"not"` marker, data becomes a {@link voidPlaceholder} - so indices stay stable.
     * @param {Array} a
     * @param {JsonPointer} p
     * @param {boolean} used whether `a` is reached (directly reffed or inside a reached schema)
     * @return {boolean} whether anything remains
     */
    const sweepArray = (a, p, used) => {
        let lastKeptIndex = -1;
        for (let i = a.length - 1; i >= 0; --i) {
            const v = a[i];
            const iP = `${p}${JP_PREFIX}${i}`;
            if (sweepValue(v, iP, used || reffed.has(iP))) {
                lastKeptIndex = Math.max(lastKeptIndex, i);
                continue;
            }
            if (lastKeptIndex < i) {
                delete a[i];
                removed.add(iP);
                continue;
            }
            a[i] = schemas.has(v)
                ? {[NOT_KEYWORD]: {[COMMENT_KEYWORD]: VOID_COMMENT}}
                : voidPlaceholder(v);
            voided.add(iP);
        }
        a.length = 1 + lastKeptIndex;
        return used || a.length > 0;
    };
    /**
     * Sweep phase: sweep a schema and hollow it if needed.
     *
     * - Schemas declaring an anchor are kept untouched.
     * - Used schemas: only `$defs` is swept.
     * - Unused schemas: every key except {@link treeShakeSchemaKeep} is swept, then the
     *   schema is hollowed with a `"not"` marker. A pre-existing `not` has been swept away by then
     *   and is replaced - it is reported as neither removed nor hollowed. The schema itself is only
     *   reported as hollowed if the marker changed its meaning, i.e. it did not already reject everything.
     *
     * @param {Schema} s
     * @param {JsonPointer} p
     * @param {boolean} used whether `s` is reached (directly reffed or inside a reached schema)
     * @returns {boolean} whether anything besides {@link treeShakeSchemaKeep} keys remains
     * @throws {HollowCollisionError} if the schema is to be hollowed but its `not` survived the sweep,
     *   i.e. something reached lives inside it
     */
    const sweepSchema = (s, p, used) => {
        if (Object.keys(s).some(k => ANCHOR_KEYWORDS.has(k))) {
            // we do NOT support anchors, yet -> keep as is for now
            return true;
        }
        const hadNot = Object.hasOwn(s, NOT_KEYWORD);
        const wasHollow = hadNot && acceptsAnything(s[NOT_KEYWORD]);
        for (const [k, v] of Object.entries(s)) {
            if (treeShakeSchemaKeep.has(k)) continue;
            const kP = `${p}${JP_PREFIX}${escapeJsonPointer(k)}`;
            const kUsed = (used && k !== DEFS_KEYWORD) || reffed.has(kP);
            if (!sweepValue(v, kP, kUsed)) {
                delete s[k];
                removed.add(kP);
            }
        }
        const kept = used || Object.keys(s).some(k => !treeShakeSchemaKeep.has(k));
        if (!used) {
            if (Object.hasOwn(s, NOT_KEYWORD)) {
                throw new HollowCollisionError(
                    `Collision: ${makeLocalRef(p)}${JP_PREFIX}${NOT_KEYWORD}\n`
                    + `A reachable schema lives inside the "${NOT_KEYWORD}" of a schema that is to be hollowed. `
                    + `Move it out of the "${NOT_KEYWORD}", e.g. into a "${DEFS_KEYWORD}" container next to it.`);
            }
            s[NOT_KEYWORD] = {[COMMENT_KEYWORD]: HOLLOW_COMMENT};
            if (hadNot) {
                const nP = `${p}${JP_PREFIX}${NOT_KEYWORD}`;
                // the old `not` was swept away above and is now REPLACED by the marker:
                // the pointer still exists -> it is neither removed ...
                removed.delete(nP);
                // ... nor hollowed - that marker was written into a subtree that is gone.
                hollowed.delete(nP);
            }
            if (!wasHollow) {
                hollowed.add(p);
            }
        }
        return kept;
    };

    markSchemas(schema);
    markReffed(schema);
    sweepSchema(schema, ROOT_POINTER, true);

    return makeTreeShakeResult(hollowed, voided, removed);
};
