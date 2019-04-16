[![Build Status](https://travis-ci.org/CycloneDX/specification.svg?branch=master)](https://travis-ci.org/CycloneDX/specification)
[![License][license-image]][license-url]
[![Website](https://img.shields.io/badge/https://-cyclonedx.org-blue.svg)](https://cyclonedx.org/)
[![Group Discussion](https://img.shields.io/badge/discussion-groups.io-blue.svg)](https://groups.io/g/CycloneDX)
[![Twitter](https://img.shields.io/twitter/url/http/shields.io.svg?style=social&label=Follow)](https://twitter.com/CycloneDX_Spec)

# CycloneDX Specification
CycloneDX is a lightweight software bill-of-material (SBOM) specification designed for use in application security contexts and supply chain component analysis.


## Introduction
In software engineering, it is common to build new software by leveraging existing components. In doing so, it is 
often necessary to provide a bill of material that describes the components that are packaged with an application. 


## Project Goals
- Define a vendor agnostic specification independent of language or ecosystem
- Specification should be simultaneously human and machine readable
- Specification should be simple to implement with minimal effort
- Specification should provide lightweight schema definitions for JSON and XML
- Specification should reuse parts of existing specs where beneficial
- Specification should be decentralized, authoritative, and security focused
- Specification should promote continuous component analysis
- Specification should support hardware, libraries, frameworks, applications, and operating systems


## Achievable Use Cases
- Vulnerability analysis (software and hardware)
- Outdated component analysis
- License identification and compliance
- File verification
- Hierarchical representation of component assemblies
- Document a components pedigree including ancestors, descendants, variants, and commits, representing a components lineage from any viewpoint and what attributes make it unique
- Analyze modified open source libraries without any loss of fidelity
- Human and machine readable format designed to be simple to use, extensible, and easily adoptable


## Namespaces
CycloneDX defines two unique namespaces, a bill-of-material (bom) namespace and a SPDX namespace. The SPDX namespace
evolves independently from the bom namespace. As new SPDX licenses are added to the SPDX specification, those changes 
will be reflected in the bom namespace automatically, without having to change namespaces.

CycloneDX is a versioned namespace and operates as follows:

* `http://cyclonedx.org/schema/bom` will always reference the latest version of the spec.
* Supplying a version after /bom such as `http://cyclonedx.org/schema/bom/1.1` will specify a specific version of the spec.


## Specification Overview
| Field | Description | Required |
| ------|-------------| :------: |
|type| Describes if the component is a library, framework, application, operating system, or hardware device | 	&#x2714; |
|publisher| The person(s) or organization(s) that published the component | |
|group| The high-level classification that a project self-describes as. This will often be a shortened, single name of the company or project that produced the component, or the source package or domain name. | |
|name| The name of the component as defined by the project | &#x2714; |
|version| The version of the component as defined by the project | &#x2714; |
|description| A description of the component | |
|scope| Specifies the scope of the component. If scope is not specified, 'runtime' scope will be assumed. | |
|hashes| File hashes supporting MD5, SHA1, SHA2, and SHA3 | |
|license| A node describing zero or more license names, SPDX license IDs or expressions | |
|copyright| An optional copyright notice informing users of the underlying claims to copyright ownership in a published work| |
|purl| The Package URL of the component | |
|cpe| An optional mapping to an existing CPE identifier | |
|modified| Indicates if the component has been modified from the official distribution | |
|pedigree| A node which contains component ancestors, descendants, variants, and the commit which make it unique | |
|externalReferences| A node which contains various types of references to external resources | |
|components| Specifies optional sub-components. This is not a dependency tree. It provides a hierarchical representation of component assemblies | |

## Example BOM
```xml
<?xml version="1.0" encoding="UTF-8"?>
<bom xmlns="http://cyclonedx.org/schema/bom/1.1" serialNumber="urn:uuid:3e671687-395b-41f5-a30f-a58921a69b79" version="1">
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

## Implementations
Build plugins for a number of ecosystems have been created which support the automatic identification of all project 
dependencies and automatically generate CycloneDX BOMs. The resulting BOMs may contain many of the elements above 
including group, name, version, description, file hashes, license, and PackageURL. Additionally, a standalone Java API 
was created for the programmatic creation and validation of CycloneDX BOMs.

- [CycloneDX .NET Core](https://github.com/CycloneDX/cyclonedx-dotnet)
- [CycloneDX Node.js Module](https://github.com/CycloneDX/cyclonedx-node-module)
- [CycloneDX Maven Plugin](https://github.com/CycloneDX/cyclonedx-maven-plugin)
- [CycloneDX Python Module](https://github.com/CycloneDX/cyclonedx-python)
- [CycloneDX Java API](https://github.com/CycloneDX/cyclonedx-core-java)


Additional build plugins are planned and we're actively looking for volunteers to assist.

## Related Work
[SPDX (Software Package Data Exchange)][spdx-url] is a specification that provides low-level details of components, including all files, hashes, authors, and copyrights. SPDX also defines over 300 open source license IDs. CycloneDX builds on top of the work SPDX has accomplished with license IDs, but varies greatly in its approach towards building a software bill of material specification.

[CPE (Common Platform Enumeration)][cpe-url] is a specification that describes the vendor, name, and version for an application, operating system, or hardware device. CPE identifiers are used in the National Vulnerability Database to describe vulnerable components. The CycloneDX specification compliments this work as CycloneDX documents can easily be used to construct exact CPE identifiers that are useful in determining if a specific component has a known vulnerability (CVE).

## Copyright & License
CycloneDX is Copyright (c) Steve Springett. All Rights Reserved.

Permission to modify and redistribute is granted under the terms of the [Apache License 2.0][license-url]

[license-image]: https://img.shields.io/badge/license-apache%20v2-brightgreen.svg
[license-url]: https://github.com/CycloneDX/specification/blob/master/LICENSE
[spdx-url]: https://spdx.org
[cpe-url]: https://nvd.nist.gov/products/cpe
[odc-url]: https://dependencytrack.org
