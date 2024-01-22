#!/bin/bash
rm -f -R docs temp out
mkdir -p docs temp
cp ../../schema/bom-1.6.schema.json temp
cp ../../schema/jsf-0.82.schema.json temp
cp ../../schema/spdx.schema.json temp

# Check to see if jsonschema2md is executable and is in the path. If not, install jsonschema2md.
if ! [ -x "$(command -v jsonschema2md)" ]; then
  npm install -g @adobe/jsonschema2md
fi

echo Generating Ecma Documentation
jsonschema2md -d temp -o docs
rm -f -R temp out
