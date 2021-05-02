#!/usr/bin/env bash
mkdir -p proto-test
for filename in resources/1.3/*.textproto;
do
  protoc --proto_path=../../../schema/ --encode=org.cyclonedx.schema.bom.v1_3.Bom bom-1.3-SNAPSHOT.proto < $filename | protoc --proto_path=../../../schema/ --decode=org.cyclonedx.schema.bom.v1_3.Bom bom-1.3-SNAPSHOT.proto > proto-test/${filename##*/}
done;