# DSXU V20 Commercial / IP / Brand Release Gate - 2026-05-15

## Purpose

V20 absorption must serve the DSXU target: a DeepSeek-side, DSXU-owned coding product with strong orchestration, Tool Gate, context, recovery, Agent, cost, evidence, UI/TUI visibility, and release hygiene.

Reference products and source trees may be used only to understand capability patterns. They must not become DSXU branding, product claims, runtime names, public compatibility promises, or copied commercial behavior.

## Evidence

Generated scan:

- `docs/generated/DSXU_V20_COMMERCIAL_IP_BRAND_SCAN_20260515.csv`
- `docs/generated/DSXU_V20_COMMERCIAL_IP_BRAND_SCAN_SUMMARY_20260515.json`
- `docs/DSXU_V20_COMMERCIAL_IP_BRAND_ADJUDICATION_20260515.md`
- `docs/generated/DSXU_V20_COMMERCIAL_IP_BRAND_ADJUDICATION_20260515.csv`
- `docs/generated/DSXU_V20_COMMERCIAL_IP_BRAND_ADJUDICATION_SUMMARY_20260515.json`

Summary:

| Item | Count |
|---|---:|
| scanned files | 2699 |
| scan rows | 374 |
| rows requiring review | 63 |
| product-source third-party brand rows | 56 |
| product-source legal term rows | 7 |
| public-release third-party brand rows after this update | 0 |
| post-adjudication active source blockers | 0 |

The public release configuration document has been rewritten to use provider-neutral ecosystem terms and no longer exposes third-party brand examples or provider-specific fallback rows. A follow-up adjudication neutralized product copy in API skill/guide/terminal/toolchain/evaluation contracts, removed 6 inline source maps, and classified the remaining source rows as test evidence, internal provider fallback identifiers, terminal platform identifiers, Git command primitives, safety guards, security detector labels, or vendor/legal notice review.

## Gate Rule

Before final six-stage tests and clean export:

1. Product UI, CLI help, README, configuration docs, package metadata, and release docs must use DSXU-owned or provider-neutral wording.
2. Third-party brand names may remain only in internal evidence, migration review, tests, or legally required vendor notices.
3. Patent, trademark, copyright, and vendor binary notices are release-review items. This scan is not legal clearance.
4. Capability absorption must be expressed as DSXU-owned owners and interfaces, not as a promise to clone or be a drop-in replacement for another branded product.
5. If a branded or legally sensitive product-source row is functionally needed, the owner must either rename it to DSXU/provider-neutral language or document why it is test/evidence/vendor-only and release-excluded.

## Current Status

`COMMERCIAL_IP_BRAND_GATE = ADJUDICATED_ACTIVE_BLOCKERS_0`

This gate is no longer the active blocker for real-gap acceptance, but it remains a predecessor of final release closure:

- real-gap acceptance
- final six-stage tests
- final preflight
- clean export

It does not create a new runtime, entrypoint, adapter, or compatibility holding path.

This is not legal clearance. Vendor binary notices, license notices, package metadata, and final release docs still need final preflight/release closure review.
