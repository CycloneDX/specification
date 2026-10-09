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
 * @return {Promise<any>}
 */
export const getJsonfile = async  (file) =>
    JSON.parse(await readFile(file, 'utf8'));

/**
 * @param {string} p
 * @return {string}
 */
export const unixPath = (p) =>
    p.replaceAll(sep, '/');


/**
 * @param {*} o
 * @param {string[]} pathStack
 * @return {boolean}
 */
export const objectHasOwnPath = (o, pathStack) => {
    let c = o;
    for (const s of pathStack) {
        try {
            if (!Object.hasOwn(c, s)) return false;
        } catch { // TypeErrors and such.
            return false;
        }
        c = c[s];
    }
    return true;
};
