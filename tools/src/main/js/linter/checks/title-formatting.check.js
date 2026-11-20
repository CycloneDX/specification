/**
 * CycloneDX Schema Linter - Title Formatting Check
 * 
 * Validates that titles follow consistent formatting conventions:
 * - No ending punctuation
 * - Title case (configurable)
 * - Maximum length
 * - No abbreviations in certain contexts
 * 
 * @license Apache-2.0
 */

import { LintCheck, registerCheck, Severity, traverseSchema } from '../index.js';

/**
 * Common title case exceptions (words that should remain lowercase)
 */
const TITLE_CASE_EXCEPTIONS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor',
  'of', 'on', 'or', 'so', 'the', 'to', 'up', 'yet', 'via'
]);

/**
 * Check that validates title formatting
 */
class TitleFormattingCheck extends LintCheck {
  constructor() {
    super(
      'title-formatting',
      'Title Formatting',
      'Validates that titles follow consistent formatting conventions.',
      Severity.WARNING
    );
  }

  async run(schema, rawContent, config = {}) {
    const issues = [];
    
    const maxLength = config.maxLength ?? 50;
    const requireTitleCase = config.requireTitleCase ?? false;
    const forbidEndingPunctuation = config.forbidEndingPunctuation ?? true;
    const forbiddenEndings = config.forbiddenEndings ?? ['.', ',', ';', ':', '!', '?'];
    
    traverseSchema(schema, (node, path, key, parent) => {
      // Only check 'title' properties
      if (key !== 'title') return;
      
      // Skip non-string titles
      if (typeof node !== 'string') return;
      
      const title = node.trim();
      
      // Skip empty titles
      if (title === '') {
        issues.push(this.createIssue(
          'Title is empty.',
          path,
          {},
          Severity.ERROR
        ));
        return;
      }
      
      // Check length
      if (title.length > maxLength) {
        issues.push(this.createIssue(
          `Title exceeds maximum length of ${maxLength} characters (${title.length} characters).`,
          path,
          {
            length: title.length,
            maxLength,
            title
          }
        ));
      }
      
      // Check ending punctuation
      if (forbidEndingPunctuation) {
        const lastChar = title[title.length - 1];
        if (forbiddenEndings.includes(lastChar)) {
          issues.push(this.createIssue(
            `Title should not end with punctuation "${lastChar}".`,
            path,
            {
              title,
              lastChar,
              suggestion: title.slice(0, -1)
            }
          ));
        }
      }
      
      // Check title case if required
      if (requireTitleCase) {
        const titleCaseIssue = this.checkTitleCase(title, path);
        if (titleCaseIssue) {
          issues.push(titleCaseIssue);
        }
      }
    });
    
    return issues;
  }
  
  /**
   * Check if title follows title case conventions
   */
  checkTitleCase(title, path) {
    const words = title.split(/\s+/);
    const correctedWords = words.map((word, index) => {
      // First word should always be capitalised
      if (index === 0) {
        return this.capitalise(word);
      }
      
      // Check if it's an exception word
      if (TITLE_CASE_EXCEPTIONS.has(word.toLowerCase())) {
        return word.toLowerCase();
      }
      
      // Otherwise, capitalise
      return this.capitalise(word);
    });
    
    const corrected = correctedWords.join(' ');
    
    if (corrected !== title) {
      return this.createIssue(
        `Title case inconsistency. Expected "${corrected}".`,
        path,
        {
          actual: title,
          expected: corrected
        },
        Severity.INFO
      );
    }
    
    return null;
  }
  
  /**
   * Capitalise the first letter of a word
   */
  capitalise(word) {
    if (!word) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  }
}

// Create and register the check
const check = new TitleFormattingCheck();
registerCheck(check);

export { TitleFormattingCheck };
export default check;
