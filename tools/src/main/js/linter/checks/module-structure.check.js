/**
 * CycloneDX Schema Linter - Module Structure Check
 *
 * Validates that module schemas have the correct structure:
 * - type must be "null"
 * - $defs must exist
 * - properties must not exist at root level
 *
 * A module schema is identified by having "/modules/" in its $id URL.
 *
 * @license Apache-2.0
 */

import { LintCheck, registerCheck, Severity } from '../index.js';

function isEmptySchema(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    // not a schema
    return false;
  }
  const keys = new Set(Object.keys(value));
  keys.delete('$comment'); // delete keys that don't define a schema
  return keys.size === 0;
}

/**
 * Check that validates module schema structure
 */
class ModuleStructureCheck extends LintCheck {
  constructor() {
    super(
      'module-structure',
      'Module Structure',
      'Validates that module schemas have "not:{}", $defs, and no type nor properties.',
      Severity.ERROR
    );
  }

  async run(schema, rawContent, config = {}) {
    const issues = [];

    // Check if this is a module schema
    const schemaId = schema.$id || '';
    if (!schemaId.includes('/modules/')) {
      return issues; // Not a module schema, skip
    }

    // Check root is not usable
    // `not: {}` rejects every instance, so the container is unusable on its own;
    // unlike `false` it can still hold `$defs`, and unlike `not: true` it is valid in draft-04.
    if (!('not' in schema)) {
      issues.push(this.createIssue(
        'Module schema is missing required "not" property.',
        '$.not',
        { expected: {} }
      ));
    } else if (!isEmptySchema(schema.not)) {
      issues.push(this.createIssue(
        `Module schema "not" must be an empty schema, found ${JSON.stringify(schema.not)}".`,
        '$.not',
        { actual: schema.not, expected: {} }
      ));
    }

    // Check $defs must exist
    if (!('$defs' in schema)) {
      issues.push(this.createIssue(
        'Module schema is missing required "$defs" property.',
        '$.$defs',
        { suggestion: 'Add a $defs object containing the module definitions.' }
      ));
    }

    // Check properties must not exist at root level
    if ('type' in schema) {
      issues.push(this.createIssue(
        'Module schema must not have "type" at root level.',
        '$.type'
      ));
    }

    // Check properties must not exist at root level
    if ('properties' in schema) {
      issues.push(this.createIssue(
        'Module schema must not have "properties" at root level. Use $defs instead.',
        '$.properties',
        { suggestion: 'Move property definitions into $defs.' }
      ));
    }

    return issues;
  }
}

// Create and register the check
const check = new ModuleStructureCheck();
registerCheck(check);

export { ModuleStructureCheck };
export default check;
