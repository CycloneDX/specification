#!/bin/bash
set -eu

declare -a CDX_VERSIONS=(
  '1.6'
  '1.5'
  '1.4'
  '1.3'
  '1.2'
  '1.1'
  '1.0'
)

# region help
DESC="Generate HTML Schema navigator for CycloneDX XML"
USAGE="
Usage: $0 [CDX_VERSION...]

Supported values for CDX_VERSION: ${CDX_VERSIONS[*]}
"
# endregion help


THIS_PATH="$(realpath "$(dirname "$0")")"
SCHEMA_PATH="$(realpath "$THIS_PATH/../../schema")"
DOCS_PATH="$THIS_PATH/docs"

SAXON_VERSION='10.9'


# --


SAXON_JAR="Saxon-HE-${SAXON_VERSION}.jar"
prepare () {
  if [ ! -f "$THIS_PATH/$SAXON_JAR" ]; then
    echo "fetching $SAXON_JAR"
    curl --output-dir "$THIS_PATH" -O \
      "https://repo1.maven.org/maven2/net/sf/saxon/Saxon-HE/$SAXON_VERSION/$SAXON_JAR"
  fi
}


generate () {
  local version="$1"
  local title="CycloneDX v$version XML Reference"
  echo "Generating: $title"

  local OUT_FILE="$DOCS_PATH/$version/xml/index.html"
  local OUT_DIR="$(dirname "$OUT_FILE")"
  rm -rf "$OUT_DIR"
  mkdir -p "$OUT_DIR"

  ## docs: https://www.saxonica.com/documentation10/index.html#!using-xsl/commandline
  java -jar "$THIS_PATH/$SAXON_JAR" \
    -s:"$SCHEMA_PATH/bom-${version}.xsd" \
    -xsl:"$THIS_PATH/xs3p.xsl" \
    -o:"$OUT_FILE" \
    cycloneDxVersion="$version" \
    title="$title"
}


# Main logic to handle the argument using a switch case
case "$#" in
  1)
    case "$1" in
      '-h'|'--help')
        echo "$DESC"
        echo "$USAGE"
        exit 0
        ;;
      *) # One argument provided: Call generate with the specific version
        for version in "${CDX_VERSIONS[@]}"
        do
          if [[ "$1" == "$version" ]]
          then
            prepare
            generate "$1"
            exit 0
          fi
        done
        echo "Error: unknown CDX_VERSION: $1"
        echo "$USAGE"
        exit 1
        ;;
    esac
    ;;
  0) # No arguments provided: Loop over all
    for version in "${CDX_VERSIONS[@]}"
    do
      prepare
      generate "$version"
    done
    exit 0
    ;;
  *) # More than one argument provided: Show usage help
    echo "Usage: $USAGE"
    exit 2
    ;;
esac
