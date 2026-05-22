# DSXU Hard Engineering Benchmark - 2026-05-17

Status: `PASS_DSXU_HARD_ENGINEERING_LIFT`

This benchmark uses DSXU-owned internal tasks shaped like harder public agent benchmarks. Raw API can produce one-shot file replacements from visible context; DSXU can inspect the workspace, run tests, repair hidden failures, and rerun verification.

## Summary

| totalTasks | rawPassRatePct | dsxuPassRatePct | rawAverageScore | dsxuAverageScore | rawTotalCostUSD | dsxuTotalCostUSD |
| --- | --- | --- | --- | --- | --- | --- |
| 9 | 0 | 100 | 57.8 | 100 | 0.0023071104000000004 | 0.11210300640000001 |

## Tasks

| id | lane | rawPass | dsxuPass | rawScore | dsxuScore | rawFiles | dsxuTools |
| --- | --- | --- | --- | --- | --- | --- | --- |
| repo-swe-checkout-pricing | repo-swe | false | true | 50 | 100 | src/cart.ts; src/discounts.ts; src/receipt.ts | Glob:1; Read:14; Edit:2; Bash:1 |
| terminal-devops-result-recovery | terminal-devops | false | true | 50 | 100 | src/resultPack.ts; src/retryPlan.ts | Bash:5; Glob:1; Read:7; Edit:3 |
| tool-policy-claim-permission | tool-policy | false | true | 60 | 100 | src/policy.ts; src/redaction.ts | Bash:9; Glob:1; Read:10; Edit:4 |
| visible-product-timeline | visible-product | false | true | 70 | 100 | src/timeline.ts; src/projector.ts | Glob:2; Read:10; Bash:2; Edit:2 |
| deepseek-route-cost-cache | deepseek-runtime | false | true | 60 | 100 | src/route.ts; src/cache.ts | Bash:3; Glob:1; Read:5; Edit:2 |
| context-recovery-source-truth | context-recovery | false | true | 60 | 100 | src/recovery.ts | Glob:1; Read:9; Edit:1; Bash:1 |
| agent-merge-evidence-envelope | agent-coordination | false | true | 50 | 100 | src/merge.ts | Bash:3; Glob:1; Read:8; Edit:1 |
| mcp-skill-priority-boundary | mcp-skill | false | true | 70 | 100 | src/registry.ts | Bash:3; Glob:1; Read:8; Edit:1 |
| release-claim-evidence-binder | release-evidence | false | true | 50 | 100 | src/claim.ts | Glob:1; Read:8; Bash:2; Edit:1 |

## Claim Boundary

- This proves internal hard-task workflow lift only.
- It is not a public SWE-bench / Terminal-Bench / OSWorld / tau-bench score.
- Public 90/95 and external superiority claims remain blocked.
- Chart: `docs/assets/dsxu-hard-engineering-benchmark.svg`