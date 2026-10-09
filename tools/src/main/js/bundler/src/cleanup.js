import {COMMENT_KEYWORD, subschemas} from './helpers/json-schema-spec.js';

/**
 * Remove $comment in place
 * @param {*} schema
 * @return {void}
 */
export function dropComments(schema) {
    delete schema[COMMENT_KEYWORD];
    subschemas(schema).forEach(s => dropComments(s));
}

export const HOLLOW_COMMENT =
    'This schema is hollow: it was not referenced ' +
    'and only remains as a container for definitions that are still in use. ' +
    'Itself must not be used for validation.';

/**
 * @typedef {object} TreeShakeResult
 * @property {ReadonlyArray<string>} hollowed
 * @property {ReadonlyArray<string>} removed
 */

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
 * @return {TreeShakeResult}
 */
export const treeShake = (schema) => {
    const removed = [];
    const hollowed = [];

    // TODO: tree-shake schema in place

    return {
        // sort for reproducibility, freeze for immutability.
        hollowed: Object.freeze(hollowed.sort()),
        removed: Object.freeze(removed.sort()),
    };
};
