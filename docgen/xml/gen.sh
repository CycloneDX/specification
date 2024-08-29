#!/bin/bash
set -eu

THIS_PATH="$(realpath "$(dirname "$0")")"
SCHEMA_PATH="$(realpath "$THIS_PATH/../../schema")"
DOCS_PATH="$THIS_PATH/docs"

VALID_CYCLONEDX_VERSIONS=(1.0 1.1 1.2 1.3 1.4 1.5 1.6)
DRAFT_CYCLONEDX_VERSIONS=()

SAXON_JAR='Saxon-HE-9.9.1-8.jar'

# Download the Saxon JAR if it doesn't exist
if [ ! -f "$THIS_PATH/$SAXON_JAR" ]; then
  curl --output-dir "$THIS_PATH" -O \
    "https://repo1.maven.org/maven2/net/sf/saxon/Saxon-HE/9.9.1-8/$SAXON_JAR"
fi

# Function to check if a version is in an array
version_in_list() {
  local version="$1"
  shift
  local list=("$@")
  for item in "${list[@]}"; do
    if [[ "$item" == "$version" ]]; then
      return 0
    fi
  done
  return 1
}

generate () {
  version="$1"

  # Check if the version match a valid CycloneDX version or a draft under development
    if ! version_in_list "$version" "${VALID_CYCLONEDX_VERSIONS[@]}" && ! version_in_list "$version" "${DRAFT_CYCLONEDX_VERSIONS[@]}"; then
    echo "Failed: wrong CycloneDX version: $version"
    exit 1
  fi

  title="CycloneDX v$version XML Reference"
  echo "Generating: $title"

  echo "Create folder $DOCS_PATH/$version"
  mkdir -p "$DOCS_PATH/$version"

  java -jar "$THIS_PATH/$SAXON_JAR" \
    -s:"$SCHEMA_PATH/bom-${version}.xsd" \
    -xsl:"$THIS_PATH/xs3p.xsl" \
    -o:"$DOCS_PATH/$version/index.html" \
    cycloneDxVersion="$version" \
    title="$title"
}

USAGE_HELP="Generate HTML XML Schema navigator for CyccloneDX
Usage: $0 <version> : runs only for <version>
       $0           : loops over all valid and draft CycloneDX versions"

# Main logic to handle the argument using a switch case
case "$#" in
  0)
    # No arguments provided: Loop over all VALID_CYCLONEDX_VERSIONS and DRAFT_CYCLONEDX_VERSIONS
    echo "Deleting folder $DOCS_PATH"
    rm -f -R "$DOCS_PATH"
    for version in "${VALID_CYCLONEDX_VERSIONS[@]}" "${DRAFT_CYCLONEDX_VERSIONS[@]}"; do
      generate "$version"
    done
    ;;
  1)
    case "$1" in
      "-h"|"--help")
        echo "Usage: $USAGE_HELP"
        exit 1
        ;;
      *)
        # One argument provided: Call generate with the specific version
        echo "Deleting folder $DOCS_PATH"
        rm -f -R "$DOCS_PATH"
        generate "$1"
        ;;
    esac
    ;;
  *)
    # More than one argument provided: Show usage help
    echo "Usage: $USAGE_HELP"
    exit 1
    ;;
esac
