/**
 * CycloneDX Schema Linter - $ref No Externals Check
 *
 * Validates that `$ref` does not reference files outside the schema's directory:
 * - `$ref` with an `http://` or `https://` URI are allowed, as they reference a schema by its `$id`
 * - relative `$ref` must not traverse to a parent directory via `..`
 *
 * @license Apache-2.0
 */

import { LintCheck, registerCheck, Severity, traverseSchema } from '../index.js';

/**
 * Pattern of `$ref` that reference a schema by its `$id`
 */
const ID_REF_PATTERN = /^https?:\/\//i;

/**
 * Keys whose values aren't schemas - their entire subtrees are pruned
 */
const SKIP_KEYS = Object.freeze(new Set([
  'enum', 'const', // values
  'default', 'examples', // annotations
  'meta:enum', // documentational
]));

/**
 * Check that validates `$ref` does not reference external files.
 */
class SchemaRefNoExternalsCheck extends LintCheck {
  constructor() {
    super(
      'schema-ref-no-externals',
      '$ref No Externals',
      'Validates that $ref does not reference files outside the schema directory.',
      Severity.ERROR
    );
  }

  async run(schema, rawContent, config = {}) {
    const issues = [];

    traverseSchema(schema, (node, path, key) => {
      if (typeof key === 'string' && SKIP_KEYS.has(key)) {
        // don't descend into keys whose values aren't schemas
        return false;
      }

      if (node === null || typeof node !== 'object' || Array.isArray(node)) return;

      const ref = node['$ref'];
      // non-string $ref are reported by check `schema-ref-best-practice`
      if (typeof ref !== 'string') return;
      if (ID_REF_PATTERN.test(ref)) return;

      const hashPos = ref.indexOf('#');
      const filePart = hashPos === -1
        ? ref
        : ref.slice(0, hashPos);
      if (filePart.split('/').includes('..')) {
        issues.push(this.createIssue(
          'External file $ref is not allowed. Reference the schema by its "$id" instead.',
          `${path}.$ref`,
          { actual: ref, expected: 'a reference without "../"' }
        ));
      }
    });

    return issues;
  }
}

// Create and register the check
const check = new SchemaRefNoExternalsCheck();
registerCheck(check);

export { SchemaRefNoExternalsCheck };
export default check;
