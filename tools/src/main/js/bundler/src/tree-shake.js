import {HOLLOW_COMMENT} from './cleanup.js'
/**
 * Tree-shake a schema in place.
 *
 * Supports references only, no support for anchors, yet.
 *
 * Removes non-reachable definitions.
 * Hollows non-reachable definitions, when sub-definitions are kept.
 *   Hollowed schemas are marked with `"not": { "$comment": HOLLOW_COMMENT }"`.
 *
 * @param {*} schema
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
