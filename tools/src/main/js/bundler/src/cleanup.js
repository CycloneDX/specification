import {objectDeleteOwnPath, objectGetOwnPath, PATH_NOT_FOUND} from "./helpers/common.js";
import {
    escapeJsonPointer, isJsonPointer, jsonPointer2stack, jsonPointer4stack,
    PREFIX as JP_PREFIX, ROOT_POINTER
} from "./helpers/json-pointer-spec.js";
import {
    ANCHOR_KEYWORDS, COMMENT_KEYWORD, DEFS_KEYWORD, DESCRIPTION_KEYWORD, NOT_KEYWORD, REF_KEYWORDS, TITLE_KEYWORD,
    REF_FRAG_SEP,
    isSchemaObject, subschemas
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

/**
 * Which schema keys shall survive the tree shaking.
 */
const treeShakeSchemaKeep = Object.freeze(new Set([
    TITLE_KEYWORD, DESCRIPTION_KEYWORD, COMMENT_KEYWORD,
]));

/**
 * Tree-shake a schema in place.
 *
 * References support JSON pointer only, no support for anchors, yet.
 *
 * Removes non-reached schemaparts definitions.
 * Hollows non-reached schemas, when structural sub-elements are kept.
 * - keeps the keys from `treeShakeSchemaKeep`.
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
     * @type {JsonPointer[]}
     */
    const reached = [];

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
        if (reached.includes(p)) return;
        reached.push(p);
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

    /** @type {Map<JsonPointer, boolean>} */
    const _schemaSweepRes = new Map();
    /**
     * Sweep phase: sweep non-reached from array.
     * @param {Array} a
     * @param {JsonPointer} p
     * @returns {boolean} still has items
     */
    const _sweepArray = (a, p) => {
        for (const [k, v] of a.entries()) {
            const kP = `${p}${JP_PREFIX}${String(k)}`;
            if (reached.includes(kP)) continue;
            if (v === null || typeof v !== 'object'
                || (Array.isArray(v) ? _sweepArray : _sweepObject)(v, kP) === false
            ) {
                delete a[k];
                removed.push(kP);
            }
        }
        return a.some(() => true);
    };
    /**
     * Sweep phase: sweep non-reached from object.
     * @param {*} o
     * @param {JsonPointer} p
     * @returns {boolean} not completely empty
     */
    const _sweepObject = (o, p) => {
        const schemaSweepRes = _schemaSweepRes.get(p);
        if (schemaSweepRes !== undefined) return schemaSweepRes;
        for (const [k, v] of Object.entries(o)) {
            const kP = `${p}${JP_PREFIX}${escapeJsonPointer(k)}`;
            if (reached.includes(kP)) continue;
            if (v === null || typeof v !== 'object'
                || (Array.isArray(v) ? _sweepArray : _sweepObject)(v, kP) === false
            ) {
                delete o[k];
                removed.push(kP);
            }
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
            _schemaSweepRes.set(p, true);
            return true;
        }
        const isReached = reached.includes(p);
        const candidates = Object.freeze(isReached
            ? [DEFS_KEYWORD]
            : Object.keys(s).filter(k => !treeShakeSchemaKeep.has(k)));
        subschemas(s).forEach(([sSchema, sRel]) => {
            if (!candidates.includes(sRel[0])) return;
            const sP = `${p}${jsonPointer4stack(sRel)}`;
            if (sweepSchema(sSchema, sP) === false) {
                objectDeleteOwnPath(s, sRel);
                removed.push(sP);
            }
        });
        for (const c of candidates) {
            const v = s[c];
            if (v === undefined) continue;
            const cP = `${p}${JP_PREFIX}${escapeJsonPointer(c)}`;
            if (reached.includes(cP)) continue;
            if (v === null || typeof v !== 'object'
                || (Array.isArray(v) ? _sweepArray : _sweepObject)(v, cP) === false
            ) {
                delete s[c];
                removed.push(cP);
            }
        }
        const notEmpty = Object.keys(s).some(k => !treeShakeSchemaKeep.has(k));
        if (!isReached && notEmpty) {
            if (Object.hasOwn(s, NOT_KEYWORD)) {
                throw new Error(`Collision ${p}${JP_PREFIX}${NOT_KEYWORD}`);
            }
            s[NOT_KEYWORD] = {[COMMENT_KEYWORD]: HOLLOW_COMMENT};
            hollowed.push(p);
        }
        _schemaSweepRes.set(p, notEmpty);
        return notEmpty;
    };

    markReached(schema, ROOT_POINTER);
    Object.freeze(reached);
    sweepSchema(schema, ROOT_POINTER);

    return {
        reached: reached.map(r => `${REF_FRAG_SEP}${r}`).sort(),
        hollowed: hollowed.map(r => `${REF_FRAG_SEP}${r}`).sort(),
        removed: removed.filter((v, i, a) => {
            let l = v.lastIndexOf(JP_PREFIX);
            while (l > 0) {
                if (a.includes(v.slice(0, l))) return false;
                l = v.lastIndexOf(JP_PREFIX, l - 1);
            }
            return true;
        }).map(r => `${REF_FRAG_SEP}${r}`).sort()
    };
};
