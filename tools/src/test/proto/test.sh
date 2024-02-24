#!/usr/bin/env bash
set -ue

THIS_PATH="$(realpath "$(dirname "$0")")"
ROOT_PATH="$(realpath "${THIS_PATH}/../../../..")"

# paths relative to $ROOT_PATH
SCHEMA_DIR='schema'

REMOTE="https://github.com/${GITHUB_REPOSITORY:-CycloneDX/specification}.git"

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
    bufbuild/buf:1.29.0 \
      lint --path "$SCHEMA_DIR" \
      --config 'buf.yaml' \
      --error-format "$LOG_FORMAT"
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
      bufbuild/buf:1.29.0 \
        breaking "$SCHEMA_DIR" --against "${SCHEMA_DIR}_old" \
        --config 'buf.yaml' \
        --error-format "$LOG_FORMAT"
  }

  compare '1.6' '1.5'
  echo '>> skip compare' '1.5' '1.4' >&2 # <-- had breaking changes, which is acknowledged ...
  compare '1.4' '1.3'
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
    bufbuild/buf:1.29.0 \
      breaking "$SCHEMA_DIR" --against "${REMOTE}#subdir=${SCHEMA_DIR}" \
      --config 'buf.yaml' \
      --error-format "$LOG_FORMAT"
}

function schema-functional () {
  echo '> test all examples against the schema files' >&2

  echo 'TODO' # @TODO
  return 0 # WIP

  mkdir -p proto-test
  for filename in resources/1.3/*.textproto;
  do
    protoc --proto_path=../../../schema/ --encode=cyclonedx.v1_3.Bom bom-1.3-SNAPSHOT.proto < $filename | protoc --proto_path=../../../schema/ --decode=cyclonedx.v1_3.Bom bom-1.3-SNAPSHOT.proto > proto-test/${filename##*/}
  done
}

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
     'schema-lint,schema-breaking-version,schema-breaking-remote,schema-breaking,schema-functional,all'
    exit 1
    ;;
esac