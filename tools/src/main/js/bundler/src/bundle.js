/**
 * A thin, pure wrapper around `@hyperjump/json-schema/bundle` that:
 *   - registers every schema file found in a set of allow-listed directories,
 *   - resolves the transitive `$ref` graph of an entry point strictly offline,
 *   - embeds only referenced schemas that live in those directories,
 *   - leaves every other reference as an external `$ref`,
 *   - returns the compound document as a plain object (no output I/O).
 */

import { readFile, glob, stat } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";
import { pathToFileURL } from "node:url";

import { registerSchema, unregisterSchema } from "@hyperjump/json-schema";
import { bundle as hyperjumpBundle } from "@hyperjump/json-schema/bundle";
import { resolveIri, toAbsoluteIri } from "@hyperjump/uri";

// Eagerly register all dialects we are willing to handle so `$schema` just works.
import "@hyperjump/json-schema/draft-2020-12";
import "@hyperjump/json-schema/draft-2019-09";
import "@hyperjump/json-schema/draft-07";
import "@hyperjump/json-schema/draft-06";
import "@hyperjump/json-schema/draft-04";

import { DATA_KEYWORDS, ID_KEYWORDS, REF_KEYWORDS } from "./json-schema.js";

/**
 * @typedef {Record<string, unknown>} SchemaObject
 */

/**
 * @typedef {object} BundleOptions
 * @property {string[]} includeDirs
 *   Directories (recursively scanned) whose schema files are *eligible* for
 *   embedding. Only files actually reachable via `$ref` from the entry point
 *   are embedded. Everything referenced from outside these directories is left
 *   as an external `$ref` and is never fetched.
 * @property {string} [filePattern="**\/*.json"]
 *   Glob (relative to each include dir) selecting schema files.
 * @property {boolean} [alwaysIncludeDialect=false]
 *   Passthrough to hyperjump: always keep `$schema` on embedded resources.
 * @property {"uri"|"uuid"} [definitionNamingStrategy="uri"]
 *   Passthrough to hyperjump: how embedded resources are keyed under `$defs`.
 */

/**
 * @typedef {object} BundleResult
 * @property {SchemaObject} schema   The bundled compound document.
 * @property {string[]} embedded     Absolute URIs of resources that were embedded.
 * @property {string[]} external     Absolute URIs referenced but left external.
 * @property {string} entryUri       Absolute URI of the entry point's root resource.
 */

/**
 * @typedef {object} LoadedSchema
 * @property {string} retrievalUri  `file://` URL the schema was read from.
 * @property {string} baseUri       Effective base URI (`$id` resolved against retrieval URI, or the retrieval URI).
 * @property {SchemaObject} schema  Parsed document.
 */


/**
 * Bundle a JSON Schema entry point into a single compound document.
 *
 * @param {string | URL} entryPoint  File path or `file://` URL of the main schema.
 * @param {BundleOptions} options
 * @returns {Promise<BundleResult>}
 */
export async function bundle(entryPoint, options) {
    const {
        includeDirs,
        filePattern = "**/*.json",
        alwaysIncludeDialect = false,
        definitionNamingStrategy = "uri",
    } = options ?? {};

    if (!Array.isArray(includeDirs) || includeDirs.length === 0) {
        throw new TypeError("options.includeDirs must be a non-empty array of directories");
    }

    const entry = await loadSchemaFile(toFileUrl(entryPoint));
    if (entry.baseUri.startsWith("file:")) {
        // hyperjump refuses to register `file:` resources, and a bundle root
        // without a stable identifier makes no sense anyway.
        throw new Error(`Entry schema ${entry.retrievalUri} must declare an absolute $id`);
    }

    // 1. Collect every eligible schema from the include dirs (keyed by base URI).
    const eligible = await loadIncludeDirs(includeDirs, filePattern);
    // The entry point is always part of the graph, even if it lives outside includeDirs.
    if (!eligible.has(entry.baseUri)) {
        eligible.set(entry.baseUri, entry);
    }

    // Index by retrieval URI as well, so relative refs to files without `$id` resolve.
    /** @type {Map<string, LoadedSchema>} */
    const byRetrievalUri = new Map();
    for (const loaded of eligible.values()) {
        byRetrievalUri.set(loaded.retrievalUri, loaded);
    }

    // 2. Walk the transitive `$ref` graph offline to partition into embedded / external.
    const { embedded, external, aliases } = partitionReferences(entry, eligible, byRetrievalUri);

    // 3. Register everything reachable & eligible, bundle, and always clean up
    //    so the function can be called repeatedly in the same process.
    //
    //    NOTE: hyperjump keys its registry by the 2nd argument of registerSchema,
    //    NOT by `$id`. It must therefore be exactly the URI that `$ref`s and
    //    bundle() will ask for – otherwise hyperjump falls back to fetching the
    //    `$id` over the network.
    /** @type {string[]} */
    const registered = [];
    try {
        registerSchema(entry.schema, entry.baseUri);
        registered.push(entry.baseUri);

        for (const uri of embedded) {
            const loaded = eligible.get(uri) ?? byRetrievalUri.get(aliases.get(uri));
            if (!loaded) continue; // nested embedded resource; registered via its parent
            registerSchema(loaded.schema, uri);
            registered.push(uri);
        }

        const schema = /** @type {SchemaObject} */ (
            await hyperjumpBundle(entry.baseUri, {
                alwaysIncludeDialect,
                definitionNamingStrategy,
                externalSchemas: [...external],
            })
        );

        return {
            schema,
            embedded: [...embedded].sort(),
            external: [...external].sort(),
            entryUri: entry.baseUri,
        };
    } finally {
        for (const uri of registered) {
            try {
                unregisterSchema(uri);
            } catch {
                /* ignore – nothing we can do during cleanup */
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/**
 * @param {string | URL} input
 * @returns {URL}
 */
function toFileUrl(input) {
    if (input instanceof URL) {
        if (input.protocol !== "file:") {
            throw new TypeError(`entryPoint must be a file path or file:// URL, got ${input.href}`);
        }
        return input;
    }
    if (typeof input === "string" && input.startsWith("file:")) {
        return new URL(input);
    }
    return pathToFileURL(resolvePath(input));
}

/**
 * @param {URL} fileUrl
 * @returns {Promise<LoadedSchema>}
 */
async function loadSchemaFile(fileUrl) {
    const raw = await readFile(fileUrl, "utf8");
    /** @type {unknown} */
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (cause) {
        throw new Error(`Failed to parse JSON schema file ${fileUrl.href}`, { cause });
    }
    if (!isPlainObject(parsed)) {
        throw new Error(`Schema file ${fileUrl.href} does not contain a JSON object`);
    }

    const retrievalUri = fileUrl.href;
    const declaredId = getId(parsed);
    const baseUri = declaredId
        ? toAbsoluteIri(resolveIri(declaredId, retrievalUri))
        : retrievalUri;

    return { retrievalUri, baseUri, schema: parsed };
}

/**
 * @param {string[]} dirs
 * @param {string} pattern
 * @returns {Promise<Map<string, LoadedSchema>>}  keyed by base URI
 */
async function loadIncludeDirs(dirs, pattern) {
    /** @type {Map<string, LoadedSchema>} */
    const result = new Map();

    for (const dir of dirs) {
        const absDir = resolvePath(dir);
        const info = await stat(absDir).catch(() => null);
        if (!info?.isDirectory()) {
            throw new Error(`includeDirs entry is not a directory: ${dir}`);
        }

        for await (const rel of glob(pattern, { cwd: absDir })) {
            const loaded = await loadSchemaFile(pathToFileURL(resolvePath(absDir, rel)));

            const dup = result.get(loaded.baseUri);
            if (dup && dup.retrievalUri !== loaded.retrievalUri) {
                throw new Error(
                    `Duplicate schema identifier ${loaded.baseUri}: ${dup.retrievalUri} and ${loaded.retrievalUri}`,
                );
            }
            result.set(loaded.baseUri, loaded);
        }
    }
    return result;
}

// ---------------------------------------------------------------------------
// Reference graph
// ---------------------------------------------------------------------------

/**
 * Walk the `$ref` graph from the entry point. A referenced resource is
 * "embedded" if it can be found in the eligible set – either by `$id` or, for
 * files without `$id`, by resolving the relative path next to the referencing
 * file. Everything else is "external". Only embedded resources are traversed.
 *
 * @param {LoadedSchema} entry
 * @param {Map<string, LoadedSchema>} eligible       keyed by base URI
 * @param {Map<string, LoadedSchema>} byRetrievalUri keyed by file:// URL
 * @returns {{ embedded: Set<string>, external: Set<string>, aliases: Map<string, string> }}
 *   `aliases` maps a ref target URI -> file:// URL for schemas matched by path.
 */
function partitionReferences(entry, eligible, byRetrievalUri) {
    /** @type {Set<string>} */
    const embedded = new Set();
    /** @type {Set<string>} */
    const external = new Set();
    /** @type {Map<string, string>} */
    const aliases = new Map();
    /** @type {Set<string>} */
    const visited = new Set();
    /** @type {LoadedSchema[]} */
    const queue = [entry];

    while (queue.length > 0) {
        const current = /** @type {LoadedSchema} */ (queue.shift());
        if (visited.has(current.baseUri)) continue;
        visited.add(current.baseUri);

        const { nestedIds, refs } = collectIdsAndRefs(current.schema, current.baseUri);

        // Resources embedded *inside* this file are reachable through it already.
        for (const id of nestedIds) visited.add(id);

        for (const target of refs) {
            if (visited.has(target) || embedded.has(target) || external.has(target)) continue;

            let loaded = eligible.get(target);

            if (!loaded) {
                // Not matched by `$id` -> maybe a relative ref to a local file. Map the
                // resolved target back to a file path relative to the referencing document.
                const fileUrl = relativeFileUrl(target, current);
                loaded = fileUrl ? byRetrievalUri.get(fileUrl) : undefined;
                if (loaded) {
                    if (getId(loaded.schema) !== undefined && loaded.baseUri !== target) {
                        throw new Error(
                            `${current.retrievalUri} references ${target}, ` +
                            `but ${loaded.retrievalUri} declares $id ${loaded.baseUri}`,
                        );
                    }
                    aliases.set(target, loaded.retrievalUri);
                }
            }

            if (loaded) {
                embedded.add(target);
                queue.push({ ...loaded, baseUri: target });
            } else {
                external.add(target);
            }
        }
    }

    embedded.delete(entry.baseUri);
    return { embedded, external, aliases };
}

/**
 * Given an absolute ref target and the document that referenced it, compute the
 * `file://` URL the same relative path points to on disk. Returns `undefined`
 * if the target is not "next to" (or below) the referencing document.
 *
 * @param {string} target
 * @param {LoadedSchema} current
 * @returns {string | undefined}
 */
function relativeFileUrl(target, current) {
    const base = current.baseUri.slice(0, current.baseUri.lastIndexOf("/") + 1);
    if (!target.startsWith(base)) return undefined;
    const rel = target.slice(base.length);
    return new URL(rel, current.retrievalUri).href;
}

/**
 * Collect all absolute, fragment-less reference targets and nested resource
 * identifiers in a schema document, honouring base-URI changes via `$id`.
 *
 * @param {unknown} node
 * @param {string} baseUri
 * @param {{ nestedIds: Set<string>, refs: Set<string> }} [acc]
 * @returns {{ nestedIds: Set<string>, refs: Set<string> }}
 */
function collectIdsAndRefs(node, baseUri, acc = { nestedIds: new Set(), refs: new Set() }) {
    if (Array.isArray(node)) {
        for (const item of node) collectIdsAndRefs(item, baseUri, acc);
        return acc;
    }
    if (!isPlainObject(node)) return acc;

    // A nested `$id` (that isn't a mere anchor like "#foo") starts a new resource.
    const id = getId(node);
    if (id && !id.startsWith("#")) {
        baseUri = toAbsoluteIri(resolveIri(id, baseUri));
        acc.nestedIds.add(baseUri);
    }

    for (const keyword of REF_KEYWORDS) {
        const ref = node[keyword];
        if (typeof ref === "string") {
            acc.refs.add(toAbsoluteIri(resolveIri(ref, baseUri))); // strips fragment
        }
    }

    for (const [key, value] of Object.entries(node)) {
        // Data keywords may contain arbitrary JSON with "$ref"-looking keys.
        if (DATA_KEYWORDS.includes(key)) continue;
        collectIdsAndRefs(value, baseUri, acc);
    }
    return acc;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * @param {SchemaObject} schema
 * @returns {string | undefined}
 */
function getId(schema) {
    for (const keyword of ID_KEYWORDS) {
        const value = schema[keyword];
        if (typeof value === "string") return value;
    }
    return undefined;
}

/**
 * @param {unknown} value
 * @returns {value is SchemaObject}
 */
function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
