/**
 * Rename all schema resource identifiers in a (bundled) compound document and
 * rewrite every reference accordingly. The result is a new set of resources;
 * references to resources outside the document are left pointing where they
 * pointed before.
 */

import { resolveIri, toAbsoluteIri } from "@hyperjump/uri";
import { DATA_KEYWORDS, DEFS_KEYWORDS, ID_KEYWORDS, REF_KEYWORDS } from "./json-schema.js";


/**
 * @param {Record<string, unknown>} schema  Bundled schema (not modified).
 * @param {(oldUri: string) => string} mapper  Maps an old absolute resource URI to a new one.
 * @returns {{ schema: Record<string, unknown>, renamed: Map<string, string> }}
 */
export function renameIds(schema, mapper) {
    const rootId = getId(schema);
    if (!rootId) throw new Error("Root schema must declare an $id");
    const rootBase = toAbsoluteIri(rootId);

    // Pass 1: collect all resource URIs.
    /** @type {Set<string>} */
    const resources = new Set();
    collectResources(schema, rootBase, resources);

    // Build & validate the mapping.
    /** @type {Map<string, string>} */
    const renamed = new Map();
    /** @type {Map<string, string>} */
    const reverse = new Map();
    for (const oldUri of resources) {
        const newUri = toAbsoluteIri(mapper(oldUri));
        if (!/^[a-z][a-z0-9+.-]*:/i.test(newUri)) {
            throw new Error(`mapper must return an absolute URI, got "${newUri}" for ${oldUri}`);
        }
        const clash = reverse.get(newUri);
        if (clash && clash !== oldUri) {
            throw new Error(`mapper is not injective: ${clash} and ${oldUri} both map to ${newUri}`);
        }
        renamed.set(oldUri, newUri);
        reverse.set(newUri, oldUri);
    }

    // Pass 2: rewrite.
    const out = /** @type {Record<string, unknown>} */ (rewrite(schema, rootBase, renamed));
    return { schema: out, renamed };
}

/**
 * @param {unknown} node
 * @param {string} base
 * @param {Set<string>} acc
 */
function collectResources(node, base, acc) {
    if (Array.isArray(node)) {
        for (const item of node) collectResources(item, base, acc);
        return;
    }
    if (!isPlainObject(node)) return;

    const id = getId(node);
    if (id && !id.startsWith("#")) {
        base = toAbsoluteIri(resolveIri(id, base));
        acc.add(base);
    }
    for (const [key, value] of Object.entries(node)) {
        if (DATA_KEYWORDS.includes(key)) continue;
        collectResources(value, base, acc);
    }
}

/**
 * @param {unknown} node
 * @param {string} oldBase
 * @param {Map<string, string>} renamed
 * @returns {unknown}
 */
function rewrite(node, oldBase, renamed) {
    if (Array.isArray(node)) {
        return node.map((item) => rewrite(item, oldBase, renamed));
    }
    if (!isPlainObject(node)) return node;

    /** @type {Record<string, unknown>} */
    const out = {};

    // Does this node start a new resource?
    const idKeyword = ID_KEYWORDS.find((k) => typeof node[k] === "string");
    const id = idKeyword ? /** @type {string} */ (node[idKeyword]) : undefined;
    if (id && !id.startsWith("#")) {
        oldBase = toAbsoluteIri(resolveIri(id, oldBase));
    }
    const newBase = renamed.get(oldBase) ?? oldBase;

    for (const [key, value] of Object.entries(node)) {
        if (key === idKeyword && id && !id.startsWith("#")) {
            out[key] = newBase;
        } else if (REF_KEYWORDS.includes(key) && typeof value === "string") {
            out[key] = rewriteRef(value, oldBase, newBase, renamed);
        } else if (DEFS_KEYWORDS.includes(key) && isPlainObject(value)) {
            /** @type {Record<string, unknown>} */
            const defs = {};
            for (const [name, sub] of Object.entries(value)) {
                defs[renamed.get(name) ?? name] = rewrite(sub, oldBase, renamed);
            }
            out[key] = defs;
        } else if (DATA_KEYWORDS.includes(key)) {
            out[key] = structuredClone(value);
        } else {
            out[key] = rewrite(value, oldBase, renamed);
        }
    }
    return out;
}

/**
 * @param {string} ref
 * @param {string} oldBase
 * @param {string} newBase
 * @param {Map<string, string>} renamed
 * @returns {string}
 */
function rewriteRef(ref, oldBase, newBase, renamed) {
    const resolved = resolveIri(ref, oldBase);
    const hashAt = resolved.indexOf("#");
    const target = hashAt === -1 ? resolved : resolved.slice(0, hashAt);
    const fragment = hashAt === -1 ? "" : resolved.slice(hashAt);

    const mappedTarget = renamed.get(toAbsoluteIri(target)) ?? target;
    if (mappedTarget === newBase) {
        return fragment || "#"; // keep local references local
    }
    return mappedTarget + fragment;
}

/** @param {Record<string, unknown>} node */
function getId(node) {
    for (const k of ID_KEYWORDS) {
        if (typeof node[k] === "string") return /** @type {string} */ (node[k]);
    }
    return undefined;
}

/**
 * @param {unknown} v
 * @returns {v is Record<string, unknown>}
 */
function isPlainObject(v) {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}
