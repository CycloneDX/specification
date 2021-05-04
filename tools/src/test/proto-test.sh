#!/usr/bin/env bash
mkdir -p proto-test
for filename in resources/1.3/*.textproto;
do
  protoc --proto_path=../../../schema/ --encode=cyclonedx.v1_3.Bom bom-1.3-SNAPSHOT.proto < $filename | protoc --proto_path=../../../schema/ --decode=cyclonedx.v1_3.Bom bom-1.3-SNAPSHOT.proto > proto-test/${filename##*/}
done;