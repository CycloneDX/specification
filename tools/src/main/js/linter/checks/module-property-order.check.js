/**
 * CycloneDX Schema Linter - Module Property Order Check
 *
 * Validates that module schemas have top-level properties (some optional) in the required order:
 * $schema, $id, type, title, $comment, [description], $defs
 *
 * A module schema is identified by having "/modules/" in its $id URL.
 *
 * @license Apache-2.0
 */

import assert from 'node:assert/strict';
import { LintCheck, registerCheck, Severity } from '../index.js';

/**
 * Property order for module schemas
 */
const ORDER = ['$schema', '$id', 'type', 'title', '$comment', 'description', '$defs'];
/**
 * Which of the ordered properties are optional.
 */
const OPTIONALS = ['description'];

/**
 * Check that validates module property ordering
 */
class ModulePropertyOrderCheck extends LintCheck {
  constructor() {
    super(
      'module-property-order',
      'Module Property Order',
      'Validates that module schemas have top-level properties (some optional) in the required order.',
      Severity.ERROR
    );
  }

  async run(schema, rawContent, config = {}) {
    const issues = [];

    // Check if this is a module schema
    const schemaId = schema.$id || '';
    if (!schemaId.includes('/modules/')) {
      return issues; // Not a module schema, skip
    }

    const order = config.order ?? ORDER;
    const known = new Set(order);
    if (order.length !== known.size) {
      throw new Error(`duplicate order items in ${order.join(', ')}`);
    }
    const optionals = new Set(config.optionals ?? OPTIONALS).intersection(known);
    const required = known.difference(optionals);

    const expectedOrderStr = order.map(p => optionals.has(p) ? `[${p}]` : p).join(', ');

    // Parse the raw content to get actual property order
    const actualOrder = this.extractPropertyOrder(rawContent);
    const actualSet = new Set(actualOrder);

    // 0. actualOrder contains duplicates
    if (actualOrder.length !== actualSet.size) {
      issues.push(this.createIssue(
        `Module schema has duplicate root-level properties in: ${actualOrder.join(', ')}.`,
        '$',
        { actual: actualOrder },
        Severity.ERROR
      ));
      return issues;
    }

    // 1. actual properties that are unknown
    const extraProps = actualSet.difference(known);
    if (extraProps.size > 0) {
      // Unknown properties are okay - just warn.
      issues.push(this.createIssue(
        `Module schema has unexpected root-level properties: ${[...extraProps].join(', ')}. Only ${expectedOrderStr} are allowed.`,
        '$',
        { unexpected: [...extraProps], allowed: [...known] },
        Severity.WARNING
      ));
    }

    // 2. required properties missing from actual
    const missing = required.difference(actualSet);
    if (missing.size > 0) {
      const requiredList = [...required];
      missing.forEach(prop => {
        issues.push(this.createIssue(
          `Module schema is missing required property "${prop}".`,
          `$.${prop}`,
          { expected: requiredList }
        ));
      });
      // There are missing properties - can not assert order anyway.
      return issues;
    }

    // 3. actualOrder elements that are out of order (optionals may be skipped)
    const actualOrderKnown = actualOrder.filter(p => known.has(p));
    // Prerequisite: all required are in actual - see step 2.
    const expectedOrder = order.filter(p => required.has(p) || actualSet.has(p));
    // This should be impossible from the prerequisites - assert anyway.
    assert.equal(actualOrderKnown.length, expectedOrder.length,
      `Unexpected state: actualOrderKnown/expectedOrder unequal length - ` +
      `${actualOrderKnown.length} !== ${expectedOrder.length} ` +
      `(actualOrderKnown=${JSON.stringify(actualOrderKnown)}, expectedOrder=${JSON.stringify(expectedOrder)})`);
    for (const [pos, expectedProp] of expectedOrder.entries()) {
      const prop = actualOrderKnown[pos];
      if (prop !== expectedProp) {
        issues.push(this.createIssue(
          `Property "${prop}" is in wrong position. Expected order: ${expectedOrderStr}.`,
          `$.${prop}`,
          { actual: actualOrderKnown, expected: expectedOrder }
        ));
        break; // Only report first ordering issue
      }
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
      let depthChange = 0;

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
          depthChange += 1;
        } else if (char === '}' || char === ']') {
          depthChange -= 1;
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

      depth += depthChange;
    }

    return order;
  }
}

// Create and register the check
const check = new ModulePropertyOrderCheck();
registerCheck(check);

export { ModulePropertyOrderCheck, ORDER, OPTIONALS };
export default check;
