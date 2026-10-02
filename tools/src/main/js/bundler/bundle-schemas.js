#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

function isObject(value) {
    return typeof value === 'object' && value !== null;
}

/**
 * Whether `filePath` lives (at any depth) inside `dirPath`. Both must be absolute.
 */
function isInsideDir(filePath, dirPath) {
    const rel = path.relative(dirPath, filePath);
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Whether `ref` is an absolute URI (has a scheme, e.g. `https://...`, `urn:`).
 * Such refs always point to external schemas: they are never bundled, rewritten nor checked.
 */
function isAbsoluteUri(ref) {
    return /^[a-z][a-z0-9+.-]*:/i.test(ref);
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

const FILE_REF_RE = /^(.+\.schema\.json)(#.*)?$/;

/**
 * make schema name from schema file
 * @param file
 * @return {string}
 */
function makeSchemaName(file)
{
    return path.basename(file, '.schema.json');
}

/**
 * Recursively walks through an object and rewrites $ref paths.
 *
 * Relative file refs are resolved against `currentSchemaDir`:
 *  - if the resolved path is in `bundledSchemaPaths`, the ref is pointed into the bundle's definitions;
 *  - otherwise the file stays external and the ref is rewired relative to `targetSchemaDir`
 *    (the directory the bundle is written to).
 */
function rewriteRefs(obj, defsKeyword, currentSchemaName, currentSchemaDir, targetSchemaDir, bundledSchemaPaths) {
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => rewriteRefs(item, defsKeyword, currentSchemaName, currentSchemaDir, targetSchemaDir,  refExceptionSet));
    }

    const newObj = {};
    for (const [key, value] of Object.entries(obj)) {
        if (key === '$ref' && typeof value === 'string') {
            // Absolute URIs (https://..., urn:...) are never file refs: skip the file match for them
            const fileMatch = isAbsoluteUri(value) ? null : value.match(FILE_REF_RE);
            // Case 1: Reference to another schema file by relative path
            if (fileMatch) {
                const filename = fileMatch[1];
                const fragment = fileMatch[2] || '';
                const resolvedPath = path.resolve(currentSchemaDir, filename);

                // The target file is bundled -> point into the bundle's definitions
                if (bundledSchemaPaths.has(resolvedPath)) {
                    const schemaName = makeSchemaName(resolvedPath);
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
                // The target file is not bundled -> rewire the ref relative to where the bundle is written
                else {
                    const filenameRewired = path
                        .relative(targetSchemaDir, resolvedPath)
                        .split(path.sep)
                        .join('/');
                    newObj[key] = `${filenameRewired}${fragment}`;
                }
            }
            // Case 2: Internal reference within the same schema (starts with #)
            else if (value.startsWith('#')) {
                // Rewrite to be relative to the current schema's location in the bundle
                newObj[key] = `#/${defsKeyword}/${currentSchemaName}${value.substring(1)}`;
            }
            // Case 3: Absolute URIs (https://..., urn:...) and anything else -> external, left as-is
            else {
                newObj[key] = value;
            }
        } else {
            newObj[key] = rewriteRefs(value, defsKeyword, currentSchemaName, currentSchemaDir, targetSchemaDir, bundledSchemaPaths);
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

function stripTopLevelKeys(obj, keysToRemove = []) {
    if (!isObject(obj)) return obj;
    const clone = { ...obj };
    for (const k of keysToRemove) {
        if (k in clone) delete clone[k];
    }
    return clone;
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
        const baseFilename = makeSchemaName(rootSchemaFilename);
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

            schemas[schemaPath] = schema;
        }

        // Read the root schema
        console.log(`\nReading root schema...`);
        const rootContent = await fs.readFile(absoluteRootPath, 'utf8');
        const rootSchema = JSON.parse(rootContent);

        // Add root schema to the schemas collection
        schemas[absoluteRootPath] = rootSchema;

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

        // Everything read from the models directory (plus the root schema) is bundled.
        // Any other file a $ref points to stays external and is only checked for existence.
        const bundledSchemaPaths = new Set(Object.keys(schemas));

        // Pre-check: every relative file $ref target must either be bundled or exist on disk.
        // A target inside the models directory that was NOT loaded is an error (missing or filtered file).
        // Absolute URIs (https://...) are external by definition and are not checked.
        console.log('Validating external $ref targets...');
        for (const [schemaPath, schema] of Object.entries(schemas)) {
            const schemaDir = path.dirname(schemaPath);
            // Only $ref can be external; $dynamicRef/$recursiveRef are JSON Pointers by spec
            const refs = collectRefKeywords(schema, ['$ref'], (v) => !isAbsoluteUri(v) && FILE_REF_RE.test(v));
            for (const { ref, key, path: refPath } of refs) {
                const target = ref.match(FILE_REF_RE)[1];
                const resolvedPath = path.resolve(schemaDir, target);
                if (bundledSchemaPaths.has(resolvedPath)) continue;
                if (isInsideDir(resolvedPath, absoluteModelsDir)) {
                    throw new Error(`Unresolved external ${key} target file '${target}' referenced from schema '${schemaPath}' at '${refPath}'`);
                }
                try {
                    await fs.access(resolvedPath);
                } catch (err) {
                    throw new Error(`Missing external ${key} target file '${target}' referenced from schema '${schemaPath}' at '${refPath}'`,
                        {cause: err});
                }
            }
        }

        console.log('Rewriting $ref pointers...');

        // Rewrite all $refs in all schemas
        const rewrittenDefinitions = {};
        for (const [schemaPath, schema] of Object.entries(schemas)) {
            console.log(`  Rewriting refs in ${schemaPath}...`);
            rewrittenDefinitions[schemaPath] = rewriteRefs(schema, defsKeyword, makeSchemaName(schemaPath), path.dirname(schemaPath), rootSchemaDir, bundledSchemaPaths);
        }

        // Get the rewritten root schema
        const rootSchemaRewritten = rewrittenDefinitions[absoluteRootPath];

        // Strip top-level metadata keys from each embedded definition ($defs)
        const keysToStripFromDefs = ['$schema', '$id', '$comment'];
        const cleanedDefinitions = {};
        for (const [schemaPath, defSchema] of Object.entries(rewrittenDefinitions)) {
            cleanedDefinitions[makeSchemaName(schemaPath)] = stripTopLevelKeys(defSchema, keysToStripFromDefs);
        }

        // The root schema's own definition entry is emitted only when
        // something references it: its content already forms the top level of
        // the bundle, so an unreferenced copy is dead weight that downstream
        // tools (e.g. schema documentation generators) render as a duplicate
        // of the document root.
        const rootDefName = makeSchemaName(absoluteRootPath);
        const rootDefEntry = cleanedDefinitions[rootDefName];
        delete cleanedDefinitions[rootDefName];

        // Build the final schema with root schema properties at the top level
        const finalSchema = {
            ...rootSchemaRewritten,
            "$schema": schemaVersion,
            [defsKeyword]: cleanedDefinitions
        };

        const rootDefPointer = `#/${defsKeyword}/${rootDefName}`;
        const rootDefRefs = collectRefKeywords(
            finalSchema,
            ['$ref', '$dynamicRef', '$recursiveRef'],
            (v) => v === rootDefPointer || v.startsWith(`${rootDefPointer}/`)
        );
        if (rootDefRefs.length > 0) {
            console.log(`Keeping ${defsKeyword} entry '${rootDefName}' (referenced ${rootDefRefs.length}x)`);
            finalSchema[defsKeyword][rootDefName] = rootDefEntry;
        }

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
        const prettyJson = JSON.stringify({
            ...finalSchema,
            "$id": new URL(bundledFilename, finalSchema['$id']).toString()
        }, null, 2);
        await fs.writeFile(bundledPath, prettyJson);
        const bundledStats = await fs.stat(bundledPath);
        const bundledSizeKB = (bundledStats.size / 1024).toFixed(2);
        console.log(`✓ Bundled schema: ${bundledFilename} (${bundledSizeKB} KB)`);

        // Write minified version
        console.log('Writing minified schema...');
        const minifiedSchema = removeComments(finalSchema, true);
        const minifiedJson = JSON.stringify({
            ...minifiedSchema,
            "$id": new URL(minifiedFilename, finalSchema['$id']).toString()
        });

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
