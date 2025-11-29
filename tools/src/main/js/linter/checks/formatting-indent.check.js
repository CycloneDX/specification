/**
 * CycloneDX Schema Linter - Formatting and Indentation Check
 * 
 * Validates that JSON schemas follow consistent formatting rules:
 * - Correct indentation based on nesting level
 * - No trailing whitespace
 * - Consistent line endings
 * - Final newline
 * 
 * @license Apache-2.0
 */

import { LintCheck, registerCheck, Severity } from '../index.js';

/**
 * Check that validates schema formatting
 */
class FormattingIndentCheck extends LintCheck {
  constructor() {
    super(
      'formatting-indent',
      'Formatting and Indentation',
      'Validates consistent formatting including indentation, whitespace, and line endings.',
      Severity.ERROR
    );
  }

  async run(schema, rawContent, config = {}) {
    const issues = [];
    
    const spaces = config.spaces ?? 2;
    const requireFinalNewline = config.requireFinalNewline ?? true;
    const allowTrailingWhitespace = config.allowTrailingWhitespace ?? false;
    const lineEnding = config.lineEnding ?? 'lf'; // lf or crlf
    
    const lines = rawContent.split(/\r?\n/);
    
    // Check final newline
    if (requireFinalNewline && !rawContent.endsWith('\n')) {
      issues.push(this.createIssue(
        'File shall end with a newline character.',
        '$',
        { line: lines.length }
      ));
    }
    
    // Check line endings consistency
    const hasCRLF = rawContent.includes('\r\n');
    const hasLF = /[^\r]\n/.test(rawContent) || rawContent.startsWith('\n');
    
    if (lineEnding === 'lf' && hasCRLF) {
      issues.push(this.createIssue(
        'File contains CRLF line endings. Expected LF only.',
        '$',
        { expected: 'LF', actual: 'CRLF' }
      ));
    } else if (lineEnding === 'crlf' && hasLF && !hasCRLF) {
      issues.push(this.createIssue(
        'File contains LF line endings. Expected CRLF.',
        '$',
        { expected: 'CRLF', actual: 'LF' }
      ));
    }
    
    // Check trailing whitespace
    if (!allowTrailingWhitespace) {
      lines.forEach((line, index) => {
        if (/[ \t]+$/.test(line)) {
          issues.push(this.createIssue(
            `Line ${index + 1} has trailing whitespace.`,
            '$',
            { line: index + 1 },
            Severity.WARNING
          ));
        }
      });
    }
    
    // Check for tabs
    lines.forEach((line, index) => {
      if (/^\t/.test(line)) {
        issues.push(this.createIssue(
          `Line ${index + 1} uses tabs for indentation. Use ${spaces} spaces instead.`,
          '$',
          { line: index + 1 }
        ));
      }
    });
    
    // Generate canonical formatting and compare line by line
    try {
      const canonical = JSON.stringify(schema, null, spaces);
      const canonicalLines = canonical.split('\n');
      
      // Normalise input lines (remove \r)
      const normalisedLines = rawContent.replace(/\r\n/g, '\n').split('\n');
      
      // Remove trailing empty line from normalised if it exists (final newline)
      if (normalisedLines[normalisedLines.length - 1] === '') {
        normalisedLines.pop();
      }
      
      // Compare line by line
      const maxLines = Math.max(canonicalLines.length, normalisedLines.length);
      
      for (let i = 0; i < maxLines; i++) {
        const expected = canonicalLines[i];
        const actual = normalisedLines[i];
        
        // Handle missing lines
        if (expected === undefined) {
          issues.push(this.createIssue(
            `Line ${i + 1} is unexpected. File has more lines than expected.`,
            '$',
            { line: i + 1, actual: this.truncate(actual, 50) }
          ));
          continue;
        }
        
        if (actual === undefined) {
          issues.push(this.createIssue(
            `Line ${i + 1} is missing. Expected: "${this.truncate(expected, 50)}"`,
            '$',
            { line: i + 1, expected: this.truncate(expected, 50) }
          ));
          continue;
        }
        
        // Compare indentation
        const expectedIndent = this.getLeadingSpaces(expected);
        const actualIndent = this.getLeadingSpaces(actual);
        
        if (expectedIndent !== actualIndent) {
          issues.push(this.createIssue(
            `Line ${i + 1} has incorrect indentation. Expected ${expectedIndent} spaces, found ${actualIndent}.`,
            '$',
            { 
              line: i + 1, 
              expectedIndent, 
              actualIndent,
              content: this.truncate(actual.trim(), 40)
            }
          ));
          continue;
        }
        
        // Compare content (after trimming to focus on structure)
        const expectedTrimmed = expected.trim();
        const actualTrimmed = actual.trim();
        
        if (expectedTrimmed !== actualTrimmed) {
          // Check if it's a key ordering difference
          if (this.isKeyOrderDifference(expectedTrimmed, actualTrimmed)) {
            issues.push(this.createIssue(
              `Line ${i + 1} has different key ordering than canonical format.`,
              '$',
              { 
                line: i + 1, 
                expected: this.truncate(expectedTrimmed, 50),
                actual: this.truncate(actualTrimmed, 50)
              },
              Severity.INFO
            ));
          } else {
            issues.push(this.createIssue(
              `Line ${i + 1} content differs from canonical format.`,
              '$',
              { 
                line: i + 1, 
                expected: this.truncate(expectedTrimmed, 50),
                actual: this.truncate(actualTrimmed, 50)
              },
              Severity.WARNING
            ));
          }
        }
      }
      
    } catch (err) {
      // JSON parsing errors are handled elsewhere
    }
    
    return issues;
  }
  
  /**
   * Get the number of leading spaces in a string
   */
  getLeadingSpaces(str) {
    const match = str.match(/^( *)/);
    return match ? match[1].length : 0;
  }
  
  /**
   * Truncate a string for display
   */
  truncate(str, maxLength) {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
  }
  
  /**
   * Check if difference is likely due to key ordering
   */
  isKeyOrderDifference(expected, actual) {
    // Both are object keys
    const keyPattern = /^"[^"]+"\s*:/;
    return keyPattern.test(expected) && keyPattern.test(actual);
  }
}

// Create and register the check
const check = new FormattingIndentCheck();
registerCheck(check);

export { FormattingIndentCheck };
export default check;
