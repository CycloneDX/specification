/**
 * CycloneDX Schema Linter - $ref Best Practice Check
 *
 * Validates that `$ref` usage follows JSON Schema best practice:
 * - `$ref` value is a string
 * - no absolute `$ref` paths
 * - same-file `$ref` starts with "#"
 * - only documentational siblings are allowed alongside `$ref`
 *
 * @license Apache-2.0
 */

import { dirname, join, resolve } from 'path';

import { LintCheck, registerCheck, Severity, traverseSchema } from '../index.js';

/**
 * Keys allowed as siblings of `$ref`.
 */
const REF_ALLOWED_SIBLINGS = Object.freeze(new Set([
  '$ref', // the $ref itself
  '$comment', 'title', 'description', 'examples', // documentational
  /* do NOT add any non-documentationals
     instead, use:
     { "allOf": { "$ref": ... }, "$id" ..., "$anchor": ... }
     { "allOf": { "$ref": ... }, "default" ... }
     instead of additionalProperties -- { "allOf": { "$ref": ... }, "unevaluatedItems" ... }
   */
]));

/**
 * Keys whose values aren't schemas - their entire subtrees are pruned
 */
const SKIP_KEYS = Object.freeze(new Set([
  'enum', 'const', 'default', // values
  'examples', 'meta:enum', // documentational
]));

/**
 * Build a predicate that tells whether a `$ref` file-part points to the current schema itself.
 * Prefers the actual file path; falls back to the root schema's `$id` URL.
 *
 * @param {Readonly<*>} schema - the root schema
 * @param {string|null} filePath
 * @return {(function(string): boolean)|null} predicate, or null if no base is determinable
 */
function makeSameFileTest(schema, filePath) {
  if (filePath !== null) {
    // filesystem semantics
    const baseDir = dirname(filePath);
    return filePart => resolve(baseDir, filePart) === filePath;
  }
  const id = schema?.['$id'];
  if (typeof id === 'string' && URL.canParse(id)) {
    // URL semantics: resolve the ref against the $id and compare
    return filePart => {
      try {
        return new URL(filePart, id).href === new URL(id).href;
      } catch {
        return false;
      }
    };
  }
  return null; // no base known - skip the same-file rule
}

/**
 * Check that validates `$ref` best practice.
 */
class RefBestPracticeCheck extends LintCheck {
  constructor() {
    super(
      'ref-best-practice',
      '$ref Best Practice',
      'Validates that $ref usage follows JSON Schema best practice.',
      Severity.ERROR
    );
  }

  async run(schema, rawContent, config = {}, filePath = null) {
    const issues = [];

    const isSameFile = makeSameFileTest(schema, filePath);

    traverseSchema(schema, (node, path, key) => {
      if (typeof key === 'string' && SKIP_KEYS.has(key)) {
        // don't descend into keys whose values aren't schemas
        return false;
      }

      if (node === null || typeof node !== 'object' || Array.isArray(node)) return;
      if (!('$ref' in node)) return;

      const ref = node['$ref'];

      if (typeof ref !== 'string') {
        issues.push(this.createIssue(
          'Unexpected type of $ref.',
          `${path}.$ref`,
          { actual: typeof ref, expected: 'string' }
        ));
        return;
      }

      if (ref.startsWith('/')) {
        issues.push(this.createIssue(
          'Absolute $ref is not allowed.',
          `${path}.$ref`,
          { actual: ref, expected: 'a relative reference' }
        ));
      } else if (isSameFile !== null) {
        const hashPos = ref.indexOf('#');
        const filePart = hashPos === -1
          ? ref
          : ref.slice(0, hashPos);
        if (filePart !== '' && isSameFile(filePart)) {
          const fragment = hashPos === -1
            ? '#'
            : ref.slice(hashPos);
          issues.push(this.createIssue(
            'Same-file $ref must start with "#".',
            `${path}.$ref`,
            { actual: ref, expected: fragment }
          ));
        }
      }

      for (const siblingKey of Object.keys(node)) {
        if (!REF_ALLOWED_SIBLINGS.has(siblingKey)) {
          issues.push(this.createIssue(
            'Unexpected key along with $ref. Wrap the $ref in an "allOf" instead.',
            `${path}.${siblingKey}`,
            { actual: 'present', expected: 'absent' }
          ));
        }
      }
    });

    return issues;
  }
}

// Create and register the check
const check = new RefBestPracticeCheck();
registerCheck(check);

export { RefBestPracticeCheck };
export default check;
