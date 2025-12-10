/**
 * CycloneDX Schema Linter - Duplicate Definitions Check
 * 
 * Validates reusability and prevents duplication by checking:
 * 1. Duplicate definition names in $defs (including nested) within the same file
 * 2. Properties defined inline that could use $ref to existing definitions
 * 
 * @license Apache-2.0
 */

import { LintCheck, registerCheck, Severity } from '../index.js';

/**
 * Check that validates definition reusability within a single file
 */
class DuplicateDefinitionsCheck extends LintCheck {
  constructor() {
    super(
      'duplicate-definitions',
      'Duplicate Definitions',
      'Validates that definitions are reused via $ref and not duplicated.',
      Severity.ERROR
    );
  }

  async run(schema, rawContent, config = {}) {
    const issues = [];
    
    // Collect all definitions from $defs (including nested)
    const definitions = new Map();  // definitionName -> [paths]
    this.collectDefinitions(schema, '$', definitions);
    
    // Collect all inline property definitions
    const inlineProperties = [];
    this.collectInlineProperties(schema, '$', inlineProperties);
    
    // Check for duplicate definitions within this file
    for (const [defName, paths] of definitions) {
      if (paths.length > 1) {
        issues.push(this.createIssue(
          `Duplicate definition "${defName}" found at ${paths.length} locations.`,
          paths[0],
          {
            definitionName: defName,
            locations: paths,
            count: paths.length
          }
        ));
      }
    }
    
    // Check for properties that could use $ref
    for (const prop of inlineProperties) {
      if (prop.hasRef) continue;  // Already uses $ref
      
      // Check if there's a definition with this name
      const matchingDefs = definitions.get(prop.name);
      if (matchingDefs && matchingDefs.length > 0) {
        const defPath = matchingDefs[0];
        const refPath = defPath
          .replace(/^\$\.\$defs\./, '#/$defs/')
          .replace(/^\$\.definitions\./, '#/definitions/');
        
        issues.push(this.createIssue(
          `Property "${prop.name}" is defined inline but a definition exists. Consider using $ref: "${refPath}".`,
          prop.path,
          {
            propertyName: prop.name,
            definitionPath: defPath,
            suggestedRef: refPath
          },
          Severity.WARNING
        ));
      }
    }
    
    return issues;
  }
  
  /**
   * Collect all definitions from $defs recursively
   */
  collectDefinitions(node, path, definitions) {
    if (!node || typeof node !== 'object') return;
    
    // Check for $defs at this level
    if (node.$defs && typeof node.$defs === 'object') {
      for (const [defName, defSchema] of Object.entries(node.$defs)) {
        const defPath = `${path}.$defs.${defName}`;
        
        if (!definitions.has(defName)) {
          definitions.set(defName, []);
        }
        definitions.get(defName).push(defPath);
        
        // Recursively check for nested $defs
        this.collectDefinitions(defSchema, defPath, definitions);
      }
    }
    
    // Also check 'definitions' for older schemas
    if (node.definitions && typeof node.definitions === 'object') {
      for (const [defName, defSchema] of Object.entries(node.definitions)) {
        const defPath = `${path}.definitions.${defName}`;
        
        if (!definitions.has(defName)) {
          definitions.set(defName, []);
        }
        definitions.get(defName).push(defPath);
        
        // Recursively check for nested definitions
        this.collectDefinitions(defSchema, defPath, definitions);
      }
    }
    
    // Recurse into other schema structures
    for (const key of ['properties', 'items', 'additionalProperties', 'allOf', 'anyOf', 'oneOf', 'not', 'if', 'then', 'else']) {
      if (node[key]) {
        if (Array.isArray(node[key])) {
          node[key].forEach((item, i) => {
            this.collectDefinitions(item, `${path}.${key}[${i}]`, definitions);
          });
        } else if (typeof node[key] === 'object') {
          if (key === 'properties') {
            for (const [propName, propSchema] of Object.entries(node[key])) {
              this.collectDefinitions(propSchema, `${path}.${key}.${propName}`, definitions);
            }
          } else {
            this.collectDefinitions(node[key], `${path}.${key}`, definitions);
          }
        }
      }
    }
  }
  
  /**
   * Collect inline property definitions (properties without $ref)
   */
  collectInlineProperties(node, path, properties) {
    if (!node || typeof node !== 'object') return;
    
    // Skip $defs and definitions sections for inline property collection
    if (path.match(/\.\$defs\.[^.]+$/) || path.match(/\.definitions\.[^.]+$/)) {
      return;
    }
    
    // Check properties at this level
    if (node.properties && typeof node.properties === 'object') {
      for (const [propName, propSchema] of Object.entries(node.properties)) {
        const propPath = `${path}.properties.${propName}`;
        const hasRef = propSchema && propSchema.$ref;
        
        // Only track properties outside of $defs
        if (!path.includes('.$defs.') && !path.includes('.definitions.')) {
          properties.push({
            name: propName,
            path: propPath,
            hasRef: !!hasRef
          });
        }
        
        // Recurse into nested properties
        this.collectInlineProperties(propSchema, propPath, properties);
      }
    }
    
    // Recurse into schema structures
    for (const key of ['items', 'additionalProperties', 'allOf', 'anyOf', 'oneOf', 'not', 'if', 'then', 'else']) {
      if (node[key]) {
        if (Array.isArray(node[key])) {
          node[key].forEach((item, i) => {
            this.collectInlineProperties(item, `${path}.${key}[${i}]`, properties);
          });
        } else if (typeof node[key] === 'object') {
          this.collectInlineProperties(node[key], `${path}.${key}`, properties);
        }
      }
    }
  }
}

// Create and register the check
const check = new DuplicateDefinitionsCheck();
registerCheck(check);

export { DuplicateDefinitionsCheck };
export default check;
