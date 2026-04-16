# UML Diagrams for CycloneDX AI/ML Schema 2.0

This directory contains UML diagrams representing the structure of the CycloneDX AI/ML 2.0 JSON schema.

## Available Diagram Files

### 1. PlantUML Format (`cyclonedx-ai-ml-2.0-uml.puml`)
A comprehensive UML class diagram in PlantUML format showing all classes, relationships, and cardinalities.

**To generate images from PlantUML:**

#### Option A: Using Java and PlantUML JAR
```bash
# Download PlantUML (if not already done)
curl -L -o plantuml.jar https://github.com/plantuml/plantuml/releases/latest/download/plantuml.jar

# Generate PNG with HUFFMAN encoding
java -jar plantuml.jar -tpng -encodesprite cyclonedx-ai-ml-2.0-uml.puml

# Generate SVG with HUFFMAN encoding
java -jar plantuml.jar -tsvg -encodesprite cyclonedx-ai-ml-2.0-uml.puml
```

#### Option B: Using Online PlantUML Server
```bash
# Generate PNG using online service
curl -X POST --data-binary @cyclonedx-ai-ml-2.0-uml.puml \
  https://www.plantuml.com/plantuml/png/ \
  -o cyclonedx-ai-ml-2.0-uml.png

# Generate SVG using online service
curl -X POST --data-binary @cyclonedx-ai-ml-2.0-uml.puml \
  https://www.plantuml.com/plantuml/svg/ \
  -o cyclonedx-ai-ml-2.0-uml.svg
```

#### Option C: Using VS Code Extension
Install the "PlantUML" extension in VS Code and use the preview feature to view and export diagrams.

#### Option D: Using Docker
```bash
docker run --rm -v $(pwd):/data plantuml/plantuml:latest \
  -tpng -tsvg -encodesprite /data/cyclonedx-ai-ml-2.0-uml.puml
```

### 2. Mermaid Format (`cyclonedx-ai-ml-2.0-mermaid.md`)
A Mermaid class diagram embedded in a Markdown file with detailed documentation.

**To view Mermaid diagrams:**
- Open in GitHub (renders automatically)
- Open in VS Code with Mermaid preview extension
- Use online Mermaid Live Editor: https://mermaid.live/
- Render in documentation sites that support Mermaid (GitLab, Notion, etc.)

## Diagram Overview

The diagrams visualize the following main components:

### Core Components
- **ModelCard**: Root object containing architecture, design considerations, and training profile
- **ModelArchitecture**: Structural and behavioral model information
- **DesignConsiderations**: Users, use cases, limitations, and ethical considerations
- **TrainingProfile**: Training datasets, formulas, and learning approaches

### Environmental Impact
- **EnvironmentalConsiderations**: Energy consumption tracking
- **EnergyConsumption**: Activity-based energy metrics
- **EnergyProvider**: Energy source and provider information
- **CO2Measure**: Carbon dioxide equivalent measurements

### Risk Management
- **Consideration**: Named considerations with affected groups
- **RiskGroup**: Groups at risk with domain information

### Supporting Types
- **Enumerations**: LearningType, ActivityType, EnergySource
- **Measures**: EnergyMeasure, CO2Measure
- **External References**: Links to common schema types

## Relationships

The diagrams show:
- **Composition** (filled diamond): Strong ownership relationships
- **Aggregation** (hollow diamond): Weak ownership relationships
- **Association**: References between objects
- **Cardinality**: `1` (exactly one), `0..1` (optional), `0..*` (zero or more), `1..*` (one or more)

## Schema References

The AI/ML schema references several other CycloneDX schemas:
- `cyclonedx-common-2.0.schema.json`: Common types (ExternalReference, Property, etc.)
- `cyclonedx-blueprint-2.0.schema.json`: Actor definitions
- `cyclonedx-usecase-2.0.schema.json`: Use case definitions
- `cyclonedx-risk-2.0.schema.json`: Risk domain definitions

## Notes

- Required fields are marked with `*` in the Mermaid diagram
- External types (from other schemas) are marked with `<<external>>`
- The schema is part of the OWASP CycloneDX standard (ECMA-424)
- Licensed under Apache License 2.0
- **HUFFMAN encoding** (`-encodesprite` flag) is used for better compression of SVG and PNG outputs, resulting in smaller file sizes without quality loss

## Additional Resources

- [CycloneDX Official Site](https://cyclonedx.org/)
- [CycloneDX Specification](https://github.com/CycloneDX/specification)
- [PlantUML Documentation](https://plantuml.com/)
- [Mermaid Documentation](https://mermaid.js.org/)