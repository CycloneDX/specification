/**
 * Constants and function related to JSON Schema Specification.
 *
 * This adheres to DRAFT 2020-12.
 */

export const REF_KEYWORDS = Object.freeze(new Set(['$ref', '$recursiveRef', '$dynamicRef']));

export const DEFS_KEYWORDS = '$defs';

export const DATA_KEYWORDS = Object.freeze(new Set(['enum', 'const', 'examples', 'default']));

/**
 *
 * @param {string} s
 * @return {{path: string, frag: string?}}
 */
export function refSplit(s) {
    const split = s.split('#');
    if (split.length > 2) {
        throw new Error(`unexpected amount of "#" in ${s}`);
    }
    return {
        path: split[0],
        frag: split[1],
    }
}
