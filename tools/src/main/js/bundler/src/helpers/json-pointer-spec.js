/**
 * Constants and function related to JSON Pointer Schema Specification (RFC 6901).
 */

/**
 * Escaped JSON pointer.
 * @typedef {string} JsonPointer
 */

/**
 * Unescaped JSON Pointer token.
 * @typedef {string} JsonPointerToken
 */

/**
 * Stack of unescaped JSON Pointer tokens.
 * @typedef {JsonPointerToken[]} JsonPointerStack
 */

export const ROOT_POINTER = '';

export const PREFIX = '/';
const PREFIX_ESC = '~1';
const TILDE = '~';
const TILDE_ESC = '~0';

/**
 * @param {string} s
 * @returns {boolean}
 */
export const isJsonPointer = (s) =>
    s === ROOT_POINTER || s.startsWith(PREFIX);

/**
 * JSON Pointer to stack.
 * @param {JsonPointer} p
 * @returns {JsonPointerStack}
 */
export const jsonPointer2stack = (p) =>
    p.split(PREFIX).slice(1).map(unescapeJsonPointer);

/**
 * JSON Pointer for stack.
 * @param {Readonly<JsonPointerStack>} s
 * @returns {JsonPointer}
 */
export const jsonPointer4stack = (s) =>
    s.map(t => `${PREFIX}${escapeJsonPointer(t)}`).join('')


/**
 * Escape a JSON Pointer token.
 * @param {string} p
 * @returns {string}
 */
export const escapeJsonPointer = (p) =>
    p.replaceAll(TILDE, TILDE_ESC).replaceAll(PREFIX, PREFIX_ESC);

/**
 * Unescape a JSON Pointer token.
 * @param {string} p
 * @returns {string}
 */
export const unescapeJsonPointer = (p) =>
    p.replaceAll(PREFIX_ESC, PREFIX).replaceAll(TILDE_ESC, TILDE);

/**
 * Whether any pointer in `u` is a strict ancestor of `p`.
 * @param {JsonPointer} p
 * @param {Iterable<JsonPointer>} u
 * @return {boolean}
 */
export const hasAncestorIn = (p, u) => {
    for (const up of u) {
        if (p.startsWith(up + PREFIX)) return true;
    }
    return false;
};
