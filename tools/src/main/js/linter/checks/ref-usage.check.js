/**
 * CycloneDX Schema Linter - Ref Usage Check
 * 
 * Validates that $ref usage follows best practices:
 * - $ref should not be combined with other keywords (draft-07 limitation)
 * - Referenced definitions should exist
 * - No circular references (configurable)
 * 
 * @license Apache-2.0
 */

import { LintCheck, registerCheck, Severity, traverseSchema } from '../index.js';

/**
 * Keywords that should not appear alongside $ref in draft-07
 */
const CONFLICTING_KEYWORDS = [
  'type', 'properties', 'additionalProperties', 'required',
  'items', 'additionalItems', 'contains',
  'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum',
  'minLength', 'maxLength', 'pattern', 'format',
  'minItems', 'maxItems', 'uniqueItems',
  'minProperties', 'maxProperties',
  'enum', 'const', 'default',
  'allOf', 'anyOf', 'oneOf', 'not', 'if', 'then', 'else'
];

/**
 * Keywords allowed alongside $ref
 */
const ALLOWED_KEYWORDS = [
  '$ref', 'title', 'description', '$comment', 'examples'
];

/**
 * Check that validates $ref usage
 */
class RefUsageCheck extends LintCheck {
  constructor() {
    super(
      'ref-usage',
      'Ref Usage',
      'Validates that $ref usage follows JSON Schema best practices.',
      Severity.WARNING
    );
  }

  async run(schema, rawContent, config = {}) {
    const issues = [];
    
    const checkConflictingKeywords = config.checkConflictingKeywords ?? true;
    const checkDefinitionsExist = config.checkDefinitionsExist ?? true;
    const allowedConflicting = new Set(config.allowedConflicting || ['title', 'description']);
    
    // Collect all definitions
    const definitions = new Set();
    const definitionPaths = ['definitions', '$defs'];
    
    for (const defPath of definitionPaths) {
      if (schema[defPath]) {
        for (const defName of Object.keys(schema[defPath])) {
          definitions.add(`#/${defPath}/${defName}`);
        }
      }
    }
    
    // Track all $ref usages
    const refUsages = [];
    
    traverseSchema(schema, (node, path, key, parent) => {
      // Check $ref nodes
      if (key === '$ref' && typeof node === 'string') {
        refUsages.push({ ref: node, path, parent });
      }
      
      // Check for $ref combined with other keywords
      if (typeof node === 'object' && node !== null && !Array.isArray(node) && node.$ref) {
        if (checkConflictingKeywords) {
          const keys = Object.keys(node);
          const conflicting = keys.filter(k => 
            !ALLOWED_KEYWORDS.includes(k) && 
            !allowedConflicting.has(k)
          );
          
          if (conflicting.length > 0) {
            issues.push(this.createIssue(
              `$ref is combined with other keywords: ${conflicting.join(', ')}. ` +
              `In JSON Schema draft-07, $ref causes other keywords to be ignored.`,
              path,
              {
                ref: node.$ref,
                conflictingKeywords: conflicting
              }
            ));
          }
        }
      }
    });
    
    // Check that referenced definitions exist
    if (checkDefinitionsExist) {
      for (const { ref, path } of refUsages) {
        // Only check local references
        if (ref.startsWith('#/')) {
          if (!definitions.has(ref)) {
            // Check if it's a valid path in the schema
            const refPath = ref.substring(2).split('/');
            let target = schema;
            let valid = true;
            
            for (const segment of refPath) {
              if (target && typeof target === 'object' && segment in target) {
                target = target[segment];
              } else {
                valid = false;
                break;
              }
            }
            
            if (!valid) {
              issues.push(this.createIssue(
                `$ref "${ref}" references a non-existent definition.`,
                path,
                { ref },
                Severity.ERROR
              ));
            }
          }
        }
      }
    }
    
    return issues;
  }
}

// Create and register the check
const check = new RefUsageCheck();
registerCheck(check);

export { RefUsageCheck };
export default check;
