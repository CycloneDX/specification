/**
 * CycloneDX Schema Linter - Model Property Order Check
 * 
 * Validates that model schemas have top-level properties in the required order:
 * $schema, $id, type, title, $comment, $defs
 * 
 * A model schema is identified by having "/model/" in its $id URL.
 * 
 * @license Apache-2.0
 */

import { LintCheck, registerCheck, Severity } from '../index.js';

/**
 * Required property order for model schemas
 */
const REQUIRED_ORDER = ['$schema', '$id', 'type', 'title', '$comment', '$defs'];

/**
 * Check that validates model property ordering
 */
class ModelPropertyOrderCheck extends LintCheck {
  constructor() {
    super(
      'model-property-order',
      'Model Property Order',
      'Validates that model schemas have top-level properties in the required order.',
      Severity.ERROR
    );
  }

  async run(schema, rawContent, config = {}) {
    const issues = [];
    
    const requiredOrder = config.requiredOrder ?? REQUIRED_ORDER;
    
    // Check if this is a model schema
    const schemaId = schema.$id || '';
    if (!schemaId.includes('/model/')) {
      return issues; // Not a model schema, skip
    }
    
    // Parse the raw content to get actual property order
    const actualOrder = this.extractPropertyOrder(rawContent);
    
    if (actualOrder.length === 0) {
      return issues;
    }
    
    // Check that all required properties exist
    for (const prop of requiredOrder) {
      if (!actualOrder.includes(prop)) {
        issues.push(this.createIssue(
          `Model schema is missing required property "${prop}".`,
          `$.${prop}`,
          { expected: requiredOrder }
        ));
      }
    }
    
    // Check order of properties that exist
    const filteredActual = actualOrder.filter(p => requiredOrder.includes(p));
    const filteredRequired = requiredOrder.filter(p => actualOrder.includes(p));
    
    for (let i = 0; i < filteredRequired.length; i++) {
      if (filteredActual[i] !== filteredRequired[i]) {
        issues.push(this.createIssue(
          `Property "${filteredActual[i]}" is in wrong position. Expected order: ${requiredOrder.join(', ')}.`,
          `$.${filteredActual[i]}`,
          {
            actual: actualOrder.filter(p => requiredOrder.includes(p)),
            expected: filteredRequired
          }
        ));
        break; // Only report first ordering issue
      }
    }
    
    // Check for extra properties at root level (not in required order)
    const extraProps = actualOrder.filter(p => !requiredOrder.includes(p));
    if (extraProps.length > 0) {
      issues.push(this.createIssue(
        `Model schema has unexpected root-level properties: ${extraProps.join(', ')}. Only ${requiredOrder.join(', ')} are allowed.`,
        '$',
        { unexpected: extraProps, allowed: requiredOrder },
        Severity.WARNING
      ));
    }
    
    return issues;
  }
  
  /**
   * Extract the order of top-level properties from raw JSON content
   */
  extractPropertyOrder(rawContent) {
    const order = [];
    const lines = rawContent.split('\n');
    let depth = 0;
    let inString = false;
    let escapeNext = false;
    
    for (const line of lines) {
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        
        if (char === '\\' && inString) {
          escapeNext = true;
          continue;
        }
        
        if (char === '"' && !escapeNext) {
          inString = !inString;
          continue;
        }
        
        if (inString) continue;
        
        if (char === '{' || char === '[') {
          depth++;
        } else if (char === '}' || char === ']') {
          depth--;
        }
      }
      
      // Only look at depth 1 (inside root object)
      if (depth === 1) {
        // Match property key at start of line (with indentation)
        const match = line.match(/^\s*"([^"]+)"\s*:/);
        if (match) {
          order.push(match[1]);
        }
      }
    }
    
    return order;
  }
}

// Create and register the check
const check = new ModelPropertyOrderCheck();
registerCheck(check);

export { ModelPropertyOrderCheck, REQUIRED_ORDER };
export default check;
