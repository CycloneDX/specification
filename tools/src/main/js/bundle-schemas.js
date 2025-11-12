#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

/**
 * Recursively walks through an object and rewrites $ref paths
 */
function rewriteRefs(obj, schemaFiles, defsKeyword, currentSchemaName) {
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => rewriteRefs(item, schemaFiles, defsKeyword, currentSchemaName));
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

                // Rewrite to point to the bundled schema's definitions
                newObj[key] = `#/${defsKeyword}/${schemaName}${fragment}`;
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
            newObj[key] = rewriteRefs(value, schemaFiles, defsKeyword, currentSchemaName);
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
        console.log('Rewriting $ref pointers...');

        // Rewrite all $refs in all schemas
        const rewrittenDefinitions = {};
        for (const [name, schema] of Object.entries(schemas)) {
            console.log(`  Rewriting refs in ${name}...`);
            rewrittenDefinitions[name] = rewriteRefs(schema, [...schemaFiles, rootSchemaFilename], defsKeyword, name);
        }

        // Get the rewritten root schema
        const rootSchemaRewritten = rewrittenDefinitions[rootSchemaName];

        // Build the final schema with root schema properties at the top level
        const finalSchema = {
            ...rootSchemaRewritten,
            "$schema": schemaVersion,
            [defsKeyword]: rewrittenDefinitions
        };

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
        await fs.writeFile(bundledPath, JSON.stringify(finalSchema, null, 2));
        const bundledStats = await fs.stat(bundledPath);
        const bundledSizeKB = (bundledStats.size / 1024).toFixed(2);
        console.log(`✓ Bundled schema: ${bundledFilename} (${bundledSizeKB} KB)`);

        // Write minified version
        console.log('Writing minified schema...');
        await fs.writeFile(minifiedPath, JSON.stringify(finalSchema));
        const minifiedStats = await fs.stat(minifiedPath);
        const minifiedSizeKB = (minifiedStats.size / 1024).toFixed(2);
        console.log(`✓ Minified schema: ${minifiedFilename} (${minifiedSizeKB} KB)`);

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
        console.log('  ./schema/2.0/cyclonedx-2.0-bundled.schema.json (pretty-printed)');
        console.log('  ./schema/2.0/cyclonedx-2.0-bundled.min.schema.json (minified)');
        process.exit(1);
    }

    bundleSchemas(modelsDirectory, rootSchemaPath, { validate: true })
        .catch(err => process.exit(1));
}

module.exports = { bundleSchemas };