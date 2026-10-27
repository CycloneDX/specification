# Bundler tests

Minimal snapshot test for `../cli.js`. No test framework required — plain Node.js (`>= 24.2`).

## Layout

```text
.
├── run.js            # test runner
├── fixtures/         # input schemas, never modified by a run
│   ├── main.schema.json
│   ├── modules/*.schema.json    # the modules directory -> everything here is bundled
│   └── externals/*.schema.json  # outside the modules directory -> never bundled, refs are rewired
└── snapshot/         # expected bundler output, committed
    ├── main-bundled.schema.json      # pretty bundle, all `$comment` kept
    ├── main-bundled.min.schema.json  # minified bundle, only the root `$comment` kept
    └── report.json                   # bundler report (embedded / external / rewired / tree-shake / warnings)
```

The runner copies `fixtures/` to a temporary directory, runs the CLI's `main()` there with
`main.schema.json` as the entry and `modules/` as the modules directory, writes the returned
report to `report.json`, and compares all three generated files byte-for-byte against `snapshot/`.

The bundler validates its output against the JSON Schema draft 2020-12 meta schema and fails on
any violation, so every fixture (and the bundled result of it) must be valid draft 2020-12 —
boolean subschemas (`true`/`false`) included.

Each module file name states the edge case it covers; `externals/not-bundled` covers a file outside
the modules directory, the `remote` property in `used-whole` covers an absolute `https://` ref, and
`inArray` in `used-whole` covers refs nested inside an array (`allOf`).

The modules exercise the tree-shaker as follows:

- `used-whole` — referenced as a whole from the entry; the module body survives untouched, but
  its unreferenced `$defs/unused` is dropped nevertheless.
- `used-whole-data` — referenced as a whole; its reached schemas carry data-bearing keywords
  (`required`, `examples`, `default`, `enum`, `const`, `meta:enum`) and boolean-schema properties.
  All of that must pass the sweep untouched; only `$defs/unusedDef` is dropped.
- `used-subdefs-only` — only individual `$defs` are referenced; the module body (`type`, `properties`)
  is dropped, the module is hollowed, and `$defs/dropped` is removed. A ref from the dropped body
  to `unused` must *not* make `unused` reachable.
- `used-properties-only` — only nested *properties* are referenced, via JSON pointers like
  `#/properties/address/properties/geo/properties/lat`. Only the referenced property subtrees
  (and what they transitively reach, i.e. `$defs/degrees`) are kept; the containers along the path
  (`address`, `geo`, the module itself) are hollowed; unreferenced siblings (`city`, `lon`,
  `unusedTopLevel`) and `$defs/unusedDef` are dropped.
- `used-array-items` — refs point *into* schema arrays (`#/properties/combined/allOf/1`,
  `#/properties/combined/allOf/3`, `#/properties/choice/oneOf/1`). `allOf/3` is the boolean
  schema `true`. Non-reached array items *before* the last reached one (`allOf/0`, `oneOf/0`) must be
  replaced by a void `{"not": …}` placeholder — never removed, so indices and pointers stay stable,
  and never serialised as `null`; boolean items (`allOf/2` = `false`) stay as they are. Non-reached
  items *after* the last reached one (`allOf/4`) may be truncated. The unreferenced `examples` of
  `choice` are removed. `$defs/keptViaArray` is kept transitively via `allOf/1`; `$defs/droppedDef`
  and the nested `oneOf/*/$defs/droppedDef` are removed.
- `used-custom-defs` — definitions live in non-standard containers (`custom-defs`,
  `even-more-custom-defs`) instead of `$defs`. The entry refs `#/custom-defs/customKept`, which refs
  `#/even-more-custom-defs/deepKept`. Both containers must be traversed; `customKept` and `deepKept`
  are kept, `customDropped`/`deepDropped` and the module body are dropped, the containers are hollowed.
- `used-not-keyword` — schemas that already carry a `not`. `$defs/hotWithNot` is reached: its `not`
  survives untouched, only the unreferenced `not/$defs/droppedInNot` is removed. `$defs/hollowedWithNot`
  is *not* reached, only its `$defs/inner` is: its original `not` (and `type`) are dropped, then the
  schema is hollowed with the marker `not` — the marker must never collide with the original keyword.
  The module root also has an unreached `not`; it is dropped and the root is hollowed likewise.
- `unused` — nothing reachable refers to it; the whole module is removed.
- `dynamic-anchor` — declares a `$dynamicAnchor`; the tree-shaker cannot follow anchors and keeps it as is.

The entry schema additionally covers:

- a property *named* `$comment` (`properties.$comment`) — it must survive minification,
  only its own `$comment` keyword is stripped;
- local refs into the entry's own `$defs` — they are rewired to the hollow container
  `#/$defs/main/$defs/…`, which is marked with `"not": {"$comment": …}`; the unreferenced
  `$defs/mainUnused` is dropped from that container.
- an inline object property (`properties.composed`) whose own properties reference
  *properties* of a module rather than its `$defs` (see `used-properties-only` above).
- refs into *array items* of a module (`properties.middle`, `properties.lastChoice`;
  see `used-array-items` above).
- a ref into a *non-standard* definitions container of a module (`properties.customDef`;
    see `used-custom-defs` above).
- refs to an empty `{}`, a `$comment`-only and an annotation-only schema
  (`properties.anyValue`, `properties.todoValue`, `properties.annotatedValue`) — reached, so
  they must survive and must *not* be hollowed.

Inside the fixtures, the annotation keywords have distinct roles:

- `$comment` carries test intent: the top-level one (prefixed `FIXTURE:`) states the purpose of
  the file, nested ones explain the expected behaviour of the surrounding construct. The bundler
  strips the top-level `$comment` from embedded modules and all non-root `$comment` keywords from
  the minified output.
- `title` and `description` are plain, user-facing schema documentation, present on every (sub-)schema.
  They carry no test intent and must pass through the bundler untouched, in both outputs.

`report.json` pins the bundler's bookkeeping: which files were embedded and under which
`$defs` key, which refs were left external, every rewired ref (source → target), the
tree-shake result (every `reached`, `hollowed` and `removed` JSON pointer), and the
validation warnings. Paths in the report are relative to the entry schema's directory and
the `embedded`/`external`/`rewired` lists are sorted, so the snapshot is independent of the
temporary work directory and of file-system iteration order.

## Run

From the bundler directory (`..`):

```sh
npm ci
npm test
```

Exit code is non-zero if any snapshot is missing or differs.

## Update snapshots

When the bundler's output changes intentionally (or when adding fixtures), regenerate the snapshots:

```sh
UPDATE_SNAPSHOTS=1 npm test
```

Then review the diff in `snapshot/` and commit it together with the change that caused it.
