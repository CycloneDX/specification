/**
 * CycloneDX Schema Linter - Additional Properties False Check
 * 
 * Validates that all object definitions have `additionalProperties: false`.
 * This ensures strict schema validation and prevents unexpected properties.
 * 
 * @license Apache-2.0
 */

import { LintCheck, registerCheck, Severity, traverseSchema } from '../index.js';

/**
 * Check that validates additionalProperties is set to false on objects
 */
class AdditionalPropertiesFalseCheck extends LintCheck {
  constructor() {
    super(
      'additional-properties-false',
      'Additional Properties False',
      'Validates that object definitions have additionalProperties set to false.',
      Severity.ERROR
    );
  }

  async run(schema, rawContent, config = {}) {
    const issues = [];
    
    // Paths to exclude from checking (e.g., extension points)
    const excludePaths = config.excludePaths || [];
    
    // Allow additionalProperties to be a schema (for pattern-based validation)
    const allowSchema = config.allowSchema ?? false;
    
    traverseSchema(schema, (node, path, key, parent) => {
      // Only check objects with 'properties' defined
      if (typeof node !== 'object' || node === null || Array.isArray(node)) {
        return;
      }
      
      // Must have type: "object" or properties defined to be considered an object schema
      const isObjectSchema = node.type === 'object' || 
                             node.properties !== undefined ||
                             node.patternProperties !== undefined;
      
      if (!isObjectSchema) return;
      
      // Skip excluded paths
      if (excludePaths.some(excluded => path.includes(excluded))) return;
      
      // Skip if this is a $ref (references are validated separately)
      if (node.$ref) return;
      
      // Skip certain schema composition keywords that don't need additionalProperties
      if (key === 'if' || key === 'then' || key === 'else') return;
      if (key === 'not') return;
      
      // Check additionalProperties
      if (!('additionalProperties' in node)) {
        // additionalProperties is not defined
        if (node.properties || node.patternProperties) {
          issues.push(this.createIssue(
            'Object schema is missing "additionalProperties: false".',
            path,
            {
              hasProperties: !!node.properties,
              hasPatternProperties: !!node.patternProperties,
              suggestion: 'Add "additionalProperties": false to prevent unexpected properties.'
            }
          ));
        }
      } else if (node.additionalProperties === true) {
        // Explicitly set to true
        issues.push(this.createIssue(
          'Object schema has "additionalProperties: true". Set to false for strict validation.',
          path,
          {
            current: true,
            suggestion: 'Change "additionalProperties" to false.'
          }
        ));
      } else if (node.additionalProperties !== false) {
        // Set to a schema object
        if (!allowSchema) {
          // Check if it's an empty object (equivalent to true)
          if (typeof node.additionalProperties === 'object' && 
              Object.keys(node.additionalProperties).length === 0) {
            issues.push(this.createIssue(
              'Object schema has "additionalProperties: {}" which is equivalent to true. Set to false.',
              path,
              {
                current: '{}',
                suggestion: 'Change "additionalProperties" to false.'
              },
              Severity.WARNING
            ));
          } else {
            // It's a schema - this might be intentional
            issues.push(this.createIssue(
              'Object schema has "additionalProperties" set to a schema. ' +
              'Consider using false unless additional properties are intentionally allowed.',
              path,
              {
                current: typeof node.additionalProperties,
                suggestion: 'Review whether additional properties should be allowed.'
              },
              Severity.INFO
            ));
          }
        }
      }
      // else: additionalProperties === false, which is correct
    });
    
    return issues;
  }
}

// Create and register the check
const check = new AdditionalPropertiesFalseCheck();
registerCheck(check);

export { AdditionalPropertiesFalseCheck };
export default check;
