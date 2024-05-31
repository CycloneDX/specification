[![Build Status](https://github.com/CycloneDX/specification/workflows/CI%20Build/badge.svg)](https://github.com/CycloneDX/specification/actions?workflow=CI+Build)
[![License][license-image]][license-url]
[![Website](https://img.shields.io/badge/https://-cyclonedx.org-blue.svg)](https://cyclonedx.org/)
[![Slack Invite](https://img.shields.io/badge/Slack-Join-blue?logo=slack&labelColor=393939)](https://cyclonedx.org/slack/invite)
[![Group Discussion](https://img.shields.io/badge/discussion-groups.io-blue.svg)](https://groups.io/g/CycloneDX)
[![Twitter](https://img.shields.io/twitter/url/http/shields.io.svg?style=social&label=Follow)](https://twitter.com/CycloneDX_Spec)
[![ECMA TC54](https://img.shields.io/badge/ECMA-TC54-FC7C00?labelColor=404040)](https://tc54.org)


# NOTICE: Opt-out review period
> Opt-out review period: 25 April 2024 to 25 June 2024
> Review Material: [TC54/2024/011](https://members.ecma-international.org:5001/sharing/a5WruJ6ga)
> 
> Dear TC54 members,
> 
> This is to announce the beginning of the Opt-out review period for new ECMA-4xx draft standard from 25 April 2024 to 25 June 2024. See the Ecma RF policy extension and consult your company's legal department for more details on this process. Please > feel free to reach out to me if you have any questions.
>
>All possible opt-out requests should be submitted to the Ecma Secretariat directly. The Opt-out form is available on the [Ecma website](https://ecma-international.org/policies/by-ipr/).



# CycloneDX Specification
OWASP CycloneDX is a full-stack Bill of Materials (BOM) standard that provides advanced supply chain capabilities for cyber risk reduction. The specification supports:
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


## Introduction
Modern software is assembled using third-party and open source components, glued together in complex and unique ways,
and integrated with original code to achieve the desired functionality. An accurate inventory of all components enables
organizations to identify risk, allows for greater transparency, and enables rapid impact analysis.

CycloneDX was created for this purpose.

Strategic direction and maintenance of the specification is managed by the CycloneDX Core Working Group, is backed by the 
[OWASP Foundation](https://owasp.org), and is supported by the global information security community.


## Use Cases
The CycloneDX project maintains a [list of achievable use cases](https://cyclonedx.org/use-cases/). Examples for each
use case are provided in both XML and JSON.


## Tool Center
The [CycloneDX Tool Center](https://cyclonedx.org/tool-center/) is a community effort to establish a marketplace of 
free, open source, and proprietary tools and solutions that support the CycloneDX specification. 


## Media Types

The following media types are officially registered with IANA:

| Media Type | Format | Assignment |
| ------- | --------- | --------- |
| application/vnd.cyclonedx+xml | XML | [IANA](https://www.iana.org/assignments/media-types/application/vnd.cyclonedx+xml) |
| application/vnd.cyclonedx+json | JSON | [IANA](https://www.iana.org/assignments/media-types/application/vnd.cyclonedx+json) |

Specific versions of CycloneDX can be specified by using the version parameter. For example: `application/vnd.cyclonedx+xml; version=1.6`.

The officially supported media type for Protocol Buffer format is `application/x.vnd.cyclonedx+protobuf`.


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
