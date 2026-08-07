/**
 * CycloneDX Schema Linter - Check Module Loader
 * 
 * This module loads all check modules from the checks directory.
 * Each check is automatically registered with the linter.
 * 
 * @license Apache-2.0
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Dynamically load all check modules
 */
export async function loadAllChecks() {
  const checkFiles = readdirSync(__dirname).filter(
    file => file.endsWith('.check.js')
  );
  
  const loadPromises = checkFiles.map(async file => {
    const modulePath = join(__dirname, file);
    try {
      await import(modulePath);
    } catch (err) {
      console.error(`Failed to load check module ${file}: ${err.message}`);
    }
  });
  
  await Promise.all(loadPromises);
}

// Export individual check modules for direct access if needed
export * from './schema-id-pattern.check.js';
export * from './schema-comment.check.js';
export * from './schema-draft.check.js';
export * from './model-property-order.check.js';
export * from './model-structure.check.js';
export * from './formatting-indent.check.js';
export * from './description-full-stop.check.js';
export * from './meta-enum-full-stop.check.js';
export * from './property-name-american-english.check.js';
export * from './description-oxford-english.check.js';
export * from './no-uppercase-rfc.check.js';
export * from './no-must-word.check.js';
export * from './additional-properties-false.check.js';
export * from './title-formatting.check.js';
export * from './enum-value-formatting.check.js';
export * from './ref-usage.check.js';
export * from './duplicate-content.check.js';
export * from './duplicate-definitions.check.js';
