#!/usr/bin/env bash
set -ue

THIS_PATH="$(realpath "$(dirname "$0")")"
ROOT_PATH="$(realpath "${THIS_PATH}/../../../..")"

# paths relative to $ROOT_PATH
SCHEMA_DIR='schema'
TEST_RES_DIR='tools/src/test/resources'

REMOTE="https://github.com/${GITHUB_REPOSITORY:-CycloneDX/specification}.git"

BUF_IMAGE_VERSION='1.30.1'


## ----


function schema-lint () {
  echo '> lint schema files' >&2

  if [[ -n "${CI:-}" ]]
  then
    LOG_FORMAT='github-actions'
  else
    LOG_FORMAT='text'
  fi

  docker run --rm \
    --volume "${ROOT_PATH}/${SCHEMA_DIR}:/workspace/${SCHEMA_DIR}:ro" \
    --volume "${THIS_PATH}/buf_lint.yaml:/workspace/buf.yaml:ro" \
    --workdir '/workspace' \
    bufbuild/buf:"$BUF_IMAGE_VERSION" \
      lint --path "$SCHEMA_DIR" \
      --config 'buf.yaml' \
      --error-format "$LOG_FORMAT"

  echo '>> OK.' >&2
}


function schema-breaking-version () {
  echo '> test schema for breaking changes against previous version' >&2

  if [[ -n "${GITHUB_WORKFLOW:-}" ]]
  then
    LOG_FORMAT='github-actions'
  else
    LOG_FORMAT='text'
  fi

  function compare() {
    NEW="bom-${1}.proto"
    OLD="bom-${2}.proto"
    SCHEMA_DIR_OLD="${SCHEMA_DIR}_old"

    echo ">> compare new:${NEW} -VS- old:${OLD}" >&2
    # stick with the original path of "$NEW", so the reporting makes sense...
    docker run --rm \
      --volume "${ROOT_PATH}/${SCHEMA_DIR}/${NEW}:/workspace/${SCHEMA_DIR}/${NEW}:ro" \
      --volume "${ROOT_PATH}/${SCHEMA_DIR}/${OLD}:/workspace/${SCHEMA_DIR_OLD}/${NEW}:ro" \
      --volume "${THIS_PATH}/buf_breaking-version.yaml:/workspace/buf.yaml:ro" \
      --workdir '/workspace' \
      bufbuild/buf:"$BUF_IMAGE_VERSION" \
        breaking "$SCHEMA_DIR" \
        --against "$SCHEMA_DIR_OLD" \
        --config 'buf.yaml' \
        --error-format "$LOG_FORMAT"
  }

  compare '1.6' '1.5'
  echo '>> skip compare' '1.5' '1.4' >&2  # <-- had breaking changes, which is acknowledged
  compare '1.4' '1.3'

  echo '>> OK.' >&2
}

function schema-breaking-remote () {
  echo '> test schema for breaking changes against remote' >&2

  if [[ -n "${GITHUB_WORKFLOW:-}" ]]
  then
    LOG_FORMAT='github-actions'
  else
    LOG_FORMAT='text'
  fi

  docker run --rm \
    --volume "${ROOT_PATH}/${SCHEMA_DIR}:/workspace/${SCHEMA_DIR}:ro" \
    --volume "${THIS_PATH}/buf_breaking-remote.yaml:/workspace/buf.yaml:ro" \
    --workdir '/workspace' \
    bufbuild/buf:"$BUF_IMAGE_VERSION" \
      breaking "$SCHEMA_DIR" \
      --against "${REMOTE}#subdir=${SCHEMA_DIR}" \
      --config 'buf.yaml' \
      --error-format "$LOG_FORMAT"

  echo '>> OK.' >&2
}

function schema-functional () {
  echo '> test all examples against the respective schema' >&2

  function validate() {
    FILE="$1"
    SCHEMA_VERS="$2"
    SCHEMA_FILE="bom-${SCHEMA_VERS}.proto"
    MESSAGE="cyclonedx.v${SCHEMA_VERS/./_}.Bom"

    echo ">> validate $(realpath --relative-to="$PWD" "$FILE") as ${MESSAGE} of ${SCHEMA_FILE}" >&2

    # this test method is a bare minimum, and it might not detect all kinds of malformed input.
    # could be improved by utilizing protoc -- see https://github.com/CycloneDX/specification/pull/385/commits/8db0967c11cb913ac3c7a9a037159338df3f3bd9
    docker run --rm \
      --volume "${ROOT_PATH}/${SCHEMA_DIR}:/workspace/${SCHEMA_DIR}:ro" \
      --volume "${FILE}:/workspace/test_res:ro" \
      --workdir '/workspace' \
      bufbuild/buf:"$BUF_IMAGE_VERSION" \
        convert "${SCHEMA_DIR}/${SCHEMA_FILE}" \
        --type "$MESSAGE" \
        --from 'test_res#format=txtpb' \
        --to /dev/null
  }

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
    schema-lint
    ;;
  'schema-breaking-version')
    schema-breaking-version
    ;;
  'schema-breaking-remote')
    schema-breaking-remote
    ;;
  'schema-breaking')
    schema-breaking-version
    schema-breaking-remote
    ;;
  'schema-functional')
    schema-functional
    ;;
  'all')
    # all the above
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
