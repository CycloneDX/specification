/**
 * CycloneDX Schema Linter - No "Must" Word Check
 * 
 * Validates that descriptions do not use the word "must".
 * ISO House Style requires the use of "shall" for requirements,
 * and "should" for recommendations.
 * 
 * @license Apache-2.0
 */

import { LintCheck, registerCheck, Severity, traverseSchema } from '../index.js';

/**
 * Patterns to detect "must" usage
 */
const MUST_PATTERNS = [
  {
    // "must" followed by any word
    pattern: /\bmust\s+(\w+)/gi,
    suggestion: 'shall $1',
    description: 'Use "shall" instead of "must" per ISO House Style.'
  },
  {
    // Standalone "must" at word boundary
    pattern: /\bmust\b/gi,
    suggestion: 'shall',
    description: 'Use "shall" instead of "must" per ISO House Style.'
  }
];

/**
 * Context phrases where "must" might be acceptable (e.g., quoting external standards)
 */
const ACCEPTABLE_CONTEXTS = [
  /the value must be/i,  // Often used in JSON Schema descriptions to describe constraints
  /"must"/i,             // Quoted usage
  /`must`/i              // Code/inline code usage
];

/**
 * Check that validates descriptions don't use "must"
 */
class NoMustWordCheck extends LintCheck {
  constructor() {
    super(
      'no-must-word',
      'No "Must" Word',
      'Validates that descriptions use "shall" instead of "must" per ISO House Style.',
      Severity.ERROR
    );
  }

  async run(schema, rawContent, config = {}) {
    const issues = [];
    
    // Allow "must" in specific contexts
    const allowInContext = config.allowInContext ?? false;
    
    // Paths to exclude
    const excludePaths = config.excludePaths || [];
    
    traverseSchema(schema, (node, path, key, parent) => {
      // Check description properties
      if (key !== 'description') return;
      
      // Skip non-string descriptions
      if (typeof node !== 'string') return;
      
      // Skip excluded paths
      if (excludePaths.some(excluded => path.includes(excluded))) return;
      
      // Check for "must" usage
      const foundIssues = this.checkForMust(node, path, allowInContext);
      issues.push(...foundIssues);
    });
    
    // Also check meta:enum descriptions
    traverseSchema(schema, (node, path, key, parent) => {
      if (key !== 'meta:enum') return;
      if (typeof node !== 'object' || node === null) return;
      
      for (const [enumValue, desc] of Object.entries(node)) {
        if (typeof desc !== 'string') continue;
        
        const descPath = `${path}.${enumValue}`;
        
        // Skip excluded paths
        if (excludePaths.some(excluded => descPath.includes(excluded))) continue;
        
        const foundIssues = this.checkForMust(desc, descPath, allowInContext);
        issues.push(...foundIssues);
      }
    });
    
    return issues;
  }
  
  /**
   * Check text for "must" usage
   */
  checkForMust(text, path, allowInContext) {
    const issues = [];
    
    // Quick check if "must" appears at all
    if (!/\bmust\b/i.test(text)) {
      return issues;
    }
    
    // Check acceptable contexts
    if (allowInContext) {
      for (const contextPattern of ACCEPTABLE_CONTEXTS) {
        if (contextPattern.test(text)) {
          return issues;
        }
      }
    }
    
    // Track positions already reported to avoid duplicates
    const reportedPositions = new Set();
    
    // Check each pattern from most specific to least
    for (const { pattern, suggestion, description } of MUST_PATTERNS) {
      // Reset regex state
      pattern.lastIndex = 0;
      
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const position = match.index;
        
        // Skip if already reported at this position
        if (reportedPositions.has(position)) continue;
        
        const foundText = match[0];
        
        // Generate actual suggestion based on captured groups
        let actualSuggestion = suggestion;
        if (match[1] && suggestion.includes('$1')) {
          actualSuggestion = suggestion.replace('$1', match[1]);
        }
        
        // Get context
        const start = Math.max(0, position - 15);
        const end = Math.min(text.length, position + foundText.length + 15);
        const context = text.substring(start, end);
        
        issues.push(this.createIssue(
          `${description} Found: "${foundText}"`,
          path,
          {
            found: foundText,
            suggestion: actualSuggestion,
            context: (start > 0 ? '...' : '') + context + (end < text.length ? '...' : ''),
            position
          }
        ));
        
        reportedPositions.add(position);
        
        // Only report the first (most specific) match at each position
        break;
      }
    }
    
    return issues;
  }
}

// Create and register the check
const check = new NoMustWordCheck();
registerCheck(check);

export { NoMustWordCheck };
export default check;
