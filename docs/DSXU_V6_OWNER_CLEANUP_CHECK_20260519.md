# DSXU V6 Owner Cleanup Check - 20260519

- status: `PASS_V6_OWNER_CLEANUP_CHECK`

This report performs V6 Phase 0 owner/action assignment only. It does not move files, delete files, stage changes, or promote internal evidence into public product claims.

## Summary

| metric | value |
|---|---:|
| reviewedRows | 964 |
| unclassifiedRows | 208 |
| unclassifiedWithOwnerAction | 208 |
| experimentRows | 93 |
| experimentDefaultExposureViolations | 0 |
| frozenRows | 124 |
| frozenDefaultExposureViolations | 0 |
| historicalResidueRows | 521 |
| historicalDefaultExposureViolations | 0 |
| claimBlockedRows | 964 |

## Blockers

- none

## First 40 Action Rows

| path | label | owner | action | exposure | claimAllowed |
|---|---|---|---|---|---|
| `bunfig.toml` | unclassified | Runtime Config / Release Surface | keep-release-surface | not-exposed | false |
| `package.json` | unclassified | Runtime Config / Release Surface | keep-release-surface | not-exposed | false |
| `README.md` | unclassified | Docs / Release Claim Binder | keep-release-surface | not-exposed | false |
| `src/commands/bridge/bridge.tsx` | unclassified | Runtime Service Owner | classify-before-claim | doc-only | false |
| `src/components/ManagedSettingsSecurityDialog/ManagedSettingsSecurityDialog.tsx` | unclassified | Docs / Release Claim Binder | keep-release-surface | doc-only | false |
| `src/components/ManagedSettingsSecurityDialog/utils.ts` | unclassified | Docs / Release Claim Binder | keep-release-surface | doc-only | false |
| `src/coordinator/dag/persist.ts` | unclassified | Owner Review Queue | classify-before-claim | doc-only | false |
| `src/coordinator/dag/templates.ts` | unclassified | Owner Review Queue | classify-before-claim | doc-only | false |
| `src/coordinator/dag/types.ts` | unclassified | Owner Review Queue | classify-before-claim | doc-only | false |
| `src/coordinator/roles/contract.ts` | unclassified | Owner Review Queue | classify-before-claim | doc-only | false |
| `src/coordinator/roles/index.ts` | unclassified | Owner Review Queue | classify-before-claim | doc-only | false |
| `src/coordinator/roles/message.ts` | unclassified | Owner Review Queue | classify-before-claim | doc-only | false |
| `src/coordinator/roles/orchestrator.ts` | unclassified | Owner Review Queue | classify-before-claim | doc-only | false |
| `src/coordinator/roles/README.md` | unclassified | Owner Review Queue | classify-before-claim | doc-only | false |
| `src/coordinator/roles/role-implementations.ts` | unclassified | Owner Review Queue | classify-before-claim | doc-only | false |
| `src/coordinator/voting/clusterer.ts` | unclassified | Owner Review Queue | classify-before-claim | doc-only | false |
| `src/coordinator/voting/contract.ts` | unclassified | Owner Review Queue | classify-before-claim | doc-only | false |
| `src/coordinator/voting/similarity.ts` | unclassified | Owner Review Queue | classify-before-claim | doc-only | false |
| `src/coordinator/voting/voter.ts` | unclassified | Owner Review Queue | classify-before-claim | doc-only | false |
| `src/dsxu/control-plane/controlJwt.ts` | unclassified | Owner Review Queue | classify-before-claim | doc-only | false |
| `src/dsxu/control-plane/controlMain.ts` | unclassified | Owner Review Queue | classify-before-claim | doc-only | false |
| `src/dsxu/control-plane/controlMessaging.ts` | unclassified | Owner Review Queue | classify-before-claim | doc-only | false |
| `src/dsxu/control-plane/inboundControlMessages.ts` | unclassified | Owner Review Queue | classify-before-claim | doc-only | false |
| `src/dsxu/control-plane/index.ts` | unclassified | Owner Review Queue | classify-before-claim | doc-only | false |
| `src/dsxu/control-plane/operatorStateProjection.ts` | unclassified | Owner Review Queue | classify-before-claim | doc-only | false |
| `src/dsxu/cost/index.ts` | unclassified | DeepSeek Provider / Cost Cache | classify-before-claim | doc-only | false |
| `src/dsxu/engine/accessibility-tree.ts` | unclassified | Query Loop / Execution Contract | classify-before-claim | doc-only | false |
| `src/dsxu/engine/adapters/file-edit-adapter.ts` | unclassified | Query Loop / Execution Contract | classify-before-claim | doc-only | false |
| `src/dsxu/engine/adr-review.ts` | unclassified | Query Loop / Execution Contract | classify-before-claim | doc-only | false |
| `src/dsxu/engine/analyzers/classification-analyzer.ts` | unclassified | Query Loop / Execution Contract | classify-before-claim | doc-only | false |
| `src/dsxu/engine/analyzers/filtering-analyzer.ts` | unclassified | Query Loop / Execution Contract | classify-before-claim | doc-only | false |
| `src/dsxu/engine/analyzers/scoring-analyzer.ts` | unclassified | Query Loop / Execution Contract | classify-before-claim | doc-only | false |
| `src/dsxu/engine/api-microcompact-bridge.ts` | unclassified | Query Loop / Execution Contract | classify-before-claim | doc-only | false |
| `src/dsxu/engine/background-governance-contract.ts` | unclassified | Query Loop / Execution Contract | classify-before-claim | doc-only | false |
| `src/dsxu/engine/baseline-failure-reporter.ts` | unclassified | Query Loop / Execution Contract | classify-before-claim | doc-only | false |
| `src/dsxu/engine/brief/brief-generator.ts` | unclassified | Query Loop / Execution Contract | classify-before-claim | doc-only | false |
| `src/dsxu/engine/bug-brain.ts` | unclassified | Query Loop / Execution Contract | classify-before-claim | doc-only | false |
| `src/dsxu/engine/bug-brain/export.ts` | unclassified | Query Loop / Execution Contract | classify-before-claim | doc-only | false |
| `src/dsxu/engine/bug-brain/index.ts` | unclassified | Query Loop / Execution Contract | classify-before-claim | doc-only | false |
| `src/dsxu/engine/bug-brain/integration.ts` | unclassified | Query Loop / Execution Contract | classify-before-claim | doc-only | false |
