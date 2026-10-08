/**
 * Common constants and functions.
 */

import {readFile} from 'node:fs/promises';
import {sep} from "node:path";

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
export async function getJsonfile (file) {
    return JSON.parse(await readFile(file, 'utf8'));
}

export function unixPath(p) {
    return p.replace(sep, '/');
}
