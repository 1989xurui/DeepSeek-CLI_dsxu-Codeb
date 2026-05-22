# DSXU Reasonix comparative code audit - 20260517

Status: REVIEW_COMPLETE_NO_CODE_MUTATION

This report compares the downloaded Reasonix source at `D:\DSXU-external-analysis\DeepSeek-Reasonix` with the current DSXU source tree. The purpose is not to copy Reasonix or add another runtime. The purpose is to use Reasonix as a DeepSeek-specific pressure test and fold useful mechanisms into existing DSXU owners.

## Scope

Generated artifacts:

| artifact | purpose |
|---|---|
| `docs/generated/DSXU_REASONIX_COMPARATIVE_CODE_AUDIT_20260517.csv` | Per-file DSXU audit table: path, owner, Reasonix mechanism overlap, status, static risks, recommended action. |
| `docs/generated/DSXU_REASONIX_COMPARATIVE_CODE_AUDIT_20260517.json` | Machine-readable full table. |
| `docs/generated/DSXU_REASONIX_COMPARATIVE_CODE_AUDIT_SUMMARY_20260517.json` | Owner/mechanism/status/risk aggregates. |
| `docs/generated/DSXU_REASONIX_COMPARATIVE_CODE_AUDIT_CRITICAL_20260517.csv` | Static-risk shortlist for manual owner review. |
| `docs/generated/DSXU_REASONIX_SOURCE_FILE_COVERAGE_20260517.csv` | Reasonix-side filesystem coverage table with file kind, mechanism tags, DSXU absorption owner, and performance vectors. |
| `docs/generated/DSXU_REASONIX_SOURCE_FILE_COVERAGE_20260517.json` | Machine-readable Reasonix-side coverage table. |
| `docs/generated/DSXU_REASONIX_PERFORMANCE_IMPACT_SUMMARY_20260517.json` | Performance-impact aggregate by file kind, mechanism, vector, and absorption decision. |
| `docs/generated/DSXU_REASONIX_PERFORMANCE_IMPACT_MATRIX_20260517.csv` | Mechanism-level DSXU performance benefit/risk/control/measurement matrix. |

Coverage:

| metric | value |
|---|---:|
| DSXU files scanned | 2791 |
| DSXU lines scanned | 722409 |
| Reasonix source basis | local extracted source plus `docs/ARCHITECTURE.md`, benchmark reports, `src/loop.ts`, `src/memory/runtime.ts`, `src/repair/*`, `src/telemetry/*` |
| DSXU mutation | none |
| Reasonix filesystem coverage | 987 local files, including hidden/governance/benchmark/native support files ignored by simpler `rg --files` views |

Excluded from this audit: `node_modules`, `.git`, `.dsxu`, build/output folders, generated evidence internals outside the explicit docs/generated audit output.

## Completeness addendum: Reasonix-side coverage

The first DSXU audit table is intentionally DSXU-file-centric: it scans DSXU and asks which existing owners can absorb Reasonix mechanisms. That is useful, but incomplete if used alone. This addendum adds a Reasonix-side coverage pass so the audit is not just a one-way DSXU scan.

Reasonix local filesystem coverage:

| kind | files | lines | decision |
|---|---:|---:|---|
| runtime-source | 389 | 71453 | Absorb mechanisms into existing DSXU owners only. |
| test | 218 | 44764 | Use as acceptance-pattern inspiration, not product runtime. |
| other-support | 98 | 33957 | Review only; often auxiliary scripts/data. |
| benchmark-evidence | 78 | 5789 | Use benchmark method pattern only; do not claim Reasonix results for DSXU. |
| docs | 58 | 23749 | Reference boundary only. |
| asset | 51 | 0 | Exclude product-specific assets. |
| rust-or-native-support | 40 | 10676 | Review native performance ideas only; do not add native layer without measured bottleneck. |
| config-or-build | 37 | 12163 | Build/config reference only. |
| repo-governance | 14 | 779 | Open-source process pattern only. |
| example | 4 | 380 | Demo pattern only. |

Reasonix mechanism pressure, from the source-side table:

| mechanism | files | lines | DSXU meaning |
|---|---:|---:|---|
| visible-work-state | 648 | 173261 | Very large signal: DSXU must measure TUI/render/event overhead, not just feature presence. |
| context-recovery | 547 | 161710 | Recovery/compact/session ideas matter, but need retention and freshness controls. |
| tool-call-repair | 511 | 156859 | Strong DeepSeek reliability signal; must be adapter-owned and capped. |
| tool-result-budget | 502 | 159889 | Strong token/cache performance signal; must be enforced across tool families. |
| deepseek-route-cost-control | 499 | 145759 | Route/cost/cache is a first-class performance system, not README text. |
| cache-first-loop | 449 | 149648 | Highest relevance for DeepSeek cache economics. |
| mcp-skill-agent-envelope | 398 | 140717 | Useful, but only as DSXU registry/evidence envelopes. |
| evidence-release-claim | 361 | 128886 | Public claim discipline and raw evidence package pattern. |
| permission-tool-gate | 272 | 113608 | Permission evidence must stay visible and same-source. |
| parallel-safe-dispatch | 168 | 100667 | Potential wall-clock win, but only with deterministic serial barriers. |

## Performance impact assessment

Reasonix should be treated as a DeepSeek performance pressure test. The key question is not "can DSXU add more features?" but "which mechanism improves DSXU quality/cost/latency without making the main chain slower or less reliable?"

### Performance vectors found

| vector | files | lines | interpretation |
|---|---:|---:|---|
| ui-latency-risk | 648 | 173261 | Visible-state work can easily slow TUI or break resize/scroll if events are too noisy. |
| token-cache-positive | 633 | 178986 | Biggest likely DSXU win: bounded tool output, stable prefix, compact dynamic tail. |
| memory-io-risk | 547 | 161710 | Recovery/session evidence helps long tasks but can grow logs and disk IO. |
| quality-positive-latency-risk | 511 | 156859 | Tool-call repair can improve success rate, but repair loops must be capped. |
| memory-positive | 502 | 159889 | Artifact preview and compaction reduce in-prompt memory pressure. |
| cost-positive-routing-risk | 499 | 145759 | Route admission can lower cost, but wrong Pro triggers raise cost/latency. |
| integration-risk | 398 | 140717 | MCP/skill/agent mechanisms are valuable only behind DSXU registry boundaries. |
| observability-io-risk | 361 | 128886 | Evidence/telemetry improves debugging but must be sampled/redacted. |
| safety-positive-latency-risk | 272 | 113608 | Permission gates protect users but add UI waiting; must be concise and same-source. |
| latency-positive-ordering-risk | 168 | 100667 | Parallel read-only dispatch can improve wall-clock, but ordering and side-effect barriers are non-negotiable. |

### Mechanism-by-mechanism DSXU performance decision

| mechanism | likely benefit | performance risk | DSXU control |
|---|---|---|---|
| cache-first-loop | Lower repeated input tokens, better warm-turn latency/cost. | Hashing/bookkeeping overhead; stale source risk. | Stable prefix hash, drift reason, freshness guard, dynamic tail boundary. |
| tool-result-budget | Less prompt bloat, less TUI render pressure, fewer cache breaks. | Artifact IO; preview too small. | Bounded preview plus artifact path and range reread fallback. |
| tool-call-repair | Fewer failed tool turns and retries. | Extra parse/repair CPU; bad repair risk. | Max repair pass count, schema validation, identical-call storm breaker. |
| failure-signal Pro admission | Quality improves only when Flash failure signals justify escalation. | Over-escalation increases cost and latency. | Admission ledger and pass-after-escalation review; Flash remains default. |
| parallel-safe-dispatch | Lower wall-clock for independent read-only work. | IO saturation and result-order bugs. | Only consecutive read-only/concurrency-safe calls; writes are serial barriers. |
| visible-work-state | Better operator trust and debugging. | Event spam, render lag, resize/scroll regression. | Single event source, throttled render, PTY resize harness, bounded summaries. |
| context-recovery append-only | Better long-task resume. | Disk/log growth and compact CPU. | Retention policy, source hash expiry, compact timing metrics. |
| agent evidence envelope | Lower parent context tokens. | Too little detail can hide worker mistakes. | Required worker scope/test/artifact path; parent verifier rejects partial evidence. |
| MCP/Skill negotiation | Safer external ecosystem. | Startup/preflight latency. | Capability cache, permission boundary, no standalone runtime. |
| benchmark evidence pattern | Better public proof quality. | Slow harness and IO load. | Use method only; DSXU must rerun own raw evidence. |

### What this means for DSXU performance

Expected positive impact if implemented inside existing owners:

1. Lower token pressure from tool result budgeting and source capsules.
2. Higher DeepSeek cache stability from fixed prefix/dynamic-tail separation.
3. Lower unnecessary Pro usage from failure-signal admission rather than wording-triggered routing.
4. Better wall-clock on large repo inspection from safe read-only parallel dispatch.
5. Better perceived performance because work-state shows what is running, waiting, blocked, or recovering.

Expected negative impact if copied poorly:

1. TUI can get slower if every event is rendered immediately.
2. Cache can get worse if new telemetry fields drift inside stable prefix.
3. Tool-call repair can add retry loops if not capped.
4. Benchmark/evidence logging can inflate disk IO and memory.
5. MCP/Skill preflight can slow startup if not cached.
6. A native/Rust performance layer can make open-source install harder without solving the real bottleneck.

Therefore the execution rule is stricter than feature absorption:

| gate | requirement |
|---|---|
| before merge | Prove the mechanism lands in an existing DSXU owner. |
| focused test | Unit/contract tests for owner logic and regression path. |
| performance smoke | Measure token/toolResultChars/cacheHitRatePct/render latency or wall-clock before/after where applicable. |
| real TUI window | Confirm visible-state changes do not break scroll/resize/permission prompts. |
| release claim | Only write data-backed claims from DSXU runs, not Reasonix results. |

## Executive conclusion

Reasonix is valuable to DSXU because it is DeepSeek-specific, not because it has more generic features. Its high cache hit rate comes from a small set of strict loop invariants:

1. immutable prompt/tool prefix
2. append-only log
3. volatile scratch outside upstream prompt
4. tool result compaction/artifact preview
5. DeepSeek tool-call repair
6. visible route/cost/cache telemetry

DSXU already has most matching parts, but spread across many owners. The right move is consolidation:

- Do not add a Reasonix runtime.
- Do not add another provider/router/cache layer.
- Do not add another TUI state stream.
- Fold the mechanisms into existing DSXU owners: Query loop, DeepSeek route/cost/cache, Tool Gate, Permission Gate, work-state timeline, Context/Recovery, Agent/MCP/Skill registry, Evidence/Release.

## DSXU owner distribution

| owner | files | lines | interpretation |
|---|---:|---:|---|
| Shared runtime utility owner | 674 | 198322 | Largest surface. Needs owner boundaries so utilities do not become hidden runtimes. |
| Evidence / benchmark / DSXU engine owner | 558 | 159456 | Strong evidence system, but risk of too many historical boards. |
| TUI / visible-state owner | 478 | 103349 | Large enough to carry Reasonix-style route/cost/cache/status display without a new UI layer. |
| Tool Gate / Permission owner | 267 | 75979 | Existing gate can absorb tool budget, repair and side-effect evidence. |
| DeepSeek route / cost / cache owner | 91 | 23286 | Correct owner for Reasonix cache-first and cost-control ideas. |
| MCP / Skill / Plugin registry owner | 76 | 25942 | Must remain adapter intake, not standalone ecosystem runtime. |
| Agent / task lifecycle owner | 59 | 13957 | Should return evidence envelopes, not long transcripts. |
| Context / recovery / compact owner | 43 | 12504 | Should absorb compact thresholds and volatile scratch rules. |
| Query loop / entrypoint owner | 17 | 15381 | Small but critical: all new invariants must be enforced here. |
| Archived boundary / replace-delete review owner | 10 | 1580 | Old/disabled/compat paths; do not revive as product features. |

## Mechanism overlap

| Reasonix mechanism | DSXU files with related signal | current state |
|---|---:|---|
| visible-work-state | 1621 | DSXU has broad UI/state/report hooks; needs stricter single-source projection. |
| context-recovery | 1502 | Strong but dispersed; compact/recovery/source-truth policy should be unified. |
| mcp-skill-agent-envelope | 1003 | Strong adapter surface; keep parent summaries as evidence envelopes. |
| parallel-safe-dispatch | 798 | DSXU has `isConcurrencySafe` / `isReadOnly`; needs deterministic serial barriers at dispatch. |
| permission-tool-gate | 798 | Strong owner. Side effects should always project permission evidence. |
| evidence-release-claim | 758 | Strong; publish claims must continue binding source/test/live/raw/cost/cache evidence. |
| tool-call-repair | 409 | Partial. DSXU extracts tool calls, but lacks one DeepSeek-owned repair kernel. |
| deepseek-route-cost-control | 338 | Strong route/cost owner exists. Needs failure-signal admission and cache-first acceptance. |
| cache-first-loop | 198 | Implemented in evidence/support, not yet strict enough as query-loop invariant. |
| no-direct-reasonix-overlap | 353 | Baseline files; do not rewrite just to chase Reasonix. |

## Existing DSXU functions that should absorb Reasonix ideas

| Reasonix idea | DSXU existing owner/files | audit decision |
|---|---|---|
| Immutable prefix / dynamic tail | `src/dsxu/engine/prompt-prefix-cache-builder.ts`, `src/dsxu/engine/prompt-prefix-cache-evidence.ts`, `src/dsxu/engine/cost-cache-live-task-evidence.ts` | Keep and strengthen. Add query-loop acceptance that stable prefix hash is stable across turns when tools/config do not change. |
| Append-only log | `src/query.ts`, `src/utils/sessionStorage.ts`, `src/services/compact/*`, `src/dsxu/engine/compact.ts` | Do not add new memory runtime. Add guard that compact appends summaries and does not rewrite stable prefix unless explicitly recorded. |
| Volatile scratch outside prompt | `src/constants/prompts.ts`, `src/dsxu/engine/context-pressure-matrix.ts`, `src/dsxu/engine/work-state-timeline.ts` | Convert route/work-state scratch into visible event/artifact, not repeated upstream prompt text. |
| Tool result compaction | `src/utils/toolResultStorage.ts`, `src/services/compact/microCompact.ts`, `src/dsxu/engine/compact.ts`, `src/constants/toolLimits.ts` | Already strong. Expand acceptance to all Read/Bash/Web/MCP/Agent outputs and final report references. |
| DeepSeek tool-call repair | `src/services/api/deepseek-adapter.ts`, `src/Tool.ts`, tool schemas, `src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts` | Main gap. Merge repair passes into adapter/tool schema path: schema flatten/nest, reasoning-content scavenge, truncation repair, storm breaker. |
| Flash-first / Pro admission | `src/utils/model/deepseekV4Control.ts`, `src/utils/model/deepseekV4CostRouter.ts`, `src/services/api/deepseek-trajectory-store.ts` | Strong owner. Add failure-signal Pro admission ledger; do not switch ordinary tasks to Pro. |
| Read-only parallel chunks | `src/Tool.ts`, `src/query.ts`, `src/tools/BashTool/*`, `src/tools/PowerShellTool/*`, `src/dsxu/engine/parallel-tools.ts` | Use existing `isConcurrencySafe` / `isReadOnly`; dispatch must preserve declared result order and stop at unsafe calls. |
| Route/cost/cache TUI | `src/dsxu/engine/work-state-timeline.ts`, `src/components/*`, `src/cli/print.ts`, `src/dsxu/engine/final-report-usage-evidence.ts` | Do not add a UI stream. Project DeepSeekTrajectoryStore events into work-state and final report. |
| Subagent distillation | `src/tools/AgentTool/*`, `src/dsxu/engine/agent-mcp-skill-boundary-board.ts`, `src/dsxu/engine/work-state-timeline.ts` | Keep summary/path/hash/evidence envelope. Do not return long transcript to parent. |
| MCP/Skill registry | `src/services/mcp/*`, `src/tools/MCPTool/*`, `src/skills/*` | DSXU already has adapter governance. Add capability negotiation evidence only, not standalone runtime. |

## Main gaps versus Reasonix

### P0. Cache-first loop acceptance is not yet a hard query-loop invariant

DSXU has the pieces:

- `prompt-prefix-cache-builder.ts`
- `prompt-prefix-cache-evidence.ts`
- `route-cache-dynamic-tail.ts`
- `cost-cache-live-task-evidence.ts`
- `DeepSeekTrajectoryStore`

But the current evidence is mostly board/test level. Reasonix makes this a loop invariant. DSXU should add an owner-level acceptance gate:

- stable prefix hash stays fixed when system/tool/config source has not changed
- dynamic tail contains current request, task state, tool previews, traces, timestamps
- full tool result text is not repeatedly re-sent after the turn where it was needed
- cache miss is explained when tool schema/config changes

Implementation boundary: add to existing Query loop / DeepSeek trajectory / prompt-prefix evidence. Do not create `CacheFirstLoop`.

### P0. DeepSeek tool-call repair is only partial

DSXU already extracts XML/free-form tool calls in `DeepSeekAdapter.extractToolUsesFromText()`. It also normalizes tool names and inputs. This matches one Reasonix repair branch.

Missing or not unified:

- schema flatten/nest for deep or wide tool schemas
- scavenge tool calls from `reasoning_content`
- truncated JSON argument repair
- repeated identical tool-call storm breaker
- repair report as route/cost/admission evidence

Implementation boundary: fold this into `DeepSeekAdapter` + `Tool` schema metadata + existing mainline adapter tests. Do not add a second tool runtime.

### P0. Pro admission should learn from failure signals, not wording

DSXU route logic exists and is clear in `deepseekV4Control.ts`. Current decisions include Flash-first, thinking modes, FIM lane, high-risk Pro with approval, failed verification Pro.

Reasonix adds a useful pattern: count visible failure signals before escalating:

- edit/write search-not-found
- tool-call repair fired repeatedly
- tool storm broken
- failed verification after Flash attempt
- source truth conflict after reread

Implementation boundary: append these as trajectory/work-state evidence and feed existing `decideDeepSeekV4Route` / `resolveDeepSeekV4CostRoute`. Do not add another router.

### P0. Parallel dispatch needs deterministic serial barriers

DSXU has:

- `Tool.isConcurrencySafe`
- `Tool.isReadOnly`
- Bash/PowerShell read-only classifiers
- Agent serial worker / parallel fanout semantics

Reasonix adds one useful invariant: consecutive safe calls can run together, but results append in declared order; unsafe calls are serial barriers.

Implementation boundary: use existing tool metadata in query tool dispatch. Do not make a separate DAG/coordinator executor.

### P1. Visible-state should become the single product projection

DSXU has `work-state-timeline.ts`, but much of the UI still has older local status logic. Reasonix's product lesson is that cost/cache/model/tool state must be visible in the same place.

DSXU should project these into work-state:

- DeepSeek route reason
- model and thinking mode
- cache hit/miss tokens
- per-turn cost and session cost
- tool output cap/artifact path
- repair pass fired
- permission decision
- Pro admission reason

Implementation boundary: `work-state-timeline.ts`, `final-report-usage-evidence.ts`, `cli/print.ts`, TUI components. No new UI stream.

### P1. Tool result budget must be applied consistently

DSXU has strong storage support in `toolResultStorage.ts` and constants in `toolLimits.ts`. Static audit still flags many files with tool-result-budget risk because tool results appear across Read/Bash/MCP/Agent/UI code.

Decision: this is not a sign DSXU lacks the feature; it means the final acceptance must prove all major tool families use artifact preview or bounded output.

Implementation boundary: shared `processToolResultBlock` / tool `maxResultSizeChars` / final report evidence.

## Old-layer and cleanup candidates

The scan found 49 files in `review-replace-delete-or-archived-boundary`. The most important classes are:

| class | decision |
|---|---|
| `src/coordinator/dag` | Keep only as historical/harness evidence unless owner/Git approves delete; product PEV belongs to PlanGraph/work-state. |
| `src/services/swe-bench` | Old owner; replacement is `src/services/eval/swe-bench`; do not expose as benchmark runtime. |
| `src/tdd.ts` | Historical toy helper; replacement is post-mutation verification envelope / Tool Gate. |
| `src/tools/TungstenTool/*` | Disabled historical tool; must not return to terminal runtime. |
| `src/utils/model/providerMigration/*` | Hidden archived compatibility boundary; not public DSXU model/product surface. |

These should not block Reasonix-style improvements, but they should not be revived as product layers.

## What not to do

Do not do these:

- Do not introduce `ReasonixLoop`, `CacheFirstLoop`, or another DSXU runtime.
- Do not wrap DSXU tools with a second registry just to copy Reasonix `ToolRegistry`.
- Do not make cache hit rate a hard release blocker or a fake 90/95 claim.
- Do not reduce source truth just to improve cache hit.
- Do not parallelize write tools.
- Do not put Reasonix, Claude, Karpathy, Opus, Sonnet, or other reference/product names into public DSXU feature names.

## Recommended merge plan

### 1. Strengthen existing DeepSeek route/cost/cache owner

Files:

- `src/utils/model/deepseekV4Control.ts`
- `src/utils/model/deepseekV4CostRouter.ts`
- `src/services/api/deepseek-adapter.ts`
- `src/services/api/deepseek-trajectory-store.ts`
- `src/dsxu/engine/prompt-prefix-cache-builder.ts`
- `src/dsxu/engine/cost-cache-live-task-evidence.ts`

Actions:

- Add cache-first loop acceptance over existing trajectory events.
- Record stable prefix drift reason.
- Record Pro admission reason from real failure signals.
- Keep ordinary coding/feature/verification Flash-first unless route evidence says otherwise.

### 2. Fold DeepSeek tool-call repair into the adapter

Files:

- `src/services/api/deepseek-adapter.ts`
- `src/Tool.ts`
- `src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts`

Actions:

- Add schema flatten/nest decision for wide/deep schemas.
- Scavenge tool calls from `reasoning_content` and content.
- Repair truncated JSON argument strings.
- Suppress repeated identical tool calls and emit visible repair evidence.

### 3. Enforce tool result artifact-preview across major tools

Files:

- `src/utils/toolResultStorage.ts`
- `src/constants/toolLimits.ts`
- `src/tools/FileReadTool/*`
- `src/tools/BashTool/*`
- `src/tools/PowerShellTool/*`
- `src/tools/MCPTool/*`
- `src/tools/AgentTool/*`
- `src/dsxu/engine/final-report-usage-evidence.ts`

Actions:

- Prove all large outputs produce preview + artifact path.
- Preserve source truth by allowing reread/range read.
- Ensure final report references artifact paths instead of embedding huge logs.

### 4. Centralize deterministic safe parallel dispatch

Files:

- `src/query.ts`
- `src/Tool.ts`
- `src/dsxu/engine/parallel-tools.ts`
- Bash/PowerShell read-only classifiers

Actions:

- Use existing `isConcurrencySafe` and `isReadOnly`.
- Group only consecutive safe tools.
- Append results in original declared order.
- Stop at unsafe tools as serial barriers.
- Project the parallel plan to work-state before execution.

### 5. Make work-state the single visible projection

Files:

- `src/dsxu/engine/work-state-timeline.ts`
- `src/cli/print.ts`
- `src/components/*`
- `src/dsxu/engine/final-report-usage-evidence.ts`

Actions:

- Display model, route, cost, cache, tool result cap, repair pass, permission state, next action.
- Use the same source for TUI/CLI/final report.
- Keep resize/scroll regression tests in the real TUI harness because this is user-facing quality, not decoration.

### 6. Keep cleanup as owner/Git review, not feature work

Files/classes:

- old DAG
- old SWE
- root TDD helper
- disabled Tungsten
- archived provider migration helpers

Actions:

- Keep as replace/delete candidates.
- Do not use them to implement Reasonix ideas.
- Do not delete without owner/Git authorization.

## Public positioning

Allowed public message after implementation and real tests:

DSXU is a DeepSeek-first coding CLI/TUI that focuses on Flash-first routing, cache-safe context, bounded tool outputs, visible route/cost/cache evidence, and recoverable tool workflows.

Not allowed yet:

- `Reasonix-compatible`
- `Claude-compatible`
- `90/95 achieved`
- `public benchmark winner`
- `99% cache hit`
- `full SWE-bench/Terminal-Bench/OSWorld pass`

Those require same-task raw transcripts, tool traces, scoring rubric, costs, failure recovery, and public evidence pack.

## Current audit decision

DSXU does not need more feature layers to learn from Reasonix. It needs to merge Reasonix's strongest DeepSeek-specific mechanisms into existing DSXU owners:

1. cache-first loop acceptance
2. DeepSeek tool-call repair kernel
3. failure-signal Pro admission ledger
4. deterministic read-only parallel dispatch
5. artifact-preview tool result budget
6. route/cost/cache visible-state projection

This should reduce future work, not increase it: one Query loop, one Tool Gate, one DeepSeek route/cost/cache owner, one work-state projection, one release evidence binder.

## P0 performance smoke baseline - 2026-05-17

User requirement: do not absorb a Reasonix mechanism just because it looks clever. It must improve DSXU by measurement; if it does not improve, do not implement it.

Generated baseline:

| artifact | purpose |
|---|---|
| `docs/generated/DSXU_REASONIX_P0_PERFORMANCE_SMOKE_20260517.json` | Same-turn baseline for the four P0 Reasonix mechanisms with pass/fail risks and go/no-go decision. |

Focused measurements run:

| smoke | result | interpretation |
|---|---|---|
| `bun run source:cache-acceptance` | `PASS_SOURCE_CACHE_ACCEPTANCE`; capsules=2; `toolResultCharsAvoided=21809`; `stablePrefixHashUnchanged=true` | Cache/source capsule path already has measurable token-pressure reduction. |
| `bun run deepseek:cost-quality` | `PASS_DEEPSEEK_COST_QUALITY_ACCEPTANCE`; Flash turn ratio=90%; savings vs Pro-only=63.3%; cache hit=75.3% | Flash-first route/cost policy is already useful; do not make Pro common. |
| `bun run public-challenge:ablation` | scoreFloor `72->72`; cost `$0.0716986596->$0.0089982368`; cache `45.5%->66.8%`; Read calls `28->0`; tool result chars `316381->0` | Strong evidence that source capsule/tool-result budget can reduce cost and cache pressure without score regression. |
| `bun run visible-state:acceptance` | `PASS_VISIBLE_STATE_ACCEPTANCE`; readyEvents=8; blocked guard=`side-effect tool path has blocked permission state` | Work-state projection works, but permission/TUI paths still need real-window regression before public UX claim. |
| focused cache/cost tests | 18 pass / 0 fail | Route/cache/cost/source capsule gates are locally stable. |
| targeted DeepSeek repair tests | 4 pass / 0 fail | DeepSeek XML/Agent/SendMessage/Edit-to-verify repair routing works for the existing narrow cases. |
| local `extractToolUsesFromText` microbench | 20,000 iterations; 80,000 tool calls parsed; 513.812ms total; 0.025691ms per iteration | Parser overhead is negligible; future repair risk is not CPU but uncapped retry or wrong-argument repair. |
| broad `mainline-tool-adapter-v1` suite | 71 pass / 14 fail / 1 error | Not a green proof. Failures concentrate in PowerShell timeout paths and one archived provider-migration env-string expectation. Do not claim full adapter safety from this suite yet. |

### Measured go/no-go for the four P0 mechanisms

| P0 mechanism | measured improvement | decision |
|---|---|---|
| cache-first-loop | Cost down about 87.45% on existing public-challenge ablation; cache hit +21.3 points; score unchanged. | `GO_FOR_HARDENING_ONLY`: turn it into a query-loop invariant, do not rebuild runtime. |
| tool-result-budget | Tool result chars `316381->0`; Read calls `28->0`; source cache saved 21,809 chars. | `GO_FOR_COVERAGE_EXPANSION`: prove all major tool families use preview + artifact path. |
| tool-call-repair | Existing narrow DeepSeek repair tests pass; parser overhead is about 0.026ms per extraction. | `CONDITIONAL_GO`: only add bounded repair types with schema validation and failed-tool-turn reduction smoke. |
| failure-signal Pro admission | Flash route ratio 90%; savings vs Pro-only 63.3%; Pro public overclaim remains blocked. | `GO_WITH_STRICT_ADMISSION`: add failure-signal ledger only; no ordinary Pro route expansion. |

### Absorption acceptance rule

A Reasonix P0 item may be implemented only if same-task smoke keeps quality stable and improves at least one measured vector:

| vector | required direction |
|---|---|
| score / correctness | must not regress |
| cost USD | should decrease or remain flat with quality improvement |
| cacheHitRatePct | should increase, unless source-truth freshness explains a miss |
| toolResultChars | should decrease or be artifact-backed |
| failedToolTurnCount | should decrease for repair features |
| wallClockMs | should decrease for safe parallel dispatch; must not hurt writes |
| ProAdmissionCount | must not increase without pass-after-escalation evidence |
| TUI render/resize | must not regress; real PTY resize harness required for visible-state changes |

Current decision: implement/harden only the measured wins. Do not implement speculative Reasonix features, native layers, new dashboards, or additional runtime shells until a benchmark shows they improve DSXU on these vectors.
