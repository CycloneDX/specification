/**
 * CycloneDX Schema Linter - Enum Value Formatting Check
 *
 * Validates that enum values is not literal "other"
 *
 * @license Apache-2.0
 */

import { LintCheck, registerCheck, Severity, traverseSchema } from '../index.js';

const LiteralOther = /other/i;

/**
 * Check that validates enum value formatting
 */
class EnumValueOtherCheck extends LintCheck {
  constructor() {
    super(
      'enum-value-other',
      'Enum Value Literal Other',
      'Validates that enum values are not literal "other".',
      Severity.ERROR
    );
  }

  async run(schema, rawContent, config = {}) {
    const issues = [];

    traverseSchema(schema, (node, path, key, parent) => {
        // Only check 'enum' properties
        if (key !== 'enum') return;

        // Skip non-array enums
        if (!Array.isArray(node)) return;

        // Skip empty enums
        if (node.length === 0) return;

        const loc = (p) => (typeof p === 'string' && p.length ? p : '(unknown path)');

        const enumSet = new Set(node.filter(v => typeof v === 'string'));

        for (const value of enumSet) {
            if (LiteralOther.test(value)) {
                issues.push(this.createIssue(
                    `Enum value "${value}" is literal "other". Use custom-object style instead.`,
                    loc(path),
                    {
                        value,
                    },
                    Severity.ERROR
                ));
            }
        }
    })

    return issues;
  }
}

// Create and register the check
const check = new EnumValueOtherCheck();
registerCheck(check);

export { EnumValueOtherCheck };
export default check;
