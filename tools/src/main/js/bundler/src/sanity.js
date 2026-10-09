
import {objectHasOwnPath} from "./helpers/common.js";
import {REF_KEYWORDS, subschemas} from './helpers/json-schema-spec.js';
import {isJsonPointer, jsonPointer2stack} from './helpers/json-pointer-spec.js'



/**
 * @typedef {object} ValidationResult
 * @property {Array<string>} warnings
 * @property {Array<string>} errors
 */


/**
 * @param {Readonly<*>} schema
 * @return {ValidationResult}
 */
export function validateSchema(schema) {
    const refs = validateRefs(schema)
    return {
        warnings: [
            ...refs.warnings,
        ],
        errors: [
            ...refs.errors,
        ],
    };
}


/**
 * Validate a schema's refs.
 *
 * Check that all local refs are reachable.
 * - Absolutes are not checked.
 * - External file are not checked.
 * - Validation support JSON pointers.
 * - Validation does not support anchors.
 * - Validation is not aware of IDs.
 *
 * @param {Readonly<*>} schema
 * @return {ValidationResult}
 */
function validateRefs (schema) {
    /** @type {Set<string>} */
    const errors = new Set();
    /** @type {Set<string>} */
    const warnings = new Set();

    /** @type {Set<string>} */
    const localRefs = new Set();

    /**
     * @param {*} schema
     * @return {void}
     */
    const gatherRefs = (schema) => {
        for (const k of REF_KEYWORDS) {
            const v = schema[k];
            if (typeof v !== 'string') continue;
            if (v.startsWith('#')) {
                localRefs.add(v.slice(1));
            } else {
                warnings.add(`Unchecked external ref: ${v}`);
            }
        }
        subschemas(schema).forEach(gatherRefs);
    }

    gatherRefs(schema);

    for (const ref of localRefs) {
        if (isJsonPointer(ref)) {
            if (!objectHasOwnPath(schema, jsonPointer2stack(ref))) {
                errors.add(`Missing local ref: #${ref}`);
            }
        } else {
            warnings.add(`Unchecked local ref: #${ref}`);
        }
    }

    return {
        warnings: Array.from(warnings),
        errors: Array.from(errors),
    };
}
