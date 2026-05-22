# DSXU Code

[English](README.md) | [简体中文](README.zh-CN.md)

DSXU is currently positioned as open source: on top of a DeepSeek V4 Flash / Flash-MAX / Pro hybrid-model foundation, it uses strong orchestration, tools, permissions, context management, recovery, Agent execution, cost control, and evidence systems to provide a low-cost AI coding and complex-task execution tool with long-running Agent task execution and a senior-engineer-style working experience.

DSXU Code is built for real engineering work, not as a thin chat wrapper. It adds an engineering runtime around raw model calls: source-truth code reading, tool execution, permission gates, recovery loops, visible work-state, agent and skill boundaries, cost/cache tracking, and evidence-backed release checks. The public positioning is: **DeepSeek-first engineering runtime with internal reality/evidence gates passed**. It is not published as a public 90% or 95-point benchmark claim, and it does not claim external model or product superiority. Public claims in this README are limited to the evidence listed below.

## DSXU Feature Overview

| Capability area | What DSXU provides | Why it matters | Public boundary |
|---|---|---|---|
| DeepSeek hybrid routing | DeepSeek V4 Flash by default, with Flash-MAX / Pro admitted only for complex, review-heavy, or high-risk tasks; every admission records a reason | Keeps everyday work low-cost while preserving an escalation path for harder tasks | No claim that the model itself beats external models |
| Strong orchestration / Query Loop | Task Classifier, PlanGraph, work-state projection, route latch, and final gate | Connects code reading, planning, execution, verification, recovery, and reporting into one engineering loop | No second runtime is introduced |
| Tool system | Read / Edit / Write / Bash / Search / evidence tools run through one Tool Gate | Gives every model tool action purpose, permission, result, and evidence | Tools must not bypass DSXU Tool Gate |
| Permission system | Permission Gate, risky command detection, file-write / external-execution / high-risk action auditing | Prevents silent edits, unsafe execution, and accidental destructive behavior | User authorization and evidence records stay first-class |
| Context system | Source capsules, bounded reads, tool-result artifacts, prompt/cache layering | Reduces repeated large-file reads and prevents huge tool outputs from flooding model context | Cache is an optimization metric, not an external-win claim |
| Recovery system | Failure taxonomy, repair loop, replan, retry, rollback/checkpoint, and stall recovery | Failed commands, failed tests, and long-task stalls can be diagnosed, repaired, rerun, and reported | Failures are not hidden as PASS |
| Long-running Agent tasks | Agent evidence envelopes, worker handoff, parent/worker boundaries, and long-task ledger | Supports task decomposition, parallel analysis, bounded evidence return, and recovery | Agent workers do not become a second orchestrator |
| Skills system | Skill registry, priority rules, conflict handling, and secondary skill-package boundaries | Lets reusable capabilities join the DSXU mainline without stealing control from it | Skills cannot override mainline routing or permissions |
| MCP / external ecosystem | MCP client, registry, adapter boundary, and doctor checks | Allows external tools to connect while staying inside DSXU-owned governance | No bundled third-party product or standalone MCP runtime claim |
| Cost system | CostRouter, CostReporter, route/cost/cache trajectory, Pro admission ledger | Makes model choice, cost, cache, and escalation reasons visible | GitHub copy uses only recorded data |
| Evidence system | Evidence dashboard, release claim binder, blocked-claim corpus, raw evidence manifests | Makes features, tests, costs, failures, and release claims auditable | External comparison claims stay blocked without paired raw evidence |
| TUI trust surface | Goal, plan, tool, permission, cost, recovery, background task, and final report projection | Lets users see the AI working like a senior engineer instead of a black box | UI displays real runtime state only |
| Coding capability | Source truth, patch planner, edit lifecycle, static analysis, focused tests, final patch report | Supports bugfix, feature work, refactors, test repair, and engineering reports | Tests prove behavior; they do not replace functional judgment |
| Testing and release | Six-stage tests, senior coding window, fresh install smoke, clean export, and secret scan | Proves function, experience, recovery, performance, evaluation, and release gates before publishing | Current status is release-candidate, not a public 95-point claim |

## Why DSXU Exists

Raw model APIs are powerful, but real software work needs more than a single chat completion. DSXU focuses on the missing engineering loop:

- Find source truth before editing.
- Keep the user goal, current action, risks, and next step visible.
- Run tools through one Tool Gate and Permission Gate.
- Recover from failed commands and failed tests instead of hiding them.
- Keep DeepSeek Flash as the default route, with Pro admitted only when evidence says it is needed.
- Record route, cost, cache, tool results, artifacts, and final evidence so results can be audited.

## Evidence Snapshot

Full public function and test matrix: `docs/product/DSXU_PUBLIC_FEATURE_TEST_MATRIX_20260522_CN.md`.

![DSXU routing mix](docs/assets/dsxu-routing-mix.svg)

![DSXU acceptance evidence](docs/assets/dsxu-acceptance-evidence.svg)

![DSXU public challenge ablation](docs/assets/dsxu-public-challenge-ablation.svg)

![DSXU release readiness](docs/assets/dsxu-release-readiness.svg)

| Area | Current evidence |
|---|---:|
| Full repo regression | 3075 pass / 1 skip / 0 fail across 434 test files |
| Fixed benchmark/task catalog | 26 packs / 98 cases |
| Selected public demo tasks | 10 |
| Flash-first route catalog | 94/98 fixed route cases default to `deepseek-v4-flash` |
| Senior coding window | 30.48 minutes, 33 DSXU product-entry runs, 32 structured review rounds, final fixture test passed |
| Senior window model/cost | `deepseek-v4-flash` only, Pro not used, about $0.3617 in Flash cost |
| Complex task acceptance | PASS, Flash-only review path, Pro not used |
| Six-stage final tests | 22/22 command batches passed |
| DSXU release gate tests | 531 pass / 0 fail after V2/V3 finalization closeout |
| Training V1 reality run | PASS, 23 steps, 13 gates passed, 0 failed; public claim remains blocked |
| Training V2 evidence flywheel | PASS internal flywheel; uses DSXU evidence/trajectory plumbing, not a public training-quality claim |
| Latest real-task hit-rate pack | 24/24 final PASS; 0% first-attempt PASS; 100% second-attempt recovery; Flash-only; cache hit 64.1%; total cost $0.198944 |
| Internal replay hit-rate gate | 100/100 final PASS; tool hit 100%; recovery success 100%; average cache hit 80.7%; 9/9 Pro admissions justified |
| SWE internal smoke | 5/5 internal smoke instances passed; not a public benchmark score |
| V10 final reality evidence | Reachability, golden replay 77 cases, ablation, long task, provider dry smoke, agent/tool pairing, cache/cost, localized feedback, TUI trust surface, and final dashboard all PASS |
| V8 final acceptance | PASS in focused contracts, real PTY subset, TUI core, release-surface owner tests, scoped live replay, and six-stage final |
| Interactive TUI acceptance | 7/7 scenarios passed |
| Release/export public surface policy | PASS in focused release-surface tests; internal evidence docs are excluded or require rewrite |
| Clean export artifact | `PASS_CLEAN_EXPORT_ARTIFACT_CREATED`; latest run exports the release surface and records exact zip path, size, and SHA-256 in `docs/generated/DSXU_V24_CLEAN_EXPORT_ARTIFACT_20260515.json`; secret scan PASS |
| Fresh install smoke | `PASS_FRESH_INSTALL_HELP_DOCTOR_PROVIDER_SMOKE`; 8/8 commands passed from the clean export |
| Runtime health / final preflight | runtime health PASS; final preflight PASS with `canCreateCleanExport=true` |
| Brand / compatibility risk board | `DONE_EVIDENCED`; public surface blockers 0, runtime cleanup candidates 0 |
| V2/V3 finalization closeout | Original 14 non-pass cases closed 14/14; remaining 16 raw API baseline captured 16/16; 30-case DSXU raw evidence import ready 30/30 |
| Cache live A/B proof | `PASS_CACHE_LIVE_AB`; repeated stable-prefix lane reached 99.6% hit rate on rounds 2/3; internal tuning proof only |
| P12 raw readiness | PASS with 14/14 paired raw logs for the P12 readiness lane |
| Evidence dashboard | `trust=evidence-incomplete`, pass=159, fail=0, blocked=0, claimBlocked=1, notRun=0, scoreFloor=72, releaseClaimAllowed=false |
| Public claim score floor | 72, so public 90/95 claims remain blocked |
| Public comparable DSXU lane | 30/30 DSXU raw evidence ready; external target/reference transcripts are still missing, so external comparison remains blocked |

## GitHub-Safe Product Story

The latest evidence supports this public positioning:

- **DeepSeek-first engineering runtime:** DSXU is not a thin chat wrapper. It wraps DeepSeek calls with source truth, tool gates, permission decisions, route/cost/cache evidence, recovery loops, and release claim guards.
- **Flash-first cost discipline:** The 30.48-minute senior coding window completed on `deepseek-v4-flash` only, without Pro, at about $0.3617 in recorded Flash cost.
- **Long-task engineering proof:** The senior window sustained 33 DSXU product-entry runs, 32 structured review rounds, real edit/test recovery, and a final passing fixture test.
- **Release workflow proof:** Full repo regression is green, six-stage final is green, release gate tests are green, and V10 reality evidence is green.
- **V2/V3 finalization proof:** DSXU closed the prior 14-case finalization gap, captured the remaining 16 raw API baselines, and imported 30/30 DSXU public-comparable raw evidence.
- **Cache-first DeepSeek proof:** V3 cache work now has dry-run safety plus a live repeated-prefix A/B showing 99.6% cache hit after warmup in that controlled lane.
- **Release-candidate package proof:** The current clean export artifact was created, scanned, and then used for an 8/8 fresh-install smoke.
- **Brand/claim hygiene:** the current public surface has 0 brand blockers and the blocked-claim corpus keeps unsupported parity/95/external-win wording out of release copy.
- **Evidence honesty:** DSXU intentionally blocks public 90/95 and external benchmark claims when paired raw evidence is missing, even when internal smoke and release gates pass.
- **Open-source readiness direction:** DSXU can be published as a release-candidate product with clear evidence boundaries, not as a public leaderboard claim.
- **Benchmark work stays separate:** the 30-case DSXU raw lane is ready, but same-case external target/reference transcripts remain a dedicated benchmark workstream and do not block the honest release-candidate story.

## Cost And Context Ablation

DSXU has same-task before/after evidence showing that source capsules, no-Read default, route latching, and tool-result hygiene reduced cost and context bloat without lowering the score floor.

| Metric | Before | After | Result |
|---|---:|---:|---:|
| Score floor | 72 | 72 | no regression |
| Total cost USD | 0.0716986596 | 0.0098987224 | 86.2% lower |
| Cache hit rate | 45.5% | 65.4% | +19.9 points |
| Read tool calls | 28 | 0 | removed |
| Tool result chars | 316381 | 0 | removed from model context |
| Pro requests | 6 | 0 | removed in this lane |

This is an internal DSXU ablation, not an external benchmark win claim.

## Public Demo Tasks

These are the current GitHub-facing demos. They are chosen to show task complexity, not to inflate a benchmark claim.

| Demo | What it proves | Evidence |
|---|---|---|
| Senior coding repair | DSXU can sustain a 30-45 minute coding window with real dispatches and a final test | `bun run acceptance:senior-coding-window` |
| Operator-visible TUI state | Permission fallback, recovery, compact resume, background task, and model progress can be replayed | `bun run acceptance:interactive-tui` |
| Fixed task catalog | DSXU uses a replayable catalog instead of ad hoc demos | `bun run benchmark:product-data` |
| Cost/cache ablation | Same-task quality held while cost and tool-result bloat dropped | `bun run public-challenge:ablation` |
| Six-stage release proof | Function, experience, recovery, performance, evaluation, and release closure checks all pass | `bun run test:six-stage-final` |
| Clean install | Exported package installs, shows help, configures key flow, runs doctor, MCP doctor, and provider gate | `bun run release:fresh-install-smoke` after a fresh clean export artifact |

## What DSXU Adds To DeepSeek

- **DeepSeek-first routing:** Flash by default; Pro requires explicit admission evidence.
- **Source-truth coding loop:** Search, anchor, bounded read, patch, focused test, repair, final report.
- **Visible work-state:** Goal, plan, current action, permission, tool result, cost, cache, failure, recovery, and next action are projected from the same evidence stream.
- **Tool and permission lifecycle:** Local tools, MCP tools, skills, and agent workers stay behind DSXU-owned gates.
- **Context and cache discipline:** Large tool results are summarized or persisted as artifacts instead of flooding the model context.
- **Recovery-first execution:** Failed commands and failed tests are classified, repaired, rerun, and reported.
- **Agent and skill boundaries:** Agent/MCP/skill outputs become bounded evidence envelopes, not second runtimes.
- **Release evidence:** Clean export, secret scan, fresh install smoke, launch pack, and claim guards are part of the product workflow.

## Install

```bash
bun install
```

Configure DeepSeek access with environment variables or the built-in auth flow:

```env
DSXU_CODE_MODE=1
DSXU_MODEL_PROVIDER=deepseek
DSXU_MODEL_GATEWAY=direct
DSXU_API_KEY=your_key_here
DSXU_MODEL=deepseek-v4-flash
```

You can also run:

```bash
bun ./src/entrypoints/dsxu-code.tsx auth login
```

Release artifacts must not contain a real API key. The clean export secret scan currently passes with `PASS_NO_RUNTIME_SECRET_VALUES_IN_EXPORT`.

## Run

Interactive CLI/TUI:

```bash
bun run dsxu-code
```

Print-mode task:

```bash
bin/dsxu-code -p "summarize this repo"
```

Tool-enabled task:

```bash
bin/dsxu-code -p --tools Read,Edit,Bash --allowedTools Read,Edit,Bash "read README.md and print the first heading"
```

Doctor and provider checks:

```bash
bun ./src/entrypoints/dsxu-code.tsx --help
bun ./src/entrypoints/dsxu-code.tsx mcp doctor --json
bun run live:provider-gate
```

## Verification

Focused checks:

```bash
bun test src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts
bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts
bun run public-challenge:ablation
```

Release checks:

```bash
bun run test:six-stage-final
bun run release:clean-export-artifact
bun run release:fresh-install-smoke
```

Release checks are intentionally slower than owner-focused tests. During development, run focused owner tests first; rerun the full release chain only after a release-facing batch is complete.

Evidence files:

- `docs/product/DSXU_PUBLIC_FEATURE_TEST_MATRIX_20260522_CN.md`
- `docs/generated/DSXU_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_20260518.json`
- `docs/generated/DSXU_V24_PRODUCT_BENCHMARK_DATA_PACK_20260515.json`
- `docs/generated/DSXU_PUBLIC_CHALLENGE_ABLATION_ACCEPTANCE_20260516.json`
- `docs/generated/DSXU_V24_SENIOR_CODING_WINDOW_20260515.json`
- `docs/generated/DSXU_V24_COMPLEX_TASK_ACCEPTANCE_20260515.json`
- `docs/generated/DSXU_V24_SIX_STAGE_FINAL_TESTS_20260515.json`
- `docs/generated/DSXU_V24_CLEAN_EXPORT_ARTIFACT_20260515.json`
- `docs/generated/DSXU_V24_FRESH_INSTALL_RELEASE_SMOKE_20260515.json`

## Data Still Needed

The next evidence pack should add a direct A/B comparison:

| Comparison | Needed data |
|---|---|
| Raw DeepSeek API baseline vs DSXU | Same tasks, same model, same prompt budget, success rate, turns, cost, cache hit, recovery, final evidence quality |
| Fixed public tasks | Manifest now exists at `docs/generated/DSXU_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_20260518.json`; the DSXU raw evidence lane is ready 30/30, while same-case external target/reference transcripts are still needed for comparison claims |
| Repeated cost/cache runs | Multiple same-task runs to show whether the cache/cost improvement is stable |
| External benchmark claims | Independent same-task raw logs before any public win/loss claim |
| Public-comparable SWE lane | The latest public-comparable attempt is blocked/crashed in the runner/raw-evidence lane and cannot be used as a benchmark score; see `docs/generated/DSXU_SWE_BENCH_RESULTS_20260520.json` |
| Post-policy clean export | Completed in the current release-candidate lane: clean export artifact PASS and fresh install smoke 8/8 PASS |
| Release-safe README snapshot | Public docs that cite evidence summaries without shipping internal DSXU audit, owner-review, generated evidence, or local absolute-path material |

Until that exists, DSXU should claim engineering-runtime improvements on top of DeepSeek, not model-level superiority.

## Claim Boundaries

Allowed:

- DSXU is a DeepSeek-first coding CLI/TUI with evidence-backed tool, permission, recovery, cost, and release workflows.
- DSXU has same-task internal ablation evidence showing lower cost and lower context bloat with no score-floor regression.
- DSXU has passed senior-coding-window, complex-task, six-stage, release-gate, training V1, and internal SWE smoke gates, with the stated boundaries.
- DSXU release/export policy now separates public docs/assets from internal audit and generated evidence docs.

Blocked:

- No public 90% or 95-point ability claim yet.
- No external model or product superiority claim yet.
- No public SWE benchmark score yet; the latest public-comparable lane is blocked/crashed and lacks the required paired raw evidence.
- No external public-comparable comparison claim yet; the DSXU lane is ready 30/30, but target/reference transcripts are still missing for the same 30 cases.
- No claim that internal task adapters equal public benchmark passes.
- No claim of standalone browser, MCP, IDE, or agent runtime outside DSXU gates.
- No copied reference-product parity, branding, source, prompt, or commercial behavior claim.

## Repository Map

```text
bin/dsxu-code                 DSXU CLI/TUI launcher
src/entrypoints/dsxu-code.tsx DSXU product entrypoint
src/services/api/             DeepSeek adapter and model API boundary
src/tools/                    tool runtimes and registry integration
src/services/mcp/             MCP client, registry, and adapter boundary
src/skills/                   skill discovery and bundled skills
src/dsxu/engine/              DSXU capability engine, contracts, evidence, tests
docs/assets/                  GitHub data charts
docs/generated/               machine-readable evidence reports
.dsxu/                        local operation state, excluded from release export
```

## Release Discipline

- Useful behavior lands in named DSXU mainline owners.
- Equivalent duplicate behavior is merged into the original owner or becomes a replace/delete candidate.
- Compatibility labels are evidence labels only, not product runtime holding paths.
- Public docs must cite source/test/live/raw/cost/cache evidence.
- New product names should use capability names, not historical audit-stage names.
