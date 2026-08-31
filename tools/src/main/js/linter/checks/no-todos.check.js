/**
 * CycloneDX Schema Linter - No ToDo's Check
 *
 * @license Apache-2.0
 */

import { LintCheck, registerCheck, Severity, traverseSchema } from '../index.js';

/**
 * Patterns to detect ToDo's
 */
const TODO_PATTERNS = /\bToDos?\b/i

const DOCS_KEYS = Object.freeze(new Set([
  '$comment',
  'title',
  'description',
]))

/**
 * Check that validates there are no ToDo's
 */
class NoTodosCheck extends LintCheck {
  constructor() {
    super(
      'no-todos',
      'No ToDo\'s',
      'Validates that there are no ToDo\'s' ,
      Severity.ERROR
    );
  }

  async run(schema, rawContent, config = {}) {
    const issues = [];

    // Allow "must" in specific contexts
    const allowInContext = config.allowInContext ?? false;

    traverseSchema(schema, (node, path, key, parent) => {
      if (TODO_PATTERNS.test(key)) {
        issues.push(this.createIssue(
          `There is an open ToDo`,
          path,
          { key }
        ));
      }

      if (typeof node !== 'string') return;

      if (!DOCS_KEYS.has(key)) return;

      if (TODO_PATTERNS.test(node)) {
        issues.push(this.createIssue(
          `There is an open ToDO: ${node}`,
          path,
          { text: node }
        ));
      }
    });

    return issues;
  }
}

// Create and register the check
const check = new NoTodosCheck();
registerCheck(check);

export { NoTodosCheck };
export default check;
