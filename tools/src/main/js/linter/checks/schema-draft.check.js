/**
 * CycloneDX Schema Linter - Schema Draft Check
 * 
 * Validates that the $schema property exists and has the correct value.
 * 
 * @license Apache-2.0
 */

import { LintCheck, registerCheck, Severity } from '../index.js';

/**
 * Required $schema value
 */
const REQUIRED_SCHEMA = 'https://json-schema.org/draft/2020-12/schema';

/**
 * Check that validates the $schema property
 */
class SchemaDraftCheck extends LintCheck {
  constructor() {
    super(
      'schema-draft',
      'Schema Draft',
      'Validates that $schema is present with the correct JSON Schema draft.',
      Severity.ERROR
    );
  }

  async run(schema, rawContent, config = {}) {
    const issues = [];
    
    const requiredSchema = config.requiredSchema ?? REQUIRED_SCHEMA;
    
    // Check if $schema exists
    if (!('$schema' in schema)) {
      issues.push(this.createIssue(
        'Schema is missing required $schema property.',
        '$.$schema',
        { expected: requiredSchema }
      ));
      return issues;
    }
    
    // Check if $schema matches required value
    if (schema.$schema !== requiredSchema) {
      issues.push(this.createIssue(
        `$schema must be "${requiredSchema}".`,
        '$.$schema',
        {
          actual: schema.$schema,
          expected: requiredSchema
        }
      ));
    }
    
    return issues;
  }
}

// Create and register the check
const check = new SchemaDraftCheck();
registerCheck(check);

export { SchemaDraftCheck, REQUIRED_SCHEMA };
export default check;
