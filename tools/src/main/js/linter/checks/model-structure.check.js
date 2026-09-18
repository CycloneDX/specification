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

/**
 * Check that validates model schema structure
 */
class ModelStructureCheck extends LintCheck {
  constructor() {
    super(
      'model-structure',
      'Model Structure',
      'Validates that model schemas have type "null", $defs, and no properties.',
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
    
    // Check type must be "null"
    if (!('type' in schema)) {
      issues.push(this.createIssue(
        'Model schema is missing required "type" property.',
        '$.type',
        { expected: 'null' }
      ));
    } else if (schema.type !== 'null') {
      issues.push(this.createIssue(
        `Model schema "type" must be "null", found "${schema.type}".`,
        '$.type',
        { actual: schema.type, expected: 'null' }
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
