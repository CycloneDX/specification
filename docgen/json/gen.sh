#!/bin/bash
rm -f -R docs
mkdir -p docs/{1.2,1.3,1.4,1.5,1.6}

# Check to see if generate-schema-doc is executable and is in the path. If not, install JSON Schema for Humans.
if ! [ -x "$(command -v generate-schema-doc)" ]; then
  pip3 install json-schema-for-humans==0.47
fi

generate () {
  version=$1
  title='CycloneDX v'$version' JSON Reference'
  echo Generating $title
  STRICT_SCHEMA_FILE='../../schema/bom-'$version'-strict.schema.json'
  if [ -f "$STRICT_SCHEMA_FILE" ]; then
      SCHEMA_FILE='../../schema/bom-'$version'-strict.schema.json'
  else
      SCHEMA_FILE='../../schema/bom-'$version'.schema.json'
  fi
  echo $SCHEMA_FILE
  generate-schema-doc --config no_link_to_reused_ref --config no_show_breadcrumbs --config no_collapse_long_descriptions --deprecated-from-description --config title="$title" --config custom_template_path=$(pwd)'/templates/cyclonedx/base.html' --minify $SCHEMA_FILE 'docs/'$version'/index.html'
  sed -i -e "s/\${quotedTitle}/\"$title\"/g" 'docs/'$version'/index.html'
  sed -i -e "s/\${title}/$title/g" 'docs/'$version'/index.html'
  sed -i -e "s/\${version}/$version/g" 'docs/'$version'/index.html'
}

generate 1.2
generate 1.3
generate 1.4
generate 1.5
generate 1.6