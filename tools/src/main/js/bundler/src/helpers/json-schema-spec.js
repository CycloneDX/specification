/**
 * Constants and function related to JSON Schema Specification.
 *
 * This adheres to DRAFT 2020-12.
 */

export const REF_KEYWORDS = Object.freeze(new Set(['$ref', '$recursiveRef', '$dynamicRef']));

export const DEFS_KEYWORDS = '$defs';

export const DATA_KEYWORDS = Object.freeze(new Set(['enum', 'const', 'examples', 'default']));

/**
 * Split a ref in path and fragment.
 *
 * Return values are either non-empty strings or `null`.
 *
 * @param {string} r
 * @return {{path: string|null, frag: string|null}}
 */
export function refSplit(r) {
    const split = r.split('#');
    if (split.length > 2) {
        throw new Error(`unexpected amount of "#" in ${r}`);
    }
    return {
        path: split[0] || null,
        frag: split[1] || null,
    }
}


/**
 * Weather a ref is absolute.
 * @param {string} r
 * @return {boolean}
 */
export function refIsAbsolute(r) {
    if (r.startsWith('#')) return false;
    return r.startsWith('/')  // Unix-like absolute path
        || r.startsWith('\\')  // UNC-like absolute path
        || r.search(':') > 0; // Windows-like absolute path or a form of <schema>:<rest>
}
