# Proposal: First-class `principal` block for components and services

**Status:** Draft v0.1
**Target:** CycloneDX 1.8 (or 1.7.x point release)
**Applies to:** `components`, `services`
**Author:** Markus Hupfauer
**Date:** 2026-05-25

## Summary

Add an optional `principal` object to `components` and `services` that describes the runtime identity under which the component executes, the credential mechanism that backs that identity, and the non-repudiation properties of the resulting audit trail.

The field is the schema enabler for a proposed new BOM type — **[Agentic-System Bill of Materials (ASBOM)](./profile.md)** — but is itself generally useful for any composed system where components execute under distinct identities (CI pipelines with secrets, serverless function chains, multi-tenant SaaS components, etc.). The motivating domain is agentic AI, where the gap is most acute and the operator pain is most concrete; the primitive is not AI-specific.

Today CycloneDX models *what a service exposes* (`services.endpoints`, `services.authenticated: bool`, `services.trustZone: string`) but not *what identity the service executes under* or *what credential it presents to downstream systems*. For agentic systems — where components are increasingly distinguished by *whose authority they act with* rather than by what they technically do — this is the load-bearing missing field. Two skills that ostensibly "use GitHub" have radically different blast radii depending on whether they hold a long-lived PAT, an ambient CLI session, an OAuth on-behalf-of token, or a service-principal identity. The schema must say which.

## The gap, concretely

`services.authenticated: true` collapses every meaningful distinction into one boolean. In practice the distinctions that matter for governance, incident response, and non-repudiation are not whether *some* authentication happens, but **who the audit-log actor is**, **what kind of credential is being presented**, **where that credential is stored**, and **whether a human consent event is bound to its use**. These are four orthogonal axes. No existing CycloneDX field carries any of them.

## The four orthogonal axes

Most schemas (and most thinking) collapse these into "auth method." They are not the same thing and must be modeled separately, because real systems mix them: e.g., an MCP server can run as a service principal (axis 1) holding short-lived OAuth tokens (axis 3) stored in OS keychain (axis 2) with per-action consent (axis 4). Conflating them loses information operators need.

### Axis 1 — Attribution mode (who the audit log records as the actor)

| Value | Meaning | Example |
|---|---|---|
| `none` | Component takes no credentials, calls no authenticated downstream. | Pure-compute skill that only manipulates in-context text. |
| `delegated-ambient` | Component uses whatever credentials are already loaded in the host environment. The downstream system attributes the action to the human user. No per-component consent event ties this specific component's use to the user. | A Claude Code skill that shells out to `gh pr create` and uses the existing `gh` auth. A skill that reads `OPENAI_API_KEY` from env. A skill that reads `~/.aws/credentials`. |
| `delegated-obo` | Component has its own registered client identity at the identity provider. The host or a broker exchanges the user's token for a downstream token bound to *both* the user and the component's client identity (RFC 8693 / Microsoft Graph on-behalf-of). Downstream audit logs show both principals. | A well-behaved MCP server that registers as an OAuth client and uses token exchange to call Microsoft Graph on behalf of the signed-in user. |
| `pat` | Component holds a long-lived bearer token (personal access token, API key) attributed to a human's account but used by the component. The downstream system attributes actions to the token's owning human; nothing in the audit log distinguishes a human-typed call from a component-issued one. | A skill given a GitHub PAT via `GH_TOKEN`. A skill given a Salesforce session token. |
| `service-principal` | Component has its own dedicated machine identity, distinct from any human user. Downstream attributes actions to the machine identity directly. | An MCP server using an Azure managed identity. A GitHub App installation. An AWS IAM role assumed by an agent. |
| `agent-account-os` | Component runs under a separate OS user account whose actions are OS-attestable as belonging to the agent, not the human user. Composes with the above: an OS agent account may *itself* hold delegated-obo or service-principal credentials at the application layer. | A skill running inside Windows 11 Agent Workspace, attributed at the OS layer to the agent's Windows account. |

The crucial property carried by this axis is **non-repudiation between the user and the component**. `delegated-ambient` and `pat` provide *none* — every downstream record is indistinguishable from the user acting directly. `delegated-obo`, `service-principal`, and `agent-account-os` provide it in different ways and at different layers (IdP-attested, IdP-attested, OS-attested respectively).

### Axis 2 — Credential storage (where the secret lives)

| Value | Meaning |
|---|---|
| `none` | No credential held by the component. |
| `in-memory` | Credential lives only in the component's process memory for the duration of a session; never written to disk. |
| `env-var` | Credential is exposed to the component via a process environment variable. Inherits the host's process-environment exposure. |
| `file` | Credential is read from a plaintext file at a known path (e.g., `~/.aws/credentials`, `~/.config/gh/hosts.yml`). |
| `os-keychain` | Credential is retrieved from an OS-mediated secret store: macOS Keychain, Windows Credential Manager / DPAPI, Linux libsecret/Secret Service. Retrieval is gated by the OS and is locally auditable. |
| `hardware-bound` | Credential is sealed to hardware (TPM, Secure Enclave, HSM, FIDO2 authenticator) and cannot be extracted; downstream proofs may be unforgeable off-device. |
| `broker` | Credential is held by a separate broker process (e.g., systemd-credentials, browser credential manager, cloud workload identity sidecar) and presented to the component on demand. |

The crucial property carried by this axis is **exfiltration and replay risk**. A `pat` stored in `env-var` is one shell-injection away from being a permanent compromise; the same `pat` stored in `hardware-bound` form cannot leave the device. The attribution mode (axis 1) tells you *who gets blamed*; the storage axis tells you *how long a stolen credential keeps working from somewhere else*.

### Axis 3 — Credential lifetime

| Value | Meaning |
|---|---|
| `none` | No credential. |
| `session` | Credential is bound to a single host session (e.g., a fresh OAuth grant per CLI session). |
| `short-lived-oauth` | OAuth access token with TTL on the order of minutes to an hour, typically with refresh. |
| `long-lived-pat` | Bearer token with TTL on the order of months or longer, often non-rotating. |
| `perpetual` | No effective expiry until explicit revocation (machine key, classic API key). |

The crucial property carried by this axis is **the duration of compromise from a single exfiltration**. Short-lived tokens limit the blast radius even if storage is weak; long-lived PATs make storage decisions load-bearing.

### Axis 4 — Consent binding

| Value | Meaning |
|---|---|
| `none` | No human consent event is bound to the component's credential use. |
| `per-grant` | A single human consent event at credential issuance authorizes all future use until revocation (the standard OAuth grant model). |
| `per-session` | Human consent is required at the start of each host session in which the component runs. |
| `per-action` | An explicit human consent prompt gates every privileged use (UAC, GitHub fine-grained interactive elevation, "approve this action" patterns in Claude Code and Cursor). |

The crucial property carried by this axis is **whether a prompt-injected agent action is also a consented action**. `none` and `per-grant` mean a single past consent licenses arbitrary future use; `per-action` means each high-stakes call requires a fresh human signal that the agent cannot synthesize.

## Why all four axes are needed

A few worked examples to motivate keeping them separate:

- **Skill A**: uses `delegated-ambient` GitHub CLI auth, credential stored in `file` (`~/.config/gh/hosts.yml`), `long-lived-pat` underlying, `consent: none`. → Indistinguishable from the user at GitHub. Stolen file = persistent compromise.
- **Skill B**: same downstream effect, but uses `delegated-obo` with a registered OAuth client, `short-lived-oauth` in `os-keychain`, `consent: per-grant`. → GitHub audit log shows both Skill B and the user. Stolen credential expires in 1h.
- **Skill C**: holds an Azure `service-principal`, `hardware-bound` to TPM, `perpetual` until rotated, `consent: none`. → Azure logs attribute everything to the agent's machine identity directly. Credential cannot be exfiltrated off the device.
- **Skill D**: runs as an `agent-account-os` user under Windows Agent Workspace, but the *application-layer* credential it presents to a SaaS API is a `pat` stored in `env-var`. → OS audit logs distinguish agent from user; the SaaS API does not.

All four skills would have `services.authenticated: true` today. Operators cannot tell them apart from a BOM. Under this proposal each has a distinct `principal` object, and an incident-response query like "did any agent-installed component on this host hold a long-lived bearer token in plaintext that could have been exfiltrated by the skill installed at T-30 days" becomes a structured query rather than a forensic dig.

## Proposed schema fragment

Attached to both `component` and `service` definitions (and reusable elsewhere via `$ref`):

```jsonc
{
  "principal": {
    "$ref": "#/definitions/principal"
  }
}
```

```jsonc
"principal": {
  "type": "object",
  "title": "Principal",
  "description": "Describes the runtime identity, credential mechanism, and non-repudiation properties under which a component or service executes.",
  "additionalProperties": false,
  "properties": {
    "bom-ref": {
      "$ref": "#/definitions/refType",
      "description": "Identifier so this principal can be referenced from attestations or compositions."
    },
    "mode": {
      "type": "string",
      "enum": [
        "none",
        "delegated-ambient",
        "delegated-obo",
        "pat",
        "service-principal",
        "agent-account-os"
      ],
      "description": "Attribution mode. Determines who the downstream audit log records as the actor and whether the component is distinguishable from the human user at the identity provider."
    },
    "subject": {
      "type": "object",
      "description": "The identity actions are attributed to at the downstream system.",
      "properties": {
        "kind": {
          "type": "string",
          "enum": ["user", "agent-os-account", "service-principal", "token-owner", "compound-user-and-client"]
        },
        "identifier": {
          "type": "string",
          "description": "Human-readable identifier of the subject (e.g., user email, service-principal name, OS account name). Should not include secrets."
        },
        "ref": {
          "$ref": "#/definitions/refLinkType",
          "description": "Optional reference to a component, service, or organizationalContact representing the subject."
        }
      }
    },
    "provider": {
      "type": "object",
      "description": "The identity provider or authority that issues and attests credentials for this principal.",
      "properties": {
        "name": { "type": "string", "description": "e.g., 'github.com', 'entra-id', 'okta', 'aws-iam', 'local-os', 'salesforce'." },
        "uri":  { "type": "string", "format": "iri-reference" },
        "issuer": { "type": "string", "description": "OAuth/OIDC issuer URL if applicable." }
      }
    },
    "scopes": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Scope strings as the provider expresses them. Free-form to accommodate provider-specific conventions (OAuth scopes, IAM action names, GitHub fine-grained permissions, etc.)."
    },
    "credential": {
      "type": "object",
      "description": "Properties of the credential material itself, independent of the attribution mode.",
      "properties": {
        "storage": {
          "type": "string",
          "enum": ["none", "in-memory", "env-var", "file", "os-keychain", "hardware-bound", "broker"],
          "description": "Where the credential lives at rest."
        },
        "lifetime": {
          "type": "string",
          "enum": ["none", "session", "short-lived-oauth", "long-lived-pat", "perpetual"],
          "description": "Effective duration of validity from issuance."
        },
        "replayProtection": {
          "type": "string",
          "enum": ["none", "single-use", "dpop-bound", "mtls-bound", "hardware-bound"],
          "description": "Whether a stolen credential is replayable off the originating device or session."
        },
        "rotation": {
          "type": "string",
          "enum": ["none", "manual", "automatic"],
          "description": "Operational rotation cadence, if applicable."
        }
      }
    },
    "consent": {
      "type": "object",
      "description": "Whether and how a human consent event is bound to credential use.",
      "properties": {
        "binding": {
          "type": "string",
          "enum": ["none", "per-grant", "per-session", "per-action"]
        },
        "mechanism": {
          "type": "string",
          "description": "Free-text identifier of the consent surface, e.g., 'oauth-authorize', 'uac-prompt', 'claude-code-approval', 'github-fine-grained-elevation'."
        }
      }
    },
    "attestation": {
      "type": "object",
      "description": "Where, if anywhere, the principal's actions are independently attestable.",
      "properties": {
        "level": {
          "type": "string",
          "enum": ["none", "partial", "idp-attested", "os-attested", "idp-and-os-attested"]
        },
        "notes": { "type": "string" }
      }
    },
    "properties": {
      "$ref": "#/definitions/properties"
    }
  },
  "required": ["mode"]
}
```

## Backwards compatibility

Pure addition. `principal` is optional on both `component` and `service`. Existing `services.authenticated` and `services.trustZone` remain. Tooling that does not understand `principal` continues to function; tooling that does can lift more precise governance signals from BOMs that include it.

The proposal deliberately does *not* deprecate `services.authenticated` — they cover slightly different intents (the boolean is a property of the service surface; the principal is a property of the executing identity). A consumer SHOULD treat `principal.mode != "none"` as implying `services.authenticated: true` for the service it is attached to.

## Why now

Three converging vectors:

1. **Agent skills as a distribution format.** SKILL.md ([agentskills.io](https://agentskills.io)) and `npx skills` (vercel-labs/skills) made agent capabilities installable artifacts. CycloneDX is the natural inventory; today it cannot say what identity an installed skill executes under.
2. **MCP as the protocol for cross-process agent tools.** MCP servers vary widely in their identity discipline — some implement RFC 8693 token exchange, some forward bearer tokens unchanged, some hold long-lived service tokens. The `principal` block lets a BOM distinguish them.
3. **OS-level agent identity (Windows 11 Agent Workspace).** Microsoft is the first major platform to provide an OS-attested agent principal distinct from the user. Without a schema field for `agent-account-os`, BOMs cannot represent the security property that the OS just made available.

## Worked-diff example (today vs. proposed)

Today, an MCP server appears in a BOM roughly as:

```jsonc
{
  "type": "service",
  "bom-ref": "svc:salesforce-mcp",
  "name": "salesforce-mcp",
  "version": "0.9.1",
  "endpoints": ["https://salesforce-mcp.internal/mcp"],
  "authenticated": true,
  "trustZone": "internal"
}
```

Under this proposal, two MCP servers that today look identical become distinguishable:

```jsonc
{
  "type": "service",
  "bom-ref": "svc:salesforce-mcp-good",
  "name": "salesforce-mcp",
  "version": "0.9.1",
  "endpoints": ["https://salesforce-mcp.internal/mcp"],
  "authenticated": true,
  "trustZone": "internal",
  "principal": {
    "mode": "delegated-obo",
    "subject": { "kind": "compound-user-and-client", "identifier": "alice@example.com + client:salesforce-mcp" },
    "provider": { "name": "salesforce", "issuer": "https://login.salesforce.com" },
    "scopes": ["api", "refresh_token", "id"],
    "credential": {
      "storage": "os-keychain",
      "lifetime": "short-lived-oauth",
      "replayProtection": "dpop-bound",
      "rotation": "automatic"
    },
    "consent": { "binding": "per-grant", "mechanism": "oauth-authorize" },
    "attestation": { "level": "idp-attested" }
  }
}
```

```jsonc
{
  "type": "service",
  "bom-ref": "svc:salesforce-mcp-bad",
  "name": "salesforce-mcp-shim",
  "version": "0.1.0",
  "endpoints": ["https://salesforce-mcp-shim.internal/mcp"],
  "authenticated": true,
  "trustZone": "internal",
  "principal": {
    "mode": "pat",
    "subject": { "kind": "token-owner", "identifier": "alice@example.com" },
    "provider": { "name": "salesforce" },
    "scopes": ["full"],
    "credential": {
      "storage": "env-var",
      "lifetime": "perpetual",
      "replayProtection": "none",
      "rotation": "manual"
    },
    "consent": { "binding": "none" },
    "attestation": { "level": "none" }
  }
}
```

Same protocol, same target system, same trust zone — wildly different governance posture, now machine-readable.

## Open questions

1. Should `principal` be reusable via the `definitions` collection (so multiple components can reference one principal) or always inlined? Suggest: support both via `bom-ref` + `refLinkType`.
2. Are `consent.binding` and `credential.lifetime` better expressed as enums (as proposed) or as durations and free-text? Suggest: enums for interoperability; properties bag for refinements.
3. Where does `principal` attach for *workflows*? Probably on the `task` (which already has `runtimeTopology`) rather than on the `formula`. To be clarified once the profile draft validates against worked examples.

## Prior art

- OAuth 2.0 Token Exchange (RFC 8693)
- Microsoft on-behalf-of flow
- SPIFFE / SPIRE workload identity
- in-toto attestation predicates (the `principal` block is conceptually a predicate)
- Sigstore Fulcio identity bindings

None of these standards is in conflict with this proposal; the `principal` block is the BOM-side surface that lets a consumer reason about which of them is actually in use.
