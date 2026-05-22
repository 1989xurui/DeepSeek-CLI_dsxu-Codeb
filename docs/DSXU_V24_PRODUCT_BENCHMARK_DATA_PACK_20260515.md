# DSXU V24 Product Benchmark Data Pack - 20260515

Status: `PASS_PRODUCT_BENCHMARK_DEMO_DATA_PACK_READY`

This pack fixes the public benchmark and product-demo evidence surface. It records DSXU evidence and claim boundaries; it does not claim independent external benchmark superiority and does not create the clean export artifact.

## Product Metrics

| metric | value |
| --- | --- |
| benchmark catalog | 26 packs / 98 cases |
| selected public demo tasks | 10 |
| senior-coding window | 30.58 min / 17 DSXU runs / final test true |
| Flash cost | 0.3239343576000001 |
| C2 reference files | 1902 |
| C2 behavior rows | 51 |
| C2 public-claim boundary | 914 rows closed; reference parity claim=false |
| C2 owner implementation acceptance | implemented+tested=1096; adapted/excluded=601; no-loss=205; needs=0 |
| DeepSeek trajectory evidence | 3/3 Flash review trajectories; redacted request/tool/usage/cache evidence |
| public challenge ablation | scoreFloor 72->72; cost 0.0716986596->0.0106172808; cache 45.5%->65.3%; toolResultChars 316381->0 |
| final preflight | PASS |
| release evidence | six-stage/export/fresh install pass; zip D:\DSXU-code-release-artifacts\dsxu-code-v24-clean-export-20260515-2026-05-16T15-28-23-581Z.zip |

## Evidence

| id | status | pass | path |
| --- | --- | --- | --- |
| public-challenge | PASS_PUBLIC_CHALLENGE_PACKAGE_READY | true | D:\DSXU-code\docs\generated\DSXU_V24_PUBLIC_CHALLENGE_PACKAGE_20260515.json |
| public-challenge-ablation | PASS_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE | true | D:\DSXU-code\docs\generated\DSXU_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE_20260516.json |
| senior-coding-window | PASS_SENIOR_CODING_WINDOW_30_45_MIN_REAL_DSXU | true | D:\DSXU-code\docs\generated\DSXU_V24_SENIOR_CODING_WINDOW_20260515.json |
| c2-1902-evidence-join | MISSING | false | D:\DSXU-code\docs\generated\DSXU_V24_C2_1902_FULL_EVIDENCE_JOIN_20260515.json |
| c2-loop-real-acceptance | PASS_C2_LOOP_REAL_ACCEPTANCE_BATCH | true | D:\DSXU-code\docs\generated\DSXU_V24_C2_LOOP_REAL_ACCEPTANCE_20260515.json |
| c2-public-claim-closure | PASS_C2_PUBLIC_CLAIM_BOUNDARY_CLOSED | true | D:\DSXU-code\docs\generated\DSXU_V26_C2_PUBLIC_CLAIM_CLOSURE_20260515.json |
| c2-owner-implementation-acceptance | PASS_C2_OWNER_IMPLEMENTATION_ACCEPTANCE_DECISIONS_CLOSED | true | D:\DSXU-code\docs\generated\DSXU_V26_C2_OWNER_IMPLEMENTATION_ACCEPTANCE_20260515.json |
| interactive-tui-acceptance | PASS_INTERACTIVE_TUI_ACCEPTANCE | true | D:\DSXU-code\docs\generated\DSXU_V24_INTERACTIVE_TUI_ACCEPTANCE_20260515.json |
| completed-reacceptance | PASS_COMPLETED_FEATURES_REACCEPTED_WITH_FLASH_FIRST_EVIDENCE | true | D:\DSXU-code\docs\generated\DSXU_V24_COMPLETED_REACCEPTANCE_20260515.json |
| complex-task-acceptance | PASS_COMPLEX_TASK_ACCEPTANCE_PACK_READY | true | D:\DSXU-code\docs\generated\DSXU_V24_COMPLEX_TASK_ACCEPTANCE_20260515.json |
| clean-export-preflight | PASS_READY_TO_CREATE_CLEAN_EXPORT | true | D:\DSXU-code\docs\generated\DSXU_V20_CLEAN_EXPORT_PREFLIGHT_20260515.json |
| six-stage-final-tests | PASS_V24_SIX_STAGE_FINAL_TESTS | true | D:\DSXU-code\docs\generated\DSXU_V24_SIX_STAGE_FINAL_TESTS_20260515.json |
| clean-export-artifact | PASS_CLEAN_EXPORT_ARTIFACT_CREATED | true | D:\DSXU-code\docs\generated\DSXU_V24_CLEAN_EXPORT_ARTIFACT_20260515.json |
| fresh-install-release-smoke | PASS_FRESH_INSTALL_HELP_DOCTOR_PROVIDER_SMOKE | true | D:\DSXU-code\docs\generated\DSXU_V24_FRESH_INSTALL_RELEASE_SMOKE_20260515.json |
| final-preflight | PASS | true | D:\DSXU-code\docs\generated\DSXU_V20_FINAL_PREFLIGHT_20260515.json |
| evidence-dashboard | MISSING | false | D:\DSXU-code\docs\generated\DSXU_EVIDENCE_DASHBOARD_20260517.json |

## Comparison Data

| dimension | result | claimStatus | evidence |
| --- | --- | --- | --- |
| fixed benchmark catalog | 26 packs / 98 cases / 10 selected public demo tasks | ALLOWED | scripts/benchmark/dsxu-mainline-benchmark.ts |
| senior coding window | 30.58 min, 17 DSXU runs, final fixture test pass=true | ALLOWED | D:\DSXU-code\docs\generated\DSXU_V24_SENIOR_CODING_WINDOW_20260515.json |
| reference 1902 experience-loop absorption | 1902/1902 owner-mapped; C2 loop matrix 51/51 pass; 914 public-claim boundary rows closed; owner acceptance: implemented+tested=1096, adapted/excluded=601, no-loss baseline=205 | ALLOWED | D:\DSXU-code\docs\generated\DSXU_V24_C2_1902_FULL_EVIDENCE_JOIN_20260515.json; D:\DSXU-code\docs\generated\DSXU_V24_C2_LOOP_REAL_ACCEPTANCE_20260515.json; D:\DSXU-code\docs\generated\DSXU_V26_C2_PUBLIC_CLAIM_CLOSURE_20260515.json; D:\DSXU-code\docs\generated\DSXU_V26_C2_OWNER_IMPLEMENTATION_ACCEPTANCE_20260515.json |
| TUI/operator experience | interactive replay pass with permission, recovery, compact resume, background task, and model progress evidence | ALLOWED | D:\DSXU-code\docs\generated\DSXU_V24_INTERACTIVE_TUI_ACCEPTANCE_20260515.json |
| Flash-first cost routing | senior window cost USD=0.3239343576000001; Pro used=false; benchmark route rows flash=94, pro=4 | ALLOWED | D:\DSXU-code\docs\generated\DSXU_V24_PUBLIC_CHALLENGE_PACKAGE_20260515.json |
| DeepSeek trajectory evidence | redacted trajectory store is connected to DeepSeekAdapter; public challenge Flash reviews with trajectory paths=3/3 | ALLOWED | src/services/api/deepseek-trajectory-store.ts; src/services/api/deepseek-trajectory-store.test.ts; public challenge Flash review trajectory files |
| public challenge ablation cost/cache | same-task scoreFloor 72->72; cost USD 0.0716986596->0.0106172808; cache hit 45.5%->65.3%; Read calls 28->0; toolResultChars 316381->0 | ALLOWED | D:\DSXU-code\docs\generated\DSXU_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE_20260516.json |
| release/export readiness | six-stage pass, clean export artifact created, fresh install smoke pass, zip=D:\DSXU-code-release-artifacts\dsxu-code-v24-clean-export-20260515-2026-05-16T15-28-23-581Z.zip | ALLOWED | D:\DSXU-code\docs\generated\DSXU_V20_CLEAN_EXPORT_PREFLIGHT_20260515.json; D:\DSXU-code\docs\generated\DSXU_V24_SIX_STAGE_FINAL_TESTS_20260515.json; D:\DSXU-code\docs\generated\DSXU_V24_CLEAN_EXPORT_ARTIFACT_20260515.json; D:\DSXU-code\docs\generated\DSXU_V24_FRESH_INSTALL_RELEASE_SMOKE_20260515.json |
| external benchmark superiority | not claimed by this pack | BLOCKED | requires independent target/public baseline logs |

## Demo Scenarios

| id | name | commandOrArtifact | status | requiredEvidence |
| --- | --- | --- | --- | --- |
| DEMO-01 | Senior coding repair with failed-to-passing tests | bun run v24:senior-coding-window | READY_WITH_RAW_EVIDENCE | D:\DSXU-code\docs\generated\DSXU_V24_SENIOR_CODING_WINDOW_20260515.json |
| DEMO-02 | Operator-visible TUI state replay | bun run v24:interactive-tui-acceptance | READY_WITH_RAW_EVIDENCE | D:\DSXU-code\docs\generated\DSXU_V24_INTERACTIVE_TUI_ACCEPTANCE_20260515.json |
| DEMO-03 | C2 1902 owner/loop absorption evidence | bun run v24:c2-1902-evidence-join && bun run v24:c2-loop-acceptance && bun run v26:c2-public-claim-closure && bun run v26:c2-owner-implementation-acceptance | READY_WITH_RAW_EVIDENCE | D:\DSXU-code\docs\generated\DSXU_V24_C2_1902_FULL_EVIDENCE_JOIN_20260515.json; D:\DSXU-code\docs\generated\DSXU_V24_C2_LOOP_REAL_ACCEPTANCE_20260515.json; D:\DSXU-code\docs\generated\DSXU_V26_C2_PUBLIC_CLAIM_CLOSURE_20260515.json; D:\DSXU-code\docs\generated\DSXU_V26_C2_OWNER_IMPLEMENTATION_ACCEPTANCE_20260515.json |
| DEMO-04 | Fixed public benchmark task catalog | bun scripts/benchmark/dsxu-mainline-benchmark.ts | READY_AS_REPLAY | 98 case catalog plus selected public tasks in this pack |
| DEMO-05 | Claim guard and release preflight | bun run v24:public-challenge && bun run public-challenge:ablation && bun run clean-export:preflight | READY_WITH_RAW_EVIDENCE | D:\DSXU-code\docs\generated\DSXU_V24_PUBLIC_CHALLENGE_PACKAGE_20260515.json; D:\DSXU-code\docs\generated\DSXU_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE_20260516.json; D:\DSXU-code\docs\generated\DSXU_V20_CLEAN_EXPORT_PREFLIGHT_20260515.json |
| DEMO-06 | Clean export artifact and fresh install smoke | bun run test:six-stage-final && bun run release:clean-export-artifact && bun run release:fresh-install-smoke | READY_WITH_RAW_EVIDENCE | D:\DSXU-code\docs\generated\DSXU_V24_SIX_STAGE_FINAL_TESTS_20260515.json; D:\DSXU-code\docs\generated\DSXU_V24_CLEAN_EXPORT_ARTIFACT_20260515.json; D:\DSXU-code\docs\generated\DSXU_V24_FRESH_INSTALL_RELEASE_SMOKE_20260515.json |

## Claims Allowed

- DSXU ships a fixed, replayable benchmark/task catalog instead of ad hoc demos.
- DSXU completed one real 30-45 minute Flash-first coding window with failed-to-passing test evidence.
- DSXU translates reference senior-programmer loops into DSXU-owned generic experience loops; it does not claim reference-product parity.
- DSXU keeps work state visible to the operator during real TUI flows.
- DSXU defaults to DeepSeek V4 Flash and requires explicit evidence before Pro.
- DSXU can audit DeepSeek request plan, message/tool-result structure, thinking/tool snapshots, usage, cache, route, and request id without leaking raw prompt or keys.
- DSXU has same-task ablation evidence that source capsule/no-Read/route latch/tool-result hygiene reduces cost and tool-result bloat without lowering the public challenge score floor.
- Clean export, six-stage tests, and fresh install smoke are evidence-gated release readiness signals.

## Claims Guarded


## Claims Blocked

- No superiority claim until comparable external raw logs exist.

## Remaining Hard Order

- public95 claim still requires scoreFloor >= 95 and fixed raw public challenge data
