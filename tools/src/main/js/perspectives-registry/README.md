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
| `perspectives/<name>-perspective.json` | by hand | The catalog document defining `cdx:perspectives:<name>`: a CycloneDX document with one inline perspective, whose `version` is the perspective version |
| `schema/perspectives-defs.json` | generated | Every published version of each perspective, with the sha256 of the catalog document's canonical JSON and the commit that introduced it |

The catalog document of an identity is found by naming convention
(`cdx:perspectives:<name>` → `perspectives/<name>-perspective.json`), not by a
mapping. An identity can be reserved in the enum before its catalog document
exists.

## Versioning

A published version is immutable. To change a catalog document, increment its
`version` by 1. The generator registers the new version and never rewrites a
registered one. The check fails when:

- a catalog document changed but kept a registered version,
- a version goes backwards or skips a number,
- a registered catalog document was removed,
- a registered identity is not in the enum.

## Usage

Run from this directory:

```bash
npm ci
npm test            # check the registry against the enum and the catalog documents
npm run generate    # register catalog document versions that are not registered yet
```

On pushes to the main branches, the `generate_perspectives_registry.yml`
workflow runs the generator and opens a pull request with the updated registry.
Contributors change the enum and the catalog documents, not the registry file.
