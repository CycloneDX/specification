/**
 * CycloneDX Schema Linter - Object Strictness Check
 *
 * Validates consistency of `type: "object"` (sub)schemas regarding
 * `additionalProperties` and `unevaluatedProperties`:
 * - Object schemas that carry nothing but documentational/annotation keywords
 *   (title, description, examples, ...) are skipped - there is nothing structural
 *   to be strict about.
 * - Exactly one of `additionalProperties`/`unevaluatedProperties`
 *   must be present - never both, never neither.
 * - A schema is a "mixin" if its `description` or `$comment` contains the
 *   mixin marker string (case-insensitive; default: "this is a mixin",
 *   configurable via `mixinMarker`). Mixins are meant to be composed via
 *   `allOf`, so they must be explicitly open: the present keyword must be `true`.
 * - Non-mixins must be closed: the present keyword must be `false`.
 *
 * @license Apache-2.0
 */

import { LintCheck, registerCheck, Severity, traverseSchema } from '../index.js';

/**
 * Default marker string identifying a mixin schema.
 */
const DEFAULT_MIXIN_MARKER = 'this is a mixin';

/**
 * The mutually exclusive strictness keywords.
 */
const STRICTNESS_KEYWORDS = Object.freeze([
  'additionalProperties', 'unevaluatedProperties']);

/**
 * Keywords that do not describe object structure:
 * documentational/annotation keywords, identifiers, and the type declaration itself.
 * An object schema consisting solely of these (plus the strictness keywords)
 * is not subject to this check.
 */
const NON_STRUCTURAL_KEYWORDS = Object.freeze(new Set([
  'type',
  '$id', '$anchor', '$schema', // identifiers
  '$defs', 'definitions', // defs
  'enum', 'const', 'default', // values
  '$comment', 'title', 'description', 'examples', 'default', 'readOnly', 'writeOnly', 'meta:enum', // documentational/annotations
  ...STRICTNESS_KEYWORDS, // the strictness declaration itself doesn't count as structure
]));

/**
 * Keys whose values aren't schemas - their entire subtrees are pruned
 */
const SKIP_KEYS = Object.freeze(new Set([
  'enum', 'const', 'default', // values
  'examples', 'meta:enum', // documentational
]));

/**
 * Tell whether a (sub)schema declares `type: "object"`,
 * either as plain string or as part of a type array.
 *
 * @param {Readonly<*>} node
 * @return {boolean}
 */
function isObjectType(node) {
  const type = node['type'];
  return type === 'object' ||
    (Array.isArray(type) && type.includes('object'));
}

/**
 * Tell whether a (sub)schema carries any structural keyword,
 * i.e. anything beyond documentation, identifiers, and strictness declarations.
 *
 * @param {Readonly<*>} node
 * @return {boolean}
 */
function hasStructure(node) {
  return Object.keys(node).some(k => !NON_STRUCTURAL_KEYWORDS.has(k));
}

/**
 * Check that validates strictness of object-type schemas.
 */
class ObjectStrictnessCheck extends LintCheck {
  constructor() {
    super(
      'object-strictness',
      'Object Strictness',
      'Validates that structural object schemas set exactly one of additionalProperties/unevaluatedProperties: true for mixins, false otherwise.',
      Severity.ERROR
    );
  }

  async run(schema, rawContent, config = {}, filePath = null) {
    const issues = [];

    const mixinMarker = String(
      config['mixinMarker'] ?? DEFAULT_MIXIN_MARKER
    ).toLowerCase();

    const isMixin = node =>
      [node['description'], node['$comment']].some(
        text => typeof text === 'string' && text.toLowerCase().includes(mixinMarker)
      );

    traverseSchema(schema, (node, path, key) => {
      if (typeof key === 'string' && SKIP_KEYS.has(key)) {
        // don't descend into keys whose values aren't schemas
        return false;
      }

      if (node === null || typeof node !== 'object' || Array.isArray(node)) return;
      if (!isObjectType(node)) return;

      if (!hasStructure(node)) {
        // purely documentational object (e.g. a described free-form map) - nothing to be strict about
        return;
      }

      const present = STRICTNESS_KEYWORDS.filter(kw => kw in node);

      if (present.length === 0) {
        issues.push(this.createIssue(
          'Object schema must declare its strictness: ' +
          'set exactly one of "additionalProperties"/"unevaluatedProperties".',
          path,
          { actual: 'neither present', expected: 'exactly one present' }
        ));
        return;
      }

      if (present.length > 1) {
        issues.push(this.createIssue(
          'Object schema must not set both "additionalProperties" and "unevaluatedProperties"; ' +
          'use exactly one of them.',
          path,
          { actual: 'both present', expected: 'exactly one present' }
        ));
        return;
      }

      const keyword = present[0];
      const expected = isMixin(node)

      if (node[keyword] !== expected) {
        issues.push(this.createIssue(
          expected
            ? `Mixin object schema must set ${keyword} to true.`
            : `Object schema must set ${keyword} to false, ` +
            `or be marked as a mixin by adding "${mixinMarker}" to its description or $comment.`,
          `${path}.${keyword}`,
          { actual: JSON.stringify(node[keyword]), expected: String(expected) }
        ));
      }
    });

    return issues;
  }
}

// Create and register the check
const check = new ObjectStrictnessCheck();
registerCheck(check);

export { ObjectStrictnessCheck };
export default check;
