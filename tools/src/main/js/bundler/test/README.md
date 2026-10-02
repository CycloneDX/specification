# Bundler tests

Minimal snapshot test for `../bundle-schemas.js`. No test framework required — plain Node.js.

## Layout

```text
.
├── run.js            # test runner
├── fixtures/         # input schemas (root + modules), never modified by a run
│   ├── main.schema.json
│   └── modules/*.schema.json
└── snapshot/         # expected bundler output, committed
    ├── main-bundled.schema.json
    └── main-bundled.min.schema.json
```

The runner copies `fixtures/` to a temporary directory, bundles `main.schema.json`
with `modules/` there, and compares the two generated files byte-for-byte against `snapshot/`.

Each module file name states the edge case it covers (`used-whole`, `used-subdefs-only`,
`unused`, `dynamic-anchor`, `spdx`); the `$comment` fields inside explain the expected behaviour.

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
