# DSXU V5 Phase 0 phase0 - 2026-05-19

Status: PASS_V5_PHASE0_SUITE

Owner: V5 Phase 0 / Carry-over closure owners

Purpose: All low-cost Phase 0 suites except the full external public comparable gate.

## Summary

- commands: 19/19 passed
- timed out: 0
- durationMs: 72439
- withinDurationBudget: true

## Commands

| id | owner | passed | timedOut | durationMs | command |
| --- | --- | ---: | ---: | ---: | --- |
| tool-runtime-event-boundary-1 | Tool Gate / Tool Result Contract owner | true | false | 1697 | `bun test src/dsxu/engine/__tests__/tool-lifecycle-contract-v1.test.ts ` |
| tool-runtime-event-boundary-2 | Tool Gate / Tool Result Contract owner | true | false | 2409 | `bun test src/dsxu/engine/__tests__/tool-protocol/consistency.test.ts -t "provider" ` |
| tool-runtime-event-boundary-3 | Tool Gate / Tool Result Contract owner | true | false | 1087 | `bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts -t "canonical ToolCallResult" ` |
| verification-recovery-ledger-1 | VerificationKernel / Recovery / GearBox owner | true | false | 1071 | `bun test src/dsxu/engine/__tests__/work-package-i/progress-ledger.test.ts ` |
| verification-recovery-ledger-2 | VerificationKernel / Recovery / GearBox owner | true | false | 1057 | `bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts -t "long-task ledger" ` |
| verification-recovery-ledger-3 | VerificationKernel / Recovery / GearBox owner | true | false | 1211 | `bun test src/dsxu/engine/__tests__/verify-gate.test.ts ` |
| verification-recovery-ledger-4 | VerificationKernel / Recovery / GearBox owner | true | false | 1053 | `bun test src/dsxu/engine/__tests__/query-loop-gate-state-v1.test.ts ` |
| mainline-tool-permission-agent-skill-1 | Tool Gate / Permission / Agent / MCP-Skill owner | true | false | 15507 | `bun test src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts ` |
| mainline-tool-permission-agent-skill-2 | Tool Gate / Permission / Agent / MCP-Skill owner | true | false | 4466 | `bun test src/dsxu/engine/__tests__/agent-runtime-mainline-v1.test.ts src/dsxu/engine/__tests__/skill-governance-contract-v1.test.ts ` |
| tui-trust-projection-1 | TUI work-state / trust projection owner | true | false | 2290 | `bun test src/components/PromptInput/__tests__/PromptInputFooter-trust.test.ts ` |
| tui-trust-projection-2 | TUI work-state / trust projection owner | true | false | 1130 | `bun test src/components/messages/UserToolResultMessage/__tests__/utils.test.ts ` |
| tui-trust-projection-3 | TUI work-state / trust projection owner | true | false | 2185 | `bun test src/components/messages/__tests__/SystemTextMessage-evidence-line.test.ts ` |
| tui-trust-projection-4 | TUI work-state / trust projection owner | true | false | 2217 | `bun test src/commands/context/__tests__/context-advanced.test.ts ` |
| tui-trust-projection-5 | TUI work-state / trust projection owner | true | false | 28946 | `bun test src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts -t "preserves a middle scrollback" ` |
| release-trust-evidence-1 | Evidence / release claim binder owner | true | false | 1157 | `bun test scripts/__tests__/dsxu-command-catalog.test.ts scripts/__tests__/dsxu-evidence-dashboard.test.ts ` |
| release-trust-evidence-2 | Evidence / release claim binder owner | true | false | 1075 | `bun run scripts/dsxu-command-catalog.ts ` |
| release-trust-evidence-3 | Evidence / release claim binder owner | true | false | 1359 | `bun run evidence:dashboard ` |
| evidence-dashboard-claim-boundary | Evidence / Release Claim Binder | true | false | 1340 | `bun run evidence:dashboard ` |
| v4-real-task-hit-rate-pack-replay-intake | Replay Bank / Evidence owner | true | false | 1140 | `bun run scripts/dsxu-v4-real-task-hit-rate-pack.ts ` |

## Deferred Full Release Commands

- `bun run test:six-stage-final`

## Claim Boundary

- status: PASS_CLAIM_BOUNDARY_HELD
- scoreFloor: 72
- releaseClaimAllowed: false
- releaseTrustStatus: blocked
- publicComparableMissingCases: 30
- blockedGateNames: DSXU_V24_GITHUB_OPEN_SOURCE_LAUNCH_PACK_20260515
- dataStillNeeded: release claim blocker resolution; public comparable raw evidence for 30 cases; not-run evidence cannot be used as GitHub claims

## Replay Regression

- status: PASS_REPLAY_REGRESSION
- cases: 24/24 passed
- failedCaseIds: none
- cacheHitRatePct: 64.1
- totalCostUsd: 0.198944

## Blockers

- none

## Rule

V5 Phase 0 only aggregates existing owner tests/evidence. It does not add a product runtime, provider, ToolBus, permission layer, agent layer, or public benchmark claim.
