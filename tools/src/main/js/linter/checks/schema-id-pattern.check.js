/**
 * CycloneDX Schema Linter - Schema ID Pattern Check
 * 
 * Validates that the $id property of each modular schema matches
 * the expected CycloneDX pattern.
 * 
 * @license Apache-2.0
 */

import { LintCheck, registerCheck, Severity } from '../index.js';

/**
 * Default pattern for CycloneDX schema IDs
 * 
 * Valid patterns:
 *   https://cyclonedx.org/schema/bom-1.7.schema.json
 *   https://cyclonedx.org/schema/2.0/cyclonedx-2.0.schema.json
 *   https://cyclonedx.org/schema/2.0/model/cyclonedx-cryptography-2.0.schema.json
 * 
 * Pattern breakdown:
 *   - Base URL: https://cyclonedx.org/schema/
 *   - Optional version path: e.g., 2.0/, 1.7/, 3.0/
 *   - Optional subdirectory: e.g., model/, extension/
 *   - Schema name: e.g., bom-1.7, cyclonedx-2.0, cyclonedx-cryptography-2.0
 *   - Extension: .schema.json
 */
const DEFAULT_PATTERN = '^https://cyclonedx\\.org/schema/(\\d+\\.\\d+/)?([a-z][a-z0-9-]*/)?[a-z][a-z0-9.-]*\\.schema\\.json$';

/**
 * Check that validates schema $id follows expected pattern
 */
class SchemaIdPatternCheck extends LintCheck {
  constructor() {
    super(
      'schema-id-pattern',
      'Schema ID Pattern',
      'Validates that the $id property follows the expected CycloneDX pattern.',
      Severity.ERROR
    );
  }

  async run(schema, rawContent, config = {}) {
    const issues = [];
    const pattern = new RegExp(config.pattern || DEFAULT_PATTERN);
    
    // Check root $id
    if (!schema.$id) {
      issues.push(this.createIssue(
        'Schema is missing required $id property.',
        '$.$id',
        { expected: 'A valid schema ID matching the pattern' }
      ));
    } else if (!pattern.test(schema.$id)) {
      issues.push(this.createIssue(
        `Schema $id does not match expected pattern. Got: "${schema.$id}"`,
        '$.$id',
        { 
          actual: schema.$id,
          expectedPattern: pattern.toString()
        }
      ));
    }
    
    // Check for valid $id format (must be a valid URI)
    if (schema.$id) {
      try {
        new URL(schema.$id);
      } catch {
        issues.push(this.createIssue(
          `Schema $id is not a valid URI: "${schema.$id}"`,
          '$.$id',
          { actual: schema.$id }
        ));
      }
    }
    
    // Optionally check for $id in definitions (for modular schemas)
    if (config.checkDefinitions !== false && schema.definitions) {
      for (const [defName, def] of Object.entries(schema.definitions)) {
        if (def.$id && !pattern.test(def.$id)) {
          issues.push(this.createIssue(
            `Definition "${defName}" has $id that does not match expected pattern.`,
            `$.definitions.${defName}.$id`,
            {
              actual: def.$id,
              expectedPattern: pattern.toString()
            }
          ));
        }
      }
    }
    
    // Check $defs (JSON Schema draft-2019-09+)
    if (config.checkDefinitions !== false && schema.$defs) {
      for (const [defName, def] of Object.entries(schema.$defs)) {
        if (def.$id && !pattern.test(def.$id)) {
          issues.push(this.createIssue(
            `Definition "${defName}" has $id that does not match expected pattern.`,
            `$.$defs.${defName}.$id`,
            {
              actual: def.$id,
              expectedPattern: pattern.toString()
            }
          ));
        }
      }
    }
    
    return issues;
  }
}

// Create and register the check
const check = new SchemaIdPatternCheck();
registerCheck(check);

export { SchemaIdPatternCheck };
export default check;
