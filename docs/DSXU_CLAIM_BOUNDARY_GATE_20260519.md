# DSXU V7 Claim Boundary Gate - 20260519

- status: `PASS_DSXU_CLAIM_BOUNDARY_GATE`

This gate separates source/design/internal/live/external benchmark claims. It blocks C3-below public claims and keeps public 90%/external victory blocked until paired raw benchmark evidence exists.

## Summary

| metric | value |
|---|---:|
| candidates | 5 |
| publicAllowed | 0 |
| c3BelowPublicAllowed | 0 |
| public90Allowed | false |
| externalBenchmarkReady | false |

## Blockers

- none

## Candidates

| id | level | publicAllowed | boundary |
|---|---|---:|---|
| V7-CLAIM-C0-DESIGN-GOAL | C0 | false | Internal design goal only. |
| V7-CLAIM-C1-SOURCE-OWNERS | C1 | false | Source owner evidence is not a capability result. |
| V7-CLAIM-C3-REACHABILITY | C3 | false | Internal capability candidate; public wording still needs live/raw evidence per claim. |
| V7-CLAIM-C4-LIVE-DEEPSEEK | C4 | false | Allowed only as live provider/tool-call proof, not external benchmark or 90% score. |
| V7-CLAIM-C5-EXTERNAL-BENCHMARK | C5 | false | Blocked until fixed manifest, paired target raw transcript, tool trace, cost/cache metrics, and rubric exist. |
