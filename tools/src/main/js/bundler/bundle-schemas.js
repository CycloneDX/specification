#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

// Default list of external schema files to bypass for validation and rewriting.
// This constant is used as the default value for ref exceptions; can be overridden via options.refExceptions.
const DEFAULT_REF_EXCEPTION_FILES = [
    'spdx.schema.json',
    'cryptography-defs.schema.json',
    'jsf-0.82.schema.json'
];

function isObject(value) {
    return typeof value === 'object' && value !== null;
}

/**
 * Resolve a JSON Pointer (RFC6901) against an object. Returns { ok: boolean, value?: any, error?: string }
 */
function resolveJsonPointer(root, pointer) {
    if (typeof pointer !== 'string' || pointer.length === 0) {
        return { ok: false, error: 'Empty JSON Pointer' };
    }
    // Allow pointers like "#/..." or "/..."; strip leading '#'
    let p = pointer.startsWith('#') ? pointer.slice(1) : pointer;
    if (p === '') return { ok: true, value: root };
    if (!p.startsWith('/')) {
        return { ok: false, error: `Pointer must start with '/': ${pointer}` };
    }
    const parts = p.split('/').slice(1).map(seg => seg.replace(/~1/g, '/').replace(/~0/g, '~'));
    let current = root;
    for (const key of parts) {
        if (!isObject(current) && !Array.isArray(current)) {
            return { ok: false, error: `Non-object encountered before end at '${key}' in ${pointer}` };
        }
        if (!(key in current)) {
            return { ok: false, error: `Missing key '${key}' in ${pointer}` };
        }
        current = current[key];
    }
    return { ok: true, value: current };
}

/**
 * Traverse an object and collect all ref-like keyword values matching a predicate
 */
function collectRefKeywords(obj, keys, predicate, pathStack = []) {
    const result = [];
    if (!isObject(obj)) return result;

    if (Array.isArray(obj)) {
        obj.forEach((item, idx) => {
            result.push(...collectRefKeywords(item, keys, predicate, pathStack.concat(`[${idx}]`)));
        });
        return result;
    }

    for (const [k, v] of Object.entries(obj)) {
        const nextPath = pathStack.concat(k);
        if (keys.includes(k) && typeof v === 'string' && (!predicate || predicate(v, k))) {
            result.push({ ref: v, key: k, path: nextPath.join('.') });
        }
        result.push(...collectRefKeywords(v, keys, predicate, nextPath));
    }
    return result;
}

/**
 * Recursively walks through an object and rewrites $ref paths
 */
function rewriteRefs(obj, schemaFiles, defsKeyword, currentSchemaName, refExceptionSet) {
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => rewriteRefs(item, schemaFiles, defsKeyword, currentSchemaName, refExceptionSet));
    }

    const newObj = {};
    for (const [key, value] of Object.entries(obj)) {
        if (key === '$ref' && typeof value === 'string') {
            // Case 1: Reference to another schema file (external reference)
            const fileMatch = value.match(/^(.+\.schema\.json)(#.*)?$/);
            if (fileMatch) {
                const filename = fileMatch[1];
                const fragment = fileMatch[2] || '';

                const basename = path.basename(filename);
                const schemaName = basename.replace('.schema.json', '');

                // If the target file is in the exception list, leave the ref as-is
                if (refExceptionSet && refExceptionSet.has(basename.toLowerCase())) {
                    newObj[key] = value;
                } else {
                    // Normalize fragment: drop leading '#' and optional leading '/'
                    let fragPath = '';
                    if (fragment) {
                        fragPath = fragment.startsWith('#') ? fragment.slice(1) : fragment;
                        if (fragPath.startsWith('/')) fragPath = fragPath.slice(1);
                    }

                    // Rewrite to point to the bundled schema's definitions
                    newObj[key] = fragPath
                        ? `#/${defsKeyword}/${schemaName}/${fragPath}`
                        : `#/${defsKeyword}/${schemaName}`;
                }
            }
            // Case 2: Internal reference within the same schema (starts with #)
            else if (value.startsWith('#')) {
                // Rewrite to be relative to the current schema's location in the bundle
                newObj[key] = `#/${defsKeyword}/${currentSchemaName}${value.substring(1)}`;
            }
            // Case 3: Other references (URLs, etc.) - leave as-is
            else {
                newObj[key] = value;
            }
        } else {
            newObj[key] = rewriteRefs(value, schemaFiles, defsKeyword, currentSchemaName, refExceptionSet);
        }
    }
    return newObj;
}

/**
 * Recursively removes $comment properties from an object (except at root level)
 */
function removeComments(obj, isRoot = false) {
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => removeComments(item, false));
    }

    const newObj = {};
    for (const [key, value] of Object.entries(obj)) {
        // Skip $comment unless we're at root level
        if (key === '$comment' && !isRoot) {
            continue;
        }

        if (typeof value === 'object' && value !== null) {
            newObj[key] = removeComments(value, false);
        } else {
            newObj[key] = value;
        }
    }
    return newObj;
}

async function bundleSchemas(modelsDirectory, rootSchemaPath, options = {}) {
    try {
        const absoluteModelsDir = path.resolve(modelsDirectory);
        const absoluteRootPath = path.resolve(rootSchemaPath);

        // Verify paths exist
        await fs.access(absoluteModelsDir);
        await fs.access(absoluteRootPath);

        const rootSchemaFilename = path.basename(absoluteRootPath);
        const rootSchemaDir = path.dirname(absoluteRootPath);

        console.log(`Models directory: ${absoluteModelsDir}`);
        console.log(`Root schema: ${absoluteRootPath}`);

        // Generate output filenames
        const baseFilename = rootSchemaFilename.replace('.schema.json', '');
        const bundledFilename = `${baseFilename}-bundled.schema.json`;
        const minifiedFilename = `${baseFilename}-bundled.min.schema.json`;

        const bundledPath = path.join(rootSchemaDir, bundledFilename);
        const minifiedPath = path.join(rootSchemaDir, minifiedFilename);

        console.log(`Output (bundled): ${bundledPath}`);
        console.log(`Output (minified): ${minifiedPath}\n`);

        // Read all schema files in the models directory
        const files = await fs.readdir(absoluteModelsDir);
        const schemaFiles = files.filter(file => file.endsWith('.schema.json') && !file.includes('-bundled'));

        console.log(`Found ${schemaFiles.length} schema files in models directory`);

        // Read all schemas from models directory
        const schemas = {};
        let detectedSchemaVersion = null;

        for (const file of schemaFiles) {
            const schemaPath = path.join(absoluteModelsDir, file);
            console.log(`  Reading ${file}...`);

            const content = await fs.readFile(schemaPath, 'utf8');
            const schema = JSON.parse(content);

            // Detect the $schema version from the first schema that has it
            if (!detectedSchemaVersion && schema.$schema) {
                detectedSchemaVersion = schema.$schema;
            }

            const schemaName = path.basename(file, '.schema.json');
            schemas[schemaName] = schema;
        }

        // Read the root schema
        console.log(`\nReading root schema...`);
        const rootContent = await fs.readFile(absoluteRootPath, 'utf8');
        const rootSchema = JSON.parse(rootContent);
        const rootSchemaName = path.basename(rootSchemaFilename, '.schema.json');

        // Add root schema to the schemas collection
        schemas[rootSchemaName] = rootSchema;

        // Use detected version from root schema if available
        if (rootSchema.$schema) {
            detectedSchemaVersion = rootSchema.$schema;
        }

        // Use detected version, or provided option, or default to 2020-12
        const schemaVersion = options.schemaVersion ||
            detectedSchemaVersion ||
            'https://json-schema.org/draft/2020-12/schema';

        // Determine which keyword to use based on schema version
        const isDraft2019OrLater = schemaVersion.includes('2019-09') ||
            schemaVersion.includes('2020-12') ||
            schemaVersion.includes('/next');
        const defsKeyword = isDraft2019OrLater ? '$defs' : 'definitions';

        console.log(`\nUsing schema version: ${schemaVersion}`);
        console.log(`Using keyword: ${defsKeyword}`);

        // Build exception set for external refs not to check or rewrite
        const refExceptionSet = new Set((options.refExceptions || DEFAULT_REF_EXCEPTION_FILES).map(s => s.toLowerCase()));

        // Pre-check: external file $ref targets must exist among loaded schemas
        console.log('Validating external $ref targets...');
        const allowedFiles = new Set([...schemaFiles, rootSchemaFilename]);
        for (const [name, schema] of Object.entries(schemas)) {
            // Only $ref can be external; $dynamicRef/$recursiveRef are JSON Pointers by spec
            const refs = collectRefKeywords(schema, ['$ref'], (v) => /^(\.?.*\.schema\.json)(#.*)?$/.test(v));
            for (const { ref, key, path: refPath } of refs) {
                const m = ref.match(/^(.+\.schema\.json)(#.*)?$/);
                if (!m) continue;
                const target = m[1];
                const base = path.basename(target);
                // Skip validation if target file is in exceptions
                if (refExceptionSet.has(base.toLowerCase())) continue;
                if (!allowedFiles.has(base)) {
                    throw new Error(`Unresolved external ${key} target file '${target}' referenced from schema '${name}' at '${refPath}'`);
                }
            }
        }

        console.log('Rewriting $ref pointers...');

        // Rewrite all $refs in all schemas
        const rewrittenDefinitions = {};
        for (const [name, schema] of Object.entries(schemas)) {
            console.log(`  Rewriting refs in ${name}...`);
            rewrittenDefinitions[name] = rewriteRefs(schema, [...schemaFiles, rootSchemaFilename], defsKeyword, name, refExceptionSet);
        }

        // Get the rewritten root schema
        const rootSchemaRewritten = rewrittenDefinitions[rootSchemaName];

        // Build the final schema with root schema properties at the top level
        const finalSchema = {
            ...rootSchemaRewritten,
            "$schema": schemaVersion,
            [defsKeyword]: rewrittenDefinitions
        };

        // Post-check: ensure all internal JSON Pointer refs resolve in the final bundle
        console.log('Validating internal ref pointers ($ref, $dynamicRef, $recursiveRef)...');
        const internalRefs = collectRefKeywords(
            finalSchema,
            ['$ref', '$dynamicRef', '$recursiveRef'],
            (v) => typeof v === 'string' && v.startsWith('#')
        );
        for (const { ref, key, path: refPath } of internalRefs) {
            const resolved = resolveJsonPointer(finalSchema, ref);
            if (!resolved.ok) {
                throw new Error(`Unresolved internal ${key} '${ref}' at '${refPath}': ${resolved.error}`);
            }
        }

        // Optionally validate with AJV
        if (options.validate) {
            console.log('\nValidating with AJV...');
            const Ajv = require('ajv');
            const ajv = new Ajv({
                strict: false,
                allowUnionTypes: true
            });

            try {
                ajv.compile(finalSchema);
                console.log('✓ Schema validation passed');
            } catch (validationErr) {
                console.warn('⚠ Schema validation warning:', validationErr.message);
            }
        }

        // Write bundled (pretty) version
        console.log('\nWriting bundled schema...');
        const prettyJson = JSON.stringify(finalSchema, null, 2);
        await fs.writeFile(bundledPath, prettyJson);
        const bundledStats = await fs.stat(bundledPath);
        const bundledSizeKB = (bundledStats.size / 1024).toFixed(2);
        console.log(`✓ Bundled schema: ${bundledFilename} (${bundledSizeKB} KB)`);

        // Write minified version
        console.log('Writing minified schema...');
        const minifiedSchema = removeComments(finalSchema, true);
        const minifiedJson = JSON.stringify(minifiedSchema);

        // Verify it's a single line
        const lineCount = minifiedJson.split('\n').length;
        console.log(`  Minified JSON is on ${lineCount} line(s)`);

        await fs.writeFile(minifiedPath, minifiedJson);
        const minifiedStats = await fs.stat(minifiedPath);
        const minifiedSizeKB = (minifiedStats.size / 1024).toFixed(2);
        const compressionRatio = ((1 - minifiedStats.size / bundledStats.size) * 100).toFixed(1);
        console.log(`✓ Minified schema: ${minifiedFilename} (${minifiedSizeKB} KB, ${compressionRatio}% smaller)`);

        console.log(`\n✓ Successfully bundled ${Object.keys(schemas).length} schemas`);

        return finalSchema;

    } catch (err) {
        console.error('Error processing schemas:', err.message);
        throw err;
    }
}

// CLI usage
if (require.main === module) {
    const [,, modelsDirectory, rootSchemaPath] = process.argv;

    if (!modelsDirectory || !rootSchemaPath) {
        console.log('Usage: node bundle-schemas.js <models-directory> <root-schema-path>');
        console.log('');
        console.log('Example:');
        console.log('  node bundle-schemas.js \\');
        console.log('    ./schema/2.0/model \\');
        console.log('    ./schema/2.0/cyclonedx-2.0.schema.json');
        console.log('');
        console.log('This will create:');
        console.log('  ./schema/2.0/cyclonedx-2.0-bundled.schema.json (pretty-printed with all $comment)');
        console.log('  ./schema/2.0/cyclonedx-2.0-bundled.min.schema.json (minified, root $comment only)');
        process.exit(1);
    }

    bundleSchemas(modelsDirectory, rootSchemaPath, { validate: true })
        .catch(err => process.exit(1));
}

module.exports = { bundleSchemas };