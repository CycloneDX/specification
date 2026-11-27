/**
 * CycloneDX Schema Linter - Formatting and Indentation Check
 * 
 * Validates that JSON schemas follow consistent formatting rules:
 * - Correct indentation based on nesting level (2 spaces per level)
 * - No tabs
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
    const lineEnding = config.lineEnding ?? 'lf';
    
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
    
    // Track nesting depth
    let depth = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const trimmed = line.trim();
      
      // Skip empty lines
      if (trimmed === '') continue;
      
      // Check trailing whitespace
      if (!allowTrailingWhitespace && /[ \t]+$/.test(line)) {
        issues.push(this.createIssue(
          `Line ${lineNum} has trailing whitespace.`,
          '$',
          { line: lineNum },
          Severity.WARNING
        ));
      }
      
      // Check for tabs in indentation
      if (/^\t+/.test(line)) {
        issues.push(this.createIssue(
          `Line ${lineNum} uses tabs for indentation. Use ${spaces} spaces instead.`,
          '$',
          { line: lineNum }
        ));
        // Still update depth tracking
        depth += this.getDepthChange(trimmed);
        continue;
      }
      
      // Count openers/closers outside of strings for this line
      const { openersBeforeContent, closersAtStart, netChange } = this.analyzeLineStructure(trimmed);
      
      // If line starts with closer, decrease depth for this line
      if (closersAtStart > 0) {
        depth = Math.max(0, depth - closersAtStart);
      }
      
      // Validate indentation
      const actualIndent = this.getLeadingSpaces(line);
      const expectedIndent = depth * spaces;
      
      if (actualIndent !== expectedIndent) {
        issues.push(this.createIssue(
          `Line ${lineNum} has incorrect indentation. Expected ${expectedIndent} spaces, found ${actualIndent}.`,
          '$',
          { 
            line: lineNum, 
            expectedIndent, 
            actualIndent,
            content: this.truncate(trimmed, 40)
          }
        ));
      }
      
      // Update depth for next line based on net openers (excluding leading closers already handled)
      depth += netChange + closersAtStart; // Add back closersAtStart since netChange includes them
      depth = Math.max(0, depth);
    }
    
    return issues;
  }
  
  /**
   * Analyze line structure for bracket counting
   * Returns closers at start, and net depth change
   */
  analyzeLineStructure(trimmed) {
    let closersAtStart = 0;
    let inString = false;
    let escapeNext = false;
    let openers = 0;
    let closers = 0;
    let foundNonBracket = false;
    
    for (let i = 0; i < trimmed.length; i++) {
      const char = trimmed[i];
      
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (char === '\\' && inString) {
        escapeNext = true;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
        foundNonBracket = true;
        continue;
      }
      
      if (inString) continue;
      
      if (char === '{' || char === '[') {
        openers++;
        foundNonBracket = true;
      } else if (char === '}' || char === ']') {
        closers++;
        // Count closers at start (before any non-bracket content)
        if (!foundNonBracket) {
          closersAtStart++;
        }
      } else if (!/\s/.test(char)) {
        foundNonBracket = true;
      }
    }
    
    return {
      openersBeforeContent: openers,
      closersAtStart,
      netChange: openers - closers
    };
  }
  
  /**
   * Get simple depth change (openers - closers) for a line
   */
  getDepthChange(trimmed) {
    let inString = false;
    let escapeNext = false;
    let change = 0;
    
    for (const char of trimmed) {
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (char === '\\' && inString) {
        escapeNext = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      
      if (char === '{' || char === '[') change++;
      else if (char === '}' || char === ']') change--;
    }
    
    return change;
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
}

// Create and register the check
const check = new FormattingIndentCheck();
registerCheck(check);

export { FormattingIndentCheck };
export default check;
