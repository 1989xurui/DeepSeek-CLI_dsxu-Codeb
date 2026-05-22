# DSXU V4 Complexity Risk Register - 2026-05-18

Status: PASS_DSXU_V4_COMPLEXITY_RISK_REGISTER_READY

| riskId | riskClass | status | stage | currentOwner | risk | requiredAction | activeSignals |
| --- | --- | --- | --- | --- | --- | --- | --- |
| V4-R01 | second-provider | open | P1 | Provider Plan owner | Second provider request body builder can drift from DeepSeek thinking/tool contract. | P1 must prove all DeepSeek chat/tool/thinking bodies route through canonical owner helper. | `src/services/api/deepseek-adapter.ts`<br>`src/dsxu/engine/api-service.ts`<br>`src/dsxu/engine/model-gateway-v1.ts` |
| V4-R02 | second-toolbus | watch | P4 | Tool Envelope owner | Legacy ToolBus and canonical ToolCallResult can coexist as competing contracts. | P4 must keep legacy/provider/MCP shapes normalized at Tool Gate before ledger/recovery/TUI. | `src/dsxu/engine/tool-protocol.ts`<br>`src/dsxu/engine/tool-bus`<br>`src/services/tools/toolLifecycle.ts` |
| V4-R03 | second-agent | contained | P6 | Agent Evidence Handoff owner | Swarm/forked agent paths can become a second agent orchestrator. | P6 must keep agent modes to serial worker or disjoint fanout evidence packets. | `src/tools/AgentTool`<br>`src/utils/swarm`<br>`src/utils/forkedAgent.ts` |
| V4-R04 | second-tui | open | P7 | Trust UI owner | TUI can render separate local state instead of consuming work-state/ledger evidence. | P7 must prove TUI/CLI/stream-json/final report consume the same compact projection. | `src/screens/REPL.tsx`<br>`src/components/PromptInput`<br>`src/components/messages`<br>`src/query.ts` |
| V4-R05 | prompt-stack | open | P2 | DeepSeek route/cost/cache owner | Multiple prompt stacks can inflate prompt and break DeepSeek prefix cache. | P2 must lock stable prefix, move volatile runtime facts to dynamic tail, and explain cache epoch changes. | `src/dsxu/engine/prompt-prefix-cache-builder.ts`<br>`src/dsxu/engine/prompt-processing-v1.ts`<br>`src/dsxu/engine/system-prompt-builder-v1.ts` |
| V4-R06 | script-surface | contained | P0 | Evidence / release claim binder owner | Package script surface is too large for public product claims. | P0 command catalog classifies product-runtime, validation, release-only, owner-review, live-provider, historical evidence, and utilities. | `package.json`<br>`scripts/dsxu-command-catalog.ts` |
| V4-R07 | claim-inflation | open | P8 | Evidence / release claim binder owner | Mock/internal smoke can be promoted into a public 90/95 or formal benchmark claim. | P8 must require comparable raw transcript, tool trace, cost/cache, and failure-recovery evidence before public claim. | `scripts/dsxu-evidence-dashboard.ts`<br>`docs/generated/DSXU_EVIDENCE_DASHBOARD_20260518.json`<br>`README.md` |
| V4-R08 | second-runtime | open | P5 | Recovery Decision owner | Recovery variants can disagree on retry/replan/rollback/abort. | P5 must expose one Recovery Decision Table and write decisions into ledger/TUI/final report. | `src/dsxu/engine/gear-box.ts`<br>`src/dsxu/engine/recovery`<br>`src/query.ts` |
| V4-R09 | second-runtime | open | P3 | Verification Envelope owner | Verification can remain advisory while final answer says PASS. | P3 must make mutation verification envelope visible and final claim gate reject unverified PASS. | `src/coordinator/tdd-gate/post-write-hook.ts`<br>`src/services/static-analysis/tool-gate.ts`<br>`src/dsxu/engine/post-mutation-verification-envelope.ts` |

## Rule

Complexity risks are controlled by folding work into the existing V4 product core owners. A risk marked contained still requires later-stage focused acceptance before release claims.
