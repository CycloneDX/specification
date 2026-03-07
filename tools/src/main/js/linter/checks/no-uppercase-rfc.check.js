/**
 * CycloneDX Schema Linter - No Uppercase RFC Language Check
 * 
 * Validates that descriptions do not contain uppercase RFC 2119 keywords
 * (MUST, SHALL, SHOULD, MAY, etc.). These should be lowercase in
 * JSON Schema descriptions, which are informative rather than normative.
 * 
 * @license Apache-2.0
 */

import { LintCheck, registerCheck, Severity, traverseSchema } from '../index.js';

/**
 * RFC 2119 keywords that should not appear in uppercase
 */
const RFC_KEYWORDS = [
  'MUST',
  'MUST NOT',
  'SHALL',
  'SHALL NOT',
  'SHOULD',
  'SHOULD NOT',
  'MAY',
  'OPTIONAL',
  'REQUIRED',
  'RECOMMENDED',
  'NOT RECOMMENDED'
];

/**
 * Build regex patterns for RFC keywords
 */
function buildPatterns() {
  return RFC_KEYWORDS.map(keyword => ({
    keyword,
    pattern: new RegExp(`\\b${keyword.replace(/\s+/g, '\\s+')}\\b`, 'g'),
    suggestion: keyword.toLowerCase()
  }));
}

const PATTERNS = buildPatterns();

/**
 * Check that validates descriptions don't contain uppercase RFC keywords
 */
class NoUppercaseRfcCheck extends LintCheck {
  constructor() {
    super(
      'no-uppercase-rfc',
      'No Uppercase RFC Keywords',
      'Validates that descriptions do not contain uppercase RFC 2119 keywords.',
      Severity.ERROR
    );
  }

  async run(schema, rawContent, config = {}) {
    const issues = [];
    
    // Allow specific keywords in uppercase (e.g., in certain contexts)
    const allowedKeywords = new Set(config.allowedKeywords || []);
    
    // Allow uppercase RFC keywords in specific paths
    const allowedPaths = config.allowedPaths || [];
    
    traverseSchema(schema, (node, path, key, parent) => {
      // Check 'description' properties
      if (key !== 'description') return;
      
      // Skip non-string descriptions
      if (typeof node !== 'string') return;
      
      // Skip allowed paths
      if (allowedPaths.some(allowed => path.includes(allowed))) return;
      
      // Check for each RFC keyword
      for (const { keyword, pattern, suggestion } of PATTERNS) {
        // Skip allowed keywords
        if (allowedKeywords.has(keyword)) continue;
        
        // Reset regex state
        pattern.lastIndex = 0;
        
        let match;
        while ((match = pattern.exec(node)) !== null) {
          const foundKeyword = match[0];
          const position = match.index;
          
          // Get surrounding context
          const start = Math.max(0, position - 20);
          const end = Math.min(node.length, position + foundKeyword.length + 20);
          const context = node.substring(start, end);
          
          issues.push(this.createIssue(
            `Uppercase RFC keyword "${foundKeyword}" found in description. ` +
            `Use lowercase "${suggestion}" instead.`,
            path,
            {
              keyword: foundKeyword,
              suggestion,
              context: (start > 0 ? '...' : '') + context + (end < node.length ? '...' : ''),
              position
            }
          ));
        }
      }
    });
    
    // Also check meta:enum descriptions
    traverseSchema(schema, (node, path, key, parent) => {
      if (key !== 'meta:enum') return;
      if (typeof node !== 'object' || node === null) return;
      
      for (const [enumValue, desc] of Object.entries(node)) {
        if (typeof desc !== 'string') continue;
        
        // Skip allowed paths
        const descPath = `${path}.${enumValue}`;
        if (allowedPaths.some(allowed => descPath.includes(allowed))) continue;
        
        for (const { keyword, pattern, suggestion } of PATTERNS) {
          if (allowedKeywords.has(keyword)) continue;
          
          pattern.lastIndex = 0;
          
          let match;
          while ((match = pattern.exec(desc)) !== null) {
            issues.push(this.createIssue(
              `Uppercase RFC keyword "${match[0]}" found in meta:enum description. ` +
              `Use lowercase "${suggestion}" instead.`,
              descPath,
              {
                keyword: match[0],
                suggestion,
                enumValue
              }
            ));
          }
        }
      }
    });
    
    return issues;
  }
}

// Create and register the check
const check = new NoUppercaseRfcCheck();
registerCheck(check);

export { NoUppercaseRfcCheck, RFC_KEYWORDS };
export default check;
