/**
 * CycloneDX Schema Linter - Schema Comment Check
 * 
 * Validates that the root $comment property contains the required
 * OWASP CycloneDX standard notice.
 * 
 * @license Apache-2.0
 */

import { LintCheck, registerCheck, Severity } from '../index.js';

/**
 * Required $comment text
 */
const REQUIRED_COMMENT = 'OWASP CycloneDX is an Ecma International standard (ECMA-424) developed in collaboration between the OWASP Foundation and Ecma Technical Committee 54 (TC54). The standard is published under a royalty-free patent policy. This JSON schema is the reference implementation and is licensed under the Apache License 2.0.';

/**
 * Check that validates the $comment property
 */
class SchemaCommentCheck extends LintCheck {
  constructor() {
    super(
      'schema-comment',
      'Schema Comment',
      'Validates that the $comment property contains the required standard notice.',
      Severity.ERROR
    );
  }

  async run(schema, rawContent, config = {}) {
    const issues = [];
    
    const requiredComment = config.requiredComment ?? REQUIRED_COMMENT;
    
    // Check if $comment exists at root level
    if (!('$comment' in schema)) {
      issues.push(this.createIssue(
        'Schema is missing required $comment property.',
        '$.$comment',
        { expected: requiredComment }
      ));
      return issues;
    }
    
    // Check if $comment matches required value
    if (schema.$comment !== requiredComment) {
      issues.push(this.createIssue(
        '$comment does not match the required standard notice.',
        '$.$comment',
        {
          actual: schema.$comment,
          expected: requiredComment
        }
      ));
    }
    
    return issues;
  }
}

// Create and register the check
const check = new SchemaCommentCheck();
registerCheck(check);

export { SchemaCommentCheck, REQUIRED_COMMENT };
export default check;
