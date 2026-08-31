/**
 * CycloneDX Schema Linter - No Deprecated Check
 *
 * Validates that there are no deprecated schemas:
 * - no schema has `deprecated` set to `true`
 * - optionally (default: on), docs keys ($comment, title, description)
 *   and `meta:enum` docs must not contain a deprecation marker
 *
 * @license Apache-2.0
 */

import { LintCheck, registerCheck, Severity, traverseSchema } from '../index.js';

/**
 * Default pattern to detect deprecation markers in docs texts.
 * Configurable via check config `docsPattern`.
 */
const DEFAULT_DOCS_PATTERN = '\\bdeprecated\\b';

/**
 * Keys whose values are documentational texts.
 */
const DOCS_KEYS = Object.freeze([
  '$comment',
  'title',
  'description',
]);

/**
 * Keys whose values aren't schemas - their entire subtrees are pruned.
 * `meta:enum` is handled explicitly on its parent schema.
 */
const SKIP_KEYS = Object.freeze(new Set([
  'enum', 'const', 'default', // values
  'examples', 'meta:enum', // documentational - meta:enum is handled explicitly
]));

/**
 * Check that validates there are no deprecated schemas.
 */
class NoDeprecatedCheck extends LintCheck {
  constructor() {
    super(
      'no-deprecated',
      'No Deprecated',
      'Validates that no schema is deprecated, and optionally that docs do not contain deprecation markers.',
      Severity.ERROR
    );
  }

  async run(schema, rawContent, config = {}) {
    const issues = [];

    // whether to inspect docs at all
    const checkDocs = config.checkDocs ?? true;
    // configurable deprecation marker; case-insensitive
    const docsPattern = new RegExp(config.docsPattern ?? DEFAULT_DOCS_PATTERN, 'i');

    traverseSchema(schema, (node, path, key) => {
      if (typeof key === 'string' && SKIP_KEYS.has(key)) {
        // don't descend into keys whose values aren't schemas
        return false;
      }

      if (node === null || typeof node !== 'object' || Array.isArray(node)) return;

      // node is a (potential) schema object

      if (node.deprecated === true) {
        issues.push(this.createIssue(
          'Has a deprecation marker.',
          `${path}.deprecated`,
          { actual: true, expected: 'absent or false' }
        ));
      }

      if (!checkDocs) return;

      for (const docsKey of DOCS_KEYS) {
        const docs = node[docsKey];
        if (typeof docs === 'string' && docsPattern.test(docs)) {
          issues.push(this.createIssue(
            `Docs contain a deprecation marker: ${docs}`,
            `${path}.${docsKey}`,
            { text: docs, pattern: docsPattern.source }
          ));
        }
      }

      const { 'enum': enumValues, 'meta:enum': metaEnum } = node;
      if (Array.isArray(enumValues)
        && metaEnum !== null && typeof metaEnum === 'object' && !Array.isArray(metaEnum)
      ) {
        for (const enumValue of enumValues) {
          const docs = metaEnum[enumValue];
          if (typeof docs === 'string' && docsPattern.test(docs)) {
            issues.push(this.createIssue(
              `Enum value docs contain a deprecation marker: ${docs}`,
              `${path}["meta:enum"].${enumValue}`,
              { enumValue, text: docs, pattern: docsPattern.source }
            ));
          }
        }
      }
    });

    return issues;
  }
}

// Create and register the check
const check = new NoDeprecatedCheck();
registerCheck(check);

export { NoDeprecatedCheck };
export default check;
