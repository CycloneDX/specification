/**
 * CycloneDX Schema Linter - Schema Draft Check
 * 
 * Validates that the $schema property exists, has the correct value,
 * and appears on the first line of the schema file.
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
    
    // Check if $schema appears on first line
    const lines = rawContent.split('\n');
    let foundOnFirstLine = false;
    
    for (let i = 0; i < lines.length && i < 3; i++) {
      const line = lines[i].trim();
      // Skip opening brace
      if (line === '{') continue;
      
      // First non-brace line should contain $schema
      if (line.includes('"$schema"')) {
        foundOnFirstLine = true;
        break;
      } else if (line.length > 0 && line !== '{') {
        // Found something else first
        break;
      }
    }
    
    if (!foundOnFirstLine) {
      issues.push(this.createIssue(
        '$schema must appear as the first property in the schema.',
        '$.$schema',
        { suggestion: 'Move $schema to be the first property after the opening brace.' }
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
