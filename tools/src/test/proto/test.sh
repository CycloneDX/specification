#!/usr/bin/env bash
set -ue

THIS_PATH="$(realpath "$(dirname "$0")")"
ROOT_PATH="$(realpath "${THIS_PATH}/../../../..")"

# paths relative to $ROOT_PATH
SCHEMA_DIR='schema'
TEST_RES_DIR='tools/src/test/resources'

REMOTE="https://github.com/${GITHUB_REPOSITORY:-CycloneDX/specification}.git"

BUF_IMAGE_VERSION='1.50.0'
BUF_IMAGE="bufbuild/buf:$BUF_IMAGE_VERSION"

LOG_FORMAT='text'  # set to 'json' to see details
if [[ -n "${GITHUB_WORKFLOW:-}" ]]
then
  LOG_FORMAT='github-actions'
fi


## ----


function prepare () {
  docker pull "$BUF_IMAGE"
}


function schema-lint () {
  echo '> lint schema files' >&2

  docker run --rm \
    --volume "${ROOT_PATH}/${SCHEMA_DIR}:/workspace/${SCHEMA_DIR}:ro" \
    --volume "${THIS_PATH}/buf_lint.yaml:/workspace/buf.yaml:ro" \
    --workdir '/workspace' \
    "$BUF_IMAGE" \
      lint --path "$SCHEMA_DIR" \
      --error-format "$LOG_FORMAT"

  echo '>> OK.' >&2
}


function schema-breaking-version () {
  echo '> test schema for breaking changes against previous version' >&2

  function compare() {
    local NEW="bom-${1}.proto"
    local OLD="bom-${2}.proto"

    local NEW_NP OLD_NP
    NEW_NP="$(mktemp)"
    OLD_NP="$(mktemp)"

    # remove package identifier -> so that the comparisson works as expected
    sed 's/^package .*//' "${ROOT_PATH}/${SCHEMA_DIR}/${NEW}" > "$NEW_NP"
    sed 's/^package .*//' "${ROOT_PATH}/${SCHEMA_DIR}/${OLD}" > "$OLD_NP"

    echo ">> compare new:${NEW} -VS- old:${OLD}" >&2
    # stick with the original path and name of "$NEW", so the reporting makes sense...
    docker run --rm \
      --volume "${OLD_NP}:/workspaces/old/${SCHEMA_DIR}/${NEW}:ro" \
      --volume "${NEW_NP}:/workspaces/new/${SCHEMA_DIR}/${NEW}:ro" \
      --volume "${THIS_PATH}/buf_breaking-version.yaml:/workspaces/new/buf.yaml:ro" \
      --workdir '/workspaces/new' \
      "$BUF_IMAGE" \
        breaking \
        --against ../old \
        --error-format "$LOG_FORMAT"
  }

  compare '1.6' '1.5' || echo "possible breaks are acknowledged for this specific version only"
  compare '1.5' '1.4' || echo "possible breaks are acknowledged for this specific version only"
  compare '1.4' '1.3'

  echo '>> OK.' >&2
}

function schema-breaking-remote () {
  echo '> test schema for breaking changes against remote' >&2

  docker run --rm \
    --volume "${ROOT_PATH}/${SCHEMA_DIR}:/workspace/${SCHEMA_DIR}:ro" \
    --volume "${THIS_PATH}/buf_breaking-remote.yaml:/workspace/buf.yaml:ro" \
    --workdir '/workspace' \
    "$BUF_IMAGE" \
      breaking --path "$SCHEMA_DIR" \
      --against "${REMOTE}" \
      --error-format "$LOG_FORMAT"

  echo '>> OK.' >&2
}

function schema-functional () {
  echo '> test all examples against the respective schema' >&2

  function validate() {
    local FILE="$1"
    local SCHEMA_VERS="$2"
    local SCHEMA_FILE="bom-${SCHEMA_VERS}.proto"
    local MESSAGE="cyclonedx.v${SCHEMA_VERS/./_}.Bom"

    echo ">> validate $(realpath --relative-to="$PWD" "$FILE") as ${MESSAGE} of ${SCHEMA_FILE}" >&2

    # this test method is a bare minimum, and it might not detect all kinds of malformed input.
    # could be improved by utilizing protoc -- see https://github.com/CycloneDX/specification/pull/385/commits/8db0967c11cb913ac3c7a9a037159338df3f3bd9
    docker run --rm \
      --volume "${ROOT_PATH}/${SCHEMA_DIR}:/workspace/${SCHEMA_DIR}:ro" \
      --volume "${FILE}:/workspace/test_res:ro" \
      --workdir '/workspace' \
      "$BUF_IMAGE" \
        convert "${SCHEMA_DIR}/${SCHEMA_FILE}" \
        --type "$MESSAGE" \
        --from 'test_res#format=txtpb' \
        --to /dev/null
  }

  local SCHEMA_VERS
  shopt -s globstar
  for test_res in "$ROOT_PATH"/"$TEST_RES_DIR"/*/valid-*.textproto
  do
    SCHEMA_VERS="$(basename "$(dirname "$test_res")")"
    validate "$test_res" "$SCHEMA_VERS"
  done

  echo '>> OK.' >&2
}


## ----


case "${1:-all}" in
  'schema-lint')
    prepare
    schema-lint
    ;;
  'schema-breaking-version')
    prepare
    schema-breaking-version
    ;;
  'schema-breaking-remote')
    prepare
    schema-breaking-remote
    ;;
  'schema-breaking')
    prepare
    schema-breaking-version
    schema-breaking-remote
    ;;
  'schema-functional')
    prepare
    schema-functional
    ;;
  'all')
    # all the above
    prepare
    schema-lint
    schema-breaking-version
    schema-breaking-remote
    schema-functional
    ;;
  *)
    echo 'unexpected argument. known arguments:' \
      'schema-lint,schema-breaking-version,schema-breaking-remote,schema-breaking,schema-functional,all' \
      >&2
    exit 1
    ;;
esac
