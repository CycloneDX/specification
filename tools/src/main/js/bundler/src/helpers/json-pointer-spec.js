/**
 * Constants and function related to JSON Pointer Schema Specification (RFC 6901).
 */

/**
 * Escaped JSON pointer.
 * @typedef {string} JsonPointer
 */

/**
 * Stack of unescaped JSON Pointer tokens.
 * @typedef  {string[]} JsonPointerStack
 */


/**
 * Delimiter in JSON Pointer.
 */
const JSON_POINTER_DELIM = '/';

/**
 * JSON Pointer to stack.
 * @param {JsonPointer} p
 * @return {JsonPointerStack}
 */
export function jsonPointer2stack(p) {
    return p.split(JSON_POINTER_DELIM);
}

/**
 * JSON Pointer for stack.
 * @param {JsonPointerStack} s
 * @return {JsonPointer}
 */
export function jsonPointer4stack(s) {
    return s.join(JSON_POINTER_DELIM);
}


/**
 * Escape a JSON Pointer token..
 * @param {string} p
 * @return {string}
 */
export function escapeJsonPointer(p) {
    return p.replaceAll('~', '~0').replaceAll('/', '~1');
}

/**
 * Unescape a JSON Pointer token.
 * @param {string} p
 * @return {string}
 */
export function unescapeJsonPointer(p) {
    return p.replaceAll('~1', '/').replaceAll('~0', '~');
}


