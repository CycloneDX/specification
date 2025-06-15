# CycloneDX 2.0 Model Definitions

This directory contains the modular JSON Schema definitions that constitute the building blocks of the CycloneDX 2.0 specification.

## Purpose

The model definitions are:

- **Reusable** across different schemas such as `bom.schema.json` and `api.schema.json`
- **Compositional**, enabling coherent and maintainable schema evolution
- **Portable**, supporting external reuse outside the CycloneDX context

Each file in this directory defines a discrete concept and adheres to the CycloneDX data modelling conventions.

These models are compiled into the schemas in the parent directory, ensuring consistency and maximising reuse.

| Schema File                                                                                        | Purpose                                                                                                 |
|----------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| [`cyclonedx-ai-model-parameters-2.0.schema.json`](./cyclonedx-ai-model-parameters-2.0.schema.json) | Defines configuration and metadata for AI/ML training, evaluation, and deployment parameters.           |
| [`cyclonedx-ai-modelcard-2.0.schema.json`](./cyclonedx-ai-modelcard-2.0.schema.json)               | Describes AI/ML model cards including intended use, limitations, and ethical considerations.            |
| [`cyclonedx-annotation-2.0.schema.json`](./cyclonedx-annotation-2.0.schema.json)                   | Represents human or automated comments about BOM elements, such as components or services.              |
| [`cyclonedx-common-2.0.schema.json`](./cyclonedx-common-2.0.schema.json)                           | Provides common types and base definitions used across all other schemas.                               |
| [`cyclonedx-component-2.0.schema.json`](./cyclonedx-component-2.0.schema.json)                     | Models hardware, software, data, cryptographic, and AI components and their attributes.                 |
| [`cyclonedx-composition-2.0.schema.json`](./cyclonedx-composition-2.0.schema.json)                 | Indicates the known and unknown completeness of BOM elements and their relationships.                   |
| [`cyclonedx-cryptography-2.0.schema.json`](./cyclonedx-cryptography-2.0.schema.json)               | Defines cryptographic properties, including algorithms, keys, and post-quantum cryptographic readiness. |
| [`cyclonedx-declaration-2.0.schema.json`](./cyclonedx-declaration-2.0.schema.json)                 | Structures conformance declarations, claims, attestations, and associated evidence.                     |
| [`cyclonedx-definition-2.0.schema.json`](./cyclonedx-definition-2.0.schema.json)                   | Contains reusable definitions and enums referenced by other schemas.                                    |
| [`cyclonedx-dependency-2.0.schema.json`](./cyclonedx-dependency-2.0.schema.json)                   | Captures dependency relationships among components and services in the BOM.                             |
| [`cyclonedx-formulation-2.0.schema.json`](./cyclonedx-formulation-2.0.schema.json)                 | Describes the process of manufacturing, building, or deploying a component or service.                  |
| [`cyclonedx-license-2.0.schema.json`](./cyclonedx-license-2.0.schema.json)                         | Models software licences using SPDX IDs, named licences, and optional full text.                        |
| [`cyclonedx-licensing-2.0.schema.json`](./cyclonedx-licensing-2.0.schema.json)                     | Expands on licence metadata with purchaser, licensee, terms, and validity periods.                      |
| [`cyclonedx-metadata-2.0.schema.json`](./cyclonedx-metadata-2.0.schema.json)                       | Contains metadata about the BOM, such as authorship, tools used, and timestamps.                        |
| [`cyclonedx-patent-2.0.schema.json`](./cyclonedx-patent-2.0.schema.json)                           | Represents patents relevant to components, including jurisdiction and legal status.                     |
| [`cyclonedx-patent-assertion-2.0.schema.json`](./cyclonedx-patent-assertion-2.0.schema.json)       | Defines legal claims or disclaimers associated with patents.                                            |
| [`cyclonedx-patent-family-2.0.schema.json`](./cyclonedx-patent-family-2.0.schema.json)             | Groups related patents across different jurisdictions into patent families.                             |
| [`cyclonedx-release-notes-2.0.schema.json`](./cyclonedx-release-notes-2.0.schema.json)             | Specifies structured release note content, including changes and version history.                       |
| [`cyclonedx-service-2.0.schema.json`](./cyclonedx-service-2.0.schema.json)                         | Models services such as APIs or microservices, including endpoints and interactions.                    |
| [`cyclonedx-standard-2.0.schema.json`](./cyclonedx-standard-2.0.schema.json)                       | Describes standards, regulations, and frameworks referenced in BOM declarations.                        |
| [`cyclonedx-vulnerability-2.0.schema.json`](./cyclonedx-vulnerability-2.0.schema.json)             | Details vulnerabilities, including severity, remediation, and advisories.                               |

