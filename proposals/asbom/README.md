# Proposal: Agentic-System Bill of Materials (ASBOM) and `principal` field

**Status:** Draft RFC for community feedback
**Discussion:** [#940](https://github.com/CycloneDX/specification/discussions/940)
**Process step:** [Standardization process](https://cyclonedx.org/participate/standardization-process/) — "Pull requests can be initially created in 'draft' to enable early community feedback."
**Author:** Markus Hupfauer (@mhupfauer)
**Date:** 2026-05-30

## What this PR is (and is not)

This PR surfaces the proposal from discussion [#940](https://github.com/CycloneDX/specification/discussions/940) in **draft PR form** for early community feedback, per the CycloneDX standardization process. It deliberately does **not** patch the released v1.7 schema or pre-empt the in-flight modular v2.0 architecture in PR [#930](https://github.com/CycloneDX/specification/pull/930). The intent is to give the Core Working Group a reviewable surface (file diff, line comments, suggested edits) for a proposal that has not received engagement on the discussion thread.

If the Working Group accepts the proposal, the natural follow-up work is to:

- realise the `principal` field as a modular model under [`schema/2.0/model/`](../../schema/2.0/model/) once that structure lands via [#930](https://github.com/CycloneDX/specification/pull/930) — likely as `cyclonedx-principal-2.0.schema.json`, referenced from `cyclonedx-service-2.0.schema.json` and `cyclonedx-component-2.0.schema.json`;
- align ASBOM's `bomType` discriminator with whatever convention v2.0 adopts (the current draft uses `metadata.properties.cdx:bomType` for compatibility with 1.7 consumers);
- compose with the [party model](https://github.com/CycloneDX/specification/pull/930) where appropriate — the `valid-party-system-service-account-2.0.json` and `valid-party-ai-agent-2.0.json` fixtures in #930 cover concepts adjacent to `principal.attributionMode`, and the two models should be reconciled rather than overlap.

## Contents

- **[`profile.md`](./profile.md)** — ASBOM v0.1 specification. Conformance rules, component taxonomy mapping agentic-system parts to existing CycloneDX `component`/`service` types, composition pattern (`compositions`, `formulation.runtimeTopology`), attestation via `declarations`, signing requirements, property-bag fallback for consumers without the `principal` field.
- **[`principal.md`](./principal.md)** — Schema proposal for the one new field ASBOM requires. Decomposes credential modelling into four orthogonal axes (attribution mode, credential storage, credential lifetime, consent binding), frames the gap around non-repudiation, ships a JSON Schema fragment and worked diff examples (OBO MCP server vs. PAT shim). Generally useful beyond ASBOM (CI pipelines, serverless chains, multi-tenant SaaS).
- **[`example-claude-code-session.cdx.json`](./example-claude-code-session.cdx.json)** — Valid CycloneDX 1.7 ASBOM applied to a realistic scenario: Claude Code in Windows 11 Agent Workspace, one skill installed via internal registry, one MCP server using delegated-OBO with DPoP-bound OAuth tokens in OS keychain, plus signed fleet-admin and registry-operator attestations.

## Why a new BOM type, not just a profile

The agentic-AI ecosystem has rapidly moved to a place where capabilities (SKILL.md packages, MCP servers, plugins) are installable artifacts, hosts (Claude Code, Cursor, Gemini CLI, GitHub CLI) load them dynamically, and operating systems (Windows 11 Agent Workspace) now expose dedicated agent principals. The *running composition* of these parts — which model, in which harness, with which skills, in which runtime, under which credentials — is what determines an agentic system's effective authority and blast radius. It is the unit operators must audit, sign, and respond to in an incident.

| BOM type | Inventories |
|---|---|
| SBOM | Software components |
| HBOM | Hardware components |
| ML-BOM | Models, training datasets, training methodology |
| SaaSBOM | Service surfaces, endpoints, data flows |
| CBOM | Cryptographic assets |
| MBOM | Manufactured items |
| OBOM | Operations / runtime configuration |
| **ASBOM** | **Runtime composition of an agentic system + identities under which each part executes** |

Where ML-BOM answers "what is this model and how was it trained" and SaaSBOM answers "what services and data flows exist," ASBOM answers "what composition is executing *right now*, under whose authority, with what reversibility, and with what non-repudiation properties." None of the existing types capture the *running stack of identities* — and that is the unit operators must audit, sign, and respond to in an agentic-AI incident.

ASBOM is expressible entirely in CycloneDX 1.7 primitives (`compositions`, `formulation.runtimeTopology`, `declarations`, `services.trustZone`, `components.type=machine-learning-model`/`platform`/`application`) with one schema addition — the `principal` block proposed in [`principal.md`](./principal.md).

## The four orthogonal axes of `principal` (summary)

Today `services.authenticated: bool` + `services.trustZone: string` collapses four orthogonal axes into a single boolean. The proposed `principal` block separates them:

1. **Attribution mode** — `none`, `delegated-ambient` (skill uses host's `gh` auth), `delegated-obo` (RFC 8693 token exchange), `pat` (long-lived bearer), `service-principal`, `agent-account-os` (e.g., Win11 Agent Workspace). Determines who the downstream audit log records as actor.
2. **Credential storage** — `none` / `in-memory` / `env-var` / `file` / `os-keychain` / `hardware-bound` / `broker`. Determines exfiltration and off-device replay risk.
3. **Credential lifetime** — `session` / `short-lived-oauth` / `long-lived-pat` / `perpetual`. Determines duration of compromise.
4. **Consent binding** — `none` / `per-grant` / `per-session` / `per-action`. Determines whether a prompt-injected agent action is also a consented action.

Real systems mix these axes — e.g., an MCP server can run as a service principal (axis 1) holding short-lived OAuth tokens (axis 3) stored in OS keychain (axis 2) with per-action consent (axis 4). Conflating them loses the information operators need.

See [`principal.md`](./principal.md) for the full enumeration, JSON Schema fragment, backwards-compatibility analysis, and worked diff examples that show two MCP servers identical under today's schema (`authenticated: true, trustZone: internal`) but with wildly different governance postures once `principal` is populated.

## Open questions for the Working Group

The same four questions as the discussion thread, restated for PR review:

1. **Framing.** Is ASBOM the right framing, or should this land as a *profile* on top of existing BOM types? My read: new BOM type, because the domain is distinct enough that operators need a recognisable category — but happy to be argued out of it. The party model in [#930](https://github.com/CycloneDX/specification/pull/930) creates an alternative path where ASBOM could land as a coordinated party + composition + principal pattern rather than a top-level type.
2. **Axes.** Is the four-axis decomposition for `principal` the right grain, or are some of these axes better collapsed / expanded? Of the four, attribution-mode is the load-bearing one; consent-binding is the most novel.
3. **Attachment.** Where should `principal` attach — `component` only, `service` only, both, or via `definitions` for reuse? The draft attaches to both; in v2.0 modular form it would naturally become a referenceable model.
4. **Home.** If accepted, should the ASBOM specification live in this repo (as a capability page / authoritative guide) or as a downstream maintained spec?

I am happy to split this into smaller PRs (`principal` field alone, ASBOM capability brand alone, axes as separate enums) if that is easier to land incrementally.

## Related

- Discussion: [CycloneDX/specification#940](https://github.com/CycloneDX/specification/discussions/940)
- Adjacent in-flight work: [CycloneDX/specification#930](https://github.com/CycloneDX/specification/pull/930) (party model / modular v2.0)
- Blog post motivating the broader argument: [The registry is the control plane](https://hupfauer.one/posts/the-registry-is-the-control-plane/)
- Working drafts and reference repo: [mhupfauer/asbom](https://github.com/mhupfauer/asbom)
- Reference implementation seed for policy-aware skill installation (the natural ASBOM producer): [vercel-labs/skills#1254](https://github.com/vercel-labs/skills/pull/1254)
