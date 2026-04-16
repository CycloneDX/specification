# CycloneDX AI/ML Schema 2.0 - UML Diagrams

## Mermaid Class Diagram

```mermaid
classDiagram
    class ModelCard {
        +ModelArchitecture architecture
        +DesignConsiderations designConsiderations
        +TrainingProfile trainingProfile
    }

    class ModelArchitecture {
        +Structural structural
        +string[] behavioralParadigm
        +string[] specializedProcessing
        +ExternalReference[] externalReferences
        +Property[] properties
    }

    class Structural {
        +string primary*
        +string topologyType
        +string[] secondary
    }

    class DesignConsiderations {
        +Actor[] users
        +UseCases useCases
        +Consideration[] technicalLimitations
        +Consideration[] performanceTradeoffs
        +Consideration[] ethicalConsiderations
        +EnvironmentalConsiderations environmentalConsiderations
        +Consideration[] fairnessAssessments
        +ExternalReference[] externalReferences
        +Property[] properties
    }

    class Consideration {
        +string name*
        +string description
        +RiskGroup[] groupsAtRisk
        +ExternalReference[] externalReferences
        +Property[] properties
    }

    class RiskGroup {
        +string groupName*
        +string groupDescription
        +string type
        +string description
        +string priority
        +ExternalReference[] externalReferences
        +Property[] properties
    }

    class TrainingProfile {
        +DatasetProcessingSpec[] dataProcessingSpec
        +DatasetProcessingSpec[] trainingDatasets
        +TrainingFormula trainingFormula
    }

    class DatasetProcessingSpec {
        +DatasetReference[] datasets
        +string datasetProcessingFormula
        +ExternalReference[] externalReferences
        +Property[] properties
    }

    class DatasetReference {
        +string dataRef
    }

    class TrainingFormula {
        +string formulaRef
    }

    class EnvironmentalConsiderations {
        +EnergyConsumption[] energyConsumptions
        +Property[] properties
    }

    class EnergyConsumption {
        +ActivityType activity*
        +EnergyProvider[] energyProviders*
        +EnergyMeasure activityEnergyCost*
        +CO2Measure co2CostEquivalent
        +CO2Measure co2CostOffset
        +Property[] properties
    }

    class ActivityType {
        <<enumeration>>
        design
        data-collection
        data-preparation
        training
        fine-tuning
        validation
        deployment
        inference
        other
    }

    class EnergyProvider {
        +string bom-ref
        +string description
        +OrganizationalEntity organization*
        +EnergySource energySource*
        +EnergyMeasure energyProvided*
        +ExternalReference[] externalReferences
    }

    class EnergySource {
        <<enumeration>>
        coal
        oil
        natural-gas
        nuclear
        wind
        solar
        geothermal
        hydropower
        biofuel
        unknown
        other
    }

    class EnergyMeasure {
        +number value*
        +string unit*
    }

    class CO2Measure {
        +number value*
        +string unit*
    }

    class Graphic {
        +string name
        +Attachment image
    }

    class ExternalReference {
        <<external>>
        +string url
        +string type
        +string comment
    }

    class Property {
        <<external>>
        +string name
        +string value
    }

    class OrganizationalEntity {
        <<external>>
        +string name
        +string[] url
    }

    class Actor {
        <<external>>
    }

    class UseCases {
        <<external>>
    }

    class Attachment {
        <<external>>
        +string content
        +string contentType
        +string encoding
    }

    ModelCard "1" *-- "0..1" ModelArchitecture
    ModelCard "1" *-- "0..1" DesignConsiderations
    ModelCard "1" *-- "0..1" TrainingProfile

    ModelArchitecture "1" *-- "0..1" Structural
    ModelArchitecture "1" *-- "0..*" ExternalReference
    ModelArchitecture "1" *-- "0..*" Property

    DesignConsiderations "1" *-- "0..*" Actor
    DesignConsiderations "1" *-- "0..1" UseCases
    DesignConsiderations "1" *-- "0..*" Consideration
    DesignConsiderations "1" *-- "0..1" EnvironmentalConsiderations
    DesignConsiderations "1" *-- "0..*" ExternalReference
    DesignConsiderations "1" *-- "0..*" Property

    Consideration "1" *-- "0..*" RiskGroup
    Consideration "1" *-- "0..*" ExternalReference
    Consideration "1" *-- "0..*" Property

    RiskGroup "1" *-- "0..*" ExternalReference
    RiskGroup "1" *-- "0..*" Property

    TrainingProfile "1" *-- "0..*" DatasetProcessingSpec
    TrainingProfile "1" *-- "0..1" TrainingFormula

    DatasetProcessingSpec "1" *-- "0..*" DatasetReference
    DatasetProcessingSpec "1" *-- "0..*" ExternalReference
    DatasetProcessingSpec "1" *-- "0..*" Property

    EnvironmentalConsiderations "1" *-- "0..*" EnergyConsumption
    EnvironmentalConsiderations "1" *-- "0..*" Property

    EnergyConsumption "1" *-- "1" ActivityType
    EnergyConsumption "1" *-- "1..*" EnergyProvider
    EnergyConsumption "1" *-- "1" EnergyMeasure
    EnergyConsumption "1" *-- "0..1" CO2Measure
    EnergyConsumption "1" *-- "0..*" Property

    EnergyProvider "1" *-- "1" OrganizationalEntity
    EnergyProvider "1" *-- "1" EnergySource
    EnergyProvider "1" *-- "1" EnergyMeasure
    EnergyProvider "1" *-- "0..*" ExternalReference

    Graphic "1" *-- "0..1" Attachment
```

## Key Components

### ModelCard
The root object containing architecture, design considerations, and training profile information for AI/ML models.

### ModelArchitecture
Describes the structural and behavioral aspects of the model:
- **Structural**: Primary architecture (e.g., Transformer, CNN, RNN), topology type, and secondary components
- **Behavioral Paradigm**: Learning approaches (e.g., Autoregressive, Diffusion, Contrastive)
- **Specialized Processing**: Custom mechanisms (e.g., RoPE, FlashAttention-2)

### DesignConsiderations
Captures various considerations for model design and deployment:
- **Users**: Intended users of the model
- **Use Cases**: Intended applications
- **Technical Limitations**: Mathematical and physical constraints
- **Performance Tradeoffs**: Known accuracy/performance tradeoffs
- **Ethical Considerations**: Ethical risks
- **Environmental Considerations**: Environmental impact metrics
- **Fairness Assessments**: Fairness evaluations

### TrainingProfile
Information about training data and methodology:
- **Data Processing Spec**: Array of data processing specifications
- **Training Datasets**: Dataset processing specifications for training
- **Training Formula**: Reference to the training formula defined elsewhere in the BOM

### EnvironmentalConsiderations
Tracks environmental impact through:
- **Energy Consumption**: Energy used across lifecycle activities
- **Energy Providers**: Organizations providing energy with source information
- **CO2 Metrics**: Carbon dioxide equivalent measurements

### Risk Management
- **Consideration**: Named considerations with descriptions and affected risk groups
- **RiskGroup**: Groups at risk with domain information from risk schema

## Notes

- Fields marked with `*` are required
- `<<external>>` indicates types defined in other CycloneDX schemas
- Enumerations show allowed values for specific fields
- Cardinality notation: `1` (exactly one), `0..1` (optional), `0..*` (zero or more), `1..*` (one or more)