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
* [`ajv`](https://ajv.js.org/) `^8.20` — used to validate the bundle against the JSON Schema meta schema

Install the dependencies once:

```shell
npm ci
```

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
  (except the top-level `$comment` of embedded modules, see [How it works](#how-it-works))
* `cyclonedx-2.0-bundled.min.schema.json` — minified, only the root `$comment` kept

Exit codes:
* `1` — invalid arguments
* `2` — bundling/tree-shaking/validation error

This is what the `bundle_2.0_schemas` GitHub workflow runs on every change to
the 2.0 schema sources.

## How it works

The bundler is split into stages (one module each under `src/`):

1. **Bundle** (`src/bundle.js`)
   * Loads the entry schema and *all* `*.schema.json` files found recursively in the modules directory.
   * Each module is embedded under `$defs/<module-name>`, where `<module-name>` is the file's basename without `.schema.json`.
      `$schema`, `$id` and the top-level `$comment` of embedded modules are dropped —
      they describe the module *file*, not the schema, and would be misleading inside the bundle.
   * The entry schema's own `$defs` are moved into a *hollow* container `$defs/<entry-name>`
      (marked with `"not": {"$comment": …}` so it is never used for validation by accident).
   * `$ref`, `$dynamicRef` and `$recursiveRef` are rewired
     (all treated alike as static pointers, see [Limitations](#limitations)):
     * refs to a bundled file → `#/$defs/<module-name>[/<pointer>]`
     * refs to a non-bundled file → path made relative to the output file, kept external
     * absolute URIs → left untouched, reported as external
   * The root `$id` is rewritten to point at the bundled file name.
2. **Tree-shake** (`src/cleanup.js`) — a mark-and-sweep pass over the bundled schema.
   * *Mark*: starting at the root schema, walk all subschemas (`properties`, `items`, `allOf`, …)
     and follow every local `$ref`/`$dynamicRef`.
     `$dynamicRef` is treated exactly like `$ref` — resolved statically as a JSON Pointer,
     without dynamic-scope semantics. `$defs` are *not* descended into —
     definitions are only reached via refs. Non-standard keywords are not descended into either.
     Refs may point at any JSON Pointer, not just `$defs`
     entries, e.g. `#/$defs/<module>/properties/address/properties/street`
     or `#/$defs/<module>/properties/combined/allOf/1`.
   * *Sweep*: everything that was not marked is dropped. Three things can happen:
     * **removed** — unreached object members are deleted:
       * unreached `$defs` entries — also in schemas that are reached as a whole;
       * unreached parts (`properties`, `type`, `examples`, …) of schemas that are not reached
         themselves but contain reached parts;
       * unreached *trailing* array items (`allOf`, `oneOf`, …).
     * **voided** — unreached array items that are followed by a reached item are *not* removed,
       so that the indices of the reached items stay stable. They are replaced by a placeholder:
       `{"not": {"$comment": …}}` for schemas, an empty value (`{}`, `[]`, `""`, `0`) for data;
       booleans and `null` are kept as they are.
     * **hollowed** — schemas that are not reached but contain reached parts:
       only `title`, `description`, `$comment` and the keys leading to the reached parts are kept,
       and `"not": {"$comment": …}` is added so the hollow schema never validates anything.
       Typical examples: an embedded module of which only some `$defs` are referenced,
       or a `properties` container of which only a nested property is referenced.
     Reached schemas themselves are left untouched — only their `$defs` are swept.
     Non-standard keywords of reached schemas (e.g. custom definition containers) are kept as a whole.
   * Schemas carrying `$anchor`/`$dynamicAnchor` are kept untouched, whether reached or not:
     their `$defs` are not swept, and refs inside them are not followed.
   * The tree-shaker aborts with an error if any local ref in the schema — reached or not — uses
     an anchor fragment instead of a JSON Pointer.
     It also aborts if a *reached* local ref's target does not exist, or is neither a schema nor a boolean.
     Unresolvable refs in unreached parts are dropped silently along with those parts.
3. **Sanity check** (`src/sanity.js`) — validates the bundled result:
   * every local JSON-Pointer ref must resolve in the bundle.
     Unresolvable refs are errors; external refs and anchor-based refs are reported as warnings only.
   * the bundle must be valid against the JSON Schema draft 2020-12 meta schema (checked via `ajv`).
     Every meta-schema violation is an error.
4. **Write** (`cli.js`) — emits the pretty bundle, then strips `$comment` from all subschemas
   (property *names* called `$comment` are preserved) and emits the minified bundle.

A report of what was embedded, rewired and treated as external, and of what the tree-shaker
hollowed, voided and removed, is printed to the console.

## Limitations

* Refs via `$anchor` / `$dynamicAnchor` / `$recursiveAnchor` into bundled files are **not** supported
  and cause an error; only JSON-Pointer fragments are rewired.
* `$dynamicRef` is **not** supported with its dynamic-scope semantics.
  The bundler and the tree-shaker treat it as a plain `$ref`: the fragment must be a JSON Pointer and
  is resolved statically against the bundle. A `$dynamicRef` with an anchor fragment
  (e.g. `"$dynamicRef": "#node"`) aborts the tree-shaker with an `Unsupported ref fragment` error.
  Since a statically resolved `$dynamicRef` may keep a different target than a validator would pick
  at runtime, avoid `$dynamicRef`/`$dynamicAnchor` in the modular schemas altogether.
* Tree-shaking follows JSON-Pointer refs only; a local ref with an anchor fragment aborts with an
  `Unsupported ref fragment` error before the sanity check runs.
  Schemas that declare an anchor are kept as they are, since the tree-shaker cannot tell whether
  they are referenced. Refs inside them are not followed, so their targets may be removed,
  which then fails the sanity check.
* Non-standard keywords of reached schemas are kept, but refs inside them are not followed,
  so their targets may be removed, which then fails the sanity check.
* Unresolvable *reached* local refs abort the tree-shaker with a `Missing target for LocalRef` error
  before the sanity check gets to report them. Unresolvable refs in unreached parts are removed
  without notice.
* Tree-shaking cannot hollow a schema that kept a `not` keyword;
  this aborts with a `Collision` error.
* The bundler is not aware of `$id`-based resolution; refs are resolved purely by file path.
* Module names are derived from file basenames (`<name>.schema.json` → `<name>`).
  If two schema files — including the entry schema — share a basename, the bundler
  aborts before doing any work with a `ModuleName collisions` error that lists every
  colliding name and the files involved.
* No conversion between JSON Schema drafts; written against draft 2020-12 keywords.
* Refs are not checked for existence in the *source* schemas — only the rewired result is validated.

## Tests

see [dedicated README](test/README.md)
