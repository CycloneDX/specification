#!/bin/bash
# Script to generate UML diagrams from PlantUML source

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PLANTUML_FILE="cyclonedx-ai-ml-2.0-uml.puml"
PLANTUML_JAR="plantuml.jar"

echo "CycloneDX AI/ML Schema UML Diagram Generator"
echo "============================================="
echo ""

# Check if PlantUML file exists
if [ ! -f "$PLANTUML_FILE" ]; then
    echo "Error: $PLANTUML_FILE not found!"
    exit 1
fi

# Function to generate using Java
generate_with_java() {
    echo "Checking for Java..."
    if ! command -v java &> /dev/null; then
        echo "Java not found. Please install Java or use another method."
        return 1
    fi

    echo "Checking for PlantUML JAR..."
    if [ ! -f "$PLANTUML_JAR" ]; then
        echo "Downloading PlantUML..."
        curl -L -o "$PLANTUML_JAR" \
            "https://github.com/plantuml/plantuml/releases/latest/download/plantuml.jar"
    fi

    echo "Generating PNG diagram with HUFFMAN encoding..."
    java -jar "$PLANTUML_JAR" -tpng -encodesprite "$PLANTUML_FILE"

    echo "Generating SVG diagram with HUFFMAN encoding..."
    java -jar "$PLANTUML_JAR" -tsvg -encodesprite "$PLANTUML_FILE"

    echo "✓ Diagrams generated successfully!"
    return 0
}

# Function to generate using online service
generate_with_online() {
    echo "Using PlantUML online service..."

    # Encode the file for URL
    ENCODED=$(cat "$PLANTUML_FILE" | plantuml -encodesprite 2>/dev/null || cat "$PLANTUML_FILE")

    echo "Generating PNG diagram..."
    curl -X POST --data-binary "@$PLANTUML_FILE" \
        "https://www.plantuml.com/plantuml/png/" \
        -o "cyclonedx-ai-ml-2.0-uml.png" 2>/dev/null || {
        echo "Failed to generate PNG via online service"
        return 1
    }

    echo "Generating SVG diagram..."
    curl -X POST --data-binary "@$PLANTUML_FILE" \
        "https://www.plantuml.com/plantuml/svg/" \
        -o "cyclonedx-ai-ml-2.0-uml.svg" 2>/dev/null || {
        echo "Failed to generate SVG via online service"
        return 1
    }

    echo "✓ Diagrams generated successfully!"
    return 0
}

# Function to generate using Docker
generate_with_docker() {
    echo "Using Docker..."
    if ! command -v docker &> /dev/null; then
        echo "Docker not found."
        return 1
    fi

    echo "Generating diagrams with Docker and HUFFMAN encoding..."
    docker run --rm -v "$(pwd):/data" plantuml/plantuml:latest \
        -tpng -tsvg -encodesprite "/data/$PLANTUML_FILE"

    echo "✓ Diagrams generated successfully!"
    return 0
}

# Try methods in order
echo "Attempting to generate diagrams..."
echo ""

if generate_with_java; then
    exit 0
elif generate_with_online; then
    exit 0
elif generate_with_docker; then
    exit 0
else
    echo ""
    echo "Failed to generate diagrams automatically."
    echo ""
    echo "Please try one of these manual methods:"
    echo "1. Install Java and run: java -jar plantuml.jar -tpng -tsvg -encodesprite $PLANTUML_FILE"
    echo "2. Use VS Code with PlantUML extension (add -encodesprite to settings)"
    echo "3. Visit https://www.plantuml.com/plantuml/uml/ and paste the file content"
    echo "4. Use Docker: docker run --rm -v \$(pwd):/data plantuml/plantuml:latest -tpng -tsvg -encodesprite /data/$PLANTUML_FILE"
    exit 1
fi

# Made with Bob
