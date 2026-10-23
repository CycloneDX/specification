import {objectGetOwnPath, PATH_NOT_FOUND} from "./helpers/common.js";
import {isSchemaObject, makeLocalRef, REF_FRAG_SEP, REF_KEYWORDS, subschemas} from './helpers/json-schema-spec.js';
import {isJsonPointer, jsonPointer2stack} from './helpers/json-pointer-spec.js'

/** @typedef {import('./helpers/json-schema-spec.js').Schema} Schema */


/**
 * @typedef {object} ValidationResult
 * @property {string[]} warnings
 * @property {string[]} errors
 */


/**
 * Validate a schema's refs.
 *
 * Check that all local refs are reachable.
 * - Checks only local refs.
 * - Validation support JSON pointers.
 * - Validation does not support anchors.
 * - Validation is not aware of IDs.
 *
 * @param {Readonly<Schema>} schema
 * @returns {ValidationResult}
 */
const validateRefs = (schema) => {
    /** @type {Set<string>} */
    const errors = new Set();
    /** @type {Set<string>} */
    const warnings = new Set();

    /** @type {Set<string>} */
    const localRefs = new Set();

    /**
     * @type {WeakSet<Schema>}
     */
    const _seen = new WeakSet();
    /**
     * @param {Readonly<Schema>} schema
     * @returns {void}
     */
    const gatherRefs = (schema) => {
        if (_seen.has(schema)) return;
        _seen.add(schema);
        for (const k of REF_KEYWORDS) {
            const v = schema[k];
            if (typeof v !== 'string') continue;
            if (v.startsWith(REF_FRAG_SEP)) {
                localRefs.add(v.slice(REF_FRAG_SEP.length));
            } else {
                warnings.add(`Unchecked external ref: ${v}`);
            }
        }
        subschemas(schema).forEach(([s]) => gatherRefs(s));
    }

    gatherRefs(schema);

    for (const ref of localRefs) {
        if (isJsonPointer(ref)) {
            const res = objectGetOwnPath(schema, jsonPointer2stack(ref));
            if (res === PATH_NOT_FOUND) {
                errors.add(`Missing local ref: ${makeLocalRef(ref)}`);
            }
            if (isSchemaObject(res)) {
                gatherRefs(res);
            }
        } else {
            warnings.add(`Unchecked local ref: ${makeLocalRef(ref)}`);
        }
    }

    return {
        warnings: Array.from(warnings),
        errors: Array.from(errors),
    };
};

/**
 * @param {Readonly<Schema>} schema
 * @returns {ValidationResult}
 */
export const validateSchema = (schema) => {
    const refs = validateRefs(schema)
    return {
        warnings: [
            ...refs.warnings,
        ],
        errors: [
            ...refs.errors,
        ],
    }
};
