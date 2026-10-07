import { readFile } from 'node:fs/promises';

export async function bundle(entryFile, includeDir) {
    const embedded = [];
    const external = [];

    const schema = JSON.parse(await readFile(entryFile, 'utf8'));
    // TODO bundling - exclude everything that is not in `includeDir` or has a schema - `https?:...`

    return {
        schema,
        embedded: Object.freeze(embedded.sort()),
        external: Object.freeze(external.sort()),
    };
}
