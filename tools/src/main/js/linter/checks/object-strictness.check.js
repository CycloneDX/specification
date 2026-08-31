/**
 * CycloneDX Schema Linter - Object Strictness Check
 *
 * Validates consistency of `type: "object"` (sub)schemas regarding
 * `additionalProperties` and `unevaluatedProperties`:
 * - A schema is a "mixin" if its `description` or `$comment` contains the
 *   mixin marker string (case-insensitive; default: "this is a mixin",
 *   configurable via `mixinMarker`).
 * - Mixins: `additionalProperties` and `unevaluatedProperties` shall each be
 *   either absent or exactly `false`.
 * - Non-mixins: the object shall be closed - at least one of
 *   `additionalProperties`/`unevaluatedProperties` must be present and `false`,
 *   and neither may hold any value other than `false`.
 *
 * @license Apache-2.0
 */

import { LintCheck, registerCheck, Severity, traverseSchema } from '../index.js';

/**
 * Default marker string identifying a mixin schema.
 */
const DEFAULT_MIXIN_MARKER = 'this is a mixin';

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
 * Check that validates strictness of object-type schemas.
 */
class ObjectStrictnessCheck extends LintCheck {
  constructor() {
    super(
      'object-strictness',
      'Object Strictness',
      'Validates that object schemas forbid undeclared properties, unless marked as a mixin.',
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

      const mixin = isMixin(node);

      for (const keyword of ['additionalProperties', 'unevaluatedProperties']) {
        if (keyword in node && node[keyword] !== false) {
          issues.push(this.createIssue(
            mixin
              ? `Mixin object schema must not set ${keyword} to anything but false.`
              : `Object schema must not set ${keyword} to anything but false.`,
            `${path}.${keyword}`,
            { actual: JSON.stringify(node[keyword]), expected: 'false or absent' }
          ));
        }
      }

      if (!mixin &&
        node['additionalProperties'] !== false &&
        node['unevaluatedProperties'] !== false
      ) {
        issues.push(this.createIssue(
          'Object schema is not a mixin but allows undeclared properties. ' +
          'Set "additionalProperties": false or "unevaluatedProperties": false, ' +
          `or mark it as a mixin by adding "${mixinMarker}" to its description or $comment.`,
          path,
          { actual: 'open object', expected: 'additionalProperties:false or unevaluatedProperties:false' }
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
