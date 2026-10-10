/**
 * Constants and function related to JSON Schema Specification.
 *
 * This adheres to DRAFT 2020-12.
 */


export const SCHEMA_KEYWORD = '$schema';

export const ID_KEYWORD = '$id';

export const COMMENT_KEYWORD = '$comment';

export const DEFS_KEYWORDS = '$defs';

export const REF_KEYWORDS = Object.freeze(new Set(['$ref', '$dynamicRef', '$recursiveRef']));

export const ANCHOR_KEYWORDS = Object.freeze(new Set(['$anchor', '$dynamicAnchor', '$recursiveAnchor']));

export const DATA_KEYWORDS = Object.freeze(new Set(['enum', 'const', 'examples', 'default']));

export const NOT_KEYWORD = 'not';

export const SINGLE_SCHEMA = Object.freeze(new Set([
    'additionalProperties', 'propertyNames',
    'items', 'contains',
    'unevaluatedProperties', 'unevaluatedItems',
    'if', 'then', 'else', NOT_KEYWORD,
    'contentSchema',
]));

export const SCHEMA_ARRAY = Object.freeze(new Set(['allOf', 'anyOf', 'oneOf', 'prefixItems']));

export const SCHEMA_MAP = Object.freeze(new Set([DEFS_KEYWORDS, 'properties', 'patternProperties', 'dependentSchemas']));

/**
 * @param {unknown} o
 * @returns {o is Record<string, unknown>}
 */
export const isSchemaObject = (o) =>
    o !== null
    && typeof o === 'object'
    && !Array.isArray(o);

/**
 * Yield immediate subschemas, never property maps or literal data.
 * @param {Readonly<*>} s schema
 * @return {Generator<unknown, void, *>}
 */
export const subschemas = function* (s) {
    for (const [k, v] of Object.entries(s)) {
        if (SINGLE_SCHEMA.has(k)) {
            if (isSchemaObject(v)) yield v;
        } else if (SCHEMA_ARRAY.has(k)) {
            if (Array.isArray(v)) yield* v.filter(isSchemaObject);
        } else if (SCHEMA_MAP.has(k)) {
            if (isSchemaObject(v)) yield* Object.values(v).filter(isSchemaObject);
        }
    }
};

/**
 * @typedef {object} RefSplit
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
export const refSplit = (r) => {
    const split = r.split('#');
    if (split.length > 2) {
        throw new RangeError(`Unexpected amount of "#" in ${r}`);
    }
    return {
        path: split[0] || null,
        frag: split[1] || null,
    }
};


/**
 * Join a ref path and fragment.
 *
 * @param {Readonly<RefSplit>} rs
 * @return {string}
 */
export const refJoin = ({path, frag}) => {
    if (path && frag) return `${path}#${frag}`;
    if (path) return path;
    if (frag) return `#${frag}`;
    return '#'; // the entire schema
};


/**
 * Whether a ref is absolute.
 * @param {string} r ref
 * @return {boolean}
 */
export const refIsAbsolute = (r) => {
    if (r.startsWith('#')) return false;
    return r.startsWith('/')  // Unix-like absolute path
        || r.startsWith('\\')  // UNC-like absolute path
        || r.search(':') > 0; // Windows-like absolute path or a form of <schema>:<rest>
};
