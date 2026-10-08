
import { DATA_KEYWORDS } from './helpers/json-schema-spec.js';

/**
 * Remove $comment in place - except from schema root.
 * @param {*} schema
 */
export function dropCommentsExceptRoot(schema) {
    if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) {
        throw new Error('expected a schema');
    }
    for (const [k, v] of Object.entries(schema)) {
        if (DATA_KEYWORDS.has(k)) { continue; }
        dropComments(v);
    }
}

/**
 * Remove $comment in place
 * @param {*} schema
 */
export function dropComments(schema) {
    if (typeof schema !== 'object' || schema === null) {
        return;
    }
    if (Array.isArray(schema)) {
        schema.forEach(dropComments);
        return;
    }
    delete schema.$comment;
    for (const [k, v] of Object.entries(schema)) {
        if (DATA_KEYWORDS.has(k)) { continue; }
        dropComments(v);
    }
}

export const HOLLOW_COMMENT =
    "This schema is hollow: it was not referenced and only remains as a container " +
    "for definitions that are still in use. Itself must not be used for validation.";

