# DSXU V4 Freeze Register - 2026-05-18

Status: PASS_DSXU_V4_FREEZE_REGISTER_READY

| id | capability | productCore | defaultStatus | allowedUse | blockedUse | action | ownerFiles |
| --- | --- | --- | --- | --- | --- | --- | --- |
| V4-FRZ-01 | Voting / consensus panel | agent-evidence | frozen | Historical evidence or explicit research-only owner review. | Default coding workflow, public capability claim, or automatic model debate. | Keep out of default chain; reduce any needed disagreement to Pro admission evidence. | `src/coordinator/voting` |
| V4-FRZ-02 | Forked agent counterfactual branch | agent-evidence | default-disabled | Explicit AgentTool worker/fanout with owner scope and evidence packet. | Autonomous branch tree, hidden second query loop, or parent PASS without evidence. | Fold accepted use into Agent Evidence Handoff; freeze branch fantasy paths. | `src/utils/forkedAgent.ts`<br>`src/tools/AgentTool/forkSubagent.ts` |
| V4-FRZ-03 | Swarm / team mesh | agent-evidence | default-disabled | Existing compatibility code only when explicitly enabled and permission-visible. | Default coding runtime, manager mesh, agent-of-agents, or public swarm claim. | Keep default route to serial worker or disjoint fanout evidence. | `src/utils/swarm`<br>`src/screens/REPL.tsx` |
| V4-FRZ-04 | Legacy ToolBus | tool-envelope | frozen | Historical tests and owner-review migration evidence. | New tool caller or second tool runtime. | All new outputs must normalize to ToolCallResult at Tool Gate. | `src/dsxu/engine/tool-bus`<br>`src/dsxu/engine/__tests__/wave5-telemetry.test.ts` |
| V4-FRZ-05 | Multiple recovery planner variants | recovery-decision | frozen | Compatibility tests proving mainline export points at the accepted decision table. | Parallel recovery stacks with conflicting retry/replan decisions. | P5 owns consolidation into one Recovery Decision Table. | `src/dsxu/engine/recovery/recovery-planner.ts`<br>`src/dsxu/engine/recovery/recovery-planner-v3.ts` |
| V4-FRZ-06 | Multiple prompt stacks | provider-plan | frozen | Source evidence for prompt slimming and cache-safe discipline. | Layered prompt accumulation in default query path. | P2 owns stable prefix / dynamic tail; prompt policy belongs in runtime gates. | `src/dsxu/engine/prompt-stack-v1.ts`<br>`src/dsxu/engine/prompt-processing-v1.ts`<br>`src/dsxu/engine/system-prompt-builder-v1.ts` |
| V4-FRZ-07 | MCP/Skill standalone runtime | agent-evidence | default-disabled | Registry-governed tool boundary through DSXU Tool Gate. | External server or skill owning runtime, permission, or provider routing. | P6 keeps MCP/Skill as registry/tool boundary with owner proof. | `src/commands/mcp`<br>`src/dsxu/engine/skills-adapter.ts` |
| V4-FRZ-08 | Background provider cache warmer | provider-plan | default-disabled | Dry-run or explicit long-session operator action. | Startup background DeepSeek calls or hidden cost generation. | Keep dry-run default until P2 has performance evidence. | `src/services/cache-warmer.ts`<br>`scripts/dsxu-cache-warm.ts` |
| V4-FRZ-09 | Internal smoke as public benchmark | trust-ui | release-gated | Internal regression and dashboard input with smoke label. | Formal SWE-bench or external victory claim without raw paired evidence. | P8 final claim gate controls public wording. | `scripts/dsxu-swe-bench-runner.ts`<br>`scripts/dsxu-evidence-dashboard.ts` |
| V4-FRZ-10 | Generic package entrypoint expansion | trust-ui | owner-review-only | Owner-reviewed mainline alias, release-only command, or internal evidence command. | New product surface without owner classification. | P0 command catalog must classify every script and block claim leakage. | `package.json`<br>`scripts/dsxu-command-catalog.ts` |

## Rule

Frozen capabilities may only appear through explicit owner review, compatibility evidence, or release-gated proof. They must not become default coding workflow, GitHub public claims, or hidden second runtimes.
