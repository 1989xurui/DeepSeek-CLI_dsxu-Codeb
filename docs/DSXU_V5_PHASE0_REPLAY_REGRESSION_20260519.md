# DSXU V5 Phase 0 replay-regression - 2026-05-19

Status: PASS_V5_PHASE0_SUITE

Owner: Replay Bank / Evidence owner

Purpose: Promote failed real-task cases into V5 replay regression blockers instead of hiding them behind average pass rate.

## Summary

- commands: 1/1 passed
- timed out: 0
- durationMs: 1120
- withinDurationBudget: true

## Commands

| id | owner | passed | timedOut | durationMs | command |
| --- | --- | ---: | ---: | ---: | --- |
| v5-strict-replay-bank-intake | Replay Bank / Evidence owner | true | false | 1116 | `bun run scripts/dsxu-v5-replay-bank.ts ` |

## Deferred Full Release Commands

- none

## Claim Boundary

- not assessed in this suite

## Replay Regression

- status: PASS_REPLAY_REGRESSION
- cases: 20/20 passed
- acceptedCount: 20
- nativeV5ReadyCount: 20
- requiredSubsetReady: true
- fullReleaseReady: false
- failedCaseIds: none
- cacheHitRatePct: unknown
- totalCostUsd: unknown
- blockers: none

## Blockers

- none

## Rule

V5 Phase 0 only aggregates existing owner tests/evidence. It does not add a product runtime, provider, ToolBus, permission layer, agent layer, or public benchmark claim.
