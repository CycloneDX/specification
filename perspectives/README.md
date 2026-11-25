# Safety Perspective

[safety-perspective.json](safety-perspective.json) proposes a reusable Safety
Perspective for [issue #1122](https://github.com/CycloneDX/specification/issues/1122).
It uses the existing CycloneDX 2.0 perspective, blueprint, risk, annotation, and
declaration models, including the safety work merged in
[PR #1120](https://github.com/CycloneDX/specification/pull/1120).
It adds examples and mappings, with no schema or vocabulary changes.

The catalog document contains a single inline perspective. A consumer can copy
that entry into a document's `perspectives` array. The worked examples reference
the catalog through an external reference of type `perspective`; this reference
does not cause a consumer to fetch or apply the perspective automatically.
Catalog registration and predefined identities proposed in
[PR #1067](https://github.com/CycloneDX/specification/pull/1067) are separate work.

## Reading the view

The mappings select data across the **whole document**. They do not implement
per-assessment scoping, joins, reference resolution, or a completeness policy.
In a document containing several contexts, resolve each assessment's `risks`,
then each risk's `affects`, to identify the relevant asset and its classification.
Resolve that asset's `componentRef` to the component identity and version.
Follow `triggeredBy` to the existing source object and each claim's `target`,
`evidence`, and `counterEvidence` to its subject and supporting records.
Never apply every selected claim or evidence object to every assessment.

The graph in the examples is:

```text
assessment -> triggeredBy -> vulnerability or report annotation
assessment -> risks -> risk -> affects -> asset -> componentRef -> component
                            -> relatedDamageScenarios -> potential harm
claim -> target -> asset
      -> evidence / counterEvidence -> evidence records
assessment -> externalReferences -> authoritative review or change records
```

Assessment status describes progress. Conclusion describes risk acceptability.
For example, an assessment may be `completed` and conclude `unacceptable` while
corrective implementation and verification remain open. `acceptable` is not a
release authorization. A supplied `approved` status still requires the consumer
to establish who approved what, under which process, and with what authority.
The examples preserve the manufacturer's authority and do not certify a product.

## Lessons from the SPDX reviews

These are usage lessons from ongoing SPDX proposals, not a claim that their
unmerged vocabulary is standardized or a lossless SPDX/CycloneDX conversion.

| Review lesson | Application here |
| --- | --- |
| Reuse an existing vulnerability as the source | `triggeredBy` references the vulnerability directly; no duplicate trigger is created. Non-security reports use existing annotations. |
| A trigger can lead to no change | The customer-report example records a bounded no-action result with an explicit rationale and applicable baseline evidence. |
| Separate analysis lifecycle, outcome, and decision | `status` and `conclusion` keep their native meanings. Per-element dispositions and their lifecycle remain in authoritative records; no new Decision class or approval enums are invented. |
| Distinguish affected from added, modified, or removed | `risk.affects` records scope, not a change set. The validation example links to the change record rather than misusing `affects` for proposed edits. |
| Explain why verification is sufficient | `claim.reasoning` explains the selected method and evidence coverage. It is distinct from the source report, analysis scope, and review disposition. |
| Avoid ambiguous impact scales | Classifications remain scheme-specific. Harm is described with its category and example context; no universal safety score or ASIL/SIL/DAL conversion is defined. |
| Keep generic models reusable | Safety-specific workflow guidance lives here and in fixtures rather than restricting the generic risk, annotation, or declaration models. |
| Model closure evidence explicitly | Claims reference actual evidence, and review records bind a subject and assessment. Missing references remain missing even if a status says `completed`. |

The relevant discussions are
[SPDX #1442](https://github.com/spdx/spdx-3-model/pull/1442),
[SPDX #1443](https://github.com/spdx/spdx-3-model/pull/1443), and
[SPDX #1458](https://github.com/spdx/spdx-3-model/pull/1458).

The integrity level on a blueprint asset describes that context, not an intrinsic
classification of every use of the component. An omitted optional classification
means that it was not supplied; it does not assert an absence of safety relevance.
Where a process stops an assessment or closes it as duplicate, retain that state
using the native custom-status form and link the covering analysis or lifecycle
record. Do not label stopped work `completed` solely to imply closure.

## Worked examples

All names, reports, policies, and outcomes below are fictional illustrations.
They are complete local graphs for demonstrating the mappings, not evidence
about an actual product or a general definition of safety-case completeness.

| Example | Result | Evidence and authority boundary |
| --- | --- | --- |
| [Vulnerability](../tools/src/test/resources/2.0/valid-safety-perspective-vulnerability-2.0.json) | Completed, acceptable in the assessed certificate-pinning configuration | Direct vulnerability trigger, contextual IEC 62304 classification, FMEA and regression evidence; separate review record. Existing VEX remains unchanged. |
| [Validation failure](../tools/src/test/resources/2.0/valid-safety-perspective-validation-2.0.json) | Completed, unacceptable; corrective work remains open | Failed test supports a non-conformance claim. A change record tracks the proposed correction and verification rerun. Completed assessment does not close them. |
| [Customer report](../tools/src/test/resources/2.0/valid-safety-perspective-no-action-2.0.json) | Completed, acceptable with a bounded no-action disposition | Design inspection explains why the existing baseline verification remains sufficient and no additional safety verification is required for this report. |

Each reference of type `evidence` on an assessment is a BOM-Link to an embedded
review record. These records are text evidence of example dispositions, not a
portable machine-readable Decision model or an authenticated authorization grant.
For operational use, the authoritative system must establish the responsible
identity, scope, process or policy version, relevant evidence, and authorization.
Keep analysis results separate from each element's disposition and its lifecycle.

Changes to source versions, assumptions, requirements, deployment context, or
evidence validity require reassessment under the responsible lifecycle process.
Do not silently carry a prior decision to the new baseline. Digests detect byte
changes; they do not by themselves detect semantic staleness or completeness.

## Validation

From `tools/src/test/js/schema-v2`, install dependencies and run:

```sh
npm install
npm run test:v2.0:t4-safety-perspective
```

The tests validate the catalog, fixtures, and embedded perspective against the
unmodified source schemas; evaluate every JSONPath mapping on each example;
check local identities, reference binding, and exact-byte hashes of the new
embedded text records; and exercise missing evidence, missing triggers,
counter-evidence, duplicate identities, cross-subject substitution, wrong BOM
versions, and modified evidence. They also demonstrate that an unacceptable
result can coexist with a completed assessment and that VEX is not rewritten.

The test checks are limited to these examples. Schema validity, graph integrity,
cryptographic authenticity, evidence sufficiency, authorization, and safety claim
truth are different checks. The fixtures are unsigned; no signature verification,
authority-policy evaluation, safety acceptance, or release decision is automated.
In particular, a valid signature would not repair missing evidence or give its
signer authority. Required downstream verification may remain open, or a
responsible review may justify no additional verification, as illustrated above.
