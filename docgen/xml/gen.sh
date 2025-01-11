#!/bin/bash
set -eu

THIS_PATH="$(realpath "$(dirname "$0")")"
SCHEMA_PATH="$(realpath "$THIS_PATH/../../schema")"
DOCS_PATH="$THIS_PATH/docs"

SAXON_VERSION='10.9'

# --


rm -rf "$DOCS_PATH"


SAXON_JAR="Saxon-HE-${SAXON_VERSION}.jar"
if [ ! -f "$THIS_PATH/$SAXON_JAR" ]; then
  echo "fetching $SAXON_JAR"
  curl --output-dir "$THIS_PATH" -O \
    "https://repo1.maven.org/maven2/net/sf/saxon/Saxon-HE/$SAXON_VERSION/$SAXON_JAR"
fi


generate () {
  version="$1"
  title="CycloneDX v$version XML Reference"
  echo "Generating: $title"

  OUT_FILE="$DOCS_PATH/$version/xml/index.html"
  mkdir -p "$(dirname "$OUT_FILE")"

  ## docs: https://www.saxonica.com/documentation10/index.html#!using-xsl/commandline
  java -jar "$THIS_PATH/$SAXON_JAR" \
    -s:"$SCHEMA_PATH/bom-${version}.xsd" \
    -xsl:"$THIS_PATH/xs3p.xsl" \
    -o:"$OUT_FILE" \
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
