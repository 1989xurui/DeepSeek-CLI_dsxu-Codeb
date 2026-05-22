# DSXU Hard Engineering Benchmark - 2026-05-17

Status: `PASS_DSXU_HARD_ENGINEERING_LIFT`

This benchmark uses DSXU-owned internal tasks shaped like harder public agent benchmarks. Raw API can produce one-shot file replacements from visible context; DSXU can inspect the workspace, run tests, repair hidden failures, and rerun verification.

## Summary

| totalTasks | rawPassRatePct | dsxuPassRatePct | rawAverageScore | dsxuAverageScore | rawTotalCostUSD | dsxuTotalCostUSD |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 0 | 100 | 60 | 100 | 0.00029064000000000005 | 0.0077579208 |

## Tasks

| id | lane | rawPass | dsxuPass | rawScore | dsxuScore | rawFiles | dsxuTools |
| --- | --- | --- | --- | --- | --- | --- | --- |
| deepseek-route-cost-cache | deepseek-runtime | false | true | 60 | 100 | src/route.ts; src/cache.ts | Glob:1; Read:10; Bash:2; Edit:2 |

## Claim Boundary

- This proves internal hard-task workflow lift only.
- It is not a public SWE-bench / Terminal-Bench / OSWorld / tau-bench score.
- Public 90/95 and external superiority claims remain blocked.
- Chart: `docs/assets/dsxu-hard-engineering-benchmark.svg`