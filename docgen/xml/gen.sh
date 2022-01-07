#!/bin/bash
rm -f -R docs
if [ ! -f "Saxon-HE-9.9.1-8.jar" ]; then
  curl -O https://repo1.maven.org/maven2/net/sf/saxon/Saxon-HE/9.9.1-8/Saxon-HE-9.9.1-8.jar
fi

generate () {
  version=$1
  title='CycloneDX v'$version' XML Reference'
  echo Generating $title
  java -jar Saxon-HE-9.9.1-8.jar -s:'../../schema/bom-'$version'.xsd' -xsl:xs3p.xsl -o:'./docs/'$version'/index.html' cycloneDxVersion="$version" title="$title"
}

generate 1.0
generate 1.1
generate 1.2
generate 1.3
generate 1.4