# DSXU V6 Independent Completion Audit - 2026-05-19

Role:上线审核者 / 反向验收。  
Scope: `docs/DSXU_V6_DEEPSEEK_NATIVE_ENGINEERING_RUNTIME_20260519_CN.md` and V6 code/evidence artifacts.  
Rule: do not treat documentation, unit tests, smoke scripts, or internally generated replay data as real public capability proof.

## Audit Verdict

V6 is **architecture-contract ready** for the core DSXU-owned runtime gates. It is **not yet public-performance complete**.

The implementation is not empty and most V6 owner contracts are real code/tests, but several PASS labels are only structural/internal evidence. The highest fake-completion risk is WP11 replay/hit-rate: it proves the replay gate and evidence schema, not real DeepSeek live senior-coding ability.

## Focused Verification Rerun

Rerun command:

```bash
bun test scripts/__tests__/dsxu-v6-replay-bank.test.ts src/dsxu/engine/__tests__/execution-contract-compiler.test.ts src/dsxu/engine/__tests__/tool-view-compiler.test.ts src/dsxu/engine/__tests__/model-router-cost-policy.test.ts src/dsxu/engine/__tests__/proof-carrying-edit.test.ts src/components/__tests__/tui-trust-surface.test.tsx
```

Result: `22 pass / 0 fail / 119 expect() calls`.

Provider probe rerun:

```bash
bun run scripts/dsxu-v6-live-provider-probe.ts --live
```

Result: `PASS_V6_DEEPSEEK_PROVIDER_CONTRACT`, `mode=live`, `checkCount=5`, `blockers=[]`.

## Reverse Evidence Table

| Work Package | Evidence Type | Audit Decision | Why |
| --- | --- | --- | --- |
| WP0 Truth Matrix Gate | real static repo audit | implemented+focused-tested | It scans repository capability classification and blocks default-mainline exposure for experiment/frozen/historical rows. It does not mutate or reduce dirty count. |
| WP1 DeepSeek Provider Contract | live provider basic probe + unit contract | implemented as live-basic; not full live replay | `scripts/dsxu-v6-live-provider-probe.ts --live` now proves one real DeepSeek Flash request, response marker, usage/cache fields, estimated cost, and redacted key evidence. It still does not prove live tool-call replay or failure/retry quality. |
| WP2 Task Contract Compiler | source code + focused tests | implemented+focused-tested | `action-contract.ts` compiles task/risk/route/claim policy and projects route/claim into ledger events. |
| WP3 Tool View + Strict Schema | source code + focused tests | implemented+focused-tested | `tool-catalog-v1.ts` caps visible tools and rejects planned hidden tools. Strict schema tests prove DeepSeek-safe flat schema conversion. |
| WP4 Model Router + Cost Policy | focused tests + modeled/internal cost report | implemented structurally; public cost proof not complete | Route/cost policy tests are real. `senior-40` report uses internal/modeled evidence and explicitly says it is not a public benchmark score. |
| WP5 Active Frame + Durable Ledger | source code + smoke | implemented+focused-tested | Ledger can recover after failed verification and keep final claim blocked. Smoke is local, not a full long live task proof. |
| WP6 Proof-Carrying Edit | source code + focused tests | implemented+focused-tested | Not-run/fail verification blocks final claim; passed verification allows focused claim. Full cross-tool live edit coverage remains a later acceptance layer. |
| WP7 Recovery Decision Table | source code + focused tests | implemented+focused-tested | Stall/failure decisions are non-claiming and ledger-backed. This is a decision table proof, not a full chaos/recovery live run. |
| WP8 Agent Evidence Handoff | focused tests | implemented+focused-tested | `agentToolResultSchema` has been moved into owner-local `agentToolSchemas.ts`, fixing the AgentTool initialization cycle while keeping compact evidence inside DSXU AgentTool owner boundaries. It does not prove standalone swarm/runtime capability, and should not claim that. |
| WP9 Context / Cache Strategy | focused tests + synthetic pressure report | implemented+focused-tested | Preserves active-frame obligations under 70/85/95/99 pressure and artifacts large tool output. Cache hit claims still require raw provider usage for public numbers. |
| WP10 TUI Trust Surface | render/snapshot tests | partial-live | Compact trust lines, no-verify blocked state, and width cap are tested. This is not a real PTY resize/live-window acceptance. |
| WP11 Replay Bank + Hit Rate | internally generated replay cases | contract pass only; real ability not proven | `scripts/dsxu-v6-replay-bank.ts` generates 100 deterministic cases and sets `finalPass: true`; cost/cache/wall-clock are modeled. This cannot prove real 90% senior coding ability. |
| WP12 Owner Cleanup | real static owner cleanup audit | analysis-only owner/action gate | Truth matrix now resolves `src/...` alias imports. It does not use docs references to erase unclassified status. Current broad core unclassified is 74, total unclassified is 218; owner cleanup assigns owner/action and blocks claims only. It does not perform Git review, deletion, staging, cleanup mutation, or final merge/delete decisions. |

## Hard Findings

1. WP11 originally used a dangerously broad hit-rate status name.
   It has now been tightened to `PASS_V6_INTERNAL_REPLAY_HIT_RATE_GATE` and `PASS_V6_INTERNAL_REPLAY_CONTRACT_GATE`. These statuses mean internal replay contract readiness only, not real/live/public 90% ability proof.

2. WP1 live provider proof is now live-basic complete.
   `scripts/dsxu-v6-live-provider-probe.ts --live` proves one fixed DeepSeek Flash live request, response marker, usage/cache fields, and estimated cost with redacted key evidence. It still does not prove live tool-call replay, failure/retry behavior, or full model-quality performance.

3. WP10 is not a full real-window acceptance.
   The V6 TUI test proves compact rendering behavior, not terminal resize, scroll anchoring, permission popup visibility, or live DSXU interaction under long output.

4. WP11 metrics are generated evidence, not measured external performance.
   `finalPassRatePct=100`, `totalCostUsd=$0.08352`, and `averageCacheHitRatePct=80.7%` are valid for internal replay-schema readiness only. They must not appear in GitHub as public benchmark data.

5. WP12 does not reduce `git status`.
   It proves owner/action assignment and claim blocking, but the worktree still needs owner/Git mutation review before dirty count can drop.

## No Second-Mainline Findings

No V6-specific package.json product entrypoint was found in this audit. V6 scripts remain evidence/check scripts. The main code changes found by focused audit fold into existing owners: `action-contract.ts`, `tool-catalog-v1.ts`, DeepSeek provider contract tests, Agent evidence, ledger/recovery/proof/context/TUI tests.

## Completion Classification

| Completion Layer | Status |
| --- | --- |
| V6 architecture contracts | mostly complete |
| V6 focused unit/contract tests | pass for sampled critical set |
| V6 dry-run provider shape | complete |
| V6 real DeepSeek live provider proof | live-basic complete; live tool/failure replay still missing |
| V6 real PTY/TUI live-window proof | not complete |
| V6 internal replay/hit-rate gate | complete as internal contract |
| V6 public 90% / external comparison claim | blocked |
| V6 clean release readiness | blocked by external/live evidence and workspace/Git closure |

## Next Correct Actions

1. Rename or re-bound WP11 public wording in any README/GitHub material: use `internal V6 replay gate`, not `senior-engineering hit rate` as public evidence.
2. Extend the live provider packet when cost-approved: add one live tool-call task and one failure/retry task, with raw request/response redacted and usage/cache/cost recorded.
3. Run a real PTY/TUI V6 acceptance: long output, resize, scroll anchoring, permission popup, trust footer, final report evidence.
4. Keep WP0-WP12 as owner-contract complete, but do not mark V6 public-complete until live tool/failure provider replay + live TUI + external paired raw benchmark are present.
