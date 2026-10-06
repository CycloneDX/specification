
const HOLLOW_COMMENT =
    "This schema is hollow: it was not referenced and only remains as a container " +
    "for definitions that are still in use. It must not be used for validation.";

export function treeShake(schema) {
    // TODO: tree-shake schema in place
    const removed = [];
    const hollowed= [];
    return {
        removed: Object.freeze(removed.sort()),
        hollowed: Object.freeze(hollowed.sort()),
    };
}
