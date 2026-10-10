# JSON Schema bundler

Bundles a modular CycloneDX JSON Schema (an entry schema plus a directory of
module schemas) into a single self-contained schema file, and a minified
variant of it.

Works best effort.  
Not compliant with [JSON Schema Compound Documents](https://json-schema.org/blog/posts/bundling-json-schema-compound-documents):
embedded schemas lose their `$id`/`$schema` and are addressed via JSON Pointers
into `$defs` instead of via embedded resources.

## Requirements

* Node.js `>= 24.2` (uses `import.meta.main`, `RegExp.escape`, `fs.glob`)
* No runtime dependencies

## Usage

```shell
node cli.js <modules-directory> <root-schema-path>
```

Example (run from the repository root):

```shell
node tools/src/main/js/bundler/cli.js \
  schema/2.0/modules \
  schema/2.0/cyclonedx-2.0.schema.json
```

This writes, next to the root schema:

* `cyclonedx-2.0-bundled.schema.json` — pretty-printed, all `$comment` kept
* `cyclonedx-2.0-bundled.min.schema.json` — minified, only the root `$comment` kept

Exit codes:
* `1` — invalid arguments
* `2` — bundling/validation error

This is what the `bundle_2.0_schemas` GitHub workflow runs on every change to
the 2.0 schema sources.

## How it works

The bundler is split into stages (one module each under `src/`):

1. **Bundle** (`src/bundle.js`)
   * Loads the entry schema and *all* `*.schema.json` files found recursively in the modules directory.
   * Each module is embedded under `$defs/<module-name>`, where `<module-name>` is the file's basename without `.schema.json`.
      `$schema`, `$id` and the top-level `$comment` of embedded modules are dropped.
   * The entry schema's own `$defs` are moved into a *hollow* container `$defs/<entry-name>`
      (marked with `"not": {"$comment": …}` so it is never used for validation by accident).
   * `$ref`, `$dynamicRef` and `$recursiveRef` are rewired:
     * refs to a bundled file → `#/$defs/<module-name>[/<pointer>]`
     * refs to a non-bundled file → path made relative to the output file, kept external
     * absolute URIs → left untouched, reported as external
   * The root `$id` is rewritten to point at the bundled file name.
2. **Tree-shake** (`src/cleanup.js`) — remove definitions that are not reachable from the root.  
   *Not implemented yet; currently a no-op.*
3. **Sanity check** (`src/sanity.js`) — verifies every local JSON-Pointer ref resolves in the bundle.
   Unresolvable refs are errors; external refs and anchor-based refs are reported as warnings only.
4. **Write** (`cli.js`) — emits the pretty bundle, then strips `$comment` from all subschemas
   (property *names* called `$comment` are preserved) and emits the minified bundle.

A report of what was embedded, rewired and treated as external is printed to the console.

## Limitations

* Refs via `$anchor` / `$dynamicAnchor` / `$recursiveAnchor` into bundled files are **not** supported
  and cause an error; only JSON-Pointer fragments are rewired.
* The bundler is not aware of `$id`-based resolution; refs are resolved purely by file path.
* Module names are derived from file basenames (`<name>.schema.json` → `<name>`).
  If two schema files — including the entry schema — share a basename, the bundler
  aborts before doing any work with a `ModuleName collisions` error that lists every
  colliding name and the files involved.
* No conversion between JSON Schema drafts; written against draft 2020-12 keywords.
* Refs are not checked for existence in the *source* schemas — only the rewired result is validated.

## Tests

see [dedicated README](test/README.md)
