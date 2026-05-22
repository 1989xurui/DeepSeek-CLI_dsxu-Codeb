# DSXU Command Catalog - 2026-05-18

Status: PASS_DSXU_COMMAND_CATALOG_READY

Script count: 124

## Mainline Aliases

- evidence:dashboard
- benchmark:swe-bench
- health:runtime
- cache:warm

## Owner-Focused Verification Groups

| group | owner | testTier | timeoutBudgetMs | liveProvider | claimBoundary | purpose | commands |
| --- | --- | --- | --- | --- | --- | --- | --- |
| tool-runtime-event-boundary | Tool Gate / Tool Result Contract owner | mainline | 60000 | false | source-test-evidence-only | prove legacy provider tool_result blocks normalize to canonical ToolCallResult, ledger event, and work-state event without a second tool runtime | `bun test src/dsxu/engine/__tests__/tool-lifecycle-contract-v1.test.ts`<br>`bun test src/dsxu/engine/__tests__/tool-protocol/consistency.test.ts -t "provider"`<br>`bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts -t "canonical ToolCallResult"` |
| verification-recovery-ledger | VerificationKernel / Recovery / GearBox owner | mainline | 60000 | false | source-test-evidence-only | prove verification policy, recovery decision, long-task ledger, and final-claim boundary share one evidence projection | `bun test src/dsxu/engine/__tests__/work-package-i/progress-ledger.test.ts`<br>`bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts -t "long-task ledger"`<br>`bun test src/dsxu/engine/__tests__/verify-gate.test.ts`<br>`bun test src/dsxu/engine/__tests__/query-loop-gate-state-v1.test.ts` |
| mainline-tool-permission-agent-skill | Tool Gate / Permission / Agent / MCP-Skill owner | mainline | 60000 | false | source-test-evidence-only | prove default tools, permission callbacks, agent handoff, MCP/Skill registry, and shell adapters stay on the DSXU mainline | `bun test src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts`<br>`bun test src/dsxu/engine/__tests__/agent-runtime-mainline-v1.test.ts src/dsxu/engine/__tests__/skill-governance-contract-v1.test.ts` |
| tui-trust-projection | TUI work-state / trust projection owner | acceptance | 180000 | false | live-required | prove visible work-state, compact tool cards, ledger/agent panel, EvidenceLine, context advanced view, and resize behavior consume mainline evidence | `bun test src/components/PromptInput/__tests__/PromptInputFooter-trust.test.ts`<br>`bun test src/components/messages/UserToolResultMessage/__tests__/utils.test.ts`<br>`bun test src/components/messages/__tests__/SystemTextMessage-evidence-line.test.ts`<br>`bun test src/commands/context/__tests__/context-advanced.test.ts`<br>`bun test src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts -t "preserves a middle scrollback"` |
| release-trust-evidence | Evidence / release claim binder owner | release-only | 180000 | false | release-only | prove dashboard, command catalog, release gates, public-comparable boundaries, and README claim evidence remain honest | `bun test scripts/__tests__/dsxu-command-catalog.test.ts scripts/__tests__/dsxu-evidence-dashboard.test.ts`<br>`bun run scripts/dsxu-command-catalog.ts`<br>`bun run evidence:dashboard` |

## Category Summary

| category | count |
| --- | --- |
| product-runtime | 3 |
| mainline-validation | 15 |
| release-only | 9 |
| owner-review | 12 |
| historical-evidence | 56 |
| internal-benchmark | 4 |
| live-provider | 8 |
| toolchain | 4 |
| supporting-utility | 13 |

## Command Boundaries

| script | category | owner | publicClaimUse | reason |
| --- | --- | --- | --- | --- |
| acceptance:c2-loop | mainline-validation | Acceptance / verification owner | allowed-with-evidence | validation command; output can support claims only when raw evidence is generated and current |
| acceptance:complex-task | mainline-validation | Acceptance / verification owner | allowed-with-evidence | validation command; output can support claims only when raw evidence is generated and current |
| acceptance:interactive-tui | mainline-validation | Acceptance / verification owner | allowed-with-evidence | validation command; output can support claims only when raw evidence is generated and current |
| acceptance:live | mainline-validation | Acceptance / verification owner | allowed-with-evidence | validation command; output can support claims only when raw evidence is generated and current |
| acceptance:senior-coding-window | mainline-validation | Senior coding live acceptance owner | allowed-with-evidence | mainline validation alias; claim text must cite generated evidence output |
| acl:closure-plan | owner-review | Owner/Git review and external input owner | blocked-as-claim | closure or external-input workflow; must not be promoted to a user-facing feature claim |
| acl:preflight | owner-review | Owner/Git review and external input owner | blocked-as-claim | closure or external-input workflow; must not be promoted to a user-facing feature claim |
| agent-mcp-skill:acceptance | supporting-utility | Supporting script owner | operator-only | not part of the four mainline aliases; use only through owner-specific evidence |
| agent:orchestration-evidence | supporting-utility | Supporting script owner | operator-only | not part of the four mainline aliases; use only through owner-specific evidence |
| audit:dsxu:health | supporting-utility | Supporting script owner | operator-only | not part of the four mainline aliases; use only through owner-specific evidence |
| benchmark:hard-engineering | internal-benchmark | Evidence / benchmark owner | internal-only | benchmark runner; public comparison claim requires real paired raw evidence and claim binder approval |
| benchmark:product-data | internal-benchmark | Evidence / benchmark owner | internal-only | benchmark runner; public comparison claim requires real paired raw evidence and claim binder approval |
| benchmark:public-challenge | internal-benchmark | Evidence / benchmark owner | internal-only | benchmark runner; public comparison claim requires real paired raw evidence and claim binder approval |
| benchmark:raw-api-vs-dsxu | internal-benchmark | Evidence / benchmark owner | internal-only | benchmark runner; public comparison claim requires real paired raw evidence and claim binder approval |
| benchmark:swe-bench | mainline-validation | Evidence / internal SWE-bench owner | allowed-with-evidence | mainline validation alias; claim text must cite generated evidence output |
| cache:warm | mainline-validation | DeepSeek route/cost/cache owner | allowed-with-evidence | mainline validation alias; claim text must cite generated evidence output |
| capability:acceptance-audit | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| capability:cost-crosswalk | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| clean-export:preflight | release-only | Release / clean export / compliance owner | operator-only | release gate command; not a product capability claim by itself |
| commercial-ip:preflight | release-only | Release / clean export / compliance owner | operator-only | release gate command; not a product capability claim by itself |
| deepseek:cost-quality | supporting-utility | Supporting script owner | operator-only | not part of the four mainline aliases; use only through owner-specific evidence |
| dsxu | product-runtime | CLI/TUI product runtime owner | allowed-with-evidence | product launch surface; behavior must project through DSXU main query loop and work-state |
| dsxu-code | product-runtime | CLI/TUI product runtime owner | allowed-with-evidence | product launch surface; behavior must project through DSXU main query loop and work-state |
| evidence:agent-mcp-skill-boundary | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| evidence:blocked-claim-corpus | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| evidence:brand-compat-risk | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| evidence:c2-1902-join | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| evidence:c2-capability-loss-board | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| evidence:c2-owner-implementation-acceptance | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| evidence:c2-public-claim-closure | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| evidence:capability-acceptance-audit | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| evidence:capability-cost-crosswalk | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| evidence:claim-boundary | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| evidence:completed-reacceptance | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| evidence:dashboard | mainline-validation | Evidence / release claim binder owner | allowed-with-evidence | mainline validation alias; claim text must cite generated evidence output |
| evidence:deepseek-cost-quality | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| evidence:execution-batch | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| evidence:experience-loop-audit | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| evidence:external-benchmark-adapter-proof | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| evidence:hard-engineering | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| evidence:naming-governance | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| evidence:public-challenge-ablation | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| evidence:raw-api-vs-dsxu | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| evidence:reference-experience-reverse-analysis | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| evidence:reference-mechanism-audit | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| evidence:reference-scenario-backlog | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| evidence:reference-scenario-convergence | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| evidence:source-cache-acceptance | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| evidence:terminal-live-acceptance | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| evidence:visible-state-acceptance | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| external-benchmark-adapter:proof | supporting-utility | Supporting script owner | operator-only | not part of the four mainline aliases; use only through owner-specific evidence |
| health:runtime | mainline-validation | Doctor / release preflight owner | allowed-with-evidence | mainline validation alias; claim text must cite generated evidence output |
| lint-schema | toolchain | Toolchain / schema owner | operator-only | developer maintenance command; keep outside product capability claims |
| live:agent-parent-synthesis-smoke | live-provider | DeepSeek provider live gate owner | allowed-with-evidence | live provider proof; evidence must redact secrets and distinguish model lane/cost/cache |
| live:cache-prefix-smoke | live-provider | DeepSeek provider live gate owner | allowed-with-evidence | live provider proof; evidence must redact secrets and distinguish model lane/cost/cache |
| live:flash-first-recovery-smoke | live-provider | DeepSeek provider live gate owner | allowed-with-evidence | live provider proof; evidence must redact secrets and distinguish model lane/cost/cache |
| live:flash-smoke | live-provider | DeepSeek provider live gate owner | allowed-with-evidence | live provider proof; evidence must redact secrets and distinguish model lane/cost/cache |
| live:planning-flash-max-smoke | live-provider | DeepSeek provider live gate owner | allowed-with-evidence | live provider proof; evidence must redact secrets and distinguish model lane/cost/cache |
| live:pro-planning-smoke | live-provider | DeepSeek provider live gate owner | allowed-with-evidence | live provider proof; evidence must redact secrets and distinguish model lane/cost/cache |
| live:provider-gate | live-provider | DeepSeek provider live gate owner | allowed-with-evidence | live provider proof; evidence must redact secrets and distinguish model lane/cost/cache |
| live:real-task-compare | live-provider | DeepSeek provider live gate owner | allowed-with-evidence | live provider proof; evidence must redact secrets and distinguish model lane/cost/cache |
| owner-git:authorization-board | owner-review | Owner/Git review and external input owner | blocked-as-claim | closure or external-input workflow; must not be promoted to a user-facing feature claim |
| owner-git:mutation-command-plan | owner-review | Owner/Git review and external input owner | blocked-as-claim | closure or external-input workflow; must not be promoted to a user-facing feature claim |
| owner-git:preflight | owner-review | Owner/Git review and external input owner | blocked-as-claim | closure or external-input workflow; must not be promoted to a user-facing feature claim |
| owner-git:product-stage-plan | owner-review | Owner/Git review and external input owner | blocked-as-claim | closure or external-input workflow; must not be promoted to a user-facing feature claim |
| owner-git:stage-plan | owner-review | Owner/Git review and external input owner | blocked-as-claim | closure or external-input workflow; must not be promoted to a user-facing feature claim |
| p12:raw-readiness | owner-review | Owner/Git review and external input owner | blocked-as-claim | closure or external-input workflow; must not be promoted to a user-facing feature claim |
| p12:target-collection | owner-review | Owner/Git review and external input owner | blocked-as-claim | closure or external-input workflow; must not be promoted to a user-facing feature claim |
| p12:target-contract | owner-review | Owner/Git review and external input owner | blocked-as-claim | closure or external-input workflow; must not be promoted to a user-facing feature claim |
| p12:target-discovery | owner-review | Owner/Git review and external input owner | blocked-as-claim | closure or external-input workflow; must not be promoted to a user-facing feature claim |
| p12:target-intake | owner-review | Owner/Git review and external input owner | blocked-as-claim | closure or external-input workflow; must not be promoted to a user-facing feature claim |
| prebuild | toolchain | Toolchain / schema owner | operator-only | developer maintenance command; keep outside product capability claims |
| project:dev-proof | supporting-utility | Supporting script owner | operator-only | not part of the four mainline aliases; use only through owner-specific evidence |
| public-challenge:ablation | supporting-utility | Supporting script owner | operator-only | not part of the four mainline aliases; use only through owner-specific evidence |
| reference:mechanism-audit | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| reference:scenario-backlog | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| reference:scenario-convergence | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| release:blocker-board | release-only | Release / clean export / compliance owner | operator-only | release gate command; not a product capability claim by itself |
| release:clean-export-artifact | release-only | Release / clean export / compliance owner | operator-only | release gate command; not a product capability claim by itself |
| release:closure-batch | release-only | Release / clean export / compliance owner | operator-only | release gate command; not a product capability claim by itself |
| release:final-preflight | release-only | Release / clean export / compliance owner | operator-only | release gate command; not a product capability claim by itself |
| release:fresh-install-smoke | release-only | Release / clean export / compliance owner | operator-only | release gate command; not a product capability claim by itself |
| release:github-launch-pack | release-only | Release / clean export / compliance owner | operator-only | release gate command; not a product capability claim by itself |
| release:post-authorization-plan | release-only | Release / clean export / compliance owner | operator-only | release gate command; not a product capability claim by itself |
| replay:regression | supporting-utility | Supporting script owner | operator-only | not part of the four mainline aliases; use only through owner-specific evidence |
| semantic:tool-gate-trace | supporting-utility | Supporting script owner | operator-only | not part of the four mainline aliases; use only through owner-specific evidence |
| source:cache-acceptance | supporting-utility | Supporting script owner | operator-only | not part of the four mainline aliases; use only through owner-specific evidence |
| start | product-runtime | CLI/TUI product runtime owner | allowed-with-evidence | product launch surface; behavior must project through DSXU main query loop and work-state |
| terminal:live-acceptance | supporting-utility | Supporting script owner | operator-only | not part of the four mainline aliases; use only through owner-specific evidence |
| test:dsxu:release | mainline-validation | Acceptance / verification owner | allowed-with-evidence | validation command; output can support claims only when raw evidence is generated and current |
| test:experience | mainline-validation | Acceptance / verification owner | allowed-with-evidence | validation command; output can support claims only when raw evidence is generated and current |
| test:mainline | mainline-validation | Acceptance / verification owner | allowed-with-evidence | validation command; output can support claims only when raw evidence is generated and current |
| test:release-gates | mainline-validation | Acceptance / verification owner | allowed-with-evidence | validation command; output can support claims only when raw evidence is generated and current |
| test:six-stage-final | mainline-validation | Acceptance / verification owner | allowed-with-evidence | mainline validation alias; claim text must cite generated evidence output |
| test:six-stage-plan | mainline-validation | Acceptance / verification owner | allowed-with-evidence | validation command; output can support claims only when raw evidence is generated and current |
| toolchain:inventory | toolchain | Toolchain / schema owner | operator-only | developer maintenance command; keep outside product capability claims |
| toolchain:repair | toolchain | Toolchain / schema owner | operator-only | developer maintenance command; keep outside product capability claims |
| v20:blocker-board | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| v20:closure-batch | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| v20:final-preflight | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| v20:post-auth-plan | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| v20:six-stage-plan | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| v24:batch | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| v24:c2-1902-evidence-join | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| v24:c2-loop-acceptance | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| v24:clean-export-artifact | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| v24:completed-reacceptance | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| v24:complex-task | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| v24:fresh-install-release-smoke | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| v24:github-launch-pack | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| v24:interactive-tui-acceptance | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| v24:live-acceptance | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| v24:product-benchmark-data | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| v24:public-challenge | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| v24:section45-audit | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| v24:senior-coding-window | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| v24:six-stage-final-tests | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| v26:c2-capability-loss-board | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| v26:c2-owner-implementation-acceptance | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| v26:c2-public-claim-closure | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| v26:naming-governance | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| v26:reference-experience-reverse-analysis | historical-evidence | Evidence / release claim binder owner | internal-only | historical or generated evidence command; may feed dashboard but is not a separate product surface |
| v5:phase0 | supporting-utility | Supporting script owner | operator-only | not part of the four mainline aliases; use only through owner-specific evidence |
| visible-state:acceptance | supporting-utility | Supporting script owner | operator-only | not part of the four mainline aliases; use only through owner-specific evidence |

## Rule

Package scripts are cataloged by owner and claim boundary. Historical, owner-review, release-only, smoke, and live-provider commands must not be promoted into GitHub product claims without current source/test/live/raw/cost evidence.
