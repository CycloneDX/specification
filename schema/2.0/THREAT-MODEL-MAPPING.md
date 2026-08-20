# OWASP Threat Model Library Mapping

This note records mappings from the OWASP Threat Model Library to CycloneDX 2.0 threat-model structures.

## Control Status

Map OWASP Threat Model Library control statuses to `controls[].status` as follows:

| OWASP status | CycloneDX status |
| --- | --- |
| `assumed` | `{ "name": "assumed", "description": "Inherited or presumed to be in effect; implementation has not been independently verified." }` |
| `active` | `implemented` |
| `suggested` | `recommended` |
| `under_review` | `proposed` |
| `approved` | `approved` |
| `scheduled` | `planned` |
| `retired` | `decommissioned` |
| `wont_do` | `rejected` |

`assumed` remains a custom status because it expresses an evidentiary condition that is not equivalent to implementation. This preserves the source meaning without expanding the global implementation-status vocabulary.
