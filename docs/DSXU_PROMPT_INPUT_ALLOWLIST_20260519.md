# DSXU V7 Prompt Input Allowlist - 20260519

- status: `PASS_DSXU_PROMPT_INPUT_ALLOWLIST`

The default DeepSeek prompt may use only compact current-task, current-memory, active mainline rules, current tool window, verification contract, and prompt discipline signals. Historical raw docs, evidence-only rows, legacy rows, generated-historical docs, and delete-review paths remain blocked.

## Summary

| metric | value |
|---|---:|
| allowlistItems | 12 |
| blockedItems | 3229 |
| estimatedTokenBudget | 8760 |
| maxTokenBudget | 12000 |
| deleteReviewPromptItems | 0 |
| generatedHistoricalRawDocs | 0 |
| supersededPlanRawDocs | 0 |
| claimAllowedItems | 0 |

## Blockers

- none

## Allowlist

| id | source | owner | maxTokens |
|---|---|---|---:|
| current-task | `runtime user turn` | Query Loop / PlanGraph / Tool Gate | 2200 |
| current-memory-summary | `active work-state ledger` | PlanGraph / Work-State Ledger | 1800 |
| v6-mainline-rules | `DSXU V6 active master plan summary` | Release Claim Binder | 1800 |
| tool-window-current | `current tool-view compiler` | Tool Gate / Tool View | 1200 |
| verification-recovery-contract | `current verification/recovery envelope` | VerificationKernel / Recovery Decision | 1200 |
| prompt-signal-001 | `docs/BENCHMARK.md` | Prompt Section Router / Prompt Input Allowlist | 80 |
| prompt-signal-002 | `docs/DEEPSEEK_V4_CAPABILITIES.md` | Prompt Section Router / Prompt Input Allowlist | 80 |
| prompt-signal-003 | `docs/DSXU_V6_CONTEXT_PRESSURE_20260519.md` | Prompt Section Router / Prompt Input Allowlist | 80 |
| prompt-signal-004 | `docs/DSXU_V6_DEEPSEEK_NATIVE_ENGINEERING_RUNTIME_20260519_CN.md` | Prompt Section Router / Prompt Input Allowlist | 80 |
| prompt-signal-005 | `docs/DSXU_V6_EXECUTION_PLAN_20260519_CN.md` | Prompt Section Router / Prompt Input Allowlist | 80 |
| prompt-signal-006 | `docs/DSXU_V6_OWNER_REVIEW_DECISIONS_20260519.md` | Prompt Section Router / Prompt Input Allowlist | 80 |
| prompt-signal-007 | `docs/DSXU_V6_PROMPT_DIET_REPORT_20260519.md` | Prompt Section Router / Prompt Input Allowlist | 80 |
