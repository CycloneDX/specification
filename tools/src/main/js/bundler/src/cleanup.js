/**
 * Size-reduction passes for a bundled schema. Pure: returns a new object.
 */

import { DATA_KEYWORDS } from "./json-schema.js";

/**
 * Drop every `$comment` keyword from schema objects, except on the root.
 *
 * @param {Record<string, unknown>} schema
 * @returns {Record<string, unknown>}
 */
export function dropComments(schema) {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [key, value] of Object.entries(schema)) {
        out[key] = DATA_KEYWORDS.includes(key) ? structuredClone(value) : dropCommentsDeep(value);
    }
    return out;
}

/**
 * @template T
 * @param {T} node
 * @returns {T}
 */
function dropCommentsDeep(node) {
    if (Array.isArray(node)) {
        return /** @type {T} */ (node.map(dropCommentsDeep));
    }
    if (typeof node !== "object" || node === null) {
        return node;
    }

    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [key, value] of Object.entries(node)) {
        if (key === "$comment") continue;
        // Data keywords hold arbitrary JSON; a "$comment" key in there is data, not a schema keyword.
        out[key] = DATA_KEYWORDS.includes(key) ? structuredClone(value) : dropCommentsDeep(value);
    }
    return /** @type {T} */ (out);
}
