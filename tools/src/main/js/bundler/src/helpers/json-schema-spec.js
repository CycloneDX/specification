/**
 * Constants and function related to JSON Schema Specification.
 *
 * This adheres to DRAFT 2020-12.
 */


export const ID_KEYWORD = '$id';

export const REF_KEYWORDS = Object.freeze(['$ref', '$recursiveRef', '$dynamicRef']);

export const DEFS_KEYWORDS = '$defs';

export const DATA_KEYWORDS = Object.freeze(['enum', 'const', 'examples', 'default']);
