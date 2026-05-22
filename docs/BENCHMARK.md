# DSXU Benchmark and Public Evidence Truth

Last updated: 2026-05-21

This page is the public evidence index for DSXU benchmark and release claims. It is intentionally conservative: benchmark data can be used as a product proof only when the raw run, score rule, cost record, failure record, and release-claim boundary all point to the same task.

## Current Evidence Sources

| Evidence | File or command | Public use |
|---|---|---|
| Hard engineering benchmark | `bun run benchmark:hard-engineering` and `docs/DSXU_HARD_ENGINEERING_BENCHMARK_20260517.md` | Shows DSXU workflow lift on internal hard engineering tasks. It is not an external leaderboard claim. |
| Release-claim binder single-task proof | `docs/DSXU_HARD_ENGINEERING_BENCHMARK_20260517_release-claim-evidence-binder.md` | Shows one fixed release-claim task now blocks overclaim wording and requires evidence binding. It is not a full 9-task benchmark replacement. |
| Raw API vs DSXU A/B | `bun run benchmark:raw-api-vs-dsxu` and `docs/DSXU_RAW_API_VS_DSXU_AB_20260516.md` | Shows same-family DSXU orchestration value when a raw run exists. |
| Product benchmark data pack | `bun run benchmark:product-data` and `docs/DSXU_V24_PRODUCT_BENCHMARK_DATA_PACK_20260515.md` | Internal product data pack for GitHub charts and demos. It must stay tied to raw evidence. |
| Public challenge package | `bun run benchmark:public-challenge` | Prepares public challenge assets. It is allowed only when same-task raw evidence exists. |
| SWE internal smoke / public-comparable candidate | `bun run benchmark:swe-bench --instances "mock-001,mock-002"` for internal smoke; `bun run benchmark:swe-bench --mode public-comparable --instances "<fixed-public-set>"` only for fixed raw collection | Internal smoke is product plumbing evidence only. `public-comparable` enters the real benchmark candidate lane, but public claims remain blocked until all required raw evidence is present. |
| Blocked claim corpus | `bun run evidence:blocked-claim-corpus` and `docs/DSXU_BLOCKED_CLAIM_CORPUS_20260517.md` | Prevents unsupported public wording from returning to README, launch pack, or charts. |
| Capability acceptance audit | `bun run evidence:capability-acceptance-audit` and `docs/DSXU_CAPABILITY_ACCEPTANCE_AUDIT_20260516.md` | Lists implemented, adapted, and live-window-needed DSXU capabilities. |
| Cost/capability crosswalk | `bun run evidence:capability-cost-crosswalk` and `docs/DSXU_CAPABILITY_COST_CROSSWALK_20260516.md` | Connects capability value to route, cost, cache, and evidence. |
| Release/export public surface policy | `bun test src/dsxu/engine/__tests__/open-source-package-gate.test.ts src/dsxu/engine/__tests__/release-surface-v1.test.ts src/dsxu/engine/__tests__/release-surface-source-policy-review-v1.test.ts` | Proves public docs/assets are separated from internal audit and generated evidence docs before clean export. It is not a benchmark score. |
| Public comparable manifest | `docs/generated/DSXU_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_20260518.json` and `docs/DSXU_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_20260518.md` | Defines the fixed 30-case task set and required raw fields. It is a collection contract, not a result. |
| V2/V3 finalization closeout | `docs/generated/DSXU_V2_FINALIZATION_CLOSEOUT_20260521.json` and `docs/generated/DSXU_V3_FINALIZATION_GATE_TRACKER_20260521.json` | Shows the prior 14-case finalization gap is closed, the remaining 16 raw API baseline cases are captured, and 30/30 DSXU raw evidence is ready. It is not an external comparison result. |
| Cache live A/B | `docs/generated/DSXU_CACHE_LIVE_AB_20260521.json` | Shows a controlled repeated stable-prefix lane reached 99.6% cache hit after warmup. It is internal tuning proof, not model-quality or benchmark proof. |
| Latest real-task hit-rate pack | `docs/generated/DSXU_V4_REAL_TASK_HIT_RATE_PACK_20260519.json` | Internal product proof: 24/24 final PASS, 0% first-attempt PASS, 100% second-attempt recovery, Flash-only, 64.1% cache hit, $0.198944 total cost. It is not an external benchmark claim. |
| Internal replay hit-rate gate | `docs/generated/DSXU_V6_HIT_RATE_REPORT_20260519.json` | Internal replay proof: 100/100 final PASS, 100% tool hit, 100% recovery success, 80.7% average cache hit, 9/9 Pro admissions justified. It is not an external benchmark claim. |
| V8 final acceptance | `docs/generated/DSXU_V8_COMPLETION_AUDIT_20260519.json` | Confirms six-stage final acceptance and keeps public external benchmark plus clean export artifact blocked until required evidence is created. |
| Clean export artifact | `docs/generated/DSXU_V24_CLEAN_EXPORT_ARTIFACT_20260515.json` | Current release-candidate export passed secret scan and records exact zip path, size, and SHA-256 in generated evidence. It is release packaging proof, not benchmark proof. |
| Fresh install smoke | `docs/generated/DSXU_V24_FRESH_INSTALL_RELEASE_SMOKE_20260515.json` | 8/8 clean-export commands passed, covering install/help/auth/doctor/provider smoke. It is package usability proof, not benchmark proof. |

## Latest GitHub-Facing Evidence Snapshot

This snapshot is public-safe only because it separates internal product proof from external benchmark proof.

| Evidence | Latest result | Public interpretation |
|---|---:|---|
| Full repo regression | 3075 pass / 1 skip / 0 fail across 434 test files | Product stability proof, not a benchmark score. |
| Six-stage final tests | 22/22 command batches passed | Function, experience, recovery, performance, evaluation, and release-closure workflow proof. |
| DSXU release gate tests | 531 pass / 0 fail | Release surface and claim-boundary proof after V2/V3 closeout. |
| Senior coding window | 30.48 minutes, 33 DSXU product-entry runs, 32 structured review rounds, final fixture test passed | Long-task coding workflow proof. |
| Senior window model/cost | `deepseek-v4-flash` only, Pro not used, about $0.3617 Flash cost | Flash-first cost discipline proof for this window. |
| SWE internal smoke | 5/5 internal smoke instances passed | Internal eval plumbing proof only; it must not be called a public SWE score. |
| Training V1 reality run | PASS, 23 steps, 13 gates passed, 0 failed | Training/evidence pipeline proof; `publicClaimAllowed=false`. |
| V10 final reality evidence | reachability, golden replay 77 cases, ablation, long task, provider dry smoke, agent/tool pairing, cache/cost, localized feedback, TUI trust surface, final dashboard all PASS | DSXU-owned final reality proof, not external model superiority proof. |
| V2/V3 finalization closeout | 14/14 finalization subset PASS; remaining 16/16 raw API baseline captured; 30/30 raw evidence import ready | DSXU raw evidence readiness proof, not external comparison proof. |
| Cache live A/B | PASS live lane, round 2/3 hit rate 99.6% | Controlled cache behavior proof for one stable-prefix lane. |
| Evidence dashboard | pass=159, fail=0, blocked=0, claimBlocked=1, notRun=0, scoreFloor=72, releaseClaimAllowed=false | Runtime/release blockers are closed. The actual score floor `72/95` is publishable with boundaries; public 90/95 and external comparison claims remain blocked. |
| Public-comparable SWE lane | `BLOCKED_PUBLIC_COMPARABLE_EVIDENCE` in `docs/generated/DSXU_SWE_BENCH_RESULTS_20260520.json` | Not a benchmark result. It shows the external/raw-evidence lane still needs a real runner environment and complete raw evidence. |
| Public-comparable DSXU lane | 30/30 DSXU raw evidence ready after V2/V3 closeout | DSXU/raw API evidence can be cited with boundaries; external comparison still needs same-case target/reference transcripts. |

## Claim Rules

Allowed public wording:

- DSXU is a DeepSeek-first coding CLI/TUI that adds orchestration, tool execution, permission gates, recovery, cost/cache evidence, and release proof around DeepSeek model calls.
- DSXU can publish internal benchmark results when each chart links to raw run data, scorer, cost/cache record, and failure notes.
- DSXU can say a task is `PASS`, `PARTIAL`, or `BLOCKED` only according to the latest evidence file for that exact task.

Blocked public wording:

- No external leaderboard win unless there is a same-task target/reference manifest with raw transcript, tool trace, final report, artifacts, metrics, risks, and scoring protocol.
- No generic parity wording against closed or branded products.
- No percentage capability claim unless it is backed by a reproducible public evidence pack and the exact scoring rubric is published.
- No target-only, DSXU-only, template, or generic log can substitute for paired raw evidence.

## Sampling Policy

Every public benchmark row must record:

- model lane and route decision
- thinking mode state
- temperature and relevant generation controls when available
- prompt/input manifest
- tool permission and execution evidence
- cost, cache hit/miss tokens, and elapsed time when available
- final report path and artifact paths
- failure classification and recovery path, including failures that were not fixed

## Current Release Boundary

Current public-safe status:

- DSXU can publish DSXU-owned workflow evidence and internal benchmark data.
- DSXU can publish the actual evidenced public challenge score floor, currently `72/95`, without rounding it into a 90/95 claim.
- External comparison remains a prepared capability, not a final public claim, until paired target/reference raw input is imported.
- Final GitHub README, launch pack, and charts must continue to pass blocked-claim and brand/compat risk gates.
- Current clean export and fresh install smoke have passed for the release-candidate package lane.
- The 30-case public comparable manifest exists and DSXU/raw API evidence is ready 30/30 after V2/V3 closeout. External comparison remains blocked until same-case target/reference transcripts are collected for all 30 cases.
- Evidence dashboard reports high-score and external-comparison claim blockers separately from runtime `FAIL`, so users can distinguish honest claim gating from broken code.
