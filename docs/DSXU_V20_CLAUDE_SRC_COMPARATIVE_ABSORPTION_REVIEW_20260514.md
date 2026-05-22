# DSXU V20 Claude Source Comparative Absorption Review

Date: 2026-05-14

Reference source: `D:\源代码claude\src`

Target: DSXU V20 must reach product-grade AI coding and complex-task capability, while staying original-side DSXU. The goal is not to clone Claude. The goal is to absorb proven product capabilities into DSXU owners: query loop, tool lifecycle, permission/tool gate, model router/cost, context/memory, agent orchestration, MCP/skill/plugin registry, evidence/eval, and real operation UI/TUI.

Important boundary: this Claude source does not "remember" the DSXU goal. It encodes Claude product decisions. DSXU must read those decisions as reference evidence, then translate them into DeepSeek-based architecture and DSXU release/evidence standards.

## Source Inventory

The reference source contains 1902 files:

- `.ts`: 1332
- `.tsx`: 552
- `.js`: 18

Largest product files:

- `screens/REPL.tsx`: full interactive shell surface.
- `main.tsx`: top-level product bootstrap and application wiring.
- `components/PromptInput/PromptInput.tsx`: command input, mode switch, images, IDE mentions, task navigation, permission-mode UX.
- `commands/plugin/ManagePlugins.tsx`: plugin management UI.
- `components/Settings/Config.tsx`: settings UI.
- `tools/AgentTool/AgentTool.tsx`: agent spawning and lifecycle routing.
- `tools/BashTool/BashTool.tsx` and `tools/PowerShellTool/PowerShellTool.tsx`: shell execution and display.
- `query.ts` and `QueryEngine.ts`: main loop and SDK/non-interactive engine.

## Top-Level Directory Review

| Claude path | What it owns | DSXU V20 decision |
|---|---|---|
| `assistant` | session history adjunct | Absorb as session transcript owner, not runtime core |
| `bootstrap` | global/session state bootstrap | Absorb state bootstrap pattern into DSXU composition root |
| `bridge` | direct/repl bridge, remote control, permission callbacks | Absorb only as adapter boundary; do not create second runtime |
| `buddy` | companion notification surface | Optional UX reference only |
| `cli` | print/structured/remote IO and command-line handlers | Absorb for real operation CLI/SDK parity |
| `commands` | slash commands, review, model, tasks, permissions, mcp, plugin, diff, doctor | Absorb command registry and command result evidence |
| `components` | product TUI components, permissions, tasks, settings, diff, messages | Absorb for V20 real UI/TUI acceptance |
| `constants` | prompts, tools, limits, messages, betas | Absorb as typed policy constants; avoid provider-specific constants |
| `context` | React context providers | Absorb UI state separation, not product runtime logic |
| `coordinator` | coordinator mode gate | Absorb into DSXU agent orchestration owner |
| `entrypoints` | CLI/MCP/SDK type entrypoints | Absorb as explicit DSXU entrypoint contracts |
| `hooks` | UI hooks, permission hooks, tool hooks, IDE, tasks, voice, skills | Absorb as product extension surfaces with owner gating |
| `ink` | terminal rendering runtime | Reference only unless DSXU keeps Ink TUI |
| `keybindings` | command keybinding schema and resolver | Absorb for real operation UX |
| `memdir` | persistent/team memory directory | Absorb into DSXU context/memory owner |
| `migrations` | settings/model migration | Absorb as release migration pattern |
| `moreright` | UI layout helper | Reference only |
| `native-ts` | native helper modules | Absorb only if DSXU needs equivalent native function |
| `outputStyles` | output style loading | Optional UX feature |
| `plugins` | built-in plugin registry | Absorb into DSXU plugin owner |
| `query` | query deps/config/stop hooks/token budget | Absorb into query-loop owner, not scattered runtime-core |
| `remote` | remote session, SDK message adapter, permission bridge | Absorb as explicit remote adapter |
| `schemas` | hook schema | Absorb schema-first extension contracts |
| `screens` | REPL, doctor, resume conversation screens | Absorb REPL and doctor as V20 real-operation surfaces |
| `server` | direct connect sessions | Absorb only as adapter boundary |
| `services` | API, MCP, compact, memory, tool execution, rate limits, summaries | Absorb by owner, not as service bucket |
| `skills` | bundled/file/MCP skills and dynamic discovery | Absorb strongly into DSXU skill registry |
| `state` | AppState store/selectors | Absorb into UI/control-plane state owner |
| `tasks` | local shell, local agent, remote agent, background session, teammate lifecycle | Absorb into DSXU task/agent lifecycle owner |
| `tools` | all tool implementations | Absorb tool protocol ideas, not direct provider names |
| `types` | shared command/hook/permission/plugin/log types | Absorb for typed contracts |
| `upstreamproxy` | upstream relay | Reference only unless DSXU needs proxy mode |
| `utils` | model, permissions, shell safety, sandbox, tasks, plugins, telemetry, file state | Absorb many utilities, but split by owner |
| `vim` | vim editing mode | Optional UX feature |
| `voice` | voice mode enablement | Optional V20+ real operation feature |

## Key File Findings

### Query and Engine

Reference files:

- `query.ts`
- `QueryEngine.ts`
- `query/tokenBudget.ts`
- `utils/tokens.ts`
- `services/compact/*`
- `services/SessionMemory/*`
- `memdir/*`

What Claude does well:

- `QueryEngine.ts` separates SDK/non-interactive engine state from REPL state.
- `query.ts` owns a loop with compaction, model fallback, token budget continuation, stop hooks, tool execution, tool-use summary, max-output recovery, and context overflow recovery.
- `query/tokenBudget.ts` has explicit continuation and diminishing-returns logic.
- `utils/tokens.ts` distinguishes context-window token count, output tokens, and final context tokens.
- `services/compact` and `services/SessionMemory` separate compaction and session memory instead of hiding them in a generic query loop.

DSXU gap:

- DSXU has evidence-rich closure, but `query-loop.ts` and `runtime-core.ts` still carry too many responsibilities.
- V20 needs a state-machine query loop with explicit phases: prepare context, choose model, call provider, stream, execute tools, recover, compact, summarize, recurse, finish.

Absorb into DSXU:

- `QueryEngine` style dual entrypoint: interactive and SDK/headless share core but differ by adapters.
- Token-budget continuation with evidence.
- Separate compaction owner: microcompact, auto-compact, session memory, overflow recovery.
- Tool-use summary generated after tool batches and fed to next turn.

Do not absorb directly:

- Claude-specific model fallback names, Anthropic beta headers, and subscription-driven model defaults.

### Tool Contract and Tool Pool

Reference files:

- `Tool.ts`
- `tools.ts`
- `services/tools/toolExecution.ts`
- `services/tools/toolOrchestration.ts`
- `services/tools/StreamingToolExecutor.ts`

What Claude does well:

- `Tool.ts` defines a full product contract, not just execution: schema, validation, permissions, read-only/concurrency, destructive marker, interrupt behavior, activity text, search/read collapse, MCP metadata, result mapping, progress UI, rejection UI, error UI, grouping, transcript search text.
- `tools.ts` is a single tool-pool assembly point that combines built-in tools with MCP tools and filters deny rules before model exposure.
- `toolExecution.ts` order is strong: find tool, validate schema, validate values, run pre-tool hooks, resolve permission, log decision, then call tool.
- `toolOrchestration.ts` partitions tool calls into concurrent read-only batches and serial non-read-only batches.
- `StreamingToolExecutor.ts` supports streaming tool calls, queueing, progress, abort propagation, and sibling cancellation for shell failures.

DSXU gap:

- DSXU `tool-registry-v1.ts` still infers metadata from `readOnly`; this is weaker than Claude's explicit tool contract.
- DSXU `tool-mainline-runtime-v1.ts` currently has managed-service paths that execute before permission/gate, which V20 must fix before adopting streaming/concurrency.

Absorb into DSXU:

- A DSXU `ToolDefinitionV20` with required fields: owner, input schema, output schema, permission class, side-effect class, read/write class, concurrency class, destructive marker, interrupt behavior, evidence sink, UI projection, transcript projection.
- One tool-pool assembly owner for built-in, MCP, skill, plugin, and provider tools.
- Read-only parallelism and write serialism.
- Streaming executor that emits progress and synthetic errors without bypassing permission.

Do not absorb directly:

- Alias fallback that revives deprecated tools unless explicitly marked as transcript-compat only.

### Permission and Shell Safety

Reference files:

- `hooks/toolPermission/PermissionContext.ts`
- `hooks/toolPermission/handlers/interactiveHandler.ts`
- `hooks/toolPermission/handlers/coordinatorHandler.ts`
- `hooks/toolPermission/handlers/swarmWorkerHandler.ts`
- `utils/permissions/*`
- `tools/BashTool/*`
- `tools/PowerShellTool/*`
- `components/permissions/*`

What Claude does well:

- Permission is a product system: queue, UI prompt, bridge relay, channel relay, hooks, classifier, user feedback, persistent rule updates, worker/leader permission routing, logging.
- Shell permission has deep command parsing, deny/ask/allow precedence, subcommand checks, wrapper stripping, path constraints, sandbox handling, destructive warnings, PowerShell-specific validation.
- Background or worker agents can avoid prompts or route permission to the leader.

DSXU gap:

- DSXU currently treats broad script/interpreter commands as safe in `permissions.ts`.
- Missing ask callback currently becomes allow in DSXU; Claude-style product permission would not silently allow.
- DSXU needs PowerShell and Bash permission owners with equivalent depth, especially on Windows.

Absorb into DSXU:

- Permission queue and visible prompt state.
- Deny/ask/allow precedence with explicit rule sources.
- Shell AST/semantic checks for Bash and PowerShell.
- Worker permission bridge: child agents request permission from parent/control plane.
- Classifier can be optional, but it must be evidence-backed and fail closed.

Do not absorb directly:

- Provider-specific classifier implementation. DSXU should use DeepSeek-compatible or local classifier only after evaluation.

### Agent and Task Lifecycle

Reference files:

- `tools/AgentTool/AgentTool.tsx`
- `tools/AgentTool/runAgent.ts`
- `tools/AgentTool/forkSubagent.ts`
- `tools/AgentTool/resumeAgent.ts`
- `tools/AgentTool/loadAgentsDir.ts`
- `tools/AgentTool/built-in/*`
- `tasks/LocalAgentTask/LocalAgentTask.tsx`
- `tasks/LocalShellTask/LocalShellTask.tsx`
- `tasks/RemoteAgentTask/RemoteAgentTask.tsx`
- `tasks/InProcessTeammateTask/InProcessTeammateTask.tsx`
- `utils/swarm/*`
- `components/tasks/*`

What Claude does well:

- Agent tool is not a generic action bucket. It resolves agent definitions, models, MCP requirements, permission modes, allowed tools, background mode, worktree isolation, transcript persistence, progress, and cleanup.
- `runAgent.ts` builds a subagent context with cloned file state, scoped tools, scoped permissions, optional context fork, sidechain transcript, agent-specific MCP servers, hooks, skills, and cleanup.
- Background tasks have visible status, progress, stop, resume/detail views, notifications, and result summaries.
- Agent permission can bubble to the parent or leader instead of being silently allowed.

DSXU gap:

- DSXU currently risks collapsing many agent/task/team tools into a generic `AgentTool` path.
- For 100/100, DSXU needs first-class agent lifecycle, not normalized action strings that always return success.

Absorb into DSXU:

- Agent definition contract: role, model policy, tools, permissions, MCP requirements, skills, hooks, max turns, background capability, worktree isolation.
- Parent/child transcript sidechain.
- Parent final gate: worker output is evidence, not automatic final answer.
- Background task board and detail views.
- Kill/cleanup semantics for spawned shell tasks and agent-specific resources.

Do not absorb directly:

- Claude-specific built-in agent prompts. Translate capability classes instead: explorer, worker, verifier, planner, review agent.

### MCP, Skills, Plugins

Reference files:

- `services/mcp/*`
- `tools/MCPTool/MCPTool.ts`
- `tools/McpAuthTool/McpAuthTool.ts`
- `tools/ListMcpResourcesTool/ListMcpResourcesTool.ts`
- `skills/loadSkillsDir.ts`
- `skills/bundledSkills.ts`
- `skills/mcpSkillBuilders.ts`
- `plugins/builtinPlugins.ts`
- `commands/plugin/*`
- `utils/settings/pluginOnlyPolicy.ts`

What Claude does well:

- MCP has connection manager, auth, OAuth, XAA-style shared auth, channel permissions, notifications, resource listing, resource reading, official registry, normalization, environment expansion, and pseudo auth tools for unauthenticated servers.
- Skills load from managed, user, project, additional dirs, bundled, plugin, and MCP sources.
- Skills can be conditional by path, dynamically discovered from touched files, deduped, and gated by policy.
- Plugin-only policy marks trusted sources and restricts customization surfaces.

DSXU gap:

- DSXU has evidence for MCP/skill owner closure, but V20 product runtime should expose a single registry with trust/source policy, not ad hoc tool conversion.

Absorb into DSXU:

- Source-scoped registry: built-in, managed, project, user, plugin, MCP.
- Skill frontmatter: description, when-to-use, allowed tools, model/effort, hooks, paths, shell.
- Dynamic skill discovery on file paths.
- MCP auth pseudo-tool and reconnect flow.
- Plugin-only policy and trusted-source rules.

Do not absorb directly:

- Anthropic/Claude.ai-specific OAuth surfaces. DSXU needs provider-neutral connector auth.

### UI/TUI Real Operation

Reference files:

- `screens/REPL.tsx`
- `components/PromptInput/PromptInput.tsx`
- `components/Messages.tsx`
- `components/VirtualMessageList.tsx`
- `components/StructuredDiff*`
- `components/permissions/*`
- `components/tasks/*`
- `hooks/use*`
- `keybindings/*`
- `vim/*`
- `voice/*`

What Claude does well:

- The product is operable, not just testable. It has REPL, transcript mode, virtual scroll, permission dialogs, task detail dialogs, prompt input modes, queued commands, image paste, IDE selection, command palette-like suggestions, history search, keybindings, diff viewing, status notifications, background task navigation, and voice hooks.
- It treats UX as part of correctness: visible permission waiting, progress messages, compact rendering, transcript search fidelity, and terminal performance.

DSXU gap:

- DSXU evidence gates are strong, but V20 real operation must prove a user can actually drive complex coding tasks through CLI/TUI/UI and understand state.

Absorb into DSXU:

- Real operation TUI or web UI with: prompt input, permission queue, tool progress, task board, transcript search, diff viewer, model/cost/status line, image/file attachments, command palette, recovery messages.
- V20 test document should execute this UI, not just scripts.

Do not absorb directly:

- Compiled React cache artifacts or product-specific keybinding choices. Absorb UX capabilities, not implementation artifacts.

### Model, Cost, Context, Rate

Reference files:

- `utils/model/*`
- `cost-tracker.ts`
- `services/claudeAiLimits.ts`
- `commands/model/*`
- `commands/cost/*`
- `services/tokenEstimation.ts`
- `utils/tokens.ts`

What Claude does well:

- It centralizes model aliasing, defaults, provider differences, context windows, model capability cache, display names, usage/cost tracking, session cost restore/save, and rate-limit state.
- `cost-tracker.ts` tracks input, output, cache read/write, web search, per-model usage, wall/API/tool duration, and code-change counts.

DSXU gap:

- DSXU target is DeepSeek-based, so model router must not inherit Anthropic product tiers or model-family assumptions.

Absorb into DSXU:

- Provider-neutral model capability manifest.
- DeepSeek model router: chat/reasoning/coding modes, fallback policy, context window, max output, pricing, latency, rate limits, and evidence.
- Per-turn and per-session usage: input/output/cache/tool duration/code diff.
- Model switch command and status line.

Do not absorb directly:

- Anthropic subscription logic, Opus/Sonnet/Haiku defaults, Anthropic headers, first-party/Bedrock/Vertex logic.

### Review, Git, Diff, Doctor, Release UX

Reference files:

- `commands/review/*`
- `commands/security-review.ts`
- `commands/commit.ts`
- `commands/commit-push-pr.ts`
- `commands/diff/*`
- `commands/doctor/*`
- `components/StructuredDiff*`
- `hooks/useDiffData.ts`
- `hooks/useDiffInIDE.ts`

What Claude does well:

- It includes product-level review, security-review, diff display, GitHub app setup, doctor diagnostics, and commit/PR workflows.

DSXU gap:

- DSXU has release closure reports, but V20 should have actual operator surfaces for diff/review/doctor/preflight.

Absorb into DSXU:

- DSXU review command backed by evidence ledger.
- Structured diff UI with file-level status.
- Doctor/preflight command that checks provider, MCP, tools, workspace, git, permissions, tests, and export readiness.

## DSXU V20改造方向

### V20-C1 Runtime composition root

Current DSXU issue: `runtime-core.ts` is too broad and has mock product returns.

Refactor:

- Split query loop, tools, permission, model/cost, context, agent, MCP/skills/plugins, evidence, release into owners.
- Keep runtime root as wiring only.
- Add import-boundary tests to prevent legacy/provider/tool shortcuts.

Absorb from Claude:

- `QueryEngine` as a thin engine facade.
- `ToolUseContext` style typed port object.
- State bootstrap separated from runtime behavior.

### V20-C2 Permission-first tool lifecycle

Current DSXU issue: some managed service tools can execute before gate.

Refactor:

- `validate schema -> validate values -> pre hooks -> permission -> execute -> post hooks -> evidence`.
- No tool side effect before permission.
- Every tool has explicit side-effect metadata.

Absorb from Claude:

- Permission queue and decision logging.
- PreToolUse/PostToolUse hooks.
- Read-only parallelism and write serialism.
- Streaming executor with progress and abort semantics.

### V20-C3 DeepSeek model router and cost evidence

Current DSXU issue: evidence exists, but V20 needs provider-grade routing.

Refactor:

- Create DeepSeek provider manifest: model ids, context limits, output limits, cost, latency, capability tags, reasoning mode, fallback chain.
- Add provider-independent usage tracker.
- Add model switch/status command.
- Store per-turn model/cost/eval evidence.

Absorb from Claude:

- Model aliasing, context/capability cache, cost/session restore.

Reject from Claude:

- Anthropic subscription and family-specific rules.

### V20-C4 Agent orchestration

Current DSXU issue: agent/task/team can collapse into generic lifecycle action.

Refactor:

- Agent definition owner: role, tools, permissions, model, max turns, skills, MCP requirements, background/worktree mode.
- Parent final gate owner: worker output must be synthesized and checked.
- Background task owner: status, progress, stop, resume, transcript, cleanup.

Absorb from Claude:

- `runAgent` style scoped subagent context.
- Sidechain transcript.
- Agent-specific MCP/skills/hooks.
- Visible background task board.

Reject from Claude:

- Any generic `AgentTool` catch-all that returns success for unknown actions.

### V20-C5 Context, memory, compaction

Current DSXU issue: context and evidence are strong but product continuity needs clearer runtime behavior.

Refactor:

- Separate memory directory, session memory, nested memory attachment, tool-result budget, microcompact, autocompact, overflow recovery.
- Add tests that prove long coding tasks survive compaction without losing tool/result continuity.

Absorb from Claude:

- `memdir`, `SessionMemory`, `compact`, `tokenBudget`, and `toolUseSummary` concepts.

### V20-C6 MCP, skill, plugin registry

Current DSXU issue: closure evidence says no second runtime, but product registry still needs mature trust/source policy.

Refactor:

- One registry for tools, MCP tools, skills, plugins, direct-connect tools.
- Source trust: built-in, managed, project, user, plugin, MCP.
- Skill frontmatter: when-to-use, allowed tools, paths, hooks, model/effort, shell.
- Dynamic skill activation based on touched paths.

Absorb from Claude:

- `loadSkillsDir`, bundled skills, dynamic skills, MCP skill builders, plugin-only policy.

### V20-C7 Real operation UI/TUI

Current DSXU issue: release evidence is strong, but UI-level task execution is not yet the main proof.

Refactor:

- Build or harden DSXU TUI/UI around real operation: prompt, permission dialog, tool progress, task board, diff, transcript search, model/cost/status, recovery, export/preflight.
- V20 acceptance tests must open and use this surface.

Absorb from Claude:

- REPL/PromptInput/task/permission/diff/transcript patterns.

### V20-C8 Evaluation and release closure

Current DSXU issue: P12 can import target logs and still overclaim if target quality is blocked/partial.

Refactor:

- Separate raw input completeness, pair integrity, quality comparison, release readiness.
- Never let target blocked/partial become a comparison win.
- V20 tests must be real operation tests, not report-only tests.

Absorb from Claude:

- Real transcripts, task summaries, tool-use summaries, cost/session evidence, replayable sidechain logs.

## Feature Additions Needed For 100/100

1. Product-grade Tool Protocol V20: schema, permissions, side effect, read/write, concurrency, destructive, interrupt, progress, UI, transcript, evidence.
2. Permission Queue V20: local dialog, headless behavior, parent/worker relay, bridge/direct-connect relay, visible denial/allow evidence, fail-closed missing ask callback.
3. Shell Safety V20: Bash and PowerShell semantic parser, deny/ask precedence, path normalization, compound command checks, script runner guard, sandbox evidence.
4. Agent Orchestration V20: parent/worker/fork/background/team lifecycle with transcripts, scoped tools, scoped permissions, cleanup, final gate.
5. DeepSeek Provider Router V20: DeepSeek-specific capability manifest, reasoning/chat routing, fallback, context/cost/rate evidence.
6. Context Continuity V20: session memory, nested project memory, compaction, overflow recovery, token budget continuation, tool result storage.
7. MCP/Skill/Plugin V20: source-trusted registry, dynamic skill discovery, MCP auth/reconnect/resource tools, plugin policy.
8. Real Operation UI V20: prompt input, permissions, progress, background tasks, transcript search, diff, status, screenshots/recordings for acceptance.
9. Evaluation V20: P12 raw intake, quality comparison, real UI/task tests, recovery/performance tests, release preflight.
10. Operator Dashboard V20: owner packets, dirty review, pending deletion, permission residues, tests, release gate, clean export readiness.

## What DSXU Should Not Copy

- Anthropic product model family defaults, subscription tier logic, rate-limit headers, Claude.ai connector assumptions.
- Any compatibility path that keeps deprecated behavior alive in product runtime.
- Any generic adapter bucket that hides ownership.
- Any UI-specific compiled artifact or cache optimization before DSXU has the core product contract correct.
- Any classifier auto-approval without DSXU evidence, fail-closed behavior, and DeepSeek/local validation.

## Optimized Execution Order

1. Fix DSXU P12 semantics first so evaluation cannot overclaim.
2. Fix DSXU tool permission order and shell safety.
3. Define `ToolDefinitionV20` and migrate current tools into it.
4. Split `runtime-core.ts` into owner composition.
5. Build DeepSeek model router/cost/capability owner.
6. Refactor agent lifecycle away from generic action bucket.
7. Absorb active legacy/provider/MCP/skill imports into named owners.
8. Add real operation TUI/UI harness and task board.
9. Run V20 real operation acceptance sequence.
10. Only then run final comprehensive tests and clean export.

## Final Assessment

Claude source shows that 100/100 AI coding ability is not just model quality. It is a product system:

- strong query loop,
- strict tool protocol,
- visible permission UX,
- safe shell semantics,
- agent lifecycle,
- memory/compaction,
- provider routing,
- MCP/skill/plugin ecosystem,
- real operation UI,
- reproducible transcripts,
- cost/evidence/release gates.

DSXU already has unusually strong evidence discipline from V18/V19. The missing V20 move is to convert that evidence discipline into product runtime discipline. The correct direction is not more small closure buckets. The correct direction is owner-level product refactor plus real operation tests.
