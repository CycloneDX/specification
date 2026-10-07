
/**
 * Escape a JSON Pointer (RFC 6901).
 * @param {string} p
 * @return {string}
 */
export function escapeJsonPointer(p) {
    return p.replaceAll('~', '~0').replaceAll('/', '~1');
}

/**
 * Unescape a JSON Pointer (RFC 6901).
 * @param {string} p
 * @return {string}
 */
export function unescapeJsonPointer(p) {
    return p.replaceAll('~1', '/').replaceAll('~0', '~');
}
