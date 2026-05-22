# DSXU V5 Replay Bank Strict Intake - 2026-05-19

Status: `PASS_V5_REPLAY_BANK_REQUIRED_SUBSET`

This intake uses native V5 internal replay traces for V5 default-chain acceptance only. It is not a public benchmark score and cannot be used as a 90% external-comparison claim without paired public raw evidence.

## Summary

| sourceCases | bankCases | accepted | nativeV5Ready | projectedLegacy | requiredSubsetReady | fullReleaseReady | rawTraceSavedPct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 20 | 20 | 20 | 20 | 0 | true | false | 100 |

## Source

- sourcePackPath: `docs/generated/DSXU_V5_NATIVE_REPLAY_SUBSET_20260519.json`
- sourcePackSchemaVersion: `dsxu.v5.native-replay-subset.v1`

## Case Audit

| caseId | layer | sourceSuite | sourceCategory | nativeV5Ready | missingNativeFields | missingStandardFields |
| --- | --- | --- | --- | --- | --- | --- |
| V5-NATIVE-001 | L1 | native-v5-replay-subset | default-query-contract | true |  |  |
| V5-NATIVE-002 | L2 | native-v5-replay-subset | tool-window-hard-cap | true |  |  |
| V5-NATIVE-003 | L3 | native-v5-replay-subset | active-frame-ledger | true |  |  |
| V5-NATIVE-004 | L4 | native-v5-replay-subset | semantic-code-graph | true |  |  |
| V5-NATIVE-005 | L5 | native-v5-replay-subset | proof-carrying-edit | true |  |  |
| V5-NATIVE-006 | L1 | native-v5-replay-subset | default-query-contract | true |  |  |
| V5-NATIVE-007 | L2 | native-v5-replay-subset | tool-window-hard-cap | true |  |  |
| V5-NATIVE-008 | L3 | native-v5-replay-subset | active-frame-ledger | true |  |  |
| V5-NATIVE-009 | L4 | native-v5-replay-subset | semantic-code-graph | true |  |  |
| V5-NATIVE-010 | L5 | native-v5-replay-subset | proof-carrying-edit | true |  |  |
| V5-NATIVE-011 | L1 | native-v5-replay-subset | default-query-contract | true |  |  |
| V5-NATIVE-012 | L2 | native-v5-replay-subset | tool-window-hard-cap | true |  |  |
| V5-NATIVE-013 | L3 | native-v5-replay-subset | active-frame-ledger | true |  |  |
| V5-NATIVE-014 | L4 | native-v5-replay-subset | semantic-code-graph | true |  |  |
| V5-NATIVE-015 | L5 | native-v5-replay-subset | proof-carrying-edit | true |  |  |
| V5-NATIVE-016 | L1 | native-v5-replay-subset | default-query-contract | true |  |  |
| V5-NATIVE-017 | L2 | native-v5-replay-subset | tool-window-hard-cap | true |  |  |
| V5-NATIVE-018 | L3 | native-v5-replay-subset | active-frame-ledger | true |  |  |
| V5-NATIVE-019 | L4 | native-v5-replay-subset | semantic-code-graph | true |  |  |
| V5-NATIVE-020 | L5 | native-v5-replay-subset | proof-carrying-edit | true |  |  |

## Blockers

- none

## Data Still Needed

- Expand the same native V5 replay bank to 100 accepted cases before V5 release-ready status.
- Collect 30 paired public comparable raw evidence cases before any public benchmark or 90% external-comparison claim.

Evidence hash: `484ffc2d629fa95f`
