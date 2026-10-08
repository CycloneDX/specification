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
