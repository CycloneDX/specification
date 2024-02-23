#!/usr/bin/env bash
set -uex

THIS_DIR="$(dirname "$0")"
REPO_ROOT="$(realpath "${THIS_DIR}/../../..")"

# paths relative to $REPO_ROOT
BUF_CONFIG='buf.yaml'
SCHEMA_DIR='schema'

function test-schema-lint () {
  echo '> lint schema files' >&2

  if [[ -n "${CI:-}" ]]
  then
    LOG_FORMAT='github-actions'
  else
    LOG_FORMAT='text'
  fi

  docker run --rm \
    --volume "${REPO_ROOT}/${SCHEMA_DIR}:/workspace/${SCHEMA_DIR}:ro" \
    --volume "${REPO_ROOT}/${BUF_CONFIG}:/workspace/buf.yaml:ro" \
    --workdir /workspace \
    bufbuild/buf:1.29.0 \
      lint \
      --error-format "$LOG_FORMAT" \
      --config 'buf.yaml'
}


function test-schema-breaking () {
  echo '> test schema for breaking changes' >&2

  if [[ -n "${CI:-}" ]]
  then
    LOG_FORMAT='github-actions'
  else
    LOG_FORMAT='text'
  fi

  function run-test() {
    echo "> new:${1} -VS- old:${2}" >&2
    # stick with the original paths, so the reporting makes sense...
    docker run --rm \
      --volume "${REPO_ROOT}/${SCHEMA_DIR}/bom-${1}.proto:/workspace/${SCHEMA_DIR}/bom-${1}.proto:ro" \
      --volume "${REPO_ROOT}/${SCHEMA_DIR}/bom-${2}.proto:/workspace/${SCHEMA_DIR}_old/bom-${1}.proto:ro" \
      --workdir /workspace \
      bufbuild/buf:1.29.0 \
        breaking "${SCHEMA_DIR}/" \
        --against "${SCHEMA_DIR}_old/" \
        --error-format "$LOG_FORMAT" \
        --config '{"version":"v1","breaking":{"use":["FILE","WIRE_JSON"],"except":["FILE_SAME_PACKAGE"]}}'
        # scope is to detect changes from one version to the other -> so ignore "FILE_SAME_PACKAGE"
  }

  run-test '1.6' '1.5'
  run-test '1.5' '1.4'
  run-test '1.4' '1.3'
}

function test-schema-functional () {
  echo '> test all examples against the schema files' >&2

  return 0 # WIP

  mkdir -p proto-test
  for filename in resources/1.3/*.textproto;
  do
    protoc --proto_path=../../../schema/ --encode=cyclonedx.v1_3.Bom bom-1.3-SNAPSHOT.proto < $filename | protoc --proto_path=../../../schema/ --decode=cyclonedx.v1_3.Bom bom-1.3-SNAPSHOT.proto > proto-test/${filename##*/}
  done
}

case "${1:-test}" in
  'lint')
    test-schema-lint
    ;;
  'breaking')
    test-schema-breaking
    ;;
  'functional')
    test-schema-functional
    ;;
  'test')
    test-schema-lint
    test-schema-breaking
    test-schema-functional
    ;;
  *)
    echo 'unexpected argument. known arguments: lint,breaking,functional,test'
    exit 1
esac