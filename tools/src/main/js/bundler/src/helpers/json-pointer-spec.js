/**
 * Constants and function related to JSON Pointer Schema Specification (RFC 6901).
 */

/**
 * Escaped JSON pointer.
 * @typedef {string} JsonPointer
 */

/**
 * Stack of unescaped JSON Pointer tokens.
 * @typedef {string[]} JsonPointerStack
 */


const PREFIX = '/';
const PREFIX_ESC = '~1';
const TILDE = '~';
const TILDE_ESC = '~0';

/**
 * @param {string} s
 * @return {boolean}
 */
export const isJsonPointer = (s) =>
    s.startsWith(PREFIX);

/**
 * JSON Pointer to stack.
 * @param {JsonPointer} p
 * @return {JsonPointerStack}
 */
export const jsonPointer2stack = (p) =>
    p.split(PREFIX).slice(1).map(unescapeJsonPointer);

/**
 * JSON Pointer for stack.
 * @param {JsonPointerStack} s
 * @return {JsonPointer}
 */
export const jsonPointer4stack = (s) =>
    PREFIX + s.map(escapeJsonPointer).join(PREFIX);






/**
 * Escape a JSON Pointer token.
 * @param {string} p
 * @return {string}
 */
export const escapeJsonPointer = (p) =>
    p.replaceAll(TILDE, TILDE_ESC).replaceAll(PREFIX, PREFIX_ESC);

/**
 * Unescape a JSON Pointer token.
 * @param {string} p
 * @return {string}
 */
export const unescapeJsonPointer = (p) =>
    p.replaceAll(PREFIX_ESC, PREFIX).replaceAll(TILDE_ESC, TILDE);


