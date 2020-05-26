[![Build Status](https://github.com/CycloneDX/specification/workflows/Maven%20CI/badge.svg)](https://github.com/CycloneDX/specification/actions?workflow=Maven+CI)
[![License][license-image]][license-url]
[![Website](https://img.shields.io/badge/https://-cyclonedx.org-blue.svg)](https://cyclonedx.org/)
[![Slack Invite](https://img.shields.io/badge/Slack-Join-blue?logo=slack&labelColor=393939)](https://cyclonedx.org/slack/invite)
[![Group Discussion](https://img.shields.io/badge/discussion-groups.io-blue.svg)](https://groups.io/g/CycloneDX)
[![Twitter](https://img.shields.io/twitter/url/http/shields.io.svg?style=social&label=Follow)](https://twitter.com/CycloneDX_Spec)

# CycloneDX Specification
CycloneDX is a lightweight software bill-of-material (SBOM) specification designed for use in application security 
contexts and supply chain component analysis.


## Introduction
Modern software is assembled using third-party and open source components, glued together in complex and unique ways, 
and integrated with original code to provide the desired functionality. Reusing components has many economic and
technical advantages. Documenting the use of all components is often desirable in order to perform 
[supply chain component analysis](https://owasp.org/www-community/Component_Analysis). 
CycloneDX was created for this purpose.


## Project Goals
- Define a vendor agnostic specification independent of language or ecosystem
- Specification should be machine readable
- Specification should be easy to implement with minimal effort
- Specification should be simple and performant to parse
- Specification should provide lightweight schema definitions for JSON and XML
- Specification should reuse parts of existing specs where beneficial
- Specification should be extensible to support specialized and future use cases
- Specification should be decentralized, authoritative, and security focused
- Specification should promote continuous component analysis
- Specification should support hardware, libraries, frameworks, applications, containers, and operating systems


## Achievable Use Cases
- Vulnerability analysis (software and hardware)
- Outdated component analysis
- License identification and compliance
- File verification
- Hierarchical representation of component assemblies
- Document a components pedigree including ancestors, descendants, and variants which describe component lineage from any viewpoint and the commits, patches, and diffs which make it unique
- Analyze modified open source libraries without any loss of fidelity
- Human and machine readable format designed to be simple to use, extensible, and easily adoptable


## Specification Overview
The following describes the high-level metadata for a component. In addition to components, BOM metadata, 
dependency graphs, and services can also be incorporated into a BOM.

| Field | Description | Required |
| ------|-------------| :------: |
|type| Describes if the component is a library, framework, application, container, operating system, firmware, or hardware device | 	&#x2714; |
|supplier| The organization that supplied the component. The supplier may often be the manufacture, but may also be a distributor or repackager. | |
|author| The person(s) or organization(s) that authored the component | |
|publisher| The person(s) or organization(s) that published the component | |
|group| The high-level classification that a project self-describes as. This will often be a shortened, single name of the company or project that produced the component, or the source package or domain name. | |
|name| The name of the component as defined by the project | &#x2714; |
|version| The version of the component as defined by the project | &#x2714; |
|description| A description of the component | |
|scope| Specifies the scope of the component. If scope is not specified, 'runtime' scope will be assumed. | |
|hashes| File hashes supporting MD5, SHA1, SHA2, SHA3, BLAKE2b, and BLAKE3 | |
|license| A node describing zero or more license names, SPDX license IDs or expressions | |
|copyright| An optional copyright notice informing users of the underlying claims to copyright ownership in a published work| |
|cpe| An optional mapping to an existing CPE identifier | |
|purl| The Package URL of the component | |
|swid| Specifies metadata and content for ISO-IEC 19770-2 Software Identification (SWID) Tags | |
|modified| Indicates if the component has been modified from the official distribution | |
|pedigree| Component ancestors, descendants, and variants which describe component lineage from any viewpoint and the commits, patches, and diffs which make it unique. | |
|externalReferences| A node which contains various types of references to external resources | |
|components| Specifies a component assembly (sub-components) | |


## Example BOM
```xml
<?xml version="1.0" encoding="UTF-8"?>
<bom xmlns="http://cyclonedx.org/schema/bom/1.2" serialNumber="urn:uuid:3e671687-395b-41f5-a30f-a58921a69b79" version="1">
  <components>
    <component type="library">
      <publisher>Apache</publisher>
      <group>org.apache.tomcat</group>
      <name>tomcat-catalina</name>
      <version>9.0.14</version>
      <hashes>
        <hash alg="MD5">3942447fac867ae5cdb3229b658f4d48</hash>
        <hash alg="SHA-1">e6b1000b94e835ffd37f4c6dcbdad43f4b48a02a</hash>
        <hash alg="SHA-256">f498a8ff2dd007e29c2074f5e4b01a9a01775c3ff3aeaf6906ea503bc5791b7b</hash>
        <hash alg="SHA-512">e8f33e424f3f4ed6db76a482fde1a5298970e442c531729119e37991884bdffab4f9426b7ee11fccd074eeda0634d71697d6f88a460dce0ac8d627a29f7d1282</hash>
      </hashes>
      <licenses>
        <license>
          <id>Apache-2.0</id>
        </license>
      </licenses>
      <purl>pkg:maven/org.apache.tomcat/tomcat-catalina@9.0.14?packaging=jar</purl>
    </component>
      <!-- More components here -->
  </components>
</bom>
```

## Official Implementations
Build plugins for a number of ecosystems have been created which support the automatic identification of all project 
dependencies and automatically generate CycloneDX SBOMs. The resulting SBOMs may contain many of the elements above 
including group, name, version, description, file hashes, license, and Package URL. Additionally, a standalone Java API 
was created for the programmatic creation and validation of CycloneDX SBOMs.

- [CycloneDX .NET Core](https://github.com/CycloneDX/cyclonedx-dotnet)
- [CycloneDX Node.js Module](https://github.com/CycloneDX/cyclonedx-node-module)
- [CycloneDX Maven Plugin](https://github.com/CycloneDX/cyclonedx-maven-plugin)
- [CycloneDX Gradle Plugin](https://github.com/CycloneDX/cyclonedx-gradle-plugin)
- [CycloneDX PHP Composer](https://github.com/CycloneDX/cyclonedx-php-composer)
- [CycloneDX Python Module](https://github.com/CycloneDX/cyclonedx-python)
- [CycloneDX Ruby Gem](https://github.com/CycloneDX/cyclonedx-ruby-gem)
- [CycloneDX Rust Cargo](https://github.com/CycloneDX/cyclonedx-rust-cargo)
- [CycloneDX Java API](https://github.com/CycloneDX/cyclonedx-core-java)


Additional build plugins planned. Volunteers and community contributions appreciated.


## Community Implementations
A growing community of CycloneDX adopters are producing various tools for the generation, analysis, and reporting 
of CycloneDX SBOMs.

#### Open Source
- [CycloneDX for Go](https://github.com/ozonru/cyclonedx-go)
- [CycloneDX SBT plugin for Scala](https://github.com/siculo/sbt-bom)
- [CycloneDX Mix Task for Erlang/Elixir](https://hex.pm/packages/sbom)
- [CycloneDX Rebar3 Plugin for Erlang/Elixir](https://hex.pm/packages/rebar3_sbom)
- [OSS Review Toolkit](https://github.com/heremaps/oss-review-toolkit)
- [OWASP Dependency-Track](https://dependencytrack.org/)
- [Eclipse SW360 Antenna](https://www.eclipse.org/antenna/)
- [Retire.js](https://retirejs.github.io/retire.js/)

#### Proprietary
- [Sonatype Nexus IQ Server](https://www.sonatype.com/nexus-iq-server)
- [CyberProtek](https://cyberprotek.com)
- [MedScan](https://medsec.com/medscan.html)
- [Reliza Hub](https://relizahub.com)


## Release History

| Version | Release Date |
| ------- | --------- |
| CycloneDX 1.2 | 26 May 2020 |
| CycloneDX 1.1 | 03 March 2019 |
| CycloneDX 1.0 | 26 March 2018 |
| Initial Prototype | 01 May 2017 |


## Related Work
[SPDX (Software Package Data Exchange)][spdx-url] is a specification that provides low-level details of components, including all files, hashes, authors, and copyrights. SPDX also defines over 300 open source license IDs. CycloneDX builds on top of the work SPDX has accomplished with license IDs, but varies greatly in its approach towards building a software bill of material specification.

[SWID (ISO/IEC 19770-2:2015)][swid-url] is used primarily to identify installed software and is the preferred format of the NVD. SWID tags are used in the National Vulnerability Database to describe vulnerable components. The CycloneDX specification compliments this work as CycloneDX documents can incorporate SWID tags and other high-level SWID metadata and optionally include entire SWID documents. Use of SWID tag ID's are useful in determining if a specific component has known vulnerabilities.

[CPE (Common Platform Enumeration)][cpe-url] is a specification that describes the vendor, name, and version for an application, operating system, or hardware device. CPE identifiers are used in the National Vulnerability Database to describe vulnerable components. The CycloneDX specification compliments this work as CycloneDX documents can easily be used to construct exact CPE identifiers that are useful in determining if a specific component has known vulnerabilities.

## Copyright & License
CycloneDX is Copyright (c) Steve Springett. All Rights Reserved.

Permission to modify and redistribute is granted under the terms of the [Apache License 2.0][license-url]

[license-image]: https://img.shields.io/badge/license-apache%20v2-brightgreen.svg
[license-url]: https://github.com/CycloneDX/specification/blob/master/LICENSE
[spdx-url]: https://spdx.org
[swid-url]: https://www.iso.org/standard/65666.html
[cpe-url]: https://nvd.nist.gov/products/cpe
