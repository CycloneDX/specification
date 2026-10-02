/**
 * CycloneDX Schema Linter - Model Structure Check
 *
 * Validates that model schemas have the correct structure:
 * - type must be "null"
 * - $defs must exist
 * - properties must not exist at root level
 *
 * A model schema is identified by having "/model/" in its $id URL.
 *
 * @license Apache-2.0
 */

import { LintCheck, registerCheck, Severity } from '../index.js';

function isEmptyObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0
  );
}

/**
 * Check that validates model schema structure
 */
class ModelStructureCheck extends LintCheck {
  constructor() {
    super(
      'model-structure',
      'Model Structure',
      'Validates that model schemas have "not:{}", $defs, and no type nor properties.',
      Severity.ERROR
    );
  }

  async run(schema, rawContent, config = {}) {
    const issues = [];

    // Check if this is a model schema
    const schemaId = schema.$id || '';
    if (!schemaId.includes('/model/')) {
      return issues; // Not a model schema, skip
    }

    // Check root is not usable
    // `not: {}` rejects every instance, so the container is unusable on its own;
    // unlike `false` it can still hold `$defs`, and unlike `not: true` it is valid in draft-04.
    if (!('not' in schema)) {
      issues.push(this.createIssue(
        'Model schema is missing required "not" property.',
        '$.not',
        { expected: {} }
      ));
    } else if (!isEmptyObject(schema.not)) {
      issues.push(this.createIssue(
        `Model schema "not" must be empty object, found ${JSON.stringify(schema.not)}".`,
        '$.not',
        { actual: schema.not, expected: {} }
      ));
    }

    // Check $defs must exist
    if (!('$defs' in schema)) {
      issues.push(this.createIssue(
        'Model schema is missing required "$defs" property.',
        '$.$defs',
        { suggestion: 'Add a $defs object containing the model definitions.' }
      ));
    }

    // Check properties must not exist at root level
    if ('type' in schema) {
      issues.push(this.createIssue(
        'Model schema must not have "type" at root level.',
        '$.type'
      ));
    }

    // Check properties must not exist at root level
    if ('properties' in schema) {
      issues.push(this.createIssue(
        'Model schema must not have "properties" at root level. Use $defs instead.',
        '$.properties',
        { suggestion: 'Move property definitions into $defs.' }
      ));
    }

    return issues;
  }
}

// Create and register the check
const check = new ModelStructureCheck();
registerCheck(check);

export { ModelStructureCheck };
export default check;
