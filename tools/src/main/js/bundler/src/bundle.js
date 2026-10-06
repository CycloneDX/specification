import { readFile } from 'node:fs/promises';

export async function bundle(entryFile, includeDir) {
    const embedded = [];
    const external = [];

    const schema = JSON.parse(await readFile(entryFile, 'utf8'));

    // TODO

    return {
        embedded,
        external,
        schema,
    };
}
