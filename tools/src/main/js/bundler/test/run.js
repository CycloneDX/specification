#!/usr/bin/env node

/**
 * Minimal snapshot test for CLI — no test framework required.
 *
 *   node test/run.js                       # compare output against test/snapshot/
 *   UPDATE_SNAPSHOTS=1 node test/run.js    # (re)write test/snapshot/
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert';
import url from 'node:url';

import cliMain from '../cli.js';

const UPDATE_SNAPSHOTS = process.env.UPDATE_SNAPSHOTS === '1';

const FIXTURES_DIR = url.fileURLToPath(new URL('./fixtures', import.meta.url));
const SNAPSHOT_DIR = url.fileURLToPath(new URL('./snapshot', import.meta.url));
const ROOT_SCHEMA = 'main.schema.json';
const MODULES_DIR = 'modules';

async function main() {
    // Work on a copy so the bundler's output never lands in fixtures/
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-schemas-test-'));
    try {
        fs.cpSync(FIXTURES_DIR, workDir, {recursive: true});

        const {bundledFile, minifiedFile, ...report} = await cliMain(
            path.join(workDir, ROOT_SCHEMA),
            path.join(workDir, MODULES_DIR),
        );

        const reportFile = path.join(workDir, 'report.json');
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf8');

        console.log(`\n--- ${UPDATE_SNAPSHOTS ? 'Updating' : 'Checking'} snapshots ---`);
        if (UPDATE_SNAPSHOTS) {
            fs.mkdirSync(SNAPSHOT_DIR, {recursive: true});
        }

        let failures = 0;
        for (const file of [bundledFile, minifiedFile, reportFile]) {
            const actual = fs.readFileSync(file, 'utf8');
            const snapshotPath = path.join(SNAPSHOT_DIR, path.basename(file));

            if (UPDATE_SNAPSHOTS) {
                fs.writeFileSync(snapshotPath, actual);
                console.log(`updated  ${file}`);
                continue;
            }

            let expected;
            try {
                expected = fs.readFileSync(snapshotPath, 'utf8');
            } catch (err) {
                ++failures;
                console.error(`MISSING  ${file} — run with UPDATE_SNAPSHOTS=1 to create it`);
                continue;
            }

            try {
                assert.strictEqual(actual, expected, `snapshot mismatch: ${file}`);
                console.log(`ok       ${file}`);
            } catch (err) {
                ++failures;
                console.error(`FAIL     ${file}`);
                console.error(err.message);
            }
        }

        if (failures > 0) {
            console.error(`\n${failures} snapshot(s) failed`);
            process.exitCode = 1;
        } else if (!UPDATE_SNAPSHOTS) {
            console.log('\nAll snapshots match');
        }
    } finally {
        fs.rmSync(workDir, {recursive: true, force: true});
    }
}

main().catch(err => {
    console.error(err);
    process.exitCode = 1;
});
