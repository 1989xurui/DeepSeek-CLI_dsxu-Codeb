# DSXU V1 Final Optimization Plan

## V1 Goal

DSXU V1 focuses on reality alignment and mainline quality. It does not replace the provider SDK stack wholesale. It turns existing DSXU capabilities into the default coding path: real verification, local regression checks, short write contracts, safe rollback, DeepSeek V4 capability truth, context discipline, and experience learning.

## Verified Baseline

| Item | V1 Baseline |
|---|---|
| DeepSeek V4 Chat context | 1M tokens |
| DeepSeek V4 Chat max output | 384K tokens |
| DeepSeek V4 thinking | Supported; `thinking` and `reasoning_effort` are available |
| DeepSeek V4 FIM | Separate beta lane; max output 4K |
| SDK strategy | Keep DSXU provider transport abstraction; do not replace with a non-existent `deepseek-sdk` dependency |
| Cache strategy | Keep `notifyCompaction` and `notifyCacheDeletion`; these are part of DSXU cache/cost evidence |
| Public claim policy | No 75/80/90/95 percent parity claim without same-task raw logs |

## P0 - Must Do

| # | Task | Primary Scope | Acceptance |
|---|---|---|---|
| 1 | Fix or guard missing `contextCollapse` runtime path | `src/services/compact/autoCompact.ts`, other `services/contextCollapse` require sites | No runtime crash when `CONTEXT_COLLAPSE` is enabled or referenced; compact path has a safe fallback |
| 2 | Remove duplicate simple-mode check | `src/tools.ts` | `DSXU_CODE_SIMPLE` is checked once; simple mode behavior remains unchanged |
| 3 | Replace simulated verification gate with real verification | `src/dsxu/engine/verify-gate.ts`, `src/tools/RunNativeTestTool/RunNativeTestTool.ts`, `src/tools/CollectEvidenceTool/CollectEvidenceTool.ts`, `src/query.ts` | After code edits, final success requires real test/build/lint evidence or an explicit PARTIAL |
| 4 | Make semantic verification part of DSXU coding mainline | `src/tools.ts`, semantic tool registration, prompt/tool visibility | `RunNativeTest` and `CollectEvidence` are available in DSXU coding profile without hidden manual setup |
| 5 | Add local regression runner | `scripts/regression-check.ts` | One command runs fixed local scenarios and reports pass/fail, turns, tool calls, route, cost, and failure category |
| 6 | Add benchmark documentation | `docs/BENCHMARK.md` | Documents task list, model/provider, thinking mode, sampling policy, route, cost, raw log location, and result history |
| 7 | Add short Action Contract before write operations | Query loop, tool gate layer, Edit/Write paths | Before Edit/Write, model declares target, allowed files, next tool, verification command, and fallback |
| 8 | Enforce Action Contract scope | `src/dsxu/engine/tool-gate-v1.ts`, `src/services/tools/dsxuToolBatchGate.ts`, Edit/Write paths | Writes outside declared scope are blocked or require a refreshed contract |
| 9 | Enable agent-owned rollback for write operations | `src/dsxu/engine/transaction-manager.ts`, file edit adapter | Failed verification can roll back only files changed by the current agent action |
| 10 | Add DeepSeek V4 capability truth document | `docs/DEEPSEEK_V4_CAPABILITIES.md` | Records 1M context, 384K output, thinking support, FIM 4K limit, pricing/cache assumptions, temperature rules, and official source links |
| 11 | Add DeepSeek prompt-too-long compatibility tests | `src/services/api/errors.ts`, compact/retry tests | DeepSeek over-context or 413-style errors trigger compact/retry behavior correctly |

## P1 - Should Do

| # | Task | Primary Scope | Acceptance |
|---|---|---|---|
| 12 | Strategy-based auto-compact thresholds | `src/services/compact/autoCompact.ts` | Threshold is model-aware and percentage/strategy based, not only fixed 13K buffer |
| 13 | Context pressure regression tests | Regression suite | Covers 70%, 85%, 95%, and 99% effective context pressure |
| 14 | Unify P0/P1/P2 context priority labels | Context manager, compact summaries, query state | Task, latest errors, active plan, and verification state are pinned; older tool history is compactable |
| 15 | Add session error frequency tracking | Query loop, experience layer | Repeated failure patterns trigger concise adaptive warnings after threshold |
| 16 | Add experience confidence and expiry | `src/dsxu/engine/experience-store.ts` | Project facts and failure patterns have confidence, source, last-seen, and expiry behavior |
| 17 | Add DSXU coding tool profile | `src/tools.ts`, prompt/tool visibility | Default coding profile exposes core code tools plus verification tools; optional tools remain discoverable |
| 18 | Connect existing gear-box to V1 flow | `src/dsxu/engine/gear-box.ts`, query route logic | Simple tasks take fast path; complex write/recovery tasks take higher-discipline path |
| 19 | Add write-operation complexity classifier | Query loop/tool gate layer | Single low-risk edits skip heavy planning; multi-file/type/risk edits require Action Contract and verification |
| 20 | Add parameter templates for high-risk tools | Edit/Write/Agent tool prompts or schemas | Edit and Agent calls use structured required fields to reduce missing or wrong parameters |
| 21 | Define benchmark sampling policy | Benchmark runner, model config docs | Results record model id, provider, thinking mode, reasoning effort, temperature policy, and route decision |
| 22 | Audit DSXU/provider feature gates | `src/coordinator/coordinatorMode.ts`, feature flag call sites | Old provider-named gates are wrapped or renamed to DSXU-owned names where they affect DSXU runtime |
| 23 | Classify `USER_TYPE === 'ant'` call sites | Source-wide audit script/doc | Each site is classified as build-time DCE, provider compatibility, DSXU runtime path, or cleanup candidate |

## P2 - Later

| # | Task | Primary Scope | Acceptance |
|---|---|---|---|
| 24 | Add PreEditCheck | Edit preflight layer | Cheap checks catch common JSX/import/type-shape issues before write |
| 25 | Add TestSkeleton helper | Test generation workflow | Generates skeletons for pure functions and common component patterns |
| 26 | Add BlameContext helper | Git evidence tool | Risky edits can show last relevant commit/blame summary before modification |
| 27 | Add every-5-step progress summary | Query loop / compact state | Long tasks preserve read files, completed edits, next action, blockers, and verification state |
| 28 | Add local quality telemetry summary | Local logs/evidence docs | Tracks edit pass rate, verification pass rate, repeated edit blocks, and average repair turns |
| 29 | Record gateway deployment metadata | Benchmark result schema | Stores provider, model version/fingerprint if available, gateway id, and quantization only when exposed |
| 30 | Add lightweight decision comments or ADRs | Critical runtime decision points | Key routing/verification/cache decisions record why, data source, and expected consequence |

## V1 Non-Goals

| Not Doing | Reason |
|---|---|
| Replace DSXU provider transport with `deepseek-sdk` | No such dependency exists in the project; DeepSeek supports compatible API formats and DSXU already has a transport layer |
| Change DeepSeek V4 context to 128K | Official and local code baseline is 1M for Chat |
| Lower DeepSeek Chat max output to 8K/16K/32K | Official and local code baseline is 384K-class output |
| Skip `notifyCompaction` or `notifyCacheDeletion` | They support cache/cost evidence and should stay |
| Batch-delete all `USER_TYPE === 'ant'` checks | Many are build-time DCE or provider compatibility gates; classify first |
| Force long reasoning prefix before every tool call | DeepSeek V4 already supports thinking; V1 uses a short Action Contract for write/risk paths |
| Claim reference-product/GPT parity percentages | Requires same-task raw logs and public benchmark evidence |

## Execution Order

1. Fix real runtime defects: `contextCollapse` guard and duplicate simple-mode check.
2. Make real verification the mainline: verification tools, final gate, and `verify-gate` replacement.
3. Add regression runner and benchmark documentation.
4. Add Action Contract and enforce write scope.
5. Enable safe agent-owned rollback.
6. Publish DeepSeek V4 capability truth document.
7. Add context pressure strategy and tests.
8. Add experience confidence/error-frequency learning.
9. Add coding tool profile and gear-box integration.
10. Add P2 editing helpers and local quality telemetry.
