/**
 * CycloneDX Schema Linter - No Deprecated Check
 *
 * @license Apache-2.0
 */

import { LintCheck, registerCheck, Severity, traverseSchema } from '../index.js';

/**
 * Pattern to detect deprecation mentions in documentation text
 */
const DEPRECATED_PATTERN = /\bdeprecat(?:ed?|ion|es|ing)\b/i;

const DOCS_KEYS = Object.freeze(new Set([
  '$comment',
  'title',
  'description',
]));

/**
 * Keys whose values aren't schemas - skipped entirely
 */
const SKIP_KEYS = Object.freeze(new Set([
  'const', 'default', // values
  'examples', 'meta:enum', // documentational
]));

/**
 * Check that validates nothing is marked as deprecated
 */
class NoDeprecatedCheck extends LintCheck {
  constructor() {
    super(
      'no-deprecated',
      'No deprecations',
      'Validates that no definition or property is marked as deprecated',
      Severity.ERROR
    );
  }

  async run(schema, rawContent, config = {}) {
    const issues = [];

    // Optionally allow textual mentions of "deprecated" in docs
    const allowInDocs = config.allowInDocs ?? false;

    traverseSchema(schema, (node, path, key, parent) => {
      if (SKIP_KEYS.has(key)) {
        // don't descend into keys whose values aren't schemas
        return false;
      }

      // JSON Schema `deprecated` keyword - flag unless explicitly set to false
      if (key === 'deprecated' && node !== false) {
        issues.push(this.createIssue(
          `Marked as deprecated via "${key}"`,
          path,
          { key, value: node }
        ));
        return;
      }

      if (allowInDocs) return;

      // when visiting an enum, check the sibling meta:enum descriptions
      if (key === 'enum') {
        const metaEnum = parent?.['meta:enum'];
        if (metaEnum && typeof metaEnum === 'object') {
          for (const [value, description] of Object.entries(metaEnum)) {
            if (typeof description === 'string' && DEPRECATED_PATTERN.test(description)) {
              issues.push(this.createIssue(
                `Deprecation mentioned in description of enum value "${value}": ${description}`,
                path,
                { value, text: description }
              ));
            }
          }
        }
        // don't descend into enums whose values aren't schemas
        return false;
      }

      if (typeof node !== 'string') return;

      if (!DOCS_KEYS.has(key)) return;

      if (DEPRECATED_PATTERN.test(node)) {
        issues.push(this.createIssue(
          `Deprecation mentioned in "${key}": ${node}`,
          path,
          { key, text: node }
        ));
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
