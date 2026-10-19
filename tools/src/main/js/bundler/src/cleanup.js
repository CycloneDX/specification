import {objectDeleteOwnPath, objectGetOwnPath, PATH_NOT_FOUND} from "./helpers/common.js";
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

    const _schemaSwept = new Map();
    /**
     * Sweep phase: sweep non-reached from array.
     * @param {Array} a
     * @param {JsonPointer} p
     * @returns {boolean} still has items
     */
    const sweepArray = (a, p) => {
        for (const [k, v] of a.entries()) {
            const kP = `${p}${JP_PREFIX}${String(k)}`;
            if (reached.has(kP)) continue;
            if (typeof v === 'object' && v !== null) {
                if (Array.isArray(v)) {
                    if (sweepArray(v, kP)) continue;
                } else {
                    if (sweepObject(v, kP)) continue;
                }
            }
            delete a[k];
            removed.push(kP);
        }
        return a.some(() => true);
    };
    /**
     * Sweep phase: sweep non-reached from object.
     * @param {*} o
     * @param {JsonPointer} p
     * @returns {boolean} not completely empty
     */
    const sweepObject = (o, p) => {
        if (_schemaSwept.has(p)) {
            console.debug('_schemaSwept has ', p, _schemaSwept.get(p));
            return _schemaSwept.get(p);
        } console.debug('sweep opbject', p);
        for (const [k, v] of Object.entries(o)) {
            const kP = `${p}${JP_PREFIX}${escapeJsonPointer(k)}`;
            if (reached.has(kP)) continue;
            if (typeof v === 'object' && v !== null) {
                if (Array.isArray(v)) {
                    if (sweepArray(v, kP)) continue;
                } else {
                    if (sweepObject(v, kP)) continue;
                }
            }
            delete o[k];
            removed.push(kP);
        }
        return Object.keys(o).length > 0;
    };
    /**
     * Sweep phase: sweep non-reached and hollow schema.
     * @param {*} s
     * @param {JsonPointer} p
     * @returns {boolean} not completely empty
     */
    const sweepSchema = (s, p) => {
        if (ANCHOR_KEYWORDS.values().some(k => Object.hasOwn(s, k))) {
            // we do NOT support anchors, yet -> keep as is for now
            _schemaSwept.set(p, true);
            return true;
        }
        const isReached = reached.has(p);
        const candidates = Object.freeze(new Set(isReached
            ? [DEFS_KEYWORD]
            : Object.keys(s)));
        subschemas(s).forEach(([sSchema, sRel]) => {
            const sRel0 = sRel[0];
            if (!candidates.has(sRel0)) return;
            const sP = `${p}${jsonPointer4stack(sRel)}`;
            const notEmpty = sweepSchema(sSchema, sP);
            if (notEmpty) return;
            objectDeleteOwnPath(s, sRel);
            removed.push(sP);
        });
        for (const c of candidates) {
            const v = s[c];
            if (v === undefined) continue;
            const cP = `${p}${JP_PREFIX}${escapeJsonPointer(c)}`;
            if (reached.has(cP)) continue;
            if (typeof v === 'object' && v !== null) {
                if (Array.isArray(v)) {
                    if (sweepArray(v, cP)) continue;
                } else {
                    if (sweepObject(v, cP)) continue;
                }
            }
            delete s[c];
            removed.push(cP);
        }
        const notEmpty = Object.keys(s).length > 0;
        if (!isReached && notEmpty) {
            s[NOT_KEYWORD] = {[COMMENT_KEYWORD]: HOLLOW_COMMENT};
            hollowed.push(p);
        }
        _schemaSwept.set(p, notEmpty);
        console.debug('> _schemaSwept', p, notEmpty); // TODO remove
        return notEmpty;
    };

    markReached(schema, ROOT_POINTER);
    Object.freeze(reached);
    sweepSchema(schema, ROOT_POINTER);

    // TODO: removed shall not include all leaves - just the mst common
    //       "#/$defs/used-properties-only/$defs/unusedDef",
    //       "#/$defs/used-properties-only/$defs/unusedDef/$comment",
    //       "#/$defs/used-properties-only/$defs/unusedDef/description",
    //       "#/$defs/used-properties-only/$defs/unusedDef/title",
    //       "#/$defs/used-properties-only/$defs/unusedDef/type",
    //   shell become just "#/$defs/used-properties-only/$defs/unusedDef",

    return {
        reached: Array.from(reached, r => `${REF_FRAG_SEP}${r}`).sort(),
        hollowed: hollowed.map(r => `${REF_FRAG_SEP}${r}`).sort(),
        removed: removed.map(r => `${REF_FRAG_SEP}${r}`).sort()
    };
};
