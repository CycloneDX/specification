# CycloneDX 2.0 Module Definitions

This directory contains the modular JSON Schema definitions that constitute the building blocks of the CycloneDX 2.0 specification.

## Purpose

The module definitions are:

- **Reusable** across different schemas such as `cyclonedx-2.0.schema.json` and `cyclonedx-api-2.0.schema.json`
- **Compositional**, enabling coherent and maintainable schema evolution
- **Portable**, supporting external reuse outside the CycloneDX context

Each file in this directory defines a discrete concept and adheres to the CycloneDX data modelling conventions.

These modules are referenced by the schemas in the parent directory and compiled into the bundled schemas
(`cyclonedx-2.0-bundled.schema.json` and `cyclonedx-2.0-bundled.min.schema.json`), ensuring consistency and maximising reuse.

| Schema File                                                                                        | Purpose                                                                                                 |
|----------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| [`cyclonedx-ai-ml-2.0.schema.json`](./cyclonedx-ai-ml-2.0.schema.json)                             | Describes machine learning model properties: learning types, tasks, architecture, modality, quantization, parameters, training datasets, and performance metrics. |
| [`cyclonedx-annotation-2.0.schema.json`](./cyclonedx-annotation-2.0.schema.json)                   | Represents human or automated comments about BOM elements, such as components.                          |
| [`cyclonedx-behavior-2.0.schema.json`](./cyclonedx-behavior-2.0.schema.json)                       | Models behaviors and behavior graphs: behavior instances, triggers, ordering, acknowledgments, nodes, and transitions. |
| [`cyclonedx-blueprint-2.0.schema.json`](./cyclonedx-blueprint-2.0.schema.json)                     | Describes system blueprints (architecture / threat models): scope, assets, data stores, interfaces, zones, boundaries, flows, actors, assumptions, and visualizations. |
| [`cyclonedx-business-objective-2.0.schema.json`](./cyclonedx-business-objective-2.0.schema.json)   | Captures business objectives that components, requirements, and risks can be traced to.                 |
| [`cyclonedx-certification-2.0.schema.json`](./cyclonedx-certification-2.0.schema.json)             | Represents certifications held by components or parties, and references to them.                       |
| [`cyclonedx-citation-2.0.schema.json`](./cyclonedx-citation-2.0.schema.json)                       | Models citations of external sources that substantiate statements made in the BOM.                      |
| [`cyclonedx-common-2.0.schema.json`](./cyclonedx-common-2.0.schema.json)                           | Provides common types and base definitions used across all other modules: references and BOM-Links, hashes, attachments, external references, properties, timestamps, and organizational entities. |
| [`cyclonedx-component-2.0.schema.json`](./cyclonedx-component-2.0.schema.json)                     | Models hardware, software, data, cryptographic, AI, and service components, including versions, identifiers, evidence, inventories, and measurements such as energy consumption. |
| [`cyclonedx-composition-2.0.schema.json`](./cyclonedx-composition-2.0.schema.json)                 | Indicates the known and unknown completeness of BOM elements and their relationships.                   |
| [`cyclonedx-control-2.0.schema.json`](./cyclonedx-control-2.0.schema.json)                         | Describes security and compliance controls, their implementation status, and effectiveness.            |
| [`cyclonedx-cryptography-2.0.schema.json`](./cyclonedx-cryptography-2.0.schema.json)               | Defines cryptographic properties, including cipher suites, IKEv2 parameters, cryptographic functions, lifecycle controls, fingerprints, and related cryptographic assets. |
| [`cyclonedx-data-2.0.schema.json`](./cyclonedx-data-2.0.schema.json)                               | Models data profiles and data objects, including attributes, relationships, subjects, jurisdictions, regulations, classification, and governance. |
| [`cyclonedx-declaration-2.0.schema.json`](./cyclonedx-declaration-2.0.schema.json)                 | Structures conformance declarations: assessors, attestations, claims, evidence, targets, affirmations, and signatures. |
| [`cyclonedx-definition-2.0.schema.json`](./cyclonedx-definition-2.0.schema.json)                   | Provides a collection of reusable, canonical objects (components, parties, licenses, standards, patents, use cases, requirements, etc.) referenced from elsewhere in the document. |
| [`cyclonedx-dependency-2.0.schema.json`](./cyclonedx-dependency-2.0.schema.json)                   | Captures dependency relationships among components in the BOM.                                          |
| [`cyclonedx-evidence-2.0.schema.json`](./cyclonedx-evidence-2.0.schema.json)                       | Defines evidence primitives: occurrences, call stacks, analysis and identification methods, detection rules, assertions, party attribution, and supporting data. |
| [`cyclonedx-formulation-2.0.schema.json`](./cyclonedx-formulation-2.0.schema.json)                 | Describes the process of manufacturing, building, or deploying a component via formulas, workflows, tasks, steps, workspaces, and triggers. |
| [`cyclonedx-jss_X590_2023_10-2.0.schema.json`](./cyclonedx-jss_X590_2023_10-2.0.schema.json)       | Implements ITU-T X.590 (10/2023) JSON Signature Scheme (JSS) for digitally signing JSON objects, supporting single, multiple, and chained signatures. |
| [`cyclonedx-license-2.0.schema.json`](./cyclonedx-license-2.0.schema.json)                         | Models licences using SPDX IDs, named licences, and optional full text, plus licensing details such as purchaser, licensee, terms, and validity periods. |
| [`cyclonedx-metadata-2.0.schema.json`](./cyclonedx-metadata-2.0.schema.json)                       | Contains metadata about the BOM, such as authorship, tools used, timestamps, and distribution constraints (TLP). |
| [`cyclonedx-party-2.0.schema.json`](./cyclonedx-party-2.0.schema.json)                             | Models parties (organizations, persons, systems, personas), their roles, identifiers, addresses, and relationships. |
| [`cyclonedx-patent-2.0.schema.json`](./cyclonedx-patent-2.0.schema.json)                           | Represents patents, patent families, and patent assertions, including application numbers, jurisdictions, filing dates, and priority applications. |
| [`cyclonedx-perspective-2.0.schema.json`](./cyclonedx-perspective-2.0.schema.json)                 | Defines perspectives (domain-specific viewpoints) and how BOM elements map to and are relevant within them. |
| [`cyclonedx-physical-2.0.schema.json`](./cyclonedx-physical-2.0.schema.json)                       | Describes physical attributes of hardware: classification and taxonomy codes, board location, device type, material form, lead time, and quantity. |
| [`cyclonedx-profile-2.0.schema.json`](./cyclonedx-profile-2.0.schema.json)                         | Provides a registry of reusable, named profiles (such as data profiles and threat profiles) that characterize how a subject behaves or is governed. |
| [`cyclonedx-release-notes-2.0.schema.json`](./cyclonedx-release-notes-2.0.schema.json)             | Specifies structured release note content, including release types, notes, and version history.        |
| [`cyclonedx-requirement-2.0.schema.json`](./cyclonedx-requirement-2.0.schema.json)                 | Models engineering requirements, their types, status, acceptance criteria, dependencies, and assertions. |
| [`cyclonedx-risk-2.0.schema.json`](./cyclonedx-risk-2.0.schema.json)                               | Describes risks, including likelihood, impact, scoring, methodology, damage scenarios, assessments, responses, priority, and risk appetite. |
| [`cyclonedx-standard-2.0.schema.json`](./cyclonedx-standard-2.0.schema.json)                       | Describes standards, regulations, and frameworks, including their requirements and levels, referenced in BOM declarations. |
| [`cyclonedx-threat-2.0.schema.json`](./cyclonedx-threat-2.0.schema.json)                           | Models threats and threat scenarios: methodologies, threat profiles, attack vectors, patterns, techniques, attack trees and paths, abuse cases, indicators, trust boundaries, and kill chain phases. |
| [`cyclonedx-usecase-2.0.schema.json`](./cyclonedx-usecase-2.0.schema.json)                         | Describes use cases with steps, flows, exceptions, and associated assertions.                           |
| [`cyclonedx-vulnerability-2.0.schema.json`](./cyclonedx-vulnerability-2.0.schema.json)             | Details vulnerabilities, including advisories, ratings and severity, impact analysis, affected status, exploitability, and evidence. |
| [`cyclonedx-weakness-2.0.schema.json`](./cyclonedx-weakness-2.0.schema.json)                       | Represents weaknesses (e.g. CWE), their identifiers, categories, and references.                        |
