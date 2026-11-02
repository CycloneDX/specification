/**
 * CycloneDX Schema Linter - Description Full Stop Check
 * 
 * Validates that all property descriptions end with a full stop (period).
 * This follows ISO House Style conventions for technical documentation.
 * 
 * @license Apache-2.0
 */

import { LintCheck, registerCheck, Severity, traverseSchema } from '../index.js';

/**
 * Check that validates descriptions end with a full stop
 */
class DescriptionFullStopCheck extends LintCheck {
  constructor() {
    super(
      'description-full-stop',
      'Description Full Stop',
      'Validates that property descriptions end with a full stop.',
      Severity.ERROR
    );
  }

  async run(schema, rawContent, config = {}) {
    const issues = [];
    
    // Characters that are acceptable at the end of a description
    const validEndings = config.validEndings ?? ['.', '?', '!', ')'];
    
    // Paths to exclude from checking (e.g., examples)
    const excludePaths = config.excludePaths ?? [];
    
    traverseSchema(schema, (node, path, key, parent) => {
      // Only check 'description' properties
      if (key !== 'description') return;
      
      // Skip if in excluded path
      if (excludePaths.some(excluded => path.includes(excluded))) return;
      
      // Skip if not a string
      if (typeof node !== 'string') return;
      
      // Skip empty descriptions
      if (node.trim() === '') return;
      
      // Skip if inside meta:enum (handled by different check)
      if (path.includes('meta:enum')) return;
      
      const trimmed = node.trim();
      const lastChar = trimmed[trimmed.length - 1];
      
      // Check if the description ends with an acceptable character
      if (!validEndings.includes(lastChar)) {
        // Check for special cases like URLs at the end
        if (this.isUrlEnding(trimmed)) {
          // URLs at the end are acceptable if wrapped in markdown or similar
          return;
        }
        
        // Check for code blocks or inline code at the end
        if (trimmed.endsWith('`') || trimmed.endsWith('```')) {
          // Code at the end might be acceptable, but let's warn
          issues.push(this.createIssue(
            `Description ends with code block. Consider adding a full stop after.`,
            path,
            { 
              ending: trimmed.substring(Math.max(0, trimmed.length - 30)),
              lastChar
            },
            Severity.WARNING
          ));
          return;
        }
        
        issues.push(this.createIssue(
          `Description does not end with a full stop. Ends with: "${lastChar}"`,
          path,
          { 
            ending: trimmed.substring(Math.max(0, trimmed.length - 30)),
            lastChar,
            suggestion: trimmed + '.'
          }
        ));
      }
    });
    
    return issues;
  }
  
  /**
   * Check if the description ends with a URL
   */
  isUrlEnding(text) {
    // Pattern for URLs at the end of text
    const urlPattern = /https?:\/\/[^\s]+$/;
    
    // Pattern for markdown links at the end
    const markdownLinkPattern = /\]\([^)]+\)$/;
    
    return urlPattern.test(text) || markdownLinkPattern.test(text);
  }
}

// Create and register the check
const check = new DescriptionFullStopCheck();
registerCheck(check);

export { DescriptionFullStopCheck };
export default check;
