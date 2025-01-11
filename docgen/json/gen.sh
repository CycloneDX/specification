#!/bin/bash
set -eu

THIS_PATH="$(realpath "$(dirname "$0")")"
SCHEMA_PATH="$(realpath "$THIS_PATH/../../schema")"
DOCS_PATH="$THIS_PATH/docs"
TEMPLATES_PATH="$THIS_PATH/templates"

rm -f -R "$DOCS_PATH"

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

generate 1.2
generate 1.3
generate 1.4
generate 1.5
generate 1.6
