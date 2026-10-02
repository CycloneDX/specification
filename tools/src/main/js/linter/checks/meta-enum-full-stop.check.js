/**
 * CycloneDX Schema Linter - Meta:Enum Full Stop Check
 * 
 * Validates that meta:enum descriptions end with a full stop.
 * This ensures consistency with property descriptions.
 * 
 * @license Apache-2.0
 */

import { LintCheck, registerCheck, Severity, traverseSchema } from '../index.js';

/**
 * Check that validates meta:enum descriptions end with full stops
 */
class MetaEnumFullStopCheck extends LintCheck {
  constructor() {
    super(
      'meta-enum-full-stop',
      'Meta:Enum Full Stop',
      'Validates that meta:enum descriptions end with a full stop.',
      Severity.ERROR
    );
  }

  async run(schema, rawContent, config = {}) {
    const issues = [];
    
    // Characters that are acceptable at the end of a description
    const validEndings = config.validEndings ?? ['.', '?', '!', ')'];
    
    traverseSchema(schema, (node, path, key, parent) => {
      // Only check 'meta:enum' properties
      if (key !== 'meta:enum') return;
      
      // meta:enum should be an object
      if (typeof node !== 'object' || node === null || Array.isArray(node)) {
        issues.push(this.createIssue(
          'meta:enum shall be an object mapping enum values to descriptions.',
          path,
          { actual: typeof node }
        ));
        return;
      }
      
      // Check each enum description
      for (const [enumValue, description] of Object.entries(node)) {
        if (typeof description !== 'string') {
          issues.push(this.createIssue(
            `meta:enum description for "${enumValue}" shall be a string.`,
            `${path}.${enumValue}`,
            { actual: typeof description }
          ));
          continue;
        }
        
        const trimmed = description.trim();
        
        // Skip empty descriptions
        if (trimmed === '') {
          issues.push(this.createIssue(
            `meta:enum description for "${enumValue}" is empty.`,
            `${path}.${enumValue}`,
            { enumValue },
            Severity.WARNING
          ));
          continue;
        }
        
        const lastChar = trimmed[trimmed.length - 1];
        
        // Check if the description ends with a valid character
        if (!validEndings.includes(lastChar)) {
          issues.push(this.createIssue(
            `meta:enum description for "${enumValue}" does not end with a full stop.`,
            `${path}.${enumValue}`,
            { 
              enumValue,
              description: trimmed,
              lastChar,
              suggestion: trimmed + '.'
            }
          ));
        }
      }
    });
    
    return issues;
  }
}

// Create and register the check
const check = new MetaEnumFullStopCheck();
registerCheck(check);

export { MetaEnumFullStopCheck };
export default check;
