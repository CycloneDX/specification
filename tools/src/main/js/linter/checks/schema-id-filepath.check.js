/**
 * CycloneDX Schema Linter - Schema ID FilePath Check
 *
 * Validates that the $id property matches
 * the expected file path.
 *
 * @license Apache-2.0
 */

import path from 'path'

import { LintCheck, registerCheck, Severity } from '../index.js';


/**
 * Default pattern for CycloneDX schema IDs' file path
 *
 * Valid patterns:
 *   https://cyclonedx.org/schema/bom-1.7.schema.json
 *   https://cyclonedx.org/schema/2.0/cyclonedx-2.0.schema.json
 *   https://cyclonedx.org/schema/2.0/model/cyclonedx-cryptography-2.0.schema.json
 *
 * Pattern breakdown:
 *   - Base URL: https://cyclonedx.org/schema/
 *   - Optional version path: any
 *   - Optional subdirectory: any
 *   - Schema name: any
 *   - Extension: .schema.json
 */
const DEFAULT_PATTERN = '^https://cyclonedx\\.org(/schema/.+\\.schema\\.json)$';

/**
 * Check that validates schema $id follows expected pattern
 */
class SchemaIdFilepathCheck extends LintCheck {
  constructor() {
    super(
      'schema-id-filepath',
      'Schema ID FilePath',
      'Validates that the $id property matches the expected file path.',
      Severity.ERROR
    );
  }

  async run(schema, rawContent, config = {}, filePath=null) {
    if (!filePath) {
      console.log('foo')
      throw new Error('Missing argument `filePath`')
    }

    const issues = [];
    const pattern = new RegExp(config.pattern || DEFAULT_PATTERN);

    // Check root $id
    if (!schema.$id) {
      issues.push(this.createIssue(
        'Schema is missing required $id property.',
        '$.$id',
        { expected: 'A valid schema ID matching the pattern' }
      ));
      return issues;
    }

    const schemaMatch = schema.$id.match(pattern)
    if (schemaMatch === null) {
      issues.push(this.createIssue(
        `Schema $id does not match expected pattern. Got: "${schema.$id}"`,
        '$.$id',
        {
          actual: schema.$id,
          expectedPattern: pattern.toString()
        }
      ));
    } else {
      const expectedFilePathEnd = schemaMatch[1].replaceAll('/', path.sep)
      if (!filePath.endsWith(expectedFilePathEnd)) {
        issues.push(this.createIssue(
          `Schema file path does not end with "${expectedFilePathEnd}".`,
          '$.$id',
          { actual: filePath, expectedFilePathEnd }
        ));
      }
    }

    return issues;
  }
}

// Create and register the check
const check = new SchemaIdFilepathCheck();
registerCheck(check);

export { SchemaIdFilepathCheck };
export default check;
