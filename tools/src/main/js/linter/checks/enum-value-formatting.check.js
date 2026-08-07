/**
 * CycloneDX Schema Linter - Enum Value Formatting Check
 * 
 * Validates that enum values follow consistent formatting conventions:
 * - Consistent case (kebab-case, snake_case, camelCase)
 * - No spaces or special characters
 * - meta:enum provides descriptions for all enum values
 * 
 * @license Apache-2.0
 */

import { LintCheck, registerCheck, Severity, traverseSchema } from '../index.js';

/**
 * Enum case styles
 */
const CaseStyles = {
  KEBAB: 'kebab-case',
  SNAKE: 'snake_case',
  CAMEL: 'camelCase',
  PASCAL: 'PascalCase',
  LOWER: 'lowercase',
  UPPER: 'UPPERCASE'
};

/**
 * Patterns for detecting case styles
 */
const CASE_PATTERNS = {
  [CaseStyles.KEBAB]: /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/,
  [CaseStyles.SNAKE]: /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/,
  [CaseStyles.CAMEL]: /^[a-z][a-zA-Z0-9]*$/,
  [CaseStyles.PASCAL]: /^[A-Z][a-zA-Z0-9]*$/,
  [CaseStyles.LOWER]: /^[a-z0-9]+$/,
  [CaseStyles.UPPER]: /^[A-Z0-9]+$/
};

/**
 * Check that validates enum value formatting
 */
class EnumValueFormattingCheck extends LintCheck {
  constructor() {
    super(
      'enum-value-formatting',
      'Enum Value Formatting',
      'Validates that enum values follow consistent formatting conventions.',
      Severity.WARNING
    );
  }

  async run(schema, rawContent, config = {}) {
    const issues = [];
    
    const preferredCase = config.preferredCase ?? CaseStyles.KEBAB;
    const allowMixedCase = config.allowMixedCase ?? false;
    
    traverseSchema(schema, (node, path, key, parent) => {
      // Only check 'enum' properties
      if (key !== 'enum') return;
      
      // Skip non-array enums
      if (!Array.isArray(node)) return;
      
      // Skip empty enums
      if (node.length === 0) return;
      
      const loc = (p) => (typeof p === 'string' && p.length ? p : '(unknown path)');
      // meta:enum is sibling of enum; path is from traverseSchema (contract: path for this node).
      const metaEnumBasePath = !path
        ? 'meta:enum'
        : path.endsWith('.enum')
          ? path.replace(/\.enum$/, '.meta:enum')
          : path === 'enum'
            ? 'meta:enum'
            : `${path}.meta:enum`;

      // Check if meta:enum exists on parent (own property only; avoid prototype chain)
      const hasMetaEnum =
        !!parent && Object.prototype.hasOwnProperty.call(parent, 'meta:enum');
      const metaEnumRaw = hasMetaEnum ? parent['meta:enum'] : null;
      const metaEnumIsPlainObject =
        metaEnumRaw !== null &&
        typeof metaEnumRaw === 'object' &&
        !Array.isArray(metaEnumRaw) &&
        (Object.getPrototypeOf(metaEnumRaw) === Object.prototype ||
          Object.getPrototypeOf(metaEnumRaw) === null);

      if (hasMetaEnum && !metaEnumIsPlainObject) {
        issues.push(this.createIssue(
          'meta:enum must be a plain object mapping enum values to descriptions.',
          loc(metaEnumBasePath),
          {
            actualType: Array.isArray(metaEnumRaw)
              ? 'array'
              : typeof metaEnumRaw
          },
          Severity.ERROR
        ));
      }

      const metaEnum = metaEnumIsPlainObject ? metaEnumRaw : {};
      const enumSet = new Set(node.filter(v => typeof v === 'string'));

      // Track detected case styles
      const detectedStyles = new Map();
      
      for (const value of enumSet) {
        // Detect case style
        const style = this.detectCaseStyle(value);
        
        if (style) {
          const count = detectedStyles.get(style) || 0;
          detectedStyles.set(style, count + 1);
        }
        
        // Check for spaces
        if (/\s/.test(value)) {
          issues.push(this.createIssue(
            `Enum value "${value}" contains whitespace. Use ${preferredCase} instead.`,
            loc(path),
            {
              value,
              suggestion: this.convertToCase(value, preferredCase)
            },
            Severity.ERROR
          ));
        }
        
        // Check for special characters (except - and _)
        if (/[^a-zA-Z0-9_-]/.test(value)) {
          issues.push(this.createIssue(
            `Enum value "${value}" contains special characters.`,
            loc(path),
            { value }
          ));
        }
        
        // Check meta:enum coverage only when meta:enum is a plain object
        if (hasMetaEnum && metaEnumIsPlainObject && !Object.prototype.hasOwnProperty.call(metaEnum, value)) {
          issues.push(this.createIssue(
            `Enum value "${value}" is missing a description in meta:enum.`,
            loc(metaEnumBasePath),
            { value },
            Severity.ERROR
          ));
        }
      }
      
      // Check case consistency
      if (!allowMixedCase && detectedStyles.size > 1) {
        const stylesUsed = Array.from(detectedStyles.entries())
          .map(([style, count]) => `${style} (${count})`)
          .join(', ');
        
        issues.push(this.createIssue(
          `Enum values use inconsistent case styles: ${stylesUsed}. ` +
          `Consider using ${preferredCase} consistently.`,
          loc(path),
          {
            detectedStyles: Object.fromEntries(detectedStyles)
          },
          Severity.INFO
        ));
      }
      
      // Check if meta:enum has extra values not in enum (only when it's a plain object)
      if (hasMetaEnum && metaEnumIsPlainObject) {
        for (const metaKey of Object.keys(metaEnum)) {
          if (!enumSet.has(metaKey)) {
            issues.push(this.createIssue(
              `meta:enum contains "${metaKey}" which is not in the enum array.`,
              `${metaEnumBasePath}.${metaKey}`,
              { value: metaKey }
            ));
          }
        }
      }
    });
    
    return issues;
  }
  
  /**
   * Detect the case style of a string
   */
  detectCaseStyle(str) {
    for (const [style, pattern] of Object.entries(CASE_PATTERNS)) {
      if (pattern.test(str)) {
        return style;
      }
    }
    return null;
  }
  
  /**
   * Convert a string to a specific case style
   */
  convertToCase(str, style) {
    // Normalise to words
    const words = str
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[-_\s]+/g, ' ')
      .toLowerCase()
      .split(' ')
      .filter(w => w);
    
    switch (style) {
      case CaseStyles.KEBAB:
        return words.join('-');
      case CaseStyles.SNAKE:
        return words.join('_');
      case CaseStyles.CAMEL:
        return words.map((w, i) => i === 0 ? w : this.capitalise(w)).join('');
      case CaseStyles.PASCAL:
        return words.map(w => this.capitalise(w)).join('');
      case CaseStyles.LOWER:
        return words.join('');
      case CaseStyles.UPPER:
        return words.join('').toUpperCase();
      default:
        return str;
    }
  }
  
  /**
   * Capitalise first letter
   */
  capitalise(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }
}

// Create and register the check
const check = new EnumValueFormattingCheck();
registerCheck(check);

export { EnumValueFormattingCheck };
export default check;
