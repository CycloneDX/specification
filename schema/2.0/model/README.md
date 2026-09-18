# CycloneDX 2.0 Model Definitions

This directory contains the modular JSON Schema definitions that constitute the building blocks of the CycloneDX 2.0 specification.

## Purpose

The model definitions are:

- **Reusable** across different schemas such as `cyclonedx-2.0.schema.json` and `cyclonedx-api-2.0.schema.json`
- **Compositional**, enabling coherent and maintainable schema evolution
- **Portable**, supporting external reuse outside the CycloneDX context

Each file in this directory defines a discrete concept and adheres to the CycloneDX data modelling conventions.

These models are referenced by the schemas in the parent directory and inlined into the auto-generated `*-bundled` variants, ensuring consistency and maximising reuse.

| Schema File | Purpose |
|-------------|---------|
| [`cyclonedx-ai-modelcard-2.0.schema.json`](./cyclonedx-ai-modelcard-2.0.schema.json) | Describes AI/ML model cards, including model parameters, performance metrics, environmental considerations, intended use, limitations, and ethical considerations. |
| [`cyclonedx-annotation-2.0.schema.json`](./cyclonedx-annotation-2.0.schema.json) | Represents human or automated comments about BOM elements, such as components. |
| [`cyclonedx-behavior-2.0.schema.json`](./cyclonedx-behavior-2.0.schema.json) | Models behaviours performed by objects within the BOM, including triggers, behaviour graphs, nodes, and transitions. |
| [`cyclonedx-blueprint-2.0.schema.json`](./cyclonedx-blueprint-2.0.schema.json) | Provides machine-readable blueprints of systems — assets, data stores, interfaces, zones, and trust boundaries — supporting use case documentation and threat and risk modelling. |
| [`cyclonedx-business-objective-2.0.schema.json`](./cyclonedx-business-objective-2.0.schema.json) | Defines business goals that threats, risks, use cases, and requirements can be traced back to, anchoring risk-centric analysis. |
| [`cyclonedx-certification-2.0.schema.json`](./cyclonedx-certification-2.0.schema.json) | Represents certifications, accreditations, and compliance marks applied to a subject, such as a person, organisation, system, product, or service. |
| [`cyclonedx-citation-2.0.schema.json`](./cyclonedx-citation-2.0.schema.json) | Captures attributions indicating which entity or process supplied specific data within the BOM. |
| [`cyclonedx-common-2.0.schema.json`](./cyclonedx-common-2.0.schema.json) | Provides common types and base definitions used across all other schemas. |
| [`cyclonedx-component-2.0.schema.json`](./cyclonedx-component-2.0.schema.json) | Models hardware, software, data, cryptographic, AI, and service components and their attributes. |
| [`cyclonedx-composition-2.0.schema.json`](./cyclonedx-composition-2.0.schema.json) | Indicates the known and unknown completeness of BOM elements and their relationships. |
| [`cyclonedx-control-2.0.schema.json`](./cyclonedx-control-2.0.schema.json) | Describes safeguards and countermeasures that are recommended or in place, linking their implementation to the requirements they satisfy. |
| [`cyclonedx-cryptography-2.0.schema.json`](./cyclonedx-cryptography-2.0.schema.json) | Defines cryptographic properties, including algorithms, keys, and post-quantum cryptographic readiness. |
| [`cyclonedx-data-2.0.schema.json`](./cyclonedx-data-2.0.schema.json) | Models data profiles capturing classification, information types, and lifecycle requirements for how data is collected, processed, shared, retained, and disposed of. |
| [`cyclonedx-declaration-2.0.schema.json`](./cyclonedx-declaration-2.0.schema.json) | Structures conformance declarations, claims, attestations, and associated evidence. |
| [`cyclonedx-definition-2.0.schema.json`](./cyclonedx-definition-2.0.schema.json) | Collects reusable definitions — standards, patents, use cases, requirements, and business objectives — that may be referenced elsewhere in the BOM. |
| [`cyclonedx-dependency-2.0.schema.json`](./cyclonedx-dependency-2.0.schema.json) | Captures dependency relationships among components in the BOM. |
| [`cyclonedx-evidence-2.0.schema.json`](./cyclonedx-evidence-2.0.schema.json) | Defines evidence structures — occurrences, call stacks, analysis methods, and assertions — that substantiate findings such as component identity or vulnerability presence. |
| [`cyclonedx-formulation-2.0.schema.json`](./cyclonedx-formulation-2.0.schema.json) | Describes the process of manufacturing, building, or deploying a component, including workflows, tasks, and steps. |
| [`cyclonedx-jss_X590_2023_10-2.0.schema.json`](./cyclonedx-jss_X590_2023_10-2.0.schema.json) | Implements ITU-T X.590 (10/2023), the JSON Signature Scheme (JSS), used for enveloped digital signatures of JSON objects. |
| [`cyclonedx-license-2.0.schema.json`](./cyclonedx-license-2.0.schema.json) | Models software licences using SPDX IDs, named licences, and optional full text, together with licensing metadata such as licensee, purchaser, terms, and validity periods. |
| [`cyclonedx-metadata-2.0.schema.json`](./cyclonedx-metadata-2.0.schema.json) | Contains metadata about the BOM, such as authorship, tools used, and timestamps. |
| [`cyclonedx-party-2.0.schema.json`](./cyclonedx-party-2.0.schema.json) | Models organisations, individuals, systems, and personas, including roles, identifiers, postal addresses, and relationships between parties. |
| [`cyclonedx-patent-2.0.schema.json`](./cyclonedx-patent-2.0.schema.json) | Represents patents relevant to components, including jurisdiction and legal status, together with patent families and patent assertions. |
| [`cyclonedx-perspective-2.0.schema.json`](./cyclonedx-perspective-2.0.schema.json) | Defines domain-specific views into the document, with terminology mappings that let different audiences interpret and navigate the data. |
| [`cyclonedx-physical-2.0.schema.json`](./cyclonedx-physical-2.0.schema.json) | Describes characteristics of physical items, including classification, device type, material form, board location, lead time, and quantity. |
| [`cyclonedx-profile-2.0.schema.json`](./cyclonedx-profile-2.0.schema.json) | Provides a registry of reusable, named profiles, such as data and threat profiles, that characterise how a subject behaves or is governed. |
| [`cyclonedx-release-notes-2.0.schema.json`](./cyclonedx-release-notes-2.0.schema.json) | Specifies structured release note content, including changes and version history. |
| [`cyclonedx-requirement-2.0.schema.json`](./cyclonedx-requirement-2.0.schema.json) | Models engineering requirements — needs, constraints, or capabilities that must be met — including status, acceptance criteria, and dependencies. |
| [`cyclonedx-risk-2.0.schema.json`](./cyclonedx-risk-2.0.schema.json) | Details risks and risk assessments, including ratings, likelihood, impact, and quantification, independent of any risk management framework. |
| [`cyclonedx-standard-2.0.schema.json`](./cyclonedx-standard-2.0.schema.json) | Describes standards, regulations, and frameworks referenced in BOM declarations. |
| [`cyclonedx-threat-2.0.schema.json`](./cyclonedx-threat-2.0.schema.json) | Captures threat-modelling content, including threats, threat scenarios, attack patterns, attack trees, attack paths, abuse cases, and trust boundaries. |
| [`cyclonedx-usecase-2.0.schema.json`](./cyclonedx-usecase-2.0.schema.json) | Describes use cases: how actors interact with a system to achieve a goal, including primary flows, alternative paths, and exception scenarios. |
| [`cyclonedx-vulnerability-2.0.schema.json`](./cyclonedx-vulnerability-2.0.schema.json) | Details vulnerabilities, including severity, remediation, and advisories. |
| [`cyclonedx-weakness-2.0.schema.json`](./cyclonedx-weakness-2.0.schema.json) | Classifies underlying weaknesses, such as CWE identifiers, including exploitability and affected scope. |
