
# CycloneDX Bill of Materials Specification (ECMA-424)

[![License][license-image]][license-url]
[![ECMA TC54](https://img.shields.io/badge/ECMA-TC54-FC7C00?labelColor=404040)](https://tc54.org) 
[![Website](https://img.shields.io/badge/https://-cyclonedx.org-blue.svg)](https://cyclonedx.org/)
[![Slack Invite](https://img.shields.io/badge/Slack-Join-blue?logo=slack&labelColor=393939)](https://cyclonedx.org/slack/invite)
[![Group Discussion](https://img.shields.io/badge/discussion-groups.io-blue.svg)](https://groups.io/g/CycloneDX)
[![Twitter](https://img.shields.io/twitter/url/http/shields.io.svg?style=social&label=Follow)](https://twitter.com/CycloneDX_Spec)  
[![Build Docs](https://github.com/CycloneDX/specification/actions/workflows/build_docs.yml/badge.svg)](https://github.com/CycloneDX/specification/actions/workflows/build_docs.yml)
[![CT Java](https://github.com/CycloneDX/specification/actions/workflows/test_java.yml/badge.svg)](https://github.com/CycloneDX/specification/actions/workflows/test_java.yml)
[![CT JavaScript](https://github.com/CycloneDX/specification/actions/workflows/test_js.yml/badge.svg)](https://github.com/CycloneDX/specification/actions/workflows/test_js.yml)
[![CT PHP](https://github.com/CycloneDX/specification/actions/workflows/test_php.yml/badge.svg)](https://github.com/CycloneDX/specification/actions/workflows/test_php.yml)
[![CT ProtoBuf](https://github.com/CycloneDX/specification/actions/workflows/test_proto.yml/badge.svg)](https://github.com/CycloneDX/specification/actions/workflows/test_proto.yml)    

----

OWASP CycloneDX is a full-stack Bill of Materials (BOM) standard that provides advanced supply chain capabilities for 
cyber risk reduction. CycloneDX is an [Ecma International](https://ecma-international.org/) standard published as 
[ECMA-424](https://ecma-international.org/publications-and-standards/standards/ecma-424/). 
The [OWASP Foundation](https://owasp.org/) and Ecma International [Technical Committee for Software & System Transparency (TC54)](https://tc54.org/) 
drive the continued advancement of the specification.

The specification supports:
* Software Bill of Materials (SBOM)
* Software-as-a-Service Bill of Materials (SaaSBOM)
* Hardware Bill of Materials (HBOM)
* Machine Learning Bill of Materials (ML-BOM)
* Cryptography Bill of Materials (CBOM)
* Manufacturing Bill of Materials (MBOM)
* Operations Bill of Materials (OBOM)
* Vulnerability Disclosure Reports (VDR)
* Vulnerability Exploitability eXchange (VEX)
* CycloneDX Attestations (CDXA)

## A Note on the Standard and Schemas
CycloneDX is an Ecma International standard published as ECMA-424 under a [royalty-free patent policy](https://ecma-international.org/policies/by-ipr/royalty-free-patent-policy-extension-option/). 
The CycloneDX schemas in this repository are the official interpretations of the standard and are available under the
[Apache 2.0 license](https://www.apache.org/licenses/LICENSE-2.0.txt). The JSON Schema is the reference implementation 
for the standard.

## Use Cases
The CycloneDX project maintains a [list of achievable use cases](https://cyclonedx.org/use-cases/). Examples for each
use case are provided in both XML and JSON.


## Tool Center
The [CycloneDX Tool Center](https://cyclonedx.org/tool-center/) is a community effort to establish a marketplace of 
free, open source, and proprietary tools and solutions that support the CycloneDX specification. 


## Media Types

The following media types are officially registered with IANA:

| Media Type | Format | Assignment |
|------------|--------|------------|
| `application/vnd.cyclonedx+xml` | XML | [IANA](https://www.iana.org/assignments/media-types/application/vnd.cyclonedx+xml) |
| `application/vnd.cyclonedx+json` | JSON | [IANA](https://www.iana.org/assignments/media-types/application/vnd.cyclonedx+json) |
| `application/x.vnd.cyclonedx+protobuf` | Protocol Buffer | |

Specific versions of CycloneDX can be specified by using the version parameter. For example: `application/vnd.cyclonedx+xml; version=1.6`.


## Recognized file patterns

The following file names are conventionally used for storing CycloneDX BOM files:
* `bom.json` for JSON encoded CycloneDX BOM files.
* `bom.xml` for XML encoded CycloneDX BOM files.

Alternatively, files that match the glob pattern below are also recognized:
* `*.cdx.json` for JSON encoded CycloneDX BOM files.
* `*.cdx.xml` for XML encoded CycloneDX BOM files.
    

## Release History

| Version           | Release Date    |
|-------------------|-----------------|
| CycloneDX 1.6     | 09 April 2024   |
| CycloneDX 1.5     | 26 June 2023    |
| CycloneDX 1.4     | 12 January 2022 |
| CycloneDX 1.3     | 04 May 2021     |
| CycloneDX 1.2     | 26 May 2020     |
| CycloneDX 1.1     | 03 March 2019   |
| CycloneDX 1.0     | 26 March 2018   |
| Initial Prototype | 01 May 2017     |


## Copyright & License

CycloneDX Specification is Copyright (c) OWASP Foundation. All Rights Reserved.

Permission to modify and redistribute is granted under the terms of the [Apache License 2.0][license-url]

[license-image]: https://img.shields.io/badge/license-apache%20v2-brightgreen.svg
[license-url]: https://github.com/CycloneDX/specification/blob/master/LICENSE
