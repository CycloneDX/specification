#!/usr/bin/env bash
set -uex

THIS_PATH="$(realpath "$(dirname "$0")")"
ROOT_PATH="$(realpath "${THIS_PATH}/../../../..")"

# paths relative to $ROOT_PATH
SCHEMA_DIR='schema'
TEST_RES_DIR='tools/src/test/resources'

REMOTE="https://github.com/${GITHUB_REPOSITORY:-CycloneDX/specification}.git"

DOCKER_IMG_NAME='cdx_schema_testing_protobuf'

function prepare() {
  echo '> preparing runner image' >&2
  docker build --tag "$DOCKER_IMG_NAME" "$THIS_PATH"
}

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
    "$DOCKER_IMG_NAME" \
      buf lint --path "$SCHEMA_DIR" \
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
    echo ">> compare new:${1} -VS- old:${2}" >&2
    # stick with the original paths, so the reporting makes sense...
    docker run --rm \
      --volume "${ROOT_PATH}/${SCHEMA_DIR}/bom-${1}.proto:/workspace/${SCHEMA_DIR}/bom-${1}.proto:ro" \
      --volume "${ROOT_PATH}/${SCHEMA_DIR}/bom-${2}.proto:/workspace/${SCHEMA_DIR}_old/bom-${1}.proto:ro" \
      --volume "${THIS_PATH}/buf_breaking-version.yaml:/workspace/buf.yaml:ro" \
      --workdir '/workspace' \
      "$DOCKER_IMG_NAME" \
        buf breaking "$SCHEMA_DIR" --against "${SCHEMA_DIR}_old" \
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
    "$DOCKER_IMG_NAME" \
      buf breaking "$SCHEMA_DIR" --against "${REMOTE}#subdir=${SCHEMA_DIR}" \
      --config 'buf.yaml' \
      --error-format "$LOG_FORMAT"

  echo '>> OK.' >&2
}

function schema-functional () {
  echo '> test all examples against the respective schema' >&2

  function validate() {
    FILE="$1"
    SCHEMA_VERS="$2"
    MESSAGE="cyclonedx.v${SCHEMA_VERS/./_}.Bom"

    echo ">> validate ${FILE} as ${MESSAGE}" >&2

    docker run --rm \
      --volume "${ROOT_PATH}/${SCHEMA_DIR}:/workspace/${SCHEMA_DIR}:ro" \
      --volume "${FILE}:/workspace/test_res:ro" \
      --workdir '/workspace' \
      "$DOCKER_IMG_NAME" \
        buf convert "${SCHEMA_DIR}/bom-${SCHEMA_VERS}.proto" \
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

  echo 'TODO' # @TODO
  return 0 # WIP

  ## buf convert schema/bom-1.6.proto --type cyclonedx.v1_6.Bom --from tools/src/test/resources/1.6/_test.textproto'#format=txtpb'
  ##

  mkdir -p proto-test
  for filename in resources/*/*.textproto;
  do
    protoc --proto_path=../../../schema/ --encode=cyclonedx.v1_3.Bom bom-1.3-SNAPSHOT.proto < $filename |\
    protoc --proto_path=../../../schema/ --decode=cyclonedx.v1_3.Bom bom-1.3-SNAPSHOT.proto > proto-test/${filename##*/}
  done

  echo '>> OK.' >&2
}

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