#!/bin/bash
rm -f -R docs
mkdir -p docs/{1.2,1.3,1.4-SNAPSHOT}

# Check to see if generate-schema-doc is executable and is in the path. If not, install JSON Schema for Humans.
if ! [ -x "$(command -v generate-schema-doc)" ]; then
  pip3 install json-schema-for-humans==0.36.1
fi

generate () {
  version=$1
  title='CycloneDX v'$version' JSON Reference'
  echo Generating $title
  generate-schema-doc --config no_link_to_reused_ref --config no_show_breadcrumbs --config title="$title" --config template_name=$(pwd)'/templates/cyclonedx' --minify '../../schema/bom-'$version'-strict.schema.json' 'docs/'$version'/index.html'
  sed -i -e "s/\${title}/$title/g" 'docs/'$version'/index.html'
  sed -i -e "s/\${version}/$version/g" 'docs/'$version'/index.html'
}

generate 1.2
generate 1.3
generate 1.4-SNAPSHOT