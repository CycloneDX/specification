/**
 * Constants and function related to JSON Schema Specification.
 *
 * This adheres to DRAFT 2020-12.
 */

export const DEFS_KEYWORDS = '$defs';

export const REF_KEYWORDS = Object.freeze(new Set(['$ref', '$recursiveRef', '$dynamicRef']));

export const DATA_KEYWORDS = Object.freeze(new Set(['enum', 'const', 'examples', 'default']));

export const SINGLE_SCHEMA = Object.freeze(new Set([
    'additionalProperties', 'propertyNames',
    'items', 'contains',
    'unevaluatedProperties', 'unevaluatedItems',
    'not', 'if', 'then', 'else',
    'contentSchema',
]));

export const SCHEMA_ARRAY = Object.freeze(new Set(['allOf', 'anyOf', 'oneOf', 'prefixItems']));

export const SCHEMA_MAP = Object.freeze(new Set([DEFS_KEYWORDS, 'properties', 'patternProperties', 'dependentSchemas']));

/**
 * @param {unknown} o
 * @returns {o is Record<string, unknown>}
 */
export function isSchemaObject(o) {
    return o !== null
        && typeof o === 'object'
        && !Array.isArray(o);
}

/**
 * Yield immediate subschemas, never property maps or literal data.
 * @param {*} s schema
 * @return {Generator<unknown, void, *>}
 */
export function* subschemas(s) {
    for (const [k, v] of Object.entries(s)) {
        if (SINGLE_SCHEMA.has(k)) {
            if(isSchemaObject(v)) yield v;
        } else if (SCHEMA_ARRAY.has(k)) {
            if (Array.isArray(v)) yield* v.filter(isSchemaObject);
        } else if (SCHEMA_MAP.has(k)) {
            if (isSchemaObject(v)) yield* Object.values(v).filter(isSchemaObject);
        }
    }
}

/**
 * @typedef RefSplit
 * @property {string|null} path
 * @property {string|null} frag
 */

/**
 * Split a ref in path and fragment.
 *
 * Return values are either non-empty strings or `null`.
 *
 * @param {string} r ref
 * @return {RefSplit}
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
 * Split a ref in path and fragment.
 *
 * Return values are either non-empty strings or `null`.
 *
 * @param {RefSplit} rs refSplit
 * @return {string}
 */
export function refJoin({path, frag}) {
    if (path && frag) return `${path}#${frag}`;
    if (path) return path;
    if (frag) return `#${frag}`;
    return '#'; // this entire  document
}


/**
 * Weather a ref is absolute.
 * @param {string} r ref
 * @return {boolean}
 */
export function refIsAbsolute(r) {
    if (r.startsWith('#')) return false;
    return r.startsWith('/')  // Unix-like absolute path
        || r.startsWith('\\')  // UNC-like absolute path
        || r.search(':') > 0; // Windows-like absolute path or a form of <schema>:<rest>
}
