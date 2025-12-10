/**
 * CycloneDX Schema Linter - Property Name American English Check
 * 
 * Validates that property names use correct American English spelling.
 * Splits identifiers (camelCase, PascalCase, snake_case, kebab-case)
 * into words and checks each against aspell with the en_US dictionary.
 * 
 * Reports:
 * - British spellings (with American suggestion)
 * - General misspellings (with aspell suggestions)
 * 
 * @license Apache-2.0
 */

import { LintCheck, registerCheck, Severity, traverseSchema } from '../index.js';
import { spawn } from 'child_process';

/**
 * JSON Schema keywords to skip
 */
const SCHEMA_KEYWORDS = new Set([
  '$schema', '$id', '$ref', '$defs', '$comment', '$anchor',
  'type', 'title', 'description', 'default', 'enum', 'const',
  'properties', 'additionalProperties', 'patternProperties',
  'items', 'additionalItems', 'contains',
  'required', 'dependencies', 'dependentRequired', 'dependentSchemas',
  'allOf', 'anyOf', 'oneOf', 'not', 'if', 'then', 'else',
  'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum',
  'minLength', 'maxLength', 'pattern', 'format',
  'minItems', 'maxItems', 'uniqueItems',
  'minProperties', 'maxProperties',
  'examples', 'definitions', 'meta:enum',
  'contentMediaType', 'contentEncoding',
  'unevaluatedProperties', 'unevaluatedItems',
  'prefixItems', 'contentSchema'
]);

/**
 * Technical terms and abbreviations to ignore
 */
const TECHNICAL_TERMS = new Set([
  'bom', 'sbom', 'cbom', 'mbom', 'vex', 'purl', 'cpe', 'swid', 'spdx',
  'ref', 'refs', 'url', 'urls', 'uri', 'uris', 'urn', 'urns',
  'uuid', 'guid', 'id', 'ids', 'api', 'apis',
  'json', 'xml', 'html', 'css', 'http', 'https', 'ftp', 'ssh',
  'sha', 'md5', 'aes', 'rsa', 'hmac', 'jwt', 'jws',
  'cpu', 'gpu', 'ram', 'rom', 'io', 'os',
  'ai', 'ml', 'llm', 'nlp', 'pqc',
  'iso', 'iec', 'ieee', 'ietf', 'rfc', 'owasp', 'nist', 'cisa',
  'cve', 'cwe', 'cvss', 'epss',
  'oid', 'oids', 'pem', 'der', 'pkcs',
  'ecc', 'ecdsa', 'ecdh', 'eddsa', 'dsa', 'dh',
  'tls', 'ssl', 'mtls', 'oauth', 'oidc', 'saml',
  'utf', 'ascii', 'unicode', 'base64',
  'cicd', 'devops', 'devsecops', 'mlops'
]);

/**
 * Check that validates property names use correct American English
 */
class PropertyNameAmericanEnglishCheck extends LintCheck {
  constructor() {
    super(
      'property-name-american-english',
      'Property Name American English',
      'Validates that property names use correct American English spelling.',
      Severity.ERROR
    );
    
    this.aspellPath = process.env.ASPELL_PATH || 'aspell';
  }

  async run(schema, rawContent, config = {}) {
    const issues = [];
    
    // Properties to ignore
    const ignoreProperties = new Set(config.ignoreProperties || []);
    
    // Custom technical terms to ignore
    const customTerms = new Set(config.customTerms || []);
    const allTerms = new Set([...TECHNICAL_TERMS, ...customTerms]);
    
    // Collect all property names to check
    const propertiesToCheck = [];
    
    traverseSchema(schema, (node, path, key, parent) => {
      // Only check string keys that aren't schema keywords
      if (typeof key !== 'string') return;
      if (SCHEMA_KEYWORDS.has(key)) return;
      if (ignoreProperties.has(key)) return;
      
      // Skip array indices
      if (/^\d+$/.test(key)) return;
      
      propertiesToCheck.push({ key, path });
    });
    
    // Check each property name
    for (const { key, path } of propertiesToCheck) {
      const words = this.splitIdentifier(key);
      
      for (const word of words) {
        // Skip short words, numbers, and technical terms
        if (word.length < 2) continue;
        if (/^\d+$/.test(word)) continue;
        if (allTerms.has(word.toLowerCase())) continue;
        
        // First, check if it's a known British spelling pattern
        const britishDetection = this.detectBritishSpelling(word);
        
        if (britishDetection.isBritish) {
          issues.push(this.createIssue(
            `Property name "${key}" contains British spelling "${word}". ` +
            `Use American spelling "${britishDetection.americanVariant}".`,
            path,
            {
              property: key,
              word,
              suggestion: britishDetection.americanVariant,
              type: 'british-spelling'
            }
          ));
          continue;
        }
        
        // Check with aspell for any spelling errors
        const result = await this.checkWordWithAspell(word);
        
        if (result.misspelled) {
          const suggestions = result.suggestions.slice(0, 3);
          const suggestionText = suggestions.length > 0
            ? ` Suggestions: ${suggestions.join(', ')}.`
            : '';
          
          issues.push(this.createIssue(
            `Property name "${key}" contains misspelled word "${word}".${suggestionText}`,
            path,
            {
              property: key,
              word,
              suggestions,
              type: 'misspelling'
            }
          ));
        }
      }
    }
    
    return issues;
  }
  
  /**
   * Split an identifier into words
   * Handles camelCase, PascalCase, snake_case, kebab-case, and SCREAMING_CASE
   */
  splitIdentifier(identifier) {
    return identifier
      // Insert space before capitals in camelCase/PascalCase
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      // Insert space between consecutive capitals followed by lowercase (e.g., XMLParser -> XML Parser)
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      // Replace separators with spaces
      .replace(/[-_]+/g, ' ')
      // Split on spaces
      .split(/\s+/)
      // Filter empty strings
      .filter(w => w.length > 0);
  }
  
  /**
   * Check a word with aspell using American English dictionary
   */
  async checkWordWithAspell(word) {
    return new Promise((resolve) => {
      const proc = spawn(this.aspellPath, [
        '-a',
        '-l', 'en_US',
        '--encoding=utf-8'
      ]);
      
      let stdout = '';
      
      proc.stdout.on('data', (data) => { stdout += data; });
      
      proc.on('error', (err) => {
        resolve({ misspelled: false, suggestions: [], error: err.message });
      });
      
      proc.on('close', () => {
        const lines = stdout.split('\n');
        
        for (const line of lines) {
          // & word count offset: suggestions (misspelled with suggestions)
          if (line.startsWith('&')) {
            const match = line.match(/^& \S+ \d+ \d+: (.*)$/);
            if (match) {
              resolve({
                misspelled: true,
                suggestions: match[1].split(', ').map(s => s.trim())
              });
              return;
            }
          }
          // # word offset (misspelled, no suggestions)
          if (line.startsWith('#')) {
            resolve({ misspelled: true, suggestions: [] });
            return;
          }
          // * (word is correct)
          if (line.startsWith('*')) {
            resolve({ misspelled: false, suggestions: [] });
            return;
          }
        }
        
        resolve({ misspelled: false, suggestions: [] });
      });
      
      proc.stdin.write(word + '\n');
      proc.stdin.end();
    });
  }
  
  /**
   * Detect if a word is British spelling and provide American variant
   */
  detectBritishSpelling(word) {
    const lower = word.toLowerCase();
    
    // Patterns: British regex -> American replacement
    const patterns = [
      // -our vs -or
      { pattern: /^(.+)our$/, replacement: '$1or' },
      { pattern: /^(.+)oured$/, replacement: '$1ored' },
      { pattern: /^(.+)ouring$/, replacement: '$1oring' },
      { pattern: /^(.+)ours$/, replacement: '$1ors' },
      // -ise vs -ize (but not words that must be -ise)
      { pattern: /^(.+)ise$/, replacement: '$1ize', excludeRoots: ['advert', 'adv', 'compr', 'comprom', 'desp', 'dev', 'disgu', 'exerc', 'improv', 'rev', 'superv', 'surpr', 'telev'] },
      { pattern: /^(.+)ised$/, replacement: '$1ized', excludeRoots: ['advert', 'adv', 'compr', 'comprom', 'desp', 'dev', 'disgu', 'exerc', 'improv', 'rev', 'superv', 'surpr', 'telev'] },
      { pattern: /^(.+)ising$/, replacement: '$1izing', excludeRoots: ['advert', 'adv', 'compr', 'comprom', 'desp', 'dev', 'disgu', 'exerc', 'improv', 'rev', 'superv', 'surpr', 'telev'] },
      { pattern: /^(.+)isation$/, replacement: '$1ization' },
      { pattern: /^(.+)isations$/, replacement: '$1izations' },
      // -yse vs -yze
      { pattern: /^(.+)yse$/, replacement: '$1yze' },
      { pattern: /^(.+)ysed$/, replacement: '$1yzed' },
      { pattern: /^(.+)ysing$/, replacement: '$1yzing' },
      { pattern: /^(.+)yser$/, replacement: '$1yzer' },
      { pattern: /^(.+)ysers$/, replacement: '$1yzers' },
      // -re vs -er
      { pattern: /^(.+)tre$/, replacement: '$1ter' },
      { pattern: /^(.+)tres$/, replacement: '$1ters' },
      { pattern: /^(.+)tred$/, replacement: '$1tered' },
      { pattern: /^(.+)bre$/, replacement: '$1ber' },
      { pattern: /^(.+)bres$/, replacement: '$1bers' },
      // -ogue vs -og
      { pattern: /^(.+)ogue$/, replacement: '$1og' },
      { pattern: /^(.+)ogues$/, replacement: '$1ogs' },
      // -ence vs -ense (specific words)
      { pattern: /^(def)ence$/, replacement: '$1ense' },
      { pattern: /^(off)ence$/, replacement: '$1ense' },
      { pattern: /^(lic)ence$/, replacement: '$1ense' },
      // Double L patterns
      { pattern: /^(.+)lled$/, replacement: '$1led' },
      { pattern: /^(.+)lling$/, replacement: '$1ling' },
      { pattern: /^(.+)ller$/, replacement: '$1ler' },
      { pattern: /^(.+)llers$/, replacement: '$1lers' },
      // -ae- vs -e-
      { pattern: /^(.*)ae(.+)$/, replacement: '$1e$2' },
      // -oe- vs -e-
      { pattern: /^(.*)oe(.+)$/, replacement: '$1e$2' },
      // Grey vs Gray
      { pattern: /^grey$/, replacement: 'gray' },
      { pattern: /^greys$/, replacement: 'grays' },
      // Judgement vs Judgment
      { pattern: /^(.+)gement$/, replacement: '$1gment' },
      { pattern: /^(.+)gements$/, replacement: '$1gments' }
    ];
    
    for (const { pattern, replacement, excludeRoots } of patterns) {
      if (pattern.test(lower)) {
        // Check exclusions
        if (excludeRoots) {
          const match = lower.match(pattern);
          if (match && excludeRoots.some(root => match[1].endsWith(root))) {
            continue;
          }
        }
        
        const american = lower.replace(pattern, replacement);
        
        // Preserve original case
        let result = american;
        if (word[0] === word[0].toUpperCase()) {
          result = american.charAt(0).toUpperCase() + american.slice(1);
        }
        if (word === word.toUpperCase()) {
          result = american.toUpperCase();
        }
        
        return { isBritish: true, americanVariant: result };
      }
    }
    
    return { isBritish: false, americanVariant: null };
  }
}

// Create and register the check
const check = new PropertyNameAmericanEnglishCheck();
registerCheck(check);

export { PropertyNameAmericanEnglishCheck };
export default check;
