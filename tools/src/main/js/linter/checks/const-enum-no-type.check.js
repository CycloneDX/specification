/**
 * CycloneDX Schema Linter - Const and Enum Without Type Check
 *
 * Reports objects that declare "type" alongside "const" or "enum".
 * Presence is checked regardless of the keyword's value.
 *
 * The contents of "const" and "enum" are literal values, not schemas:
 * their subtrees are skipped before inspection.
 *
 * @license Apache-2.0
 */

import { LintCheck, registerCheck, Severity, traverseSchema } from '../index.js';

const SKIP_KEYS = Object.freeze(new Set([
  'const', 'enum',
  'default',
]))

class ConstEnumNoTypeCheck extends LintCheck {
  constructor() {
    super(
      'const-enum-no-type',
      'Const and Enum Without Type',
      'Objects declaring "const" or "enum" must not also declare "type".',
      Severity.ERROR
    );
  }

  async run(schema) {
    const issues = [];

    traverseSchema(schema, (node, path, key) => {
      if (SKIP_KEYS.has(key)) {
        // Prune literal values before inspecting them.
        return false;
      }

      if (node === null || typeof node !== 'object' || Array.isArray(node)) {
        return;
      }

      const hasOwn = keyword =>
        Object.prototype.hasOwnProperty.call(node, keyword);

      if ((hasOwn('const') || hasOwn('enum')) && hasOwn('type')) {
        issues.push(this.createIssue(
          'An object declaring "const" or "enum" must not also declare "type".',
          `${path}.type`,
          { actual: node.type, expected: 'type omitted' }
        ));
      }
    });

    return issues;
  }
}

const check = new ConstEnumNoTypeCheck();
registerCheck(check);

export { ConstEnumNoTypeCheck };
export default check;
