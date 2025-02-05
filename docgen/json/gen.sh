#!/bin/bash
set -eu



CYCLONEDX_VERSIONS=('1.6' '1.5' '1.4' '1.3' '1.2')

# region help

USAGE_HELP="
Generate HTML JSON Schema navigator for CycloneDX
Usage: $0 <version> : runs only for a certain version (${CYCLONEDX_VERSIONS[@]})
       $0           : loops over all valid and draft CycloneDX versions
       $0 --help    : give this help list
"

# endregion help

THIS_PATH="$(realpath "$(dirname "$0")")"
SCHEMA_PATH="$(realpath "$THIS_PATH/../../schema")"
DOCS_PATH="$THIS_PATH/docs"
TEMPLATES_PATH="$THIS_PATH/templates"


# Check to see if generate-schema-doc is executable and is in the path. If not, install JSON Schema for Humans.
if ! [ -x "$(command -v generate-schema-doc)" ]
then
  # dependencies managed externally, so dependebot/renovate can pick it up
  pip3 install -r "$THIS_PATH/requirements.txt"
fi

generate () {
  version="$1"
  title="CycloneDX v${version} JSON Reference"
  echo "Generating: $title"

  rm -f -R "$DOCS_PATH/$version"
  mkdir -p

  SCHEMA_FILE="$SCHEMA_PATH/bom-${version}.schema.json"
  STRICT_SCHEMA_FILE="$SCHEMA_PATH/bom-${version}-strict.schema.json"
  if [ -f "$STRICT_SCHEMA_FILE" ]
  then
      SCHEMA_FILE="$STRICT_SCHEMA_FILE"
  fi
  echo "SCHEMA_FILE: $SCHEMA_FILE"

  OUT_FILE="$DOCS_PATH/$version/json/index.html"
  mkdir -p "$(dirname "$OUT_FILE")"

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
  0)
    # No arguments provided: Loop over all VALID_CYCLONEDX_VERSIONS and DRAFT_CYCLONEDX_VERSIONS
    for version in "${CYCLONEDX_VERSIONS[@]}"; do
      generate "$version"
    done
    ;;
  1)
    case "$1" in
      '-h'|'--help')
        echo "Usage: $USAGE_HELP"
        ;;
      *)
        # One argument provided: Call generate with the specific version
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
