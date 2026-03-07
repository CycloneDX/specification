/**
 * CycloneDX Schema Linter - Description Oxford English Check
 * 
 * Validates that descriptions use Oxford English spelling.
 * Uses aspell with the en_GB-ize dictionary (British English with -ize endings).
 * 
 * @license Apache-2.0
 */

import { LintCheck, registerCheck, Severity, traverseSchema } from '../index.js';
import { spawn } from 'child_process';

/**
 * Technical terms to ignore during spell checking
 */
const TECHNICAL_TERMS = new Set([
  'cyclonedx', 'sbom', 'cbom', 'mbom', 'vex', 'bom', 'purl', 'cpe', 'swid',
  'bomref', 'bomlink', 'attestation', 'attestations', 'assessor', 'assessors',
  'aes', 'rsa', 'ecdsa', 'eddsa', 'sha', 'hmac', 'pqc', 'kyber', 'dilithium',
  'sphincs', 'falcon', 'ntru', 'fips', 'oid', 'pkcs', 'jwt', 'jws', 'jwe',
  'iso', 'ietf', 'rfc', 'owasp', 'spdx', 'cisa', 'ntia', 'wipo',
  'json', 'xml', 'yaml', 'html', 'api', 'url', 'uri', 'urn', 'uuid', 'guid',
  'http', 'https', 'ftp', 'ssh', 'tls', 'ssl', 'utf', 'ascii',
  'ml', 'ai', 'llm', 'nlp', 'cnn', 'rnn', 'onnx',
  'cve', 'cwe', 'cvss', 'epss', 'ssvc'
]);

/**
 * Check that validates descriptions use Oxford English
 */
class DescriptionOxfordEnglishCheck extends LintCheck {
  constructor() {
    super(
      'description-oxford-english',
      'Description Oxford English',
      'Validates that descriptions use Oxford English spelling.',
      Severity.WARNING
    );
    
    this.aspellPath = process.env.ASPELL_PATH || 'aspell';
  }

  async run(schema, rawContent, config = {}) {
    const issues = [];
    
    // Collect all descriptions
    const descriptions = [];
    
    traverseSchema(schema, (node, path, key, parent) => {
      if (key === 'description' && typeof node === 'string') {
        descriptions.push({ text: node, path });
      } else if (key === 'meta:enum' && typeof node === 'object' && node !== null) {
        for (const [enumValue, desc] of Object.entries(node)) {
          if (typeof desc === 'string') {
            descriptions.push({ text: desc, path: `${path}.${enumValue}` });
          }
        }
      }
    });
    
    // Check each description with aspell
    for (const { text, path } of descriptions) {
      const aspellIssues = await this.checkWithAspell(text, path);
      issues.push(...aspellIssues);
    }
    
    return issues;
  }
  
  /**
   * Check text with aspell using Oxford English dictionary
   */
  async checkWithAspell(text, path) {
    const issues = [];
    
    const cleanText = this.cleanTextForSpellCheck(text);
    if (!cleanText.trim()) return issues;
    
    try {
      const misspellings = await this.runAspell(cleanText);
      
      for (const { word, suggestions } of misspellings) {
        const lower = word.toLowerCase();
        
        // Skip technical terms
        if (TECHNICAL_TERMS.has(lower)) continue;
        
        // Skip words that look like technical terms
        if (this.looksLikeTechnicalTerm(word)) continue;
        
        // Skip very short words
        if (word.length < 3) continue;
        
        const suggestionText = suggestions.length > 0
          ? ` Suggestions: ${suggestions.slice(0, 3).join(', ')}`
          : '';
        
        issues.push(this.createIssue(
          `Spelling: "${word}".${suggestionText}`,
          path,
          { word, suggestions: suggestions.slice(0, 5) }
        ));
      }
    } catch (err) {
      issues.push(this.createIssue(
        `Aspell check failed: ${err.message}. Ensure aspell is installed with en_GB-ize dictionary.`,
        path,
        { error: err.message },
        Severity.ERROR
      ));
    }
    
    return issues;
  }
  
  /**
   * Run aspell with Oxford English dictionary (en_GB-ize)
   */
  async runAspell(text) {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.aspellPath, [
        '-a',
        '-d', 'en_GB-ize',
        '--encoding=utf-8'
      ]);
      
      let stdout = '';
      let stderr = '';
      
      proc.stdout.on('data', (data) => { stdout += data; });
      proc.stderr.on('data', (data) => { stderr += data; });
      
      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn aspell: ${err.message}`));
      });
      
      proc.on('close', (code) => {
        if (code !== 0 && stderr) {
          reject(new Error(stderr.trim()));
          return;
        }
        
        const misspellings = [];
        const lines = stdout.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('&')) {
            const match = line.match(/^& (\S+) \d+ \d+: (.*)$/);
            if (match) {
              misspellings.push({
                word: match[1],
                suggestions: match[2].split(', ').map(s => s.trim())
              });
            }
          } else if (line.startsWith('#')) {
            const match = line.match(/^# (\S+)/);
            if (match) {
              misspellings.push({ word: match[1], suggestions: [] });
            }
          }
        }
        
        resolve(misspellings);
      });
      
      proc.stdin.write(text);
      proc.stdin.end();
    });
  }
  
  /**
   * Clean text for spell checking
   */
  cleanTextForSpellCheck(text) {
    return text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Markdown links
      .replace(/`[^`]+`/g, ' ')                  // Inline code
      .replace(/```[\s\S]*?```/g, ' ')           // Code blocks
      .replace(/https?:\/\/\S+/g, ' ')           // URLs
      .replace(/[<>]/g, ' ')                     // XML/HTML tags
      .replace(/\b[A-Z_]{2,}\b/g, ' ')           // Acronyms
      .replace(/\b\d+\b/g, ' ')                  // Numbers
      .replace(/[^\w\s'-]/g, ' ');               // Non-word characters
  }
  
  /**
   * Check if a word looks like a technical term
   */
  looksLikeTechnicalTerm(word) {
    if (/^[a-z]+[A-Z]/.test(word)) return true;           // camelCase
    if (/\d/.test(word)) return true;                      // Contains numbers
    if (word === word.toUpperCase() && word.length > 1) return true;  // ACRONYM
    if (/^(get|set|is|has|can|on|pre|post|un|re)[A-Z]/.test(word)) return true;
    return false;
  }
}

// Create and register the check
const check = new DescriptionOxfordEnglishCheck();
registerCheck(check);

export { DescriptionOxfordEnglishCheck };
export default check;
