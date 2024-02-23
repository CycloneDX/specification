#!/usr/bin/env bash
set -uex

THIS_DIR="$(dirname "$0")"
REPO_ROOT="$(realpath "$THIS_DIR/../../..")"

if [[ -n "${CI:-}" ]]
then
  LOG_FORMAT="github-actions"
else
  LOG_FORMAT="json"
fi

# lint protobuf schema files
docker run \
  --volume "$REPO_ROOT:/workspace" \
  --workdir /workspace \
  bufbuild/buf:1.29.0 \
  lint --error-format "$LOG_FORMAT"

# check protobuf schema files for breaking changes
docker run \
  --volume "$REPO_ROOT:/workspace" \
  --workdir /workspace \
  bufbuild/buf:1.29.0 \
  breaking --help

# test all examples against the schema files
# mkdir -p proto-test
# for filename in resources/1.3/*.textproto;
# do
#   protoc --proto_path=../../../schema/ --encode=cyclonedx.v1_3.Bom bom-1.3-SNAPSHOT.proto < $filename | protoc --proto_path=../../../schema/ --decode=cyclonedx.v1_3.Bom bom-1.3-SNAPSHOT.proto > proto-test/${filename##*/}
# done