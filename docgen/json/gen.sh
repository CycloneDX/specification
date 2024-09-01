#!/bin/bash
set -eu

THIS_PATH="$(realpath "$(dirname "$0")")"
SCHEMA_PATH="$(realpath "$THIS_PATH/../../schema")"
DOCS_PATH="$THIS_PATH/docs"
TEMPLATES_PATH="$THIS_PATH/templates"
VALID_CYCLONEDX_VERSIONS=(1.2 1.3 1.4 1.5 1.6)
DRAFT_CYCLONEDX_VERSIONS=()

# Check to see if generate-schema-doc is executable and is in the path. If not, install JSON Schema for Humans.
if ! [ -x "$(command -v generate-schema-doc)" ]
then
  # dependencies managed externally, so dependebot/renovate can pick it up
  pip3 install -r "$THIS_PATH/requirements.txt"
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

  echo "Create folder $DOCS_PATH/$version"
  mkdir -p "$DOCS_PATH/$version"

  title="CycloneDX v${version} JSON Reference"
  echo "Generating: $title"

  SCHEMA_FILE="$SCHEMA_PATH/bom-${version}.schema.json"
  STRICT_SCHEMA_FILE="$SCHEMA_PATH/bom-${version}-strict.schema.json"
  if [ -f "$STRICT_SCHEMA_FILE" ]
  then
      SCHEMA_FILE="$STRICT_SCHEMA_FILE"
  fi
  echo "$SCHEMA_FILE"

  generate-schema-doc \
    --config no_link_to_reused_ref \
    --config no_show_breadcrumbs \
    --config no_collapse_long_descriptions \
    --deprecated-from-description \
    --config title="$title" \
    --config custom_template_path="$TEMPLATES_PATH/cyclonedx/base.html" \
    --minify \
    "$SCHEMA_FILE" \
    "$DOCS_PATH/$version/index.html"

  sed -i -e "s/\${quotedTitle}/\"$title\"/g" "$DOCS_PATH/$version/index.html"
  sed -i -e "s/\${title}/$title/g" "$DOCS_PATH/$version/index.html"
  sed -i -e "s/\${version}/$version/g" "$DOCS_PATH/$version/index.html"
}

USAGE_HELP="Generate HTML JSON Schema navigator for CyccloneDX
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
