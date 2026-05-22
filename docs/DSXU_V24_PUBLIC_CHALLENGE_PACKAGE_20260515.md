# DSXU V24 Public Challenge Package - 20260515

Status: `PASS_PUBLIC_CHALLENGE_PACKAGE_READY`

This package turns current V24/V26 evidence into a GitHub-ready product claim guard and public challenge evidence pack. It does not claim public 90 ability or external superiority without fixed raw task evidence.

## Summary

| item | result |
| --- | --- |
| command batches | 7/7 pass |
| Flash reviews | 3/3 pass |
| C2 behavior matrix | 51/51 pass |
| C2 public claim boundary | closed without reference parity claim |
| C2 owner implementation acceptance | 1096 implemented+tested / 601 adapted/excluded / 205 no-loss / 0 needs |
| TUI replay | pass |
| completed reacceptance | pass |
| senior-coding window | 30-45 min real DSXU pass |
| release evidence | six-stage/export/fresh install pass |
| score floor from Flash reviews | 72 |
| Flash review cost USD | 0.008998236800000002 |
| Flash cache hit rate | 66.8% (86656 hit / 42982 miss) |
| Flash cache optimization reference | below 70% reference; not a release gate |
| no-Read source-truth lane | 0 Read calls / 0 tool-result chars |
| stable prompt prefix hashes | 1 stable / 3 dynamic |
| stable evidence pack | 30/30 source refs, sha256=4ba9a97a65b658f6 |

## Command Evidence

| id | exit | durationMs | stdout |
| --- | --- | --- | --- |
| completed-reacceptance-replay | 0 | 47120 | D:\DSXU-code\.dsxu\trace\v24-public-challenge-package\completed-reacceptance-replay-2026-05-16T15-36-09-856Z.stdout.log |
| interactive-tui-acceptance-replay | 0 | 152255 | D:\DSXU-code\.dsxu\trace\v24-public-challenge-package\interactive-tui-acceptance-replay-2026-05-16T15-36-56-976Z.stdout.log |
| c2-loop-acceptance-replay | 0 | 44182 | D:\DSXU-code\.dsxu\trace\v24-public-challenge-package\c2-loop-acceptance-replay-2026-05-16T15-39-29-231Z.stdout.log |
| product-runtime-owner-map-replay | 0 | 401 | D:\DSXU-code\.dsxu\trace\v24-public-challenge-package\product-runtime-owner-map-replay-2026-05-16T15-40-13-413Z.stdout.log |
| query-engine-recovery-mainline-replay | 0 | 96 | D:\DSXU-code\.dsxu\trace\v24-public-challenge-package\query-engine-recovery-mainline-replay-2026-05-16T15-40-13-814Z.stdout.log |
| deepseek-trajectory-store-replay | 0 | 1107 | D:\DSXU-code\.dsxu\trace\v24-public-challenge-package\deepseek-trajectory-store-replay-2026-05-16T15-40-13-910Z.stdout.log |
| clean-export-preflight-replay | 0 | 107 | D:\DSXU-code\.dsxu\trace\v24-public-challenge-package\clean-export-preflight-replay-2026-05-16T15-40-15-017Z.stdout.log |

## Flash Review Evidence

| id | exit | pass | score | costUSD | cacheHitRatePct | readCalls | toolResultChars | requests | stablePrefix | trace |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| flash-public-claim-guard-review | 0 | true | 72 | 0.005574044 | 25.2 | 0 | 0 | 1 | 4b6e09f461721802 | D:\DSXU-code\.dsxu\trace\v24-public-challenge-package\flash-public-claim-guard-review-2026-05-16T15-40-15-148Z.jsonl |
| flash-senior-coding-experience-review | 0 | true | 80 | 0.0026433904 | 75.8 | 0 | 0 | 1 | 4b6e09f461721802 | D:\DSXU-code\.dsxu\trace\v24-public-challenge-package\flash-senior-coding-experience-review-2026-05-16T15-40-50-357Z.jsonl |
| flash-release-ecosystem-review | 0 | true | 72 | 0.0007808024000000001 | 99.6 | 0 | 0 | 1 | 4b6e09f461721802 | D:\DSXU-code\.dsxu\trace\v24-public-challenge-package\flash-release-ecosystem-review-2026-05-16T15-41-34-584Z.jsonl |

## Cache Miss Attribution

| reviewCount | cacheHitRatePct | cacheHitInputTokens | cacheMissInputTokens | readToolCallCount | toolResultCount | toolResultChars | maxToolResultChars | uniqueSystemHashes | routeReasons |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 3 | 66.8 | 86656 | 42982 | 0 | 0 | 0 | 0 | 1 | review_flash_thinking_max |

## Public Claims Allowed

- Flash-first DSXU product-entry evidence is available; Pro was not required in this package.
- C2 experience-loop behavior matrix is evidenced at 51/51 rows.
- C2 public-claim boundary is closed as DSXU-owned generic experience evidence, not reference-product parity.
- C2 owner implementation acceptance resolved 1902/1902 rows into implemented+tested, adapted/excluded, or no-loss baseline decisions.
- DeepSeek trajectory tracing can record request plan, message/tool-result structure, redacted thinking/tool/use snapshots, usage, cache, route, and request id evidence when DSXU_DEEPSEEK_TRAJECTORY_FILE is enabled.
- Public challenge review now respects DSXU no-Read source-truth capsule mode: 0 Read calls and 0 tool-result chars in the default review lane.
- Real TUI replay evidence covers startup, permission visibility, recovery, compact resume, background task, and model task progress.
- 30-45 minute senior-coding window is evidenced through real DSXU product-entry runs, source edit, failed-to-passing test loop, sustained reviews, and Flash-only cost.
- Clean export artifact is created and secret-scanned: D:\DSXU-code-release-artifacts\dsxu-code-v24-clean-export-20260515-2026-05-16T15-28-23-581Z.zip.
- Fresh install/help/doctor/provider gate smoke is evidenced from the clean export.
- Release public-surface gates recognize V24 source-truth docs without treating them as public product claims.

## Claims Still Blocked

- Do not claim public 90 ability until the public challenge score floor reaches around 90 with fixed raw task data.
- Do not claim independent benchmark superiority until a comparable public challenge run is executed against a fixed task pack.
- Do not claim high cache ROI yet; observed public challenge cache hit rate is 66.8% against a non-release reference of 70%.
- Do not claim third-party product embedding; ecosystem compatibility must be framed as DSXU-owned intake/host contracts.

## Remaining Public 90 / Experience Gates

- public challenge scoreFloor around 90 with fixed raw task data
- same-task external/target raw transcript evidence before any superiority claim
