[![License][license-image]][license-url]
[![Website](https://img.shields.io/badge/https://-cyclonedx.org-blue.svg)](https://cyclonedx.org/)
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
- Track component usage and risk with optional hierarchical representation
- Generate automatically from multiple development ecosystems
- Portable, single file which can be supplied by development teams, business partners, and vendors
- Document a components pedigree including ancestors, descendants, and variants, representing a components lineage from any viewpoint
- Analyze modified open source libraries without any loss of fidelity 
- Validate the integrity of BOMs from suppliers


## Namespaces
CycloneDX defines two unique namespaces, a bill-of-material (bom) namespace and a SPDX namespace. The SPDX namespace
evolves independently from the bom namespace. As new SPDX licenses are added to the SPDX specification, those changes 
will be reflected in the bom namespace automatically, without having to change namespaces.

CycloneDX is a versioned namespace and operates as follows:

* `http://cyclonedx.org/schema/bom` will always reference the latest version of the spec.
* Supplying a version after /bom such as `http://cyclonedx.org/schema/bom/1.0` will specify a specific version of the spec.


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
|license| Zero or more license names or SPDX license IDs | |
|copyright| An optional copyright notice informing users of the underlying claims to copyright ownership in a published work| |
|purl| The Package URL of the component | |
|cpe| An optional mapping to an existing CPE identifier | |
|modified| Indicates if the component has been modified from the official distribution | &#x2714; |
|components| Specifies optional sub-components. This is not a dependency tree. It simply provides an optional way to group large sets of components together. | |

## Example BOM
```xml
<?xml version="1.0" encoding="UTF-8"?>
<bom xmlns="http://cyclonedx.org/schema/bom/1.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="1" xsi:schemaLocation="http://cyclonedx.org/schema/bom/1.0 http://cyclonedx.org/schema/bom/1.0">
  <components>
    <component type="library">
      <group>org.jboss.resteasy</group>
      <name>resteasy-jaxrs</name>
      <version>3.1.0.Final</version>
      <description>JAX-RS bindings for RestEasy</description>
      <hashes>
        <hash alg="SHA-1">6427a9a622bff4dbe99d6f08dabd0dd89af85235</hash>
        <hash alg="SHA-256">97bb6890cea26ed6f107603426fdb19f1444932c310705895ecf9cc24992da0d</hash>
      </hashes>
      <licenses>
        <license>
          <id>Apache-2.0</id>
        </license>
      </licenses>
      <purl>pkg:maven/org.jboss.resteasy/resteasy-jaxrs@3.1.0-Final?type=jar</purl>
      <cpe>cpe:2.3:a:redhat:resteasy:3.1.0:*:*:*:*:*:*:*</cpe>
      <modified>false</modified>
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
