# CycloneDX 2.0 Schemas

This directory contains the official JSON Schema definitions for CycloneDX 2.0, as standardised in [ECMA-424](https://ecma-international.org/publications-and-standards/standards/ecma-424/). These schemas constitute the normative implementation of the CycloneDX specification and are intended for use in validation, tooling, and data exchange.

## Schema Overview

| File                                                                                 | Description                                                                                                                                                                             |
|--------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| [`cyclonedx-2.0.schema.json`](./cyclonedx-2.0.schema.json)                           | The normative schema for CycloneDX Bill of Materials (BOM) documents. This schema references modular models and defines the complete structure for expressing inventories and metadata. |
| [`cyclonedx-api-2.0.schema.json`](./cyclonedx-api-2.0.schema.json)                   | The normative API-focused schema. It reuses CycloneDX models but is structured for compatibility with request/response patterns in service architectures.                               |
| [`cyclonedx-combined-2.0.schema.json`](./cyclonedx-combined-2.0.schema.json)         | A fully resolved version of the BOM schema with all external model references inlined. Useful for systems that require a self-contained schema.                                         |
| [`cyclonedx-api-combined-2.0.schema.json`](./cyclonedx-api-combined-2.0.schema.json) | The combined version of the API schema with all model definitions embedded. Suitable for use in tools or validators that do not support `$ref` resolution.                              |

## Modularity and Model Composition

CycloneDX 2.0 is defined as a modular specification. All core concepts—such as components, services, vulnerabilities, licensing, and AI/ML metadata—are encapsulated in reusable model definitions located in the [`model/`](./model) directory.

This modular architecture promotes:

- **Consistency** across multiple schema contexts
- **Reusability** of models within and beyond CycloneDX
- **Clarity and maintainability** for implementers

## Combined Schemas

The `*-combined` schema files are auto-generated from the normative schemas by resolving all references. These are provided for convenience and do not supersede the authoritative pre-defined schemas.

## Related Resources

- CycloneDX Website: [https://cyclonedx.org](https://cyclonedx.org)
- ECMA-424 Publication: [https://ecma-international.org/publications-and-standards/standards/ecma-424/](https://ecma-international.org/publications-and-standards/standards/ecma-424/)
- Model Definitions: See [`model/README.md`](./model/README.md)
