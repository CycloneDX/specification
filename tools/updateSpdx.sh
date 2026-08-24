#!/bin/bash
set -exu

this="$(realpath "$0")"
this_dir="$(dirname "$this")"
project_root="$(dirname "$this_dir")"
schema_dir="$project_root/schema"

cd "$this_dir"
mvn clean \
    compile \
    exec:java -Dexec.mainClass='org.cyclonedx.tools.SpdxXsdGenerator' \
    -Dcdx.schema.dir="$schema_dir"
