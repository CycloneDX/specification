/**
 * CycloneDX Schema Linter - Duplicate Content Check
 * 
 * Validates that titles and descriptions are unique within a schema.
 * Duplicate content suggests opportunities for reuse via $ref or
 * indicates copy-paste errors.
 * 
 * @license Apache-2.0
 */

import { LintCheck, registerCheck, Severity, traverseSchema } from '../index.js';

/**
 * Check that validates titles and descriptions are unique
 */
class DuplicateContentCheck extends LintCheck {
  constructor() {
    super(
      'duplicate-content',
      'Duplicate Content',
      'Validates that titles and descriptions are unique within a schema.',
      Severity.ERROR
    );
  }

  async run(schema, rawContent, config = {}) {
    const issues = [];
    
    const checkTitles = config.checkTitles ?? true;
    const checkDescriptions = config.checkDescriptions ?? true;
    const minDescriptionLength = config.minDescriptionLength ?? 20;
    
    // Collect all titles and descriptions with their paths
    const titles = new Map();  // content -> [paths]
    const descriptions = new Map();  // content -> [paths]
    
    traverseSchema(schema, (node, path, key, parent) => {
      if (checkTitles && key === 'title' && typeof node === 'string') {
        const normalised = node.trim();
        if (normalised) {
          if (!titles.has(normalised)) {
            titles.set(normalised, []);
          }
          titles.get(normalised).push(path);
        }
      }
      
      if (checkDescriptions && key === 'description' && typeof node === 'string') {
        const normalised = node.trim();
        // Only check descriptions above minimum length
        if (normalised && normalised.length >= minDescriptionLength) {
          if (!descriptions.has(normalised)) {
            descriptions.set(normalised, []);
          }
          descriptions.get(normalised).push(path);
        }
      }
    });
    
    // Report duplicate titles
    for (const [title, paths] of titles) {
      if (paths.length > 1) {
        issues.push(this.createIssue(
          `Duplicate title "${this.truncate(title, 50)}" found at ${paths.length} locations.`,
          paths[0],
          {
            title,
            locations: paths,
            count: paths.length
          }
        ));
      }
    }
    
    // Report duplicate descriptions
    for (const [description, paths] of descriptions) {
      if (paths.length > 1) {
        issues.push(this.createIssue(
          `Duplicate description found at ${paths.length} locations: "${this.truncate(description, 60)}"`,
          paths[0],
          {
            description,
            locations: paths,
            count: paths.length
          },
          Severity.WARNING
        ));
      }
    }
    
    return issues;
  }
  
  /**
   * Truncate a string for display
   */
  truncate(str, maxLength) {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
  }
}

// Create and register the check
const check = new DuplicateContentCheck();
registerCheck(check);

export { DuplicateContentCheck };
export default check;
