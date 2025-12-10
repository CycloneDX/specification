# CycloneDX Schema Linter

A modular linter for CycloneDX JSON schemas.

## Requirements

- Node.js >= 18.0.0
- aspell with English dictionaries (provides en_US and en_GB-ize)

```bash
# Ubuntu/Debian
sudo apt-get install aspell aspell-en

# macOS
brew install aspell
```

## Usage

```bash
# Lint files
cdx-lint schema.json
cdx-lint schemas/*.schema.json

# Exclude or include specific checks
cdx-lint --exclude formatting-indent schema.json
cdx-lint --include description-full-stop schema.json

# Output formats: stylish (default), json, compact
cdx-lint --format json schema.json

# List available checks
cdx-lint --list-checks
```

Or run directly with Node:

```bash
node cli.js schema.json
```

## Checks

| Check | Description |
|-------|-------------|
| `schema-draft` | Validates `$schema` is `https://json-schema.org/draft/2020-12/schema` |
| `schema-id-pattern` | Validates `$id` matches CycloneDX URL pattern |
| `schema-comment` | Validates `$comment` contains required OWASP/Ecma standard notice |
| `model-property-order` | Validates model schemas have properties in order: `$schema`, `$id`, `type`, `title`, `$comment`, `$defs` |
| `model-structure` | Validates model schemas have `type: "null"`, `$defs`, and no `properties` |
| `formatting-indent` | Validates 2-space indentation, no tabs, no trailing whitespace, LF line endings |
| `description-full-stop` | Descriptions must end with a full stop |
| `meta-enum-full-stop` | `meta:enum` values must end with a full stop |
| `property-name-american-english` | Property names must use American English spelling |
| `description-oxford-english` | Descriptions must use Oxford English spelling (British with -ize) |
| `no-uppercase-rfc` | No uppercase RFC 2119 keywords (MUST, SHALL, SHOULD, etc.) |
| `no-must-word` | Use "shall" instead of "must" per ISO House Style |
| `additional-properties-false` | Object definitions must have `additionalProperties: false` |
| `title-formatting` | Titles must use sentence case |
| `enum-value-formatting` | Enum values must be lowercase kebab-case; `meta:enum` must cover all values |
| `ref-usage` | `$ref` must not be combined with other keywords |
| `duplicate-content` | Titles and descriptions must be unique within a schema |
| `duplicate-definitions` | Definitions must be reused via `$ref`, not duplicated |

## Configuration

Create `.cdxlintrc.json` in your project root:

```json
{
  "checks": {
    "formatting-indent": {
      "spaces": 2
    }
  },
  "excludeChecks": ["description-oxford-english"],
  "includeChecks": null
}
```
