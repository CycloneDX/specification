#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { bundle } from "./src/bundle.js";
import { renameIds } from "./src/rename.js";
import { dropComments } from "./src/cleanup.js";
import { treeShake } from "./src/tree-shake.js";

// --- hardcoded for now ------------------------------------------------------
const ENTRY = resolve("../../../../../schema/2.0/cyclonedx-2.0.schema.json");
const INCLUDE_DIRS = [resolve("../../../../../schema/2.0/modules")];
// ----------------------------------------------------------------------------

/** `…/foo.schema.json` -> `…/foo-bundled.schema.json` */
const toBundledName = (s) => {
    if (!s.endsWith(".schema.json")) {
        throw new Error(`expected "*.schema.json", got ${s}`);
    }
    return s.replace(/\.schema\.json$/, "-bundled.schema.json");
};

/** `…/foo.schema.json` -> `…/foo.min.schema.json` */
const toBundledNameMinified = (s) => {
    if (!s.endsWith(".schema.json")) {
        throw new Error(`expected "*.schema.json", got ${s}`);
    }
    return s.replace(/\.schema\.json$/, ".min.schema.json");
};

const OUTPUT_BUNDLED = toBundledName(ENTRY);
const OUTPUT_MINIFIED = toBundledNameMinified(OUTPUT_BUNDLED);

const bundled = await bundle(ENTRY, { includeDirs: INCLUDE_DIRS });
console.error(`bundler: embedded (${bundled.embedded.length}):`, bundled.embedded);
console.error(`bundler: external (${bundled.external.length}):`, bundled.external);

const renamed = renameIds(bundled.schema, toBundledName);
console.error(`rename: renamed (${renamed.renamed.length}):`, renamed.renamed);


const outBundled = JSON.stringify(renamed.schema, null, 2);
await writeFile(OUTPUT_BUNDLED, outBundled);
console.error(`wrote ${OUTPUT_BUNDLED} (${Buffer.byteLength(outBundled, "utf8")} bytes)`);

const shaken = treeShake(renamed.schema);
console.error(`tree-shake: removed (${shaken.removed.length}):`, shaken.removed);
console.error(`tree-shake: hollowed (${shaken.hollowed.length}):`, shaken.hollowed);

const outMinified = JSON.stringify({ ...dropComments(shaken.schema), $id: toBundledNameMinified(schema.$id) });
await writeFile(OUTPUT_MINIFIED, outMinified);
console.error(`wrote ${OUTPUT_MINIFIED} (${Buffer.byteLength(outMinified, "utf8")} bytes)`);
