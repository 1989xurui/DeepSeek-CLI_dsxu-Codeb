# DSXU V5 Phase 0 experience - 2026-05-19

Status: PASS_V5_PHASE0_SUITE

Owner: V5 Phase 0 / Trust UI and senior experience owners

Purpose: Focused TUI and experience slices; avoids full senior-coding-window during normal development.

## Summary

- commands: 5/5 passed
- timed out: 0
- durationMs: 32411
- withinDurationBudget: true

## Commands

| id | owner | passed | timedOut | durationMs | command |
| --- | --- | ---: | ---: | ---: | --- |
| tui-trust-projection-1 | TUI work-state / trust projection owner | true | false | 2236 | `bun test src/components/PromptInput/__tests__/PromptInputFooter-trust.test.ts ` |
| tui-trust-projection-2 | TUI work-state / trust projection owner | true | false | 982 | `bun test src/components/messages/UserToolResultMessage/__tests__/utils.test.ts ` |
| tui-trust-projection-3 | TUI work-state / trust projection owner | true | false | 2196 | `bun test src/components/messages/__tests__/SystemTextMessage-evidence-line.test.ts ` |
| tui-trust-projection-4 | TUI work-state / trust projection owner | true | false | 2173 | `bun test src/commands/context/__tests__/context-advanced.test.ts ` |
| tui-trust-projection-5 | TUI work-state / trust projection owner | true | false | 24815 | `bun test src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts -t "preserves a middle scrollback" ` |

## Claim Boundary

- not assessed in this suite

## Replay Regression

- not assessed in this suite

## Blockers

- none

## Rule

V5 Phase 0 only aggregates existing owner tests/evidence. It does not add a product runtime, provider, ToolBus, permission layer, agent layer, or public benchmark claim.
