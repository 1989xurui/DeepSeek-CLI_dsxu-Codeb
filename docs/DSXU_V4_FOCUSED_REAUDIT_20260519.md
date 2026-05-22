# DSXU V4 Focused Re-audit - 2026-05-19

This record exists because acceptance tests alone cannot prove V4 completion. A command PASS only counts when the code path is present in the default owner chain and the result is visible to the model, user, final report, or API consumer.

## Audit Decision

| Area | Re-audit finding | Action |
|---|---|---|
| P3 Verification Envelope | FileWrite/FileEdit created post-mutation envelopes, but normal tool-result text still said "successfully" without exposing `finalClaimAllowed=false`, skipped/partial gates, or next verification action. This could let the model treat a partial mutation as finished. | Patched FileWrite/FileEdit tool result mapping to include compact DSXU verification state. |
| P4 Tool Envelope / ToolBus boundary | `ToolProtocolIntegration` is disabled by default, but status evidence did not clearly prove it is not the product ToolBus. It also had a real `legacy_` undefined fallback bug in legacy wrapper execution. | Patched `legacy_` fallback; added EngineHarness status fields proving Tool Protocol is an explicit owner evidence harness, not default product runtime. |
| P5 Long Task Ledger | Query loop generated progress ledger events, but final `QueryResult.metadata` did not carry the ledger/projection, so final report/API consumers could miss the same recovery evidence. | Patched query-loop final result metadata to carry `progressLedger` and `longTaskLedgerProjection`. |
| V4 launch blocker 1 | Tool selection existed, but GearBox boost could expand the default visible tool window beyond the launch hard cap without evidence. | Patched selector to enforce `visibleToolHardCap` by default and record `tool_subset_selected` plus long-task ledger evidence. |
| V4 launch blocker 2 | Prompt/cache break detection warned to console but did not enter the default ledger, so cache governance was not part of the same trust chain. | Patched cache-break path to append `DeepSeek Prompt/Cache Governance` cost-cache events with claim boundary. |
| V4 launch blocker 3 | FileWrite/FileEdit had verification envelopes, but Notebook writes and Bash simulated sed writes could still mutate files without returning the same Tool Gate / VerificationKernel state to the model-visible result. | Patched `NotebookEditTool` and `BashTool` simulated sed writes to emit post-mutation verification summaries and compact tool-result state. |
| V4 launch blocker 4 | GearBox had its own verify-failure recovery branch beside the progress-ledger `RECOVERY_DECISION_TABLE`, so recovery behavior could drift from ledger/final-report projection. | Patched `reportVerificationSummary()` to consume `projectVerificationRecoveryDecision()` and return GearBox decisions with `sourceRecoveryDecisionTable=true`. |
| V4 launch blocker 5 | Agent evidence was already implemented, but V4 needed default parent PASS proof rather than a module-exists claim. | Replayed agent boundary, parent final, query-loop, and prompt governance tests: uncited/partial/fake PASS is blocked; evidence-cited or honest partial finals are allowed. |
| V4 launch blocker 6 | Frozen experimental capabilities needed default-mainline proof, not just a generated register. | Rebuilt command catalog/freeze register and replayed Agent mode + Tool Protocol boundary tests; swarm/fork/voting/legacy ToolBus do not become default product runtime. |
| V4 launch blocker 7 | Trust UI had compact components, but V4 needed real-window proof for the reported resize/dialog failures rather than component-only PASS. | Replayed compact footer/message tests plus real PTY resize scenarios: long content stays pinned to tail, trust proof does not flood, permission review/dialog border remains visible, and middle scrollback does not snap to top or tail. |
| V4 launch blocker 8 | V4 still lacked a single 20+ real task hit-rate/cost/cache pack; older reports existed but were not joined into one launch-acceptance artifact. | Added an Evidence/benchmark owner pack that ingests real hard-engineering and raw-api-vs-dsxu stream-json traces, validates artifacts, and reports pass/recovery/cache/cost/tool-result metrics without creating an external benchmark claim. |
| Evidence Workbench completion risk | V4 status JSON was updated to `DELIVERY_PARTIAL`, but the dashboard still summarized V4 as `PASS` from old P0-P8 stage counts. | Patched dashboard V4 aggregation to honor launch acceptance blockers; dashboard now reports `v4Consolidation=PASS launch=8/8`, while public/release claims remain blocked by separate evidence gates. |

## Focused Verification

| Command | Result |
|---|---|
| `bun test src/dsxu/engine/__tests__/post-mutation-verification-envelope.test.ts` | PASS: 5 tests / 40 expects |
| `bun test src/coordinator/tdd-gate/__tests__/gate.test.ts` | PASS: 6 tests / 21 expects |
| `bun test src/services/static-analysis/__tests__/bridge.test.ts` | PASS: 12 tests / 33 expects |
| `bun test src/dsxu/engine/__tests__/tool-protocol/consistency.test.ts` | PASS: 17 tests / 123 expects |
| `bun test src/dsxu/engine/__tests__/engine.test.ts` | PASS: 7 tests / 43 expects |
| `bun test src/dsxu/engine/__tests__/work-package-e/query-loop-profile.test.ts` | PASS: 3 tests / 18 expects |
| `bun test src/dsxu/engine/__tests__/prompt-prefix-cache-builder.test.ts src/dsxu/engine/__tests__/prompt-prefix-cache-evidence.test.ts src/dsxu/engine/__tests__/route-cache-dynamic-tail.test.ts src/dsxu/engine/__tests__/route-cache-roi-smoke.test.ts` | PASS: 13 tests / 98 expects |
| `bun test src/dsxu/engine/__tests__/v4-edit-lifecycle.test.ts` | PASS: 2 tests / 12 expects |
| `bun test src/dsxu/engine/__tests__/gear-box.test.ts` | PASS: 11 tests / 30 expects |
| `bun test src/dsxu/engine/__tests__/work-package-i/progress-ledger.test.ts` | PASS: 28 tests / 149 expects |
| `bun test src/dsxu/engine/__tests__/gear-box-recovery-link-v1.test.ts` | PASS: 5 tests / 13 expects |
| `bun test src/dsxu/engine/__tests__/verify-gate.test.ts` | PASS: 11 tests / 24 expects |
| `bun test src/dsxu/engine/__tests__/agent-mcp-skill-boundary-board.test.ts` | PASS: 6 tests / 30 expects |
| `bun test src/dsxu/engine/__tests__/agent-parent-final-gate-replay-v1.test.ts` | PASS: 1 test / 10 expects |
| `bun test src/dsxu/engine/__tests__/direct-connect-and-query-contract-v1.test.ts -t "parent final gate"` | PASS: 2 tests / 4 expects |
| `bun test src/dsxu/engine/__tests__/prompt-governance-contract.test.ts -t "Agent parent final gate"` | PASS: 4 tests / 13 expects |
| `bun test scripts/__tests__/dsxu-command-catalog.test.ts` | PASS: 4 tests / 39 expects |
| `bun run scripts/dsxu-command-catalog.ts` | PASS: freeze register entries=10 |
| `bun test src/dsxu/engine/__tests__/agent-orchestration-mode-v1.test.ts` | PASS: 5 tests / 31 expects |
| `bun test src/dsxu/engine/__tests__/tool-protocol/consistency.test.ts -t "Tool Protocol"` | PASS: 3 tests / 19 expects |
| `bun run scripts/dsxu-evidence-dashboard.ts` | PASS: reports `v4Consolidation=BLOCKED completed=9/9 launch=6/8` |
| `bun test scripts/__tests__/dsxu-evidence-dashboard.test.ts` | PASS: 7 tests / 33 expects |
| `bun test src/dsxu/engine/__tests__/work-package-i/progress-ledger.test.ts` | PASS: 28 tests / 149 expects |
| `bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts` | PASS: 10 tests / 74 expects |
| `bun test src/dsxu/engine/__tests__/agent-mcp-skill-boundary-board.test.ts` | PASS: 6 tests / 30 expects |
| `bun test src/dsxu/engine/__tests__/agent-parent-final-gate-replay-v1.test.ts` | PASS: 1 test / 10 expects |
| `bun test src/components/messages/__tests__/SystemTextMessage-evidence-line.test.ts` | PASS: 4 tests / 4 expects |
| `bun test src/components/PromptInput/__tests__/PromptInputFooter-trust.test.ts` | PASS: 7 tests / 26 expects |
| `bun test src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts -t "resize"` | PASS: 4 tests / 77 expects; real PTY resize/dialog regression |
| `bun test scripts/__tests__/dsxu-v4-real-task-hit-rate-pack.test.ts` | PASS: 2 tests / 8 expects |
| `bun run scripts/dsxu-v4-real-task-hit-rate-pack.ts` | PASS: 24 real trace-backed cases, finalPassRatePct=95.8, cacheHitRatePct=64.9, totalCostUsd=0.176034 |

## Claim Boundary

Current allowed claim: focused V4 owner re-audit patched three default-chain trust gaps, then closed 8/8 launch-acceptance blockers in the default query-loop, mutation, recovery, agent parent-final, product-core freeze, Trust UI, and Evidence/benchmark paths: visible tool hard cap, prompt/cache governance ledger evidence, unified edit lifecycle coverage for FileWrite/FileEdit/Notebook/Bash simulated sed writes, GearBox verification recovery through the single `RECOVERY_DECISION_TABLE`, Agent Evidence Envelope parent PASS gating, frozen experimental capability enforcement, focused real PTY resize/dialog Trust UI regression, and a 24-case real trace-backed hit-rate/cost/cache pack. Evidence Workbench now reports V4 launch acceptance as `launch=8/8`, while public/release claims remain separately blocked until release claim and public comparable raw evidence gates are satisfied.

Not allowed from this focused pass alone:

- V4 public release fully complete.
- 90/95 public benchmark ready.
- Full all-scenario TUI interaction regression passed.
- Full `bun test` passed.
- Public comparable benchmark raw evidence is ready.
- README/data/chart release claims are bound to final raw evidence.
