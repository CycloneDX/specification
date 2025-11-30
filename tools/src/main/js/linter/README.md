# CycloneDX Schema Linter

A modular linter for CycloneDX JSON schemas.

## Requirements

- Node.js >= 18.0.0
- aspell with en_US and en_GB-ize dictionaries

```bash
# Ubuntu/Debian
sudo apt-get install aspell aspell-en

# macOS
brew install aspell
```

## Usage

```bash
# Lint files
node cli.js schema.json
node cli.js schemas/*.schema.json

# Exclude or include specific checks
node cli.js --exclude formatting-indent schema.json
node cli.js --include description-full-stop schema.json

# Output formats: stylish (default), json, compact
node cli.js --format json schema.json

# List available checks
node cli.js --list-checks
```

## Checks

| Check | Description |
|-------|-------------|
| `schema-id-pattern` | Validates `$id` matches CycloneDX URL pattern |
| `schema-comment` | Validates `$comment` contains required standard notice |
| `formatting-indent` | Validates 2-space indentation |
| `description-full-stop` | Descriptions must end with full stop |
| `meta-enum-full-stop` | `meta:enum` values must end with full stop |
| `property-name-american-english` | Property names use American English |
| `description-oxford-english` | Descriptions use Oxford English (British with -ize) |
| `no-uppercase-rfc` | No uppercase RFC 2119 keywords (MUST, SHALL, etc.) |
| `no-must-word` | Use "shall" instead of "must" per ISO style |
| `additional-properties-false` | Objects must have `additionalProperties: false` |
| `title-formatting` | Validates title formatting conventions |
| `enum-value-formatting` | Validates enum value formatting and `meta:enum` coverage |
| `ref-usage` | Suggests using `$ref` for repeated structures |
| `duplicate-content` | Detects duplicate titles and descriptions |
| `duplicate-definitions` | Detects duplicate definitions and missing `$ref` usage |

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

## Running Tests

```bash
npm test
```
