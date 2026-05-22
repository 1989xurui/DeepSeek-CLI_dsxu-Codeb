# DSXU V5 Phase 0 mainline - 2026-05-18

Status: PASS_V5_PHASE0_SUITE

Owner: V5 Phase 0 / mainline focused owners

Purpose: Fast owner-focused tests for default runtime, tool, permission, verification, recovery, and agent mainline.

## Summary

- commands: 9/9 passed
- timed out: 0
- durationMs: 30670
- withinDurationBudget: true

## Commands

| id | owner | passed | timedOut | durationMs | command |
| --- | --- | ---: | ---: | ---: | --- |
| tool-runtime-event-boundary-1 | Tool Gate / Tool Result Contract owner | true | false | 1642 | `bun test src/dsxu/engine/__tests__/tool-lifecycle-contract-v1.test.ts ` |
| tool-runtime-event-boundary-2 | Tool Gate / Tool Result Contract owner | true | false | 2388 | `bun test src/dsxu/engine/__tests__/tool-protocol/consistency.test.ts -t "provider" ` |
| tool-runtime-event-boundary-3 | Tool Gate / Tool Result Contract owner | true | false | 1110 | `bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts -t "canonical ToolCallResult" ` |
| verification-recovery-ledger-1 | VerificationKernel / Recovery / GearBox owner | true | false | 1023 | `bun test src/dsxu/engine/__tests__/work-package-i/progress-ledger.test.ts ` |
| verification-recovery-ledger-2 | VerificationKernel / Recovery / GearBox owner | true | false | 1041 | `bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts -t "long-task ledger" ` |
| verification-recovery-ledger-3 | VerificationKernel / Recovery / GearBox owner | true | false | 1214 | `bun test src/dsxu/engine/__tests__/verify-gate.test.ts ` |
| verification-recovery-ledger-4 | VerificationKernel / Recovery / GearBox owner | true | false | 1059 | `bun test src/dsxu/engine/__tests__/query-loop-gate-state-v1.test.ts ` |
| mainline-tool-permission-agent-skill-1 | Tool Gate / Permission / Agent / MCP-Skill owner | true | false | 16618 | `bun test src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts ` |
| mainline-tool-permission-agent-skill-2 | Tool Gate / Permission / Agent / MCP-Skill owner | true | false | 4557 | `bun test src/dsxu/engine/__tests__/agent-runtime-mainline-v1.test.ts src/dsxu/engine/__tests__/skill-governance-contract-v1.test.ts ` |

## Claim Boundary

- not assessed in this suite

## Replay Regression

- not assessed in this suite

## Blockers

- none

## Rule

V5 Phase 0 only aggregates existing owner tests/evidence. It does not add a product runtime, provider, ToolBus, permission layer, agent layer, or public benchmark claim.
