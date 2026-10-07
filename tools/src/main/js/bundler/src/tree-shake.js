const HOLLOW_COMMENT =
    "This schema is hollow: it was not referenced and only remains as a container " +
    "for definitions that are still in use. It must not be used for validation.";

/**
 * Tree-shake a schema in place.
 *
 * Removes non-reachable definitions.
 * Hollows non-reachable definitions, when sub-definitions are kept.
 *   Hollowed schemas are marked with `"not: { "$comment": HOLLOW_COMMENT }"`.
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
