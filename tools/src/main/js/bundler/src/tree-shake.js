/**
 * Remove unreachable `$defs` / `definitions` entries from a (bundled) compound
 * document. Pure: returns a new object.
 *
 * Reachability starts at the root schema and follows references by URI,
 * honouring `$id` base changes, JSON-Pointer fragments and `$anchor`s.
 * `$dynamicRef` / `$recursiveRef` are handled conservatively: every
 * `$dynamicAnchor` / `$recursiveAnchor` with a matching name in any resource
 * is treated as reachable.
 *
 * Schemas that are themselves unreferenced but still contain used definitions
 * are kept as "hollow" containers: all their keywords except identification
 * and the definitions are dropped, and `not: {}` makes them unsatisfiable.
 */

import { resolveIri, toAbsoluteIri } from "@hyperjump/uri";
import { ID_KEYWORDS, REF_KEYWORDS, DEFS_KEYWORDS, DATA_KEYWORDS } from "./json-schema.js";

const HOLLOW_COMMENT =
    "This schema is hollow: it was not referenced and only remains as a container " +
    "for definitions that are still in use. It must not be used for validation.";

/**
 * @param {Record<string, unknown>} schema
 * @returns {{ schema: Record<string, unknown>, removed: string[], hollowed: string[] }}
 *   `removed`  – `<resourceUri>#<pointer>` of every dropped definition.
 *   `hollowed` – `<resourceUri>#<pointer>` of every schema reduced to a container.
 */
export function treeShake(schema) {
    const rootId = getId(schema);
    if (!rootId) throw new Error("Root schema must declare an $id");
    const rootBase = toAbsoluteIri(rootId);

    // --- pass 1: index resources, anchors, and each node's base URI ----------
    /** @type {Map<string, object>} resource URI -> root node of that resource */
    const resources = new Map();
    /** @type {Map<string, Map<string, object>>} resource URI -> anchor name -> node */
    const anchors = new Map();
    /** @type {Map<string, object[]>} dynamic/recursive anchor name -> nodes */
    const dynamicAnchors = new Map();
    /** @type {WeakMap<object, string>} node -> base URI */
    const baseOf = new WeakMap();

    index(schema, rootBase, resources, anchors, dynamicAnchors, baseOf);

    // --- pass 2: mark reachable nodes -----------------------------------------
    /** @type {Set<object>} */
    const visited = new Set();
    /** @type {object[]} */
    const work = [schema];

    while (work.length > 0) {
        const node = /** @type {object} */ (work.pop());
        if (visited.has(node)) continue;
        visited.add(node);
        if (Array.isArray(node)) {
            for (const item of node) if (isObjectLike(item)) work.push(item);
            continue;
        }
        const base = baseOf.get(node) ?? rootBase;
        for (const [key, value] of Object.entries(node)) {
            if (DATA_KEYWORDS.includes(key)) continue;
            if (REF_KEYWORDS.includes(key) && typeof value === "string") {
                for (const target of resolveRef(key, value, base, resources, anchors, dynamicAnchors)) {
                    work.push(target);
                }
                continue;
            }
            if (DEFS_KEYWORDS.includes(key)) continue; // only reachable via references
            if (isObjectLike(value)) work.push(value);
        }
    }

    // --- pass 3: prune ----------------------------------------------------------
    /** @type {string[]} */
    const removed = [];
    /** @type {string[]} */
    const hollowed = [];
    /** @type {WeakMap<object, boolean>} */
    const keepMemo = new WeakMap();

    /** Does this subtree contain anything reachable? */
    const keep = (node) => {
        if (!isObjectLike(node)) return false;
        if (visited.has(node)) return true;
        const memo = keepMemo.get(node);
        if (memo !== undefined) return memo;
        const result = Object.values(node).some(keep);
        keepMemo.set(node, result);
        return result;
    };

    const prune = (node, base, pointer) => {
        if (Array.isArray(node)) return node.map((item, i) => prune(item, base, `${pointer}/${i}`));
        if (!isObjectLike(node)) return node;
        base = baseOf.get(node) ?? base;
        if (resources.get(base) === node) pointer = "";

        // A schema that is kept solely because of nested, still-used definitions.
        const hollow = !visited.has(node) && DEFS_KEYWORDS.some((k) => isObjectLike(node[k]));

        /** @type {Record<string, unknown>} */
        const out = {};
        if (hollow) {
            // Keep only what identifies the resource, then make it unsatisfiable.
            if (typeof node.$schema === "string") out.$schema = node.$schema;
            for (const k of ID_KEYWORDS) if (typeof node[k] === "string") out[k] = node[k];
            out.not = { $comment: HOLLOW_COMMENT };
            hollowed.push(`${base}#${pointer}`);
        }

        for (const [key, value] of Object.entries(node)) {
            if (DEFS_KEYWORDS.includes(key) && isObjectLike(value) && !Array.isArray(value)) {
                /** @type {Record<string, unknown>} */
                const defs = {};
                for (const [name, def] of Object.entries(value)) {
                    const defPointer = `${pointer}/${key}/${escapePointer(name)}`;
                    if (keep(def)) {
                        defs[name] = prune(def, base, defPointer);
                    } else {
                        removed.push(`${base}#${defPointer}`);
                    }
                }
                if (Object.keys(defs).length > 0) out[key] = defs;
            } else if (hollow) {
                continue; // everything else in a hollow schema is dead
            } else if (DATA_KEYWORDS.includes(key)) {
                out[key] = structuredClone(value);
            } else {
                out[key] = prune(value, base, `${pointer}/${escapePointer(key)}`);
            }
        }
        return out;
    };

    return {
        schema: prune(schema, rootBase, ""),
        removed: removed.sort(),
        hollowed: hollowed.sort(),
    };
}

// ---------------------------------------------------------------------------

function index(node, base, resources, anchors, dynamicAnchors, baseOf) {
    if (Array.isArray(node)) {
        for (const item of node) index(item, base, resources, anchors, dynamicAnchors, baseOf);
        return;
    }
    if (!isObjectLike(node)) return;

    const id = getId(node);
    if (id && !id.startsWith("#")) {
        base = toAbsoluteIri(resolveIri(id, base));
    } else if (id) {
        addAnchor(anchors, base, id.slice(1), node); // draft-04/06 "id": "#foo"
    }
    baseOf.set(node, base);
    if (!resources.has(base)) resources.set(base, node);

    if (typeof node.$anchor === "string") addAnchor(anchors, base, node.$anchor, node);
    if (typeof node.$dynamicAnchor === "string") {
        addAnchor(anchors, base, node.$dynamicAnchor, node);
        pushTo(dynamicAnchors, node.$dynamicAnchor, node);
    }
    if (node.$recursiveAnchor === true) pushTo(dynamicAnchors, "", node);

    for (const [key, value] of Object.entries(node)) {
        if (DATA_KEYWORDS.includes(key)) continue;
        index(value, base, resources, anchors, dynamicAnchors, baseOf);
    }
}

/** @returns {object[]} target nodes of a reference (empty for externals) */
function resolveRef(keyword, ref, base, resources, anchors, dynamicAnchors) {
    const resolved = resolveIri(ref, base);
    const hash = resolved.indexOf("#");
    const uri = toAbsoluteIri(hash === -1 ? resolved : resolved.slice(0, hash));
    const fragment = hash === -1 ? "" : decodeURIComponent(resolved.slice(hash + 1));
    /** @type {object[]} */
    const targets = [];

    const resource = resources.get(uri);
    if (resource) {
        if (fragment === "") {
            targets.push(resource);
        } else if (fragment.startsWith("/")) {
            const node = walkPointer(resource, fragment);
            if (isObjectLike(node)) targets.push(node);
        } else {
            const node = anchors.get(uri)?.get(fragment);
            if (node) targets.push(node);
        }
    }

    // Dynamic scope: be conservative and keep every matching dynamic anchor.
    if (keyword === "$dynamicRef" && !fragment.startsWith("/")) {
        targets.push(...(dynamicAnchors.get(fragment) ?? []));
    } else if (keyword === "$recursiveRef") {
        targets.push(...(dynamicAnchors.get("") ?? []));
    }
    return targets;
}

function walkPointer(node, pointer) {
    let current = node;
    for (const raw of pointer.split("/").slice(1)) {
        if (!isObjectLike(current)) return undefined;
        const token = raw.replaceAll("~1", "/").replaceAll("~0", "~");
        current = Array.isArray(current) ? current[Number(token)] : current[token];
    }
    return current;
}

function addAnchor(anchors, base, name, node) {
    let map = anchors.get(base);
    if (!map) anchors.set(base, (map = new Map()));
    if (!map.has(name)) map.set(name, node);
}

function pushTo(map, key, value) {
    const list = map.get(key);
    if (list) list.push(value);
    else map.set(key, [value]);
}

const escapePointer = (s) => s.replaceAll("~", "~0").replaceAll("/", "~1");

function getId(node) {
    for (const k of ID_KEYWORDS) if (typeof node[k] === "string") return node[k];
    return undefined;
}

const isObjectLike = (v) => typeof v === "object" && v !== null;
