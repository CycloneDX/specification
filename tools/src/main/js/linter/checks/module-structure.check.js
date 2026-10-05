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

/**
 * Check that validates module schema structure
 */
class ModuleStructureCheck extends LintCheck {
  constructor() {
    super(
      'module-structure',
      'Module Structure',
      'Validates that module schemas have type "null", $defs, and no properties.',
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

    // Check type must be "null"
    if (!('type' in schema)) {
      issues.push(this.createIssue(
        'Module schema is missing required "type" property.',
        '$.type',
        { expected: 'null' }
      ));
    } else if (schema.type !== 'null') {
      issues.push(this.createIssue(
        `Module schema "type" must be "null", found "${schema.type}".`,
        '$.type',
        { actual: schema.type, expected: 'null' }
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
