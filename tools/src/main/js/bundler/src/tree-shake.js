import {HOLLOW_COMMENT} from './cleanup.js'

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
 * @return {{hollowed: ReadonlyArray<string>, removed: ReadonlyArray<string>}}
 */
export function treeShake(schema) {
    const removed = [];
    const hollowed = [];

    // TODO: tree-shake schema in place

    return {
        hollowed: Object.freeze(hollowed.sort()),
        removed: Object.freeze(removed.sort()),
    };
}
