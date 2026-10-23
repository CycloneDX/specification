"use strict";

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, readdir} from 'node:fs/promises';
import {test} from 'node:test';

import Ajv2020 from 'ajv/dist/2020.js';
import draft7MetaSchema from 'ajv/dist/refs/json-schema-draft-07.json' with {type: 'json'};
import addFormats from 'ajv-formats';
import addFormats2019 from 'ajv-formats-draft2019';
import {JSONPath} from 'jsonpath-plus';

const root = new URL('../../../../../', import.meta.url);
const readJson = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const catalog = await readJson('perspectives/safety-perspective.json');
const perspective = catalog.perspectives[0];
const scenarios = ['vulnerability', 'validation', 'no-action'];
const examples = await Promise.all(scenarios.map(scenario =>
    readJson(`tools/src/test/resources/2.0/valid-safety-perspective-${scenario}-2.0.json`)));

// Register the unmodified source schemas. readdir also works on Windows,
// where a platform-specific glob pattern can silently select no modules.
const ajv = new Ajv2020({strict: false, allErrors: true, validateFormats: true});
ajv.addMetaSchema(draft7MetaSchema);
addFormats(ajv);
addFormats2019(ajv, {formats: ['idn-email']});
ajv.addFormat('iri-reference', true); // Same limitation as the existing harness.
for (const name of ['spdx', 'cryptography-defs', 'behavior-taxonomy']) {
    ajv.addSchema(await readJson(`schema/${name}.schema.json`), `https://cyclonedx.org/schema/${name}.schema.json`);
}
const moduleDirectory = new URL('schema/2.0/modules/', root);
for (const name of (await readdir(moduleDirectory)).sort()) {
    if (name.endsWith('.schema.json')) {
        ajv.addSchema(JSON.parse(await readFile(new URL(name, moduleDirectory), 'utf8')));
    }
}
const validate = ajv.compile(await readJson('schema/2.0/cyclonedx-2.0.schema.json'));
const schemaValid = document => assert.ok(validate(document), JSON.stringify(validate.errors));

const select = (document, expression) => JSONPath({path: expression, json: document});

function indexReferences(document) {
    const index = new Map();
    function visit(value) {
        if (Array.isArray(value)) return value.forEach(visit);
        if (value === null || typeof value !== 'object') return;
        if (value['bom-ref']) {
            assert.ok(!index.has(value['bom-ref']), `Duplicate bom-ref: ${value['bom-ref']}`);
            index.set(value['bom-ref'], value);
        }
        Object.values(value).forEach(visit);
    }
    visit(document);
    return index;
}

// These checks describe the self-contained examples, not a general
// CycloneDX conformance, completeness, authorization, or safety evaluator.
function assertExampleLinks(document) {
    const index = indexReferences(document);
    const resolve = ref => {
        assert.ok(index.has(ref), `Unresolved local reference: ${ref}`);
        return index.get(ref);
    };
    const affected = new Set(document.risks.risks.flatMap(risk => risk.affects));
    for (const assessment of document.risks.assessments) {
        assessment.triggeredBy.forEach(resolve);
        assessment.risks.forEach(ref => assert.ok(document.risks.risks.includes(resolve(ref))));
        for (const reference of assessment.externalReferences ?? []) {
            if (reference.url.startsWith('urn:cdx:')) {
                const prefix = `urn:cdx:${document.serialNumber.slice('urn:uuid:'.length)}/${document.version}#`;
                assert.ok(reference.url.startsWith(prefix), 'Review record belongs to another BOM or version');
                const evidence = resolve(reference.url.slice(prefix.length));
                assert.ok(document.declarations.evidence.includes(evidence), 'Review reference must resolve to evidence');
            }
        }
    }
    for (const asset of document.blueprints.flatMap(blueprint => blueprint.assets)) {
        resolve(asset.componentRef);
    }
    for (const risk of document.risks.risks) {
        risk.affects.forEach(resolve);
        for (const field of ['relatedVulnerabilities', 'relatedRequirements', 'relatedClaims', 'relatedDamageScenarios']) {
            (risk[field] ?? []).forEach(resolve);
        }
    }
    for (const annotation of document.annotations ?? []) annotation.subjects.forEach(resolve);
    for (const claim of document.declarations.claims) {
        resolve(claim.target);
        assert.ok(affected.has(claim.target), 'Claim is bound to a different subject');
        for (const ref of [...claim.evidence ?? [], ...claim.counterEvidence ?? []]) {
            assert.ok(document.declarations.evidence.includes(resolve(ref)), 'Claim must reference evidence');
        }
    }
}

function assertEmbeddedDigests(document) {
    for (const evidence of document.declarations.evidence) {
        for (const {contents} of evidence.data ?? []) {
            if (!contents.attachment || contents.attachment.encoding) continue;
            for (const hash of contents.hashes ?? []) {
                assert.equal(hash.alg, 'SHA-256');
                assert.equal(createHash('sha256').update(contents.attachment.content, 'utf8').digest('hex'), hash.content);
            }
        }
    }
}

test('perspective definition is a valid native CycloneDX 2.0 document', () => {
    schemaValid(catalog);
    assert.equal(catalog.perspectives.length, 1);
    assert.equal(perspective.name, 'Safety Perspective');
    assert.ok(!('predefined' in perspective));
    assert.ok(perspective.mappings.every(mapping => !('via' in mapping) && !('expectation' in mapping)));
});

for (const [i, scenario] of scenarios.entries()) {
    test(`${scenario}: schema, local graph, evidence digests, and actual mapping results`, () => {
        const document = examples[i];
        schemaValid(document);
        assertExampleLinks(document);
        assertEmbeddedDigests(document);
        // A reader can embed the catalog entry without any schema extension.
        schemaValid({...document, perspectives: [perspective]});
        for (const mapping of perspective.mappings) {
            const selected = select(document, mapping.expression);
            assert.ok(selected.length > 0, `Mapping selects no example data: ${mapping.nativeName}`);
        }
        assert.deepEqual(select(document, '$.risks.assessments[*].triggeredBy[*]'), document.risks.assessments[0].triggeredBy);
        assert.deepEqual(select(document, '$.blueprints[*].assets[*].classification.safetyIntegrityLevels[*]'), [{scheme: 'IEC-62304', level: 'class-c'}]);
        assert.deepEqual(select(document, "$.risks.assessments[*].externalReferences[?(@.type=='evidence')]"), document.risks.assessments[0].externalReferences.filter(ref => ref.type === 'evidence'));
    });
}

test('existing vulnerability is the trigger, without a duplicate trigger annotation', () => {
    assert.equal(examples[0].risks.assessments[0].triggeredBy[0], examples[0].vulnerabilities[0]['bom-ref']);
    assert.ok(!examples[0].annotations);
});

test('completed assessment can have an unacceptable conclusion and unfinished corrective work', () => {
    const assessment = examples[1].risks.assessments[0];
    assert.equal(assessment.status, 'completed');
    assert.equal(assessment.conclusion, 'unacceptable');
    assert.match(assessment.summary, /correction and verification rerun remain open/);
});

test('recorded evidence exists before the assessment and document snapshot', () => {
    for (const document of examples) {
        const assessmentTime = Date.parse(document.risks.assessments[0].timestamp);
        assert.ok(assessmentTime <= Date.parse(document.metadata.timestamp));
        for (const evidence of document.declarations.evidence) {
            assert.ok(Date.parse(evidence.created) <= assessmentTime);
        }
    }
});

test('no-action outcome has existing baseline evidence and a sufficiency rationale', () => {
    const document = examples[2];
    assert.equal(document.risks.assessments[0].conclusion, 'acceptable');
    assert.match(document.declarations.claims[0].reasoning, /baseline/);
    assert.deepEqual(document.declarations.claims[0].evidence, ['evidence-design-inspection', 'evidence-baseline-test']);
});

test('schema-valid missing evidence is detected by the example graph checks', () => {
    const broken = structuredClone(examples[1]);
    broken.declarations.evidence = broken.declarations.evidence.filter(e => e['bom-ref'] !== 'evidence-validation-failure');
    schemaValid(broken);
    assert.throws(() => assertExampleLinks(broken), /Unresolved local reference/);
});

test('schema-valid missing trigger is detected', () => {
    const broken = structuredClone(examples[1]);
    broken.annotations = [];
    schemaValid(broken);
    assert.throws(() => assertExampleLinks(broken), /Unresolved local reference/);
});

test('counter-evidence references must also resolve', () => {
    const broken = structuredClone(examples[0]);
    broken.declarations.claims[0].counterEvidence = ['missing-counter-evidence'];
    schemaValid(broken);
    assert.throws(() => assertExampleLinks(broken), /Unresolved local reference/);
});

test('duplicate identities cannot silently shadow another object', () => {
    const broken = structuredClone(examples[1]);
    broken.declarations.evidence[1]['bom-ref'] = broken.declarations.evidence[0]['bom-ref'];
    schemaValid(broken);
    assert.throws(() => assertExampleLinks(broken), /Duplicate bom-ref/);
});

test('an existing but unrelated claim target cannot substitute for the assessed context', () => {
    const broken = structuredClone(examples[1]);
    broken.definitions.components.push({'bom-ref': 'another-device', type: 'device', name: 'Unrelated device'});
    broken.declarations.claims[0].target = 'another-device';
    schemaValid(broken);
    assert.throws(() => assertExampleLinks(broken), /different subject/);
});

test('review BOM-Link must bind the current document and version', () => {
    const broken = structuredClone(examples[1]);
    broken.risks.assessments[0].externalReferences[0].url = broken.risks.assessments[0].externalReferences[0].url.replace('/1#', '/2#');
    schemaValid(broken);
    assert.throws(() => assertExampleLinks(broken), /another BOM or version/);
});

test('schema-valid evidence modification fails its exact-byte digest check', () => {
    const broken = structuredClone(examples[1]);
    broken.declarations.evidence[0].data[0].contents.attachment.content += ' Result changed to pass.';
    schemaValid(broken);
    assert.throws(() => assertEmbeddedDigests(broken), assert.AssertionError);
});

test('unresolved required graph branch is not repaired by a completed or approved status', () => {
    for (const status of ['completed', 'approved']) {
        const broken = structuredClone(examples[1]);
        broken.risks.assessments[0].status = status;
        broken.declarations.claims[0].evidence.push('missing-verification-rerun');
        schemaValid(broken);
        assert.throws(() => assertExampleLinks(broken), /Unresolved local reference/);
    }
});

test('perspective and graph checks leave the supplied VEX applicability unchanged', () => {
    const document = structuredClone(examples[0]);
    const original = structuredClone(document.vulnerabilities[0].analysis);
    assertExampleLinks(document);
    for (const mapping of perspective.mappings) select(document, mapping.expression);
    assert.deepEqual(document.vulnerabilities[0].analysis, original);
});

test('graph and digest checks make no authentication or authorization assertion', () => {
    for (const document of examples) {
        assertExampleLinks(document);
        assertEmbeddedDigests(document);
        // These synthetic, unsigned records deliberately carry no grant of authority.
        assert.ok(!document.signatures);
        assert.ok(document.declarations.evidence.every(evidence => !evidence.signatures));
        assert.notEqual(document.risks.assessments[0].status, 'approved');
    }
});
