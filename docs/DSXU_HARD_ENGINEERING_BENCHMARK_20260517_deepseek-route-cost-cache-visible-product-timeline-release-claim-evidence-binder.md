# DSXU Hard Engineering Benchmark - 2026-05-17

Status: `PASS_DSXU_HARD_ENGINEERING_LIFT`

This benchmark uses DSXU-owned internal tasks shaped like harder public agent benchmarks. Raw API can produce one-shot file replacements from visible context; DSXU can inspect the workspace, run tests, repair hidden failures, and rerun verification.

## Summary

| totalTasks | rawPassRatePct | dsxuPassRatePct | rawAverageScore | dsxuAverageScore | rawTotalCostUSD | dsxuTotalCostUSD |
| --- | --- | --- | --- | --- | --- | --- |
| 3 | 0 | 100 | 60 | 100 | 0.0008274 | 0.03608887520000001 |

## Tasks

| id | lane | rawPass | dsxuPass | rawScore | dsxuScore | rawFiles | dsxuTools |
| --- | --- | --- | --- | --- | --- | --- | --- |
| visible-product-timeline | visible-product | false | true | 70 | 100 | src/timeline.ts; src/projector.ts | Bash:3; Glob:1; Read:11; Edit:2 |
| deepseek-route-cost-cache | deepseek-runtime | false | true | 60 | 100 | src/route.ts; src/cache.ts | Bash:2; Glob:1; Read:12; Edit:2 |
| release-claim-evidence-binder | release-evidence | false | true | 50 | 100 | src/claim.ts | Bash:3; Glob:1; Read:4; Edit:1 |

## Claim Boundary

- This proves internal hard-task workflow lift only.
- It is not a public SWE-bench / Terminal-Bench / OSWorld / tau-bench score.
- Public 90/95 and external superiority claims remain blocked.
- Chart: `docs/assets/dsxu-hard-engineering-benchmark.svg`