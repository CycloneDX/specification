#!/bin/bash
set -eu

THIS_PATH="$(realpath "$(dirname "$0")")"
SCHEMA_PATH="$(realpath "$THIS_PATH/../../schema")"
DOCS_PATH="$THIS_PATH/docs"
TEMPLATES_PATH="$THIS_PATH/templates"

PROTOC_GEN_DOC_VERSION='1.5.1'

# --

rm -f -R "$DOCS_PATH"
mkdir -p "$DOCS_PATH/"{1.3,1.4,1.5,1.6}

generate () {
  version="$1"
  title="CycloneDX v$version Proto Reference"
  echo "Generating: $title"

  ## docs: https://github.com/pseudomuto/protoc-gen-doc
  docker run --rm \
    -v "${DOCS_PATH}/${version}:/out" \
    -v "${SCHEMA_PATH}:/protos:ro" \
    -v "${TEMPLATES_PATH}:/templates:ro" \
    "pseudomuto/protoc-gen-doc:${PROTOC_GEN_DOC_VERSION}" \
      --doc_opt=/templates/html.tmpl,index.html \
      "bom-${version}.proto"

  # fix file permissions
  docker run --rm \
    -v "${DOCS_PATH}/${version}:/out" \
    --entrypoint chown \
    "pseudomuto/protoc-gen-doc:${PROTOC_GEN_DOC_VERSION}" \
    "$(id -g):$(id -u)" -R /out
}

generate 1.3
generate 1.4
generate 1.5
generate 1.6
