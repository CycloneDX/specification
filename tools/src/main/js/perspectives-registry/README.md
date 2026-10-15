# Pre-defined perspectives registry

Generates and checks `schema/perspectives-defs.json`, the registry of
pre-defined CycloneDX perspectives.

A document can apply a published perspective by identity instead of defining
its mappings inline:

```json
{ "predefined": "cdx:perspectives:model-card", "predefinedVersion": 1 }
```

The registry records which identities exist and which versions of each have
been published. It is maintained separately from the specification release
cycle, so a perspective can be published or revised without a new CycloneDX
version.

## Files

| File | Maintained | Content |
|------|------------|---------|
| `schema/perspectives-defs.schema.json` | by hand | The identity enum (`preDefinedPerspectivesEnum`, referenced by the perspective schema) and the schema of the registry data |
| `perspectives/<name>-perspective.json` | by hand | The catalog document defining `cdx:perspectives:<name>` at its latest version: a CycloneDX document with one inline perspective, whose `version` is the perspective version |
| `perspectives/archives/<name>-perspective/<name>-perspective-<version>.json` | by hand, copied once | Each earlier version of that catalog document, unchanged |
| `schema/perspectives-defs.json` | generated | Every published version of each perspective, with the sha256 of the catalog document's canonical JSON and the date it was registered |

## Naming convention

Files are found by naming convention, not by a mapping. For
`cdx:perspectives:<name>`:

- the latest version is `perspectives/<name>-perspective.json`;
- earlier versions are in the directory `perspectives/archives/<name>-perspective/`,
  named after the catalog document without `.json`; each file is that name
  followed by `-<version>.json`.

For example, `cdx:perspectives:model-card`:

```text
perspectives/
  model-card-perspective.json                     latest version, e.g. 3
  archives/
    model-card-perspective/
      model-card-perspective-1.json
      model-card-perspective-2.json
```

`<name>` is lowercase kebab-case. An identity can be reserved in the enum
before its catalog document exists. The archives directory holds only earlier
versions of identities in the enum.

## Versioning

A published version is immutable. Its content is identified by the sha256 of
its canonical JSON (object keys sorted, no insignificant whitespace), so
reformatting a file does not change it, but any change to its content does,
including its `metadata`. The registration date is recorded in the registry,
not in the catalog document, and is not part of the hash.

To publish a new version of a perspective:

1. Copy the current catalog document, unchanged, to
   `perspectives/archives/<name>-perspective/<name>-perspective-<version>.json`,
   where `<version>` is its current `version`.
2. Edit `perspectives/<name>-perspective.json` and increment its `version` by 1.

Pull requests then show the revision as a diff of the catalog document. After
merge, the generator registers the new version and never rewrites a registered
one. The check fails when:

- a catalog document changed but kept a registered version,
- a version goes backwards or skips a number,
- a registered earlier version is not archived, or its archived copy changed,
- the archives directory holds anything other than earlier versions,
- a registered catalog document was removed,
- a registered identity is not in the enum.

The registry and the files under `perspectives/` are all a consumer needs to
read any published version; nothing depends on the history of the repository.

## Usage

Run from this directory:

```bash
npm ci
npm test            # unit tests, then check the registry against the enum and the catalog documents
npm run generate    # register catalog document versions that are not registered yet
```

On pushes to the main branches, the `generate_perspectives_registry.yml`
workflow runs the generator and opens a pull request with the updated registry.
Contributors change the enum and the catalog documents, not the registry file.
