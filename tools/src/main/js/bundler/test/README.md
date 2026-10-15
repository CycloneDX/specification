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
    └── report.json                   # bundler report (embedded / external / rewired / warnings)
```

The runner copies `fixtures/` to a temporary directory, runs the CLI's `main()` there with
`main.schema.json` as the entry and `modules/` as the modules directory, writes the returned
report to `report.json`, and compares all three generated files byte-for-byte against `snapshot/`.

Each module file name states the edge case it covers (`used-whole`, `used-subdefs-only`,
`unused`, `dynamic-anchor`); `externals/not-bundled` covers a file outside the modules directory,
the `remote` property in `used-whole` covers an absolute `https://` ref, and `inArray` in
`used-whole` covers refs nested inside an array (`allOf`).

The entry schema additionally covers:

- a property *named* `$comment` (`properties.$comment`) — it must survive minification,
  only its own `$comment` keyword is stripped;
- local refs into the entry's own `$defs` — they are rewired to the hollow container
  `#/$defs/main/$defs/…`, which is marked with `"not": {"$comment": …}`.

Inside the fixtures, the annotation keywords have distinct roles:

- `$comment` carries test intent: the top-level one (prefixed `FIXTURE:`) states the purpose of
  the file, nested ones explain the expected behaviour of the surrounding construct. The bundler
  strips the top-level `$comment` from embedded modules and all non-root `$comment` keywords from
  the minified output.
- `title` and `description` are plain, user-facing schema documentation, present on every (sub-)schema.
  They carry no test intent and must pass through the bundler untouched, in both outputs.

`report.json` pins the bundler's bookkeeping: which files were embedded and under which
`$defs` key, which refs were left external, every rewired ref (source → target), the
tree-shake result, and the validation warnings. Paths in the report are relative to the
entry schema's directory, so the snapshot is independent of the temporary work directory.

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
