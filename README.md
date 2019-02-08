[![License][license-image]][license-url]
[![Website](https://img.shields.io/badge/https://-cyclonedx.org-blue.svg)](https://cyclonedx.org/)
[![Twitter](https://img.shields.io/twitter/url/http/shields.io.svg?style=social&label=Follow)](https://twitter.com/CycloneDX_Spec)

CycloneDX Specification
=====================================

CycloneDX is a lightweight software bill-of-material (SBOM) specification designed for use in application security contexts and supply chain component analysis.

Background
-------------------

In software engineering, it is common to build new software by leveraging existing components. In doing so, it is 
often necessary to provide a bill of material that describes the components that are packaged with an application. 

Today, most build systems provide some form of dependency tree that documents or illustrates the software components 
used in a specific build. Depending on the build system, this may or may not be accurate or representative of the 
final delivery.

It is also common to combine multiple languages or development platforms in creating new types of applications. The 
use of multiple build systems is often required in these scenarios.

Project Goals
-------------------

- Define a vendor agnostic specification independent of language or ecosystem
- Specification should be simultaneously human and machine readable
- Specification should be simple to implement with minimal effort
- Specification should provide lightweight schema definitions for JSON and XML
- Specification should reuse parts of existing specs where beneficial
- Specification should be decentralized, authoritative, and security focused
- Specification should promote continuous component analysis
- Specification should support hardware, libraries, frameworks, applications, and operating systems

Features
-------------------

CycloneDX is intended to provide high-level component information that would be useful to legal or software security teams.

* Provide information such as component vendor, name, and version
* Identify the license used by the component
* If the component is distributed in a package, provide a file hash for the component

Use Cases
-------------------

The simplest use case involves an author of a component. The author would easily create a valid CycloneDX document using their IDE or text editor. The document specification describes a set of pre-defined fields that are intended to describe the component, who made it, the version, the license, and all other relevant information that would be useful to software security teams.

Today, this information may or may not be available depending on the development language used. If available, the information is often extracted from components as a set of evidence. The fields and their meanings are typically not enforced and vary between language and build system. CycloneDX provides a standards-based method of self-identifying components without adding additional complexity.

Namespaces
-------------------

CycloneDX defines two unique namespaces, a bill-of-material (bom) namespace and a SPDX namespace. The SPDX namespace
evolves independently from the bom namespace. As new SPDX licenses are added to the SPDX specification, those changes 
will be reflected in the bom namespace automatically, without having to change namespaces.

CycloneDX is a versioned namespace and operates as follows:

* `http://cyclonedx.org/schema/bom` will always reference the latest version of the spec.
* Supplying a version after /bom such as `http://cyclonedx.org/schema/bom/1.0` will specify a specific version of the spec.

Adopters
-------------------

The idea behind CycloneDX originated from the OWASP [Dependency-Track][odc-url] project. There are many benefits of
being able to easily create BOMs and push the data to the Dependency-Track platform through automation. There are,
of course, many other uses of this format. 

If you know of a project that has adopted CycloneDX, feel free to submit a pull request by adding it to the list below:

* [Dependency-Track][odc-url]

Related Work
-------------------

[SPDX (Software Package Data Exchange)][spdx-url] is a specification that provides low-level details of components, including all files, hashes, authors, and copyrights. SPDX also defines over 300 open source license IDs. CycloneDX builds on top of the work SPDX has accomplished with license IDs, but varies greatly in its approach towards building a software bill of material specification.

[CPE (Common Platform Enumeration)][cpe-url] is a specification that describes the vendor, name, and version for an application, operating system, or hardware device. CPE identifiers are used in the National Vulnerability Database to describe vulnerable components. The CycloneDX specification compliments this work as CycloneDX documents can easily be used to construct exact CPE identifiers that are useful in determining if a specific component has a known vulnerability (CVE).

Copyright & License
-------------------

CycloneDX is Copyright (c) Steve Springett. All Rights Reserved.

Permission to modify and redistribute is granted under the terms of the [Apache License 2.0][license-url]

[license-image]: https://img.shields.io/badge/license-apache%20v2-brightgreen.svg
[license-url]: https://github.com/CycloneDX/specification/blob/master/LICENSE
[spdx-url]: https://spdx.org
[cpe-url]: https://nvd.nist.gov/products/cpe
[odc-url]: https://dependencytrack.org
