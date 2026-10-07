import { readFile } from 'node:fs/promises';

/**
 * Load and bundle a schema.
 *
 * Supports references only, no support for anchors, yet.
 *
 * @param {string} entryFile
 * @param {string} includeDir
 * @return {Promise<{schema: any, embedded: ReadonlyArray<string>, external: ReadonlyArray<string>}>}
 */
export async function bundle(entryFile, includeDir) {
    const external = [];
    const embedded = [];

    const schema = JSON.parse(await readFile(entryFile, 'utf8'));
    // TODO bundling - exclude everything that is not in `includeDir` or is remote - `https?:...`

    return {
        schema,
        external: Object.freeze(external.sort()),
        embedded: Object.freeze(embedded.sort()),
    };
}
