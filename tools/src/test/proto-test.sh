#!/usr/bin/env bash
set -ue

THIS_DIR="$(dirname "$0")"
REPO_ROOT="$(realpath "${THIS_DIR}/../../..")"

if [[ -n "${CI:-}" ]]
then
  LOG_FORMAT="github-actions"
else
  LOG_FORMAT="json"
fi

function test-schema-lint () {
 echo '> lint schema files' >&2

  docker run \
    --volume "${REPO_ROOT}:/workspace" \
    --workdir /workspace \
    bufbuild/buf:1.29.0 \
    lint --error-format "$LOG_FORMAT"
}


function test-schema-breaking () {
  echo '> test schema for breaking changes' >&2

  return 0  # WIP

  docker run \
    --volume "${REPO_ROOT}:/workspace" \
    --workdir /workspace \
    bufbuild/buf:1.29.0 \
    breaking 'schema/bom-1.6.proto' --against 'schema/bom-1.5.proto' --error-format "$LOG_FORMAT"
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