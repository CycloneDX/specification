#!/bin/bash
set -eu

declare -a CDX_VERSIONS=(
  '1.7'
  '1.6'
  '1.5'
  '1.4'
  '1.3'
  '1.2'
)

# region help
DESC="Generate HTML Schema navigator for CycloneDX JSON"
USAGE="
Usage: $0 [CDX_VERSION...]

Supported values for CDX_VERSION: ${CDX_VERSIONS[*]}
"
# endregion help


THIS_PATH="$(realpath "$(dirname "$0")")"
SCHEMA_PATH="$(realpath "$THIS_PATH/../../schema")"
DOCS_PATH="$THIS_PATH/docs"
TEMPLATES_PATH="$THIS_PATH/templates"


# --

prepare () {
  # Check to see if generate-schema-doc is executable and is in the path.
  # If not, install JSON Schema for Humans.
  if ! [ -x "$(command -v generate-schema-doc)" ]
  then
    # dependencies managed externally, so dependebot/renovate can pick it up
    python -m pip install -r "$THIS_PATH/requirements.txt"
  fi
}


generate () {
  local version="$1"
  local title="CycloneDX v${version} JSON Reference"
  echo "Generating: $title"

  local SCHEMA_FILE="$SCHEMA_PATH/bom-${version}.schema.json"
  local STRICT_SCHEMA_FILE="$SCHEMA_PATH/bom-${version}-strict.schema.json"
  if [ -f "$STRICT_SCHEMA_FILE" ]
  then
      SCHEMA_FILE="$STRICT_SCHEMA_FILE"
  fi
  echo "SCHEMA_FILE: $SCHEMA_FILE"

  local OUT_FILE="$DOCS_PATH/$version/json/index.html"
  local OUT_DIR="$(dirname "$OUT_FILE")"
  rm -rf "$OUT_DIR"
  mkdir -p "$OUT_DIR"

  generate-schema-doc \
    --config no_link_to_reused_ref \
    --config no_show_breadcrumbs \
    --config no_collapse_long_descriptions \
    --deprecated-from-description \
    --config title="$title" \
    --config custom_template_path="$TEMPLATES_PATH/cyclonedx/base.html" \
    --minify \
    "$SCHEMA_FILE" \
    "$OUT_FILE"

  sed -i -e "s/\${quotedTitle}/\"$title\"/g" "$OUT_FILE"
  sed -i -e "s/\${title}/$title/g" "$OUT_FILE"
  sed -i -e "s/\${version}/$version/g" "$OUT_FILE"
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
