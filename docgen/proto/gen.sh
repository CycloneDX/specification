#!/bin/bash
set -eu

declare -a CDX_VERSIONS=(
  '1.7'
  '1.6'
  '1.5'
  '1.4'
  '1.3'
)

# region help
DESC="Generate HTML Schema navigator for CycloneDX ProtoBuf"
USAGE="
Usage: $0 [CDX_VERSION...]

Supported values for CDX_VERSION: ${CDX_VERSIONS[*]}
"
# endregion help


THIS_PATH="$(realpath "$(dirname "$0")")"
SCHEMA_PATH="$(realpath "$THIS_PATH/../../schema")"
DOCS_PATH="$THIS_PATH/docs"
TEMPLATES_PATH="$THIS_PATH/templates"

PROTOC_GEN_DOC_VERSION='1.5.1'


# --


prepare() {
  ## docs: https://github.com/pseudomuto/protoc-gen-doc
  PROTOC_CONTAINER_IMAGE="pseudomuto/protoc-gen-doc:${PROTOC_GEN_DOC_VERSION}"
  docker pull "$PROTOC_CONTAINER_IMAGE"
}

generate () {
  local version="$1"
  local title="CycloneDX v$version Protobuf Reference"
  echo "Generating: $title"

  local OUT_DIR="$DOCS_PATH/$version/proto"
  local OUT_FILE="index.html"
  mkdir -p "$OUT_DIR"

  docker run --rm \
    -v "${OUT_DIR}:/out" \
    -v "${SCHEMA_PATH}:/protos:ro" \
    -v "${TEMPLATES_PATH}:/templates:ro" \
    "$PROTOC_CONTAINER_IMAGE" \
      --doc_opt=/templates/html.tmpl,"$OUT_FILE" \
      "bom-${version}.proto"

  # fix file permissions
  docker run --rm \
    -v "${OUT_DIR}:/out" \
    --entrypoint chown \
    "$PROTOC_CONTAINER_IMAGE" \
    "$(id -u):$(id -g)" -R /out

  sed -i -e "s/\${quotedTitle}/\"$title\"/g" "$OUT_DIR/$OUT_FILE"
  sed -i -e "s/\${title}/$title/g" "$OUT_DIR/$OUT_FILE"
  sed -i -e "s/\${version}/$version/g" "$OUT_DIR/$OUT_FILE"
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
