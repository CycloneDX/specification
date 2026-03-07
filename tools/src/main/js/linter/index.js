/**
 * CycloneDX Schema Linter - Core Engine
 * 
 * A modular linter for CycloneDX 2.0 JSON schemas, enforcing:
 * - ISO House Style conventions
 * - Oxford English spelling for descriptions
 * - American English for property names
 * - Consistent formatting and structure
 * 
 * @license Apache-2.0
 */

import { readFileSync } from 'fs';

// Check registry - maps check names to their modules
const checkRegistry = new Map();

/**
 * Severity levels for lint issues
 */
export const Severity = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

/**
 * Represents a single lint issue found in a schema
 */
export class LintIssue {
  /**
   * @param {string} checkId - Unique identifier for the check
   * @param {string} severity - Severity level (error, warning, info)
   * @param {string} message - Human-readable description of the issue
   * @param {string} path - JSON path to the problematic location
   * @param {object} [context] - Additional context about the issue
   */
  constructor(checkId, severity, message, path, context = {}) {
    this.checkId = checkId;
    this.severity = severity;
    this.message = message;
    this.path = path;
    this.context = context;
  }

  /**
   * Convert to plain object for serialisation
   */
  toJSON() {
    return {
      checkId: this.checkId,
      severity: this.severity,
      message: this.message,
      path: this.path,
      context: this.context
    };
  }

  /**
   * Format as a human-readable string
   */
  toString() {
    const severityIcon = {
      error: '✖',
      warning: '⚠',
      info: 'ℹ'
    };
    return `${severityIcon[this.severity] || '•'} [${this.checkId}] ${this.path}: ${this.message}`;
  }
}

/**
 * Result of linting a single schema file
 */
export class LintResult {
  /**
   * @param {string} filePath - Path to the schema file
   */
  constructor(filePath) {
    this.filePath = filePath;
    this.issues = [];
    this.checksRun = [];
    this.startTime = Date.now();
    this.endTime = null;
  }

  /**
   * Add an issue to the result
   * @param {LintIssue} issue
   */
  addIssue(issue) {
    this.issues.push(issue);
  }

  /**
   * Mark a check as having been run
   * @param {string} checkId
   */
  markCheckRun(checkId) {
    this.checksRun.push(checkId);
  }

  /**
   * Finalise the result
   */
  finalise() {
    this.endTime = Date.now();
    return this;
  }

  /**
   * Get issues by severity
   * @param {string} severity
   */
  getIssuesBySeverity(severity) {
    return this.issues.filter(issue => issue.severity === severity);
  }

  /**
   * Check if there are any errors
   */
  hasErrors() {
    return this.issues.some(issue => issue.severity === Severity.ERROR);
  }

  /**
   * Get summary statistics
   */
  getSummary() {
    return {
      filePath: this.filePath,
      totalIssues: this.issues.length,
      errors: this.getIssuesBySeverity(Severity.ERROR).length,
      warnings: this.getIssuesBySeverity(Severity.WARNING).length,
      info: this.getIssuesBySeverity(Severity.INFO).length,
      checksRun: this.checksRun.length,
      duration: this.endTime - this.startTime
    };
  }
}

/**
 * Base class for all lint checks
 */
export class LintCheck {
  /**
   * @param {string} id - Unique identifier for the check
   * @param {string} name - Human-readable name
   * @param {string} description - Detailed description of what the check validates
   * @param {string} severity - Default severity level
   */
  constructor(id, name, description, severity = Severity.ERROR) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.defaultSeverity = severity;
  }

  /**
   * Run the check against a schema
   * @param {object} schema - The parsed JSON schema
   * @param {string} rawContent - The raw file content (for formatting checks)
   * @param {object} config - Configuration options for this check
   * @returns {LintIssue[]} Array of issues found
   */
  async run(schema, rawContent, config = {}) {
    throw new Error('LintCheck.run() must be implemented by subclass');
  }

  /**
   * Create an issue with this check's ID
   * @param {string} message
   * @param {string} path
   * @param {object} context
   * @param {string} [severity]
   */
  createIssue(message, path, context = {}, severity = null) {
    return new LintIssue(
      this.id,
      severity || this.defaultSeverity,
      message,
      path,
      context
    );
  }
}

/**
 * Register a check in the global registry
 * @param {LintCheck} check
 */
export function registerCheck(check) {
  if (!(check instanceof LintCheck)) {
    throw new Error('Check must be an instance of LintCheck');
  }
  checkRegistry.set(check.id, check);
}

/**
 * Get all registered checks
 * @returns {Map<string, LintCheck>}
 */
export function getRegisteredChecks() {
  return new Map(checkRegistry);
}

/**
 * Get a specific check by ID
 * @param {string} id
 * @returns {LintCheck|undefined}
 */
export function getCheck(id) {
  return checkRegistry.get(id);
}

/**
 * Main linter class
 */
export class SchemaLinter {
  /**
   * @param {object} [config] - Configuration options
   */
  constructor(config = {}) {
    this.config = {
      checks: config.checks || {},
      excludeChecks: config.excludeChecks || [],
      includeChecks: config.includeChecks || null, // null means all checks
      ...config
    };
  }

  /**
   * Lint a schema file
   * @param {string} filePath - Path to the schema file
   * @returns {Promise<LintResult>}
   */
  async lintFile(filePath) {
    const result = new LintResult(filePath);
    
    let rawContent;
    let schema;
    
    try {
      rawContent = readFileSync(filePath, 'utf-8');
    } catch (err) {
      result.addIssue(new LintIssue(
        'file-read',
        Severity.ERROR,
        `Failed to read file: ${err.message}`,
        filePath
      ));
      return result.finalise();
    }
    
    try {
      schema = JSON.parse(rawContent);
    } catch (err) {
      result.addIssue(new LintIssue(
        'json-parse',
        Severity.ERROR,
        `Invalid JSON: ${err.message}`,
        filePath
      ));
      return result.finalise();
    }

    // Run all applicable checks
    const checks = this.getApplicableChecks();
    
    for (const check of checks) {
      const checkConfig = this.config.checks[check.id] || {};
      
      if (checkConfig.enabled === false) {
        continue;
      }
      
      try {
        const issues = await check.run(schema, rawContent, checkConfig, filePath);
        issues.forEach(issue => result.addIssue(issue));
        result.markCheckRun(check.id);
      } catch (err) {
        result.addIssue(new LintIssue(
          'check-error',
          Severity.ERROR,
          `Check '${check.id}' failed: ${err.message}`,
          filePath,
          { stack: err.stack }
        ));
      }
    }

    return result.finalise();
  }

  /**
   * Lint a schema from a string
   * @param {string} content - Raw JSON content
   * @param {string} [virtualPath] - Virtual path for error reporting
   * @returns {Promise<LintResult>}
   */
  async lintString(content, virtualPath = '<string>') {
    const result = new LintResult(virtualPath);
    
    let schema;
    
    try {
      schema = JSON.parse(content);
    } catch (err) {
      result.addIssue(new LintIssue(
        'json-parse',
        Severity.ERROR,
        `Invalid JSON: ${err.message}`,
        virtualPath
      ));
      return result.finalise();
    }

    // Run all applicable checks
    const checks = this.getApplicableChecks();
    
    for (const check of checks) {
      const checkConfig = this.config.checks[check.id] || {};
      
      if (checkConfig.enabled === false) {
        continue;
      }
      
      try {
        const issues = await check.run(schema, content, checkConfig);
        issues.forEach(issue => result.addIssue(issue));
        result.markCheckRun(check.id);
      } catch (err) {
        result.addIssue(new LintIssue(
          'check-error',
          Severity.ERROR,
          `Check '${check.id}' failed: ${err.message}`,
          virtualPath,
          { stack: err.stack }
        ));
      }
    }

    return result.finalise();
  }

  /**
   * Lint multiple files
   * @param {string[]} filePaths
   * @returns {Promise<LintResult[]>}
   */
  async lintFiles(filePaths) {
    const results = [];
    for (const filePath of filePaths) {
      results.push(await this.lintFile(filePath));
    }
    return results;
  }

  /**
   * Get checks that should be run based on configuration
   * @returns {LintCheck[]}
   */
  getApplicableChecks() {
    const allChecks = Array.from(checkRegistry.values());
    
    let checks = allChecks;
    
    // Filter to only included checks if specified
    if (this.config.includeChecks) {
      checks = checks.filter(c => this.config.includeChecks.includes(c.id));
    }
    
    // Exclude specified checks
    if (this.config.excludeChecks.length > 0) {
      checks = checks.filter(c => !this.config.excludeChecks.includes(c.id));
    }
    
    return checks;
  }
}

/**
 * Utility to traverse a JSON schema and call a visitor function
 * @param {object} schema - The schema to traverse
 * @param {function} visitor - Function called for each node: (node, path, key, parent)
 * @param {string} [path] - Current path (used internally)
 * @param {string} [key] - Current key (used internally)
 * @param {object} [parent] - Parent node (used internally)
 */
export function traverseSchema(schema, visitor, path = '$', key = null, parent = null) {
  visitor(schema, path, key, parent);
  
  if (typeof schema !== 'object' || schema === null) {
    return;
  }
  
  if (Array.isArray(schema)) {
    schema.forEach((item, index) => {
      traverseSchema(item, visitor, `${path}[${index}]`, index, schema);
    });
  } else {
    for (const [k, v] of Object.entries(schema)) {
      traverseSchema(v, visitor, `${path}.${k}`, k, schema);
    }
  }
}

export default SchemaLinter;
