#!/bin/bash
set -eu

THIS_PATH="$(realpath "$(dirname "$0")")"
SCHEMA_DIR="$(realpath "$THIS_DIR/../../schema")"
DOCS_DIR="$THIS_DIR/docs"

SAXON_JAR='Saxon-HE-9.9.1-8.jar'

rm -f -R docs
if [ ! -f "$THIS_DIR/$SAXON_JAR" ]; then
  curl --output-dir "$THIS_DIR" -O \
    "https://repo1.maven.org/maven2/net/sf/saxon/Saxon-HE/9.9.1-8/$SAXON_JAR"
fi

generate () {
  version="$1"
  title="CycloneDX v$version XML Reference"
  echo "Generating: $title"

  java -jar "$THIS_DIR/$SAXON_JAR" \
    -s:"$SCHEMA_DIR/bom-${version}.xsd" \
    -xsl:"$THIS_DIR/xs3p.xsl" \
    -o:"$DOCS_DIR/$version/index.html" \
    cycloneDxVersion="$version" \
    title="$title"
}

generate 1.0
generate 1.1
generate 1.2
generate 1.3
generate 1.4
generate 1.5
generate 1.6
