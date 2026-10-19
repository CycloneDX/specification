/**
 * Common constants and functions.
 */

import {readFile} from 'node:fs/promises';
import {sep} from 'node:path';

/**
 * File extension for JSON schema files.
 */
export const JSON_SCHEMA_EXT = '.schema.json';

/**
 * Regex matching JSON schema files.
 */
export const JSON_SCHEMA_RE = Object.freeze(new RegExp(`${RegExp.escape(JSON_SCHEMA_EXT)}$`));

/**
 * Get JSON file.
 * @param {string} file
 * @returns {Promise<*>}
 */
export const getJsonfile = async (file) =>
    JSON.parse(await readFile(file, 'utf8'));

/**
 * @param {string} p
 * @returns {string}
 */
export const posixPath = (p) =>
    p.replaceAll(sep, '/');

/**
 * Sentinel returned by {@link objectGetOwnPath} when a path does not exist.
 *
 * A Symbol is used, since `undefined`/`null` may be legit values.
 */
export const PATH_NOT_FOUND = Symbol('PATH_NOT_FOUND');

/**
 * Get the value at a path of own properties.
 *
 * @param {Readonly<*>} o
 * @param {Iterable<string>} pathStack
 * @returns {*|typeof PATH_NOT_FOUND} the value, or {@link PATH_NOT_FOUND} if the path does not exist
 */
export const objectGetOwnPath = (o, pathStack) => {
    let c = o;
    for (const s of pathStack) {
        try {
            if (!Object.hasOwn(c, s)) return PATH_NOT_FOUND;
        } catch { // TypeErrors and such.
            return PATH_NOT_FOUND;
        }
        c = c[s];
    }
    return c;
};


/**
 * Get the value at a path of own properties.
 *
 * @param {Readonly<*>} o
 * @param {Iterable<string>} pathStack
 * @returns {void|PATH_NOT_FOUND}
 */
export const objectDeleteOwnPath = (o, pathStack) => {
    const p = [...pathStack];
    const d = p.pop();
    const t = objectGetOwnPath(o, p);
    if (t === PATH_NOT_FOUND) { throw new RangeError(`Path not found: ${JSON.stringify(p)}`) }
    delete t[d];
};


/**
 * Find duplicate values in a map.
 * @template K
 * @template V
 * @param {ReadonlyMap<K, V>} m
 * @returns {Map<V, K[]>}
 */
export const findDuplicateValues = (m) => {
    const vs = new Map(m.values().map(v => [v, []]));
    m.forEach((v, k) => {
        vs.get(v).push(k);
    });
    vs.forEach((ks, v) => {
        if (ks.length < 2) vs.delete(v);
    });
    return vs;
};
