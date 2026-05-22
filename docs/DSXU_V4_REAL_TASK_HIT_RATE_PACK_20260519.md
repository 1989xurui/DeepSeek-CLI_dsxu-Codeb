# DSXU V4 Real Task Hit-Rate Pack - 2026-05-19

Status: `PASS_V4_REAL_TASK_HIT_RATE_PACK`

This pack aggregates real DSXU internal task traces and stream-json usage. It supports internal V4 launch-acceptance evidence only; it is not an external leaderboard, not a 90/95 claim, and not a target-reference comparison.

## Summary

| status | caseCount | finalPassRatePct | firstAttemptPassRatePct | secondAttemptRecoveryRatePct | cacheHitRatePct | totalCostUsd | proAdmissionCount |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PASS_V4_REAL_TASK_HIT_RATE_PACK | 24 | 100 | 0 | 100 | 62.8 | 0.209625 | 0 |

## Source Reports

- `docs/generated/DSXU_HARD_ENGINEERING_BENCHMARK_20260517_deepseek-route-cost-cache.json`
- `docs/generated/DSXU_HARD_ENGINEERING_BENCHMARK_20260517_release-claim-evidence-binder.json`
- `docs/generated/DSXU_HARD_ENGINEERING_BENCHMARK_20260517.json`
- `docs/generated/DSXU_HARD_ENGINEERING_BENCHMARK_20260517_deepseek-route-cost-cache-visible-product-timeline-release-claim-evidence-binder.json`
- `docs/generated/DSXU_RAW_API_VS_DSXU_AB_20260516.json`

## Cases

| suite | id | category | finalPass | cacheHitRatePct | costUsd | wallClockMs | toolResultChars | evidenceOk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| hard-engineering | deepseek-route-cost-cache | deepseek-runtime | true | 65.4 | 0.010754 | 66084 | 10967 | true |
| hard-engineering | release-claim-evidence-binder | release-evidence | true | 61.9 | 0.010584 | 90901 | 8112 | true |
| hard-engineering | repo-swe-checkout-pricing | repo-swe | true | 66.9 | 0.008284 | 86419 | 12872 | true |
| hard-engineering | terminal-devops-result-recovery | terminal-devops | true | 67.8 | 0.013207 | 74712 | 12876 | true |
| hard-engineering | tool-policy-claim-permission | tool-policy | true | 55.1 | 0.047126 | 524406 | 22303 | true |
| hard-engineering | visible-product-timeline | visible-product | true | 56.5 | 0.014751 | 103808 | 11889 | true |
| hard-engineering | context-recovery-source-truth | context-recovery | true | 78.8 | 0.005845 | 47911 | 7986 | true |
| hard-engineering | agent-merge-evidence-envelope | agent-coordination | true | 75.6 | 0.005647 | 38882 | 10093 | true |
| hard-engineering | mcp-skill-priority-boundary | mcp-skill | true | 74.2 | 0.006586 | 57647 | 9538 | true |
| raw-api-vs-dsxu | route-policy-flash-first | workflow-lift | true | 40.7 | 0.008364 | 45197 | 5625 | true |
| raw-api-vs-dsxu | terminal-result-pack | workflow-lift | true | 80.2 | 0.002948 | 21452 | 4125 | true |
| raw-api-vs-dsxu | claim-boundary-guard | workflow-lift | true | 55 | 0.007354 | 38302 | 4541 | true |
| raw-api-vs-dsxu | source-capsule-budget | workflow-lift | true | 54.6 | 0.00598 | 27088 | 3902 | true |
| raw-api-vs-dsxu | permission-gate-decision | workflow-lift | true | 66.9 | 0.005839 | 22453 | 4457 | true |
| raw-api-vs-dsxu | failure-repair-taxonomy | workflow-lift | true | 79.3 | 0.00318 | 24431 | 3941 | true |
| raw-api-vs-dsxu | agent-evidence-envelope | workflow-lift | true | 55.1 | 0.005742 | 21674 | 4654 | true |
| raw-api-vs-dsxu | mcp-skill-registry | workflow-lift | true | 56.2 | 0.005394 | 17099 | 3832 | true |
| raw-api-vs-dsxu | json-schema-repair | workflow-lift | true | 63.9 | 0.006857 | 29779 | 5702 | true |
| raw-api-vs-dsxu | workspace-hygiene-classifier | workflow-lift | true | 56 | 0.005491 | 18395 | 3951 | true |
| raw-api-vs-dsxu | route-intent-lock | workflow-lift | true | 56 | 0.005399 | 16925 | 3875 | true |
| raw-api-vs-dsxu | read-fallback-governor | workflow-lift | true | 56.4 | 0.00534 | 17203 | 3610 | true |
| raw-api-vs-dsxu | secret-release-redaction | workflow-lift | true | 71.3 | 0.008104 | 49640 | 5588 | true |
| raw-api-vs-dsxu | cost-quality-pareto | workflow-lift | true | 55.9 | 0.005505 | 18095 | 3915 | true |
| raw-api-vs-dsxu | visible-state-projection | workflow-lift | true | 56.4 | 0.005344 | 16034 | 3664 | true |

## Blockers

- none

## Data Still Needed

- External target/reference paired raw transcripts are still required before any external win/loss or reference-product comparison claim.
- A fresh rerun is required before publishing time-sensitive GitHub charts if source, provider, or benchmark fixtures change.
- Cache hit rate is an observed trend metric; do not turn it into a hard public ability claim.

Evidence hash: `3386d5f817b92933`
