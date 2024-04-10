#!/bin/bash
set -eu

THIS_DIR="$(dirname "$0")"
SCHEMA_DIR="$(realpath "$THIS_DIR/../../schema")"
DOCS_DIR="$THIS_DIR/docs"
TEMPLATES_DIR="$THIS_DIR/templates"

rm -f -R "$DOCS_DIR"
mkdir -p "$DOCS_DIR/"{1.2,1.3,1.4,1.5,1.6}

# Check to see if generate-schema-doc is executable and is in the path. If not, install JSON Schema for Humans.
if ! [ -x "$(command -v generate-schema-doc)" ]
then
  pip3 install -r "$THIS_DIR/requirements.txt"
fi

generate () {
  version="$1"
  title="CycloneDX v${version} JSON Reference"
  echo "Generating: $title"

  SCHEMA_FILE="$SCHEMA_DIR/bom-${version}.schema.json"
  STRICT_SCHEMA_FILE="$SCHEMA_DIR/bom-${version}-strict.schema.json"
  if [ -f "$STRICT_SCHEMA_FILE" ]; then
      SCHEMA_FILE="$STRICT_SCHEMA_FILE"
  fi
  echo "$SCHEMA_FILE"

  generate-schema-doc \
    --config no_link_to_reused_ref \
    --config no_show_breadcrumbs \
    --config no_collapse_long_descriptions \
    --deprecated-from-description \
    --config title="$title" \
    --config custom_template_path="$TEMPLATES_DIR/cyclonedx/base.html" \
    --minify \
    "$SCHEMA_FILE" \
    "$DOCS_DIR/$version/index.html"

  sed -i -e "s/\${quotedTitle}/\"$title\"/g" "$DOCS_DIR/$version/index.html"
  sed -i -e "s/\${title}/$title/g" "$DOCS_DIR/$version/index.html"
  sed -i -e "s/\${version}/$version/g" "$DOCS_DIR/$version/index.html"
}

generate 1.2
generate 1.3
generate 1.4
generate 1.5
generate 1.6
