/**
 * CycloneDX Schema Linter - RefType Usage Check
 *
 * CycloneDX-specific: validates that every `bom-ref` property `$ref`s the
 * shared `refType` definition — and that nothing else references `refType`
 * (with the sole exception of `refLinkType`, which inherits from it).
 *
 * The refType-defining schema and the expected relative `$ref` values are
 * derived from the schema's `$id` — no file paths involved.
 *
 * @license Apache-2.0
 */

import { LintCheck, registerCheck, Severity, traverseSchema } from '../index.js';

/** Default JSON pointer to the `refType` definition. */
const DEFAULT_REF_TYPE_POINTER = '#/$defs/refType';

/** Default JSON pointer to the `refLinkType` definition. */
const DEFAULT_REF_LINK_TYPE_POINTER = '#/$defs/refLinkType';

/**
 * Default `$id` of the refType-defining schema.
 * `{version}` is replaced by the version derived from the linted schema's `$id`.
 */
const DEFAULT_REF_TYPE_SCHEMA_ID = 'https://cyclonedx.org/schema/{version}/model/cyclonedx-common-{version}.schema.json';

/** Default path prefix (in the defining schema) that is allowed to reference `refType`. */
const DEFAULT_EXCEPTION_PATH = '$.$defs.refLinkType';

/**
 * Compute a relative URL from `from` to `to` (both absolute URLs with a common origin).
 * @param {URL} from
 * @param {URL} to
 * @returns {string|null} relative reference, or `null` if origins differ
 */
function relativeUrl(from, to) {
  if (from.origin !== to.origin) {
    return null;
  }
  const fromParts = from.pathname.split('/');
  const toParts = to.pathname.split('/');
  fromParts.pop(); // drop the file segment; keep directory only
  const toFile = toParts.pop();
  // strip common leading directory segments
  while (fromParts.length > 0 && toParts.length > 0 && fromParts[0] === toParts[0]) {
    fromParts.shift();
    toParts.shift();
  }
  return [...fromParts.map(() => '..'), ...toParts, toFile].join('/');
}

/**
 * Check that `bom-ref` properties `$ref` refType — and nothing else does.
 */
class RefTypeUsageCheck extends LintCheck {
  constructor() {
    super(
      'cdx-ref-type-usage',
      'RefType Usage',
      'CycloneDX-specific: validates that `bom-ref` properties `$ref` the shared refType definition, and that refType is not referenced anywhere else (except refLinkType).',
      Severity.ERROR
    );
  }

  async run(schema, rawContent, config = {}) {
    const issues = [];

    const refTypePointer = config.refTypePointer || DEFAULT_REF_TYPE_POINTER;
    const refLinkTypePointer = config.refLinkTypePointer || DEFAULT_REF_LINK_TYPE_POINTER;
    const exceptionPath = config.exceptionPath || DEFAULT_EXCEPTION_PATH;

    const [refBase, isDefiningSchema] = this.#refBaseFor(schema, config);
    const [refTypeRef, refLinkTypeRef] = refBase === null
      ? [null, null]
      : [refTypePointer, refLinkTypePointer].map(p => refBase + p);

    traverseSchema(schema, (node, path) => {
      if (node === null || typeof node !== 'object' || Array.isArray(node)) {
        return;
      }
      const ref = node.$ref;
      if (typeof ref !== 'string') {
        return;
      }

      if (path.endsWith('.properties.bom-ref')) {
        if (refTypeRef !== null && ref !== refTypeRef) {
          issues.push(this.createIssue(
            `"bom-ref" property must $ref refType. Got: "${ref}" instead of "${refTypeRef}"`,
            `${path}.$ref`,
            {
              actual: ref,
              expected: refTypeRef,
              suggestion: refTypeRef
            }
          ));
        }
        return;
      }

      if (refTypeRef !== null && ref === refTypeRef) {
        if (isDefiningSchema && path.startsWith(exceptionPath)) {
          return; // refLinkType is allowed to inherit from refType
        }
        issues.push(this.createIssue(
          `Wrong use of refType — did you mean "${refLinkTypeRef}"?`,
          `${path}.$ref`,
          {
            actual: ref,
            expected: `different from: ${refTypeRef}`,
            suggestion: refLinkTypeRef
          }
        ));
      }
    });

    return issues;
  }

  /**
   * Compute the expected `$ref` prefix (relative URL, without JSON pointer)
   * to the refType-defining schema, based on `$id`.
   *
   * @param {*} schema
   * @param {object} config
   * @returns {[string|null, boolean]} the `$ref` prefix (empty string for
   *   same-document references, or `null` if undeterminable) and whether this
   *   schema is the refType-defining schema itself
   */
  #refBaseFor(schema, config) {
    const schemaId = schema.$id;
    if (typeof schemaId !== 'string') {
      return [null, false]; // no $id — other checks report that; skip comparisons here
    }

    let schemaUrl;
    try {
      schemaUrl = new URL(schemaId);
    } catch {
      return [null, false];
    }

    // Determine the defining schema's $id.
    let refTypeSchemaId = config.refTypeSchemaId;
    if (!refTypeSchemaId) {
      const versionMatch = schemaUrl.pathname.match(/-(\d[^-/]*)\.schema\.json$/);
      if (versionMatch === null) {
        return [null, false];
      }
      refTypeSchemaId = DEFAULT_REF_TYPE_SCHEMA_ID.replaceAll('{version}', versionMatch[1]);
    }

    if (schemaId === refTypeSchemaId) {
      return ['', true]; // same-document reference
    }

    const rel = relativeUrl(schemaUrl, new URL(refTypeSchemaId));
    return [rel, false];
  }
}

// Create and register the check
const check = new RefTypeUsageCheck();
registerCheck(check);

export { RefTypeUsageCheck };
export default check;
