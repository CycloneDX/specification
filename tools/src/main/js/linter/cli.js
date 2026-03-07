#!/usr/bin/env node

/**
 * CycloneDX Schema Linter - Command Line Interface
 * 
 * Usage:
 *   cdx-lint [options] <files...>
 *   cdx-lint --help
 * 
 * @license Apache-2.0
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import SchemaLinter, { Severity, getRegisteredChecks } from './index.js';
import { loadAllChecks } from './checks/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const options = {
    files: [],
    configFile: null,
    format: 'stylish',
    showHelp: false,
    showVersion: false,
    showChecks: false,
    excludeChecks: [],
    includeChecks: null,
    quiet: false,
    verbose: false
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      options.showHelp = true;
    } else if (arg === '--version' || arg === '-v') {
      options.showVersion = true;
    } else if (arg === '--list-checks' || arg === '-l') {
      options.showChecks = true;
    } else if (arg === '--config' || arg === '-c') {
      options.configFile = args[++i];
    } else if (arg === '--format' || arg === '-f') {
      options.format = args[++i];
    } else if (arg === '--exclude' || arg === '-e') {
      options.excludeChecks.push(args[++i]);
    } else if (arg === '--include' || arg === '-i') {
      if (!options.includeChecks) options.includeChecks = [];
      options.includeChecks.push(args[++i]);
    } else if (arg === '--quiet' || arg === '-q') {
      options.quiet = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (!arg.startsWith('-')) {
      options.files.push(arg);
    } else {
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
    }
    
    i++;
  }

  return options;
}

/**
 * Display help message
 */
function showHelp() {
  console.log(`
CycloneDX Schema Linter

A modular linter for CycloneDX 2.0 JSON schemas, enforcing ISO House Style
and Oxford English conventions.

Usage:
  cdx-lint [options] <files...>

Options:
  -h, --help           Show this help message
  -v, --version        Show version number
  -l, --list-checks    List all available checks
  -c, --config <file>  Path to configuration file
  -f, --format <type>  Output format: stylish (default), json, compact
  -e, --exclude <id>   Exclude a check (can be specified multiple times)
  -i, --include <id>   Include only specified checks (can be specified multiple times)
  -q, --quiet          Only output errors
  --verbose            Show detailed output

Examples:
  cdx-lint schema.json
  cdx-lint --format json *.schema.json
  cdx-lint -c .cdxlintrc.json src/schemas/
  cdx-lint --exclude formatting-indent schema.json
  cdx-lint --include description-full-stop --include meta-enum-no-full-stop schema.json

Configuration:
  Create a .cdxlintrc.json file in your project root:
  {
    "checks": {
      "schema-id-pattern": {
        "pattern": "^https://cyclonedx\\\\.org/schema/.*\\\\.schema\\\\.json$"
      },
      "formatting-indent": {
        "spaces": 2
      }
    },
    "excludeChecks": ["check-id-to-exclude"]
  }

Environment:
  ASPELL_PATH    Path to aspell binary (default: aspell)
  CDX_LINT_DEBUG Enable debug output

For more information, visit: https://cyclonedx.org
`);
}

/**
 * Display version
 */
function showVersion() {
  const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
  console.log(`${pkg.name} v${pkg.version}`);
}

/**
 * Display list of available checks
 */
function showChecks() {
  console.log('\nAvailable Checks:\n');
  
  const checks = getRegisteredChecks();
  const maxIdLength = Math.max(...Array.from(checks.keys()).map(k => k.length));
  
  for (const [id, check] of checks) {
    const severity = check.defaultSeverity.toUpperCase().padEnd(7);
    const paddedId = id.padEnd(maxIdLength + 2);
    console.log(`  ${paddedId} [${severity}]  ${check.name}`);
    console.log(`  ${' '.repeat(maxIdLength + 2)}            ${check.description}\n`);
  }
}

/**
 * Load configuration from file
 */
function loadConfig(configPath) {
  if (!configPath) {
    // Try to find config in standard locations
    const standardPaths = [
      '.cdxlintrc.json',
      '.cdxlintrc',
      'cdxlint.config.json'
    ];
    
    for (const path of standardPaths) {
      if (existsSync(path)) {
        configPath = path;
        break;
      }
    }
  }
  
  if (configPath && existsSync(configPath)) {
    try {
      return JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch (err) {
      console.error(`Error loading config from ${configPath}: ${err.message}`);
      process.exit(1);
    }
  }
  
  return {};
}

/**
 * Expand file paths (handle directories and globs)
 */
function expandFilePaths(paths) {
  const files = [];
  
  for (const path of paths) {
    const resolved = resolve(path);
    
    if (!existsSync(resolved)) {
      console.error(`File not found: ${path}`);
      continue;
    }
    
    const stat = statSync(resolved);
    
    if (stat.isDirectory()) {
      // Recursively find JSON files
      const dirFiles = findJsonFiles(resolved);
      files.push(...dirFiles);
    } else if (stat.isFile()) {
      files.push(resolved);
    }
  }
  
  return files;
}

/**
 * Find all JSON files in a directory recursively
 */
function findJsonFiles(dir) {
  const files = [];
  
  const entries = readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      files.push(...findJsonFiles(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.json') || entry.name.endsWith('.schema.json'))) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Format output in stylish format (similar to ESLint)
 */
function formatStylish(results, options) {
  let output = '';
  let totalErrors = 0;
  let totalWarnings = 0;
  
  // Track issues by check ID
  const checkStats = new Map();
  
  for (const result of results) {
    const issues = options.quiet 
      ? result.getIssuesBySeverity(Severity.ERROR)
      : result.issues;
    
    if (issues.length === 0) continue;
    
    output += `\n\x1b[4m${result.filePath}\x1b[0m\n`;
    
    for (const issue of issues) {
      const severityColour = issue.severity === Severity.ERROR 
        ? '\x1b[31m' // red
        : issue.severity === Severity.WARNING 
          ? '\x1b[33m' // yellow
          : '\x1b[36m'; // cyan
      
      output += `  ${severityColour}${issue.severity}\x1b[0m  ${issue.path}\n`;
      output += `         ${issue.message} \x1b[90m(${issue.checkId})\x1b[0m\n`;
      
      // Track stats by check ID
      if (!checkStats.has(issue.checkId)) {
        checkStats.set(issue.checkId, { errors: 0, warnings: 0, info: 0 });
      }
      const stats = checkStats.get(issue.checkId);
      
      if (issue.severity === Severity.ERROR) {
        totalErrors++;
        stats.errors++;
      } else if (issue.severity === Severity.WARNING) {
        totalWarnings++;
        stats.warnings++;
      } else {
        stats.info++;
      }
    }
  }
  
  if (totalErrors > 0 || totalWarnings > 0) {
    output += `\n\x1b[31m✖ ${totalErrors + totalWarnings} problems\x1b[0m`;
    output += ` (${totalErrors} errors, ${totalWarnings} warnings)\n`;
    
    // Add summary table by check
    if (checkStats.size > 0) {
      output += '\n\x1b[1mIssues by check:\x1b[0m\n';
      
      // Sort by total issues (descending)
      const sortedChecks = Array.from(checkStats.entries())
        .sort((a, b) => {
          const totalA = a[1].errors + a[1].warnings + a[1].info;
          const totalB = b[1].errors + b[1].warnings + b[1].info;
          return totalB - totalA;
        });
      
      // Find longest check name for alignment
      const maxNameLength = Math.max(...sortedChecks.map(([name]) => name.length));
      
      for (const [checkId, stats] of sortedChecks) {
        const paddedName = checkId.padEnd(maxNameLength);
        
        let statsStr = '';
        if (stats.errors > 0) {
          statsStr += `\x1b[31m${stats.errors} error${stats.errors !== 1 ? 's' : ''}\x1b[0m`;
        }
        if (stats.warnings > 0) {
          if (statsStr) statsStr += ', ';
          statsStr += `\x1b[33m${stats.warnings} warning${stats.warnings !== 1 ? 's' : ''}\x1b[0m`;
        }
        if (stats.info > 0) {
          if (statsStr) statsStr += ', ';
          statsStr += `\x1b[36m${stats.info} info\x1b[0m`;
        }
        
        output += `  ${paddedName}  ${statsStr}\n`;
      }
    }
  } else {
    output += '\n\x1b[32m✔ No issues found\x1b[0m\n';
  }
  
  return output;
}

/**
 * Format output as JSON
 */
function formatJson(results, options) {
  const output = {
    results: results.map(r => ({
      filePath: r.filePath,
      issues: options.quiet 
        ? r.getIssuesBySeverity(Severity.ERROR).map(i => i.toJSON())
        : r.issues.map(i => i.toJSON()),
      summary: r.getSummary()
    })),
    summary: {
      filesLinted: results.length,
      totalIssues: results.reduce((sum, r) => sum + r.issues.length, 0),
      totalErrors: results.reduce((sum, r) => sum + r.getIssuesBySeverity(Severity.ERROR).length, 0),
      totalWarnings: results.reduce((sum, r) => sum + r.getIssuesBySeverity(Severity.WARNING).length, 0)
    }
  };
  
  return JSON.stringify(output, null, 2);
}

/**
 * Format output in compact format
 */
function formatCompact(results, options) {
  let output = '';
  
  for (const result of results) {
    const issues = options.quiet 
      ? result.getIssuesBySeverity(Severity.ERROR)
      : result.issues;
    
    for (const issue of issues) {
      output += `${result.filePath}: ${issue.path}: ${issue.severity}: ${issue.message} [${issue.checkId}]\n`;
    }
  }
  
  return output;
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);
  
  // Load all checks
  await loadAllChecks();
  
  if (options.showHelp) {
    showHelp();
    process.exit(0);
  }
  
  if (options.showVersion) {
    showVersion();
    process.exit(0);
  }
  
  if (options.showChecks) {
    showChecks();
    process.exit(0);
  }
  
  if (options.files.length === 0) {
    console.error('Error: No input files specified');
    console.error('Run with --help for usage information');
    process.exit(1);
  }
  
  // Load configuration
  const config = loadConfig(options.configFile);
  
  // Merge CLI options with config
  if (options.excludeChecks.length > 0) {
    config.excludeChecks = [...(config.excludeChecks || []), ...options.excludeChecks];
  }
  if (options.includeChecks) {
    config.includeChecks = options.includeChecks;
  }
  
  // Expand file paths
  const files = expandFilePaths(options.files);
  
  if (files.length === 0) {
    console.error('Error: No JSON files found');
    process.exit(1);
  }
  
  if (options.verbose) {
    console.log(`Linting ${files.length} file(s)...`);
  }
  
  // Create linter and run
  const linter = new SchemaLinter(config);
  const results = await linter.lintFiles(files);
  
  // Format and output results
  let output;
  switch (options.format) {
    case 'json':
      output = formatJson(results, options);
      break;
    case 'compact':
      output = formatCompact(results, options);
      break;
    case 'stylish':
    default:
      output = formatStylish(results, options);
  }
  
  console.log(output);
  
  // Exit with error code if there are errors
  const hasErrors = results.some(r => r.hasErrors());
  process.exit(hasErrors ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  if (process.env.CDX_LINT_DEBUG) {
    console.error(err.stack);
  }
  process.exit(1);
});
