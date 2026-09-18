/**
 * CycloneDX Schema Linter - RefIdType Usage Check
 *
 * CycloneDX2-specific: validates that every `refId` property `$ref`s the
 * shared `refIdType` definition — and that nothing else references `refIdType`
 * (with the sole exception of `refLinkType`, which inherits from it).
 *
 * This check targets the CycloneDX 2.x modular schema space:
 *   schema/<version>/cyclonedx-<version>.schema.json
 *   schema/<version>/model/cyclonedx-common-<version>.schema.json
 *   schema/<version>/model/*.schema.json
 *
 * The expected relative `$ref` values are derived from the linted file's
 * path when available (walking relative from it on the filesystem);
 * otherwise they are derived from the schema's `$id`.
 *
 * Note on path separators: filesystem paths use the platform-specific
 * separator (`\` on Windows, `/` on POSIX — on Windows both may appear),
 * but `$ref` values are URI references and always use `/`.
 * Therefore all incoming paths are normalized for comparison, and all
 * emitted `$ref` values are converted to `/`-separated form.
 *
 * @license Apache-2.0
 */

import { basename, dirname, join, normalize, relative, sep } from 'path';

import { LintCheck, registerCheck, Severity, traverseSchema } from '../index.js';

/** Default JSON pointer to the `refIdType` definition. */
const DEFAULT_REF_ID_TYPE_POINTER = '#/$defs/refIdType';

/** Default JSON pointer to the `refLinkType` definition. */
const DEFAULT_REF_LINK_TYPE_POINTER = '#/$defs/refLinkType';

/**
 * Default `$id` of the refIdType-defining schema.
 * `{version}` is replaced by the version derived from the linted schema's `$id`.
 */
const DEFAULT_REF_ID_TYPE_SCHEMA_ID = 'https://cyclonedx.org/schema/{version}/model/cyclonedx-common-{version}.schema.json';

/**
 * Default file name of the refIdType-defining schema.
 * `{version}` is replaced by the version derived from the linted file's name.
 */
const DEFAULT_REF_ID_TYPE_FILE_NAME = 'cyclonedx-common-{version}.schema.json';

/** Default path prefix (in the defining schema) that is allowed to reference `refIdType`. */
const DEFAULT_EXCEPTION_PATH = '$.$defs.refLinkType';

/** Matches `-<version>` right before `.schema.json`. */
const VERSION_RE = /-(\d+\.\d+)\.schema\.json$/;

/**
 * Convert a platform-specific filesystem path to a `/`-separated URI-style path.
 * `path.sep` is `\` on Windows and `/` on POSIX; `$ref` values always use `/`.
 * @param {string} p - a path produced by the platform's `path` module
 * @returns {string}
 */
function toUriPath(p) {
  return sep === '/'
    ? p
    : p.split(sep).join('/');
}

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
 * CycloneDX2-specific: Check that `refId` properties ref the `refIdType` — and nothing else does.
 */
class Cdx2RefIdTypeUsageCheck extends LintCheck {
  constructor() {
    super(
      'cdx2-reftype-usage',
      'RefIdType Usage',
      'CycloneDX2-specific: validates that `refId` properties `$ref` the shared `refIdType` definition, and that `refIdType` is not referenced anywhere else (except `refLinkType`).',
      Severity.ERROR
    );
  }

  async run(schema, rawContent, config = {}, filePath = null) {
    const issues = [];

    const refIdTypePointer = config.refIdTypePointer || DEFAULT_REF_ID_TYPE_POINTER;
    const refLinkTypePointer = config.refLinkTypePointer || DEFAULT_REF_LINK_TYPE_POINTER;
    const exceptionPath = config.exceptionPath || DEFAULT_EXCEPTION_PATH;

    const [refBase, isDefiningSchema] = filePath
      ? this.#refBaseFromFilePath(filePath, config)
      : this.#refBaseFromSchemaId(schema, config);
    const [refIdTypeRef, refLinkTypeRef] = refBase === null
      ? [null, null]
      : [refIdTypePointer, refLinkTypePointer].map(p => refBase + p);

    traverseSchema(schema, (node, path) => {
      if (node === null || typeof node !== 'object' || Array.isArray(node)) {
        return;
      }
      const ref = node.$ref;
      if (typeof ref !== 'string') {
        return;
      }

      if (path.endsWith('.properties.refId')) {
        if (refIdTypeRef !== null && ref !== refIdTypeRef) {
          issues.push(this.createIssue(
            `"refId" property must $ref refIdType. Got: "${ref}" instead of "${refIdTypeRef}"`,
            `${path}.$ref`,
            {
              actual: ref,
              expected: refIdTypeRef,
              suggestion: refIdTypeRef
            }
          ));
        }
        return;
      }

      if (refIdTypeRef !== null && ref === refIdTypeRef) {
        if (isDefiningSchema && path.startsWith(exceptionPath)) {
          return; // refLinkType is allowed to inherit from refIdType
        }
        issues.push(this.createIssue(
          `Wrong use of refIdType — did you mean "${refLinkTypeRef}"?`,
          `${path}.$ref`,
          {
            actual: ref,
            expected: `different from: ${refIdTypeRef}`,
            suggestion: refLinkTypeRef
          }
        ));
      }
    });

    return issues;
  }

  /**
   * Compute the expected `$ref` prefix (relative, `/`-separated, without JSON
   * pointer) to the refIdType-defining schema, by walking relative from `filePath`.
   *
   * `normalize()` is applied to all incoming paths so that mixed separators
   * (possible on Windows, where both `\` and `/` are valid) compare correctly.
   * The `path` module is platform-aware, so `relative()`/`join()` handle the
   * platform separator; the result is converted to `/`-separated URI form.
   *
   * @param {string} filePath
   * @param {object} config
   * @returns {[string|null, boolean]} the `$ref` prefix (empty string for
   *   same-document references, or `null` if undeterminable) and whether this
   *   file is the refIdType-defining schema itself
   */
  #refBaseFromFilePath(filePath, config) {
    filePath = normalize(filePath);

    // Explicit configuration of the defining file's path takes precedence.
    let refIdTypeFilePath = config.refIdTypeFilePath
      ? normalize(config.refIdTypeFilePath)
      : null;
    if (!refIdTypeFilePath) {
      // Derive from repository layout:
      //   schema/<version>/cyclonedx-<version>.schema.json
      //   schema/<version>/model/cyclonedx-common-<version>.schema.json
      //   schema/<version>/model/*.schema.json
      const fileName = basename(filePath);
      const version = fileName.match(VERSION_RE)?.[1];
      if (version === undefined) {
        return [null, false]; // cannot determine — skip $ref value comparisons
      }
      const commonFileName = DEFAULT_REF_ID_TYPE_FILE_NAME.replaceAll('{version}', version);
      const dir = dirname(filePath);
      refIdTypeFilePath = basename(dir) === 'model'
        ? join(dir, commonFileName)
        : join(dir, 'model', commonFileName);
    }

    if (filePath === refIdTypeFilePath) {
      return ['', true]; // same-document reference
    }

    return [
      toUriPath(relative(dirname(filePath), refIdTypeFilePath)),
      false
    ];
  }

  /**
   * Compute the expected `$ref` prefix (relative URL, without JSON pointer)
   * to the refIdType-defining schema, based on the schema's `$id`.
   *
   * `$id` values are URIs — always `/`-separated — so no platform-specific
   * path handling is involved here.
   *
   * @param {*} schema
   * @param {object} config
   * @returns {[string|null, boolean]} the `$ref` prefix (empty string for
   *   same-document references, or `null` if undeterminable) and whether this
   *   schema is the refIdType-defining schema itself
   */
  #refBaseFromSchemaId(schema, config) {
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
    let refIdTypeSchemaId = config.refIdTypeSchemaId;
    if (!refIdTypeSchemaId) {
      const version = schemaUrl.pathname.match(VERSION_RE)?.[1];
      if (version === undefined) {
        return [null, false];
      }
      refIdTypeSchemaId = DEFAULT_REF_ID_TYPE_SCHEMA_ID.replaceAll('{version}', version);
    }

    if (schemaId === refIdTypeSchemaId) {
      return ['', true]; // same-document reference
    }

    const rel = relativeUrl(schemaUrl, new URL(refIdTypeSchemaId));
    return [rel, false];
  }
}

// Create and register the check
const check = new Cdx2RefIdTypeUsageCheck();
registerCheck(check);

export { Cdx2RefIdTypeUsageCheck };
export default check;
