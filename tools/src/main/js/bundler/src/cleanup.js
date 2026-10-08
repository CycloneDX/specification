import {subschemas} from './helpers/json-schema-spec.js';

/**
 * Remove $comment in place
 * @param {*} schema
 * @return {void}
 */
export function dropComments(schema) {
    delete schema.$comment;
    subschemas(schema).forEach(s => dropComments(s));
}

export const HOLLOW_COMMENT =
    "This schema is hollow: it was not referenced and only remains as a container " +
    "for definitions that are still in use. Itself must not be used for validation.";

