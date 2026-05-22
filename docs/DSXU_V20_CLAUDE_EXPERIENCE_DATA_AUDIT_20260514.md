# DSXU V20 Claude Experience/Data Absorption Audit - 2026-05-14

## Scope
- Claude source root: `D:\源代码claude\src`
- Files indexed one-by-one: 1902 TypeScript/JavaScript source files.
- File-by-file machine-readable audit: `docs/generated/DSXU_V20_CLAUDE_SRC_FILE_AUDIT_20260514.csv`.
- Goal: explain why Claude-like coding feels like a senior programmer, then map absorbable mechanisms to DSXU DeepSeek-side V20 without copying product-specific runtime assumptions.
- Note: 552 indexed files contain inline source maps / `sourcesContent`, so those files must be treated as transformed product artifacts. DSXU should absorb the interaction/data model behind them, not blindly copy their compiled surface.

## File Population By Area
- `utils`: 564
- `components`: 389
- `commands`: 207
- `tools`: 184
- `services`: 130
- `hooks`: 104
- `ink`: 96
- `bridge`: 31
- `constants`: 21
- `skills`: 20
- `cli`: 19
- `<root>`: 18
- `keybindings`: 14
- `tasks`: 12
- `migrations`: 11
- `types`: 11
- `context`: 9
- `entrypoints`: 8
- `memdir`: 8
- `buddy`: 6
- `state`: 6
- `vim`: 5
- `remote`: 4
- `native-ts`: 4
- `query`: 4
- `server`: 3
- `screens`: 3
- `upstreamproxy`: 2
- `plugins`: 2
- `voice`: 1
- `coordinator`: 1
- `bootstrap`: 1
- `assistant`: 1
- `schemas`: 1
- `outputStyles`: 1
- `moreright`: 1

## Experience/Data Signal Coverage
- `telemetry_data`: 845 files
- `memory_context`: 1190 files
- `ui_interaction`: 1579 files
- `tool_runtime`: 1393 files
- `permission_safety`: 1125 files
- `recovery_remote`: 948 files
- `coding_workflow`: 1491 files
- `provider_model`: 1365 files
- `plugin_mcp_skill`: 912 files

## Owner Family Coverage
- `experience_ui`: 545 files
- `support_util`: 408 files
- `tool_protocol`: 191 files
- `coding_workflow`: 182 files
- `mcp_skill_plugin`: 172 files
- `permission_gate`: 107 files
- `model_cost_context`: 104 files
- `unclassified_support`: 98 files
- `agent_lifecycle`: 93 files
- `query_engine`: 2 files

## Why It Feels Like A Senior Programmer
1. Persistent working memory: history, session storage, memdir, session memory, compact and summary code give the product continuity beyond one prompt.
2. Rich situational awareness: LSP diagnostics, git/diff/review/doctor/status commands, file-index/search/read/edit tools, context suggestions and onboarding make the assistant act inside the codebase instead of just answering text.
3. Visible execution state: REPL, PromptInput, Message components, progress lines, notifications, permission dialogs and task/background UI let users see what is happening, which reduces uncertainty during long jobs.
4. Permission and safety UX: Bash/PowerShell/file/MCP/plan permissions are not only guards; they are interactive decision surfaces with rule persistence, recent denials and explanations.
5. Recovery and resilience: retry, timeout, abort, resume, reconnect, background task, stream watchdog and compact recovery prevent long coding work from dying silently.
6. Measurement loop: cost, token, usage, analytics, diagnostics, feedback and session tracing create evidence to tune product quality, cache behavior, latency and failure modes.
7. Extensibility with ownership: MCP, skills, plugins and agents are discoverable and configurable, but strong products keep them behind trust, permission and tool contracts.

## Evidence Chain From Key Files
- `context/stats.tsx`: creates an in-process stats store, which explains why the UI can show live session state instead of only final answers.
- `cost-tracker.ts`: accumulates per-model usage, cache read/write tokens, web-search request counts and cost. DSXU needs a DeepSeek-native equivalent.
- `services/api/claude.ts`: updates streaming usage, cost, token stop reasons, fallback paths, cache behavior and API latency/error logs. DSXU should adapt the evidence model but replace provider-specific logic.
- `services/api/logging.ts`: emits API query/success/error telemetry with cache tokens and duration. This is the data loop behind product tuning.
- `utils/telemetry/perfettoTracing.ts` and `utils/telemetry/sessionTracing.ts`: record request spans, retries, cache hit rate and long-running session traces.
- `history.ts`: persists prompt history by project/session, supporting recall and command-like fluency.
- `utils/sessionStorage.ts`: is the main transcript/resume backbone, with transcript messages, sidechain subagent logs, summaries, file-history snapshots and remote resume readers.
- `services/compact/prompt.ts`, `services/compact/compact.ts`, `services/compact/sessionMemoryCompact.ts`: preserve technical decisions, files read/edited, current work and next action across context pressure.
- `services/diagnosticTracking.ts` and `services/lsp/passiveFeedback.ts`: capture baseline diagnostics, new diagnostics after edits, and async LSP feedback. This is one reason the product feels codebase-aware.
- `components/PromptInput/PromptInput.tsx`: integrates queued commands, background task focus, mentions, image paste, voice interim state, thinking/review triggers and mode indicators.
- `screens/REPL.tsx`: composes transcript, task state, bridge/remote state, compact notices, notifications and input surface into one continuous workbench.
- `components/Message.tsx` and `components/messages/*`: render thinking blocks, tool use, progress, images, task status, rejections and errors as inspectable work state.
- `Tool.ts`, `services/tools/toolExecution.ts`, `services/tools/StreamingToolExecutor.ts`: connect tool schema, permission, progress, concurrency, abort, telemetry, hooks and rendered results.
- `tools/TodoWriteTool/*`, `commands/status`, `commands/resume`, `commands/review`, `commands/diff`, `commands/tasks`: make the assistant behave like a disciplined engineer who tracks work, reviews diffs, resumes context and exposes status.

## One-File-At-A-Time Audit Format
- The CSV has one row per source file and records `relative_path`, `owner_family`, `primary_experience_signal`, category hit counts, inline source-map status and DSXU V20 action.
- `absorb_into_dsxu_mainline` means the behavior belongs in a DSXU original-side owner.
- `adapt_or_exclude_product_specific` means the file contains Claude/Anthropic/product-specific assumptions; absorb the principle only when it strengthens DeepSeek-side operation.
- `review_absorb_as_shared_utility_only_if_imported` means do not create a generic utility bucket; keep only if a real owner imports it.
- `review_candidate` means manual owner review is required before any V20 inclusion.

## Data-Supported Mechanisms To Absorb Into DSXU V20
- Build a DSXU session evidence store: prompt history, tool events, cost/tokens, context compaction, permission decisions, failures, retries, final outcome.
- Build a DSXU coding-situation layer: git diff/status, LSP diagnostics, changed files, recent commands, project onboarding, local memory and task history.
- Build a DSXU visible-state UI/TUI layer: progress, background tasks, approvals, self-talk summary, recovery notices, cost/context indicators.
- Build a DSXU feedback/eval data loop: real task transcript, raw artifacts, metrics, risk tags, user review result and release readiness.
- Keep DeepSeek-specific router/cost/token behavior as original-side mainline; Claude/Anthropic product gates remain exclude/adapt candidates.

## High-Signal Files By Category
### telemetry_data
- `services/mcp/auth.ts`: owner=`mcp_skill_plugin`, bytes=88879, action=`adapt_or_exclude_product_specific`
- `services/api/claude.ts`: owner=`model_cost_context`, bytes=125779, action=`adapt_or_exclude_product_specific`
- `utils/analyzeContext.ts`: owner=`model_cost_context`, bytes=42931, action=`adapt_or_exclude_product_specific`
- `components/Stats.tsx`: owner=`experience_ui`, bytes=152782, action=`absorb_into_dsxu_mainline`
- `utils/auth.ts`: owner=`support_util`, bytes=65436, action=`adapt_or_exclude_product_specific`
- `cost-tracker.ts`: owner=`model_cost_context`, bytes=10706, action=`adapt_or_exclude_product_specific`
- `utils/stats.ts`: owner=`support_util`, bytes=33790, action=`review_absorb_as_shared_utility_only_if_imported`
- `services/compact/compact.ts`: owner=`model_cost_context`, bytes=60814, action=`adapt_or_exclude_product_specific`
- `utils/telemetry/perfettoTracing.ts`: owner=`support_util`, bytes=29792, action=`adapt_or_exclude_product_specific`
- `main.tsx`: owner=`unclassified_support`, bytes=803924, action=`adapt_or_exclude_product_specific`
### memory_context
- `utils/sessionStorage.ts`: owner=`support_util`, bytes=180620, action=`adapt_or_exclude_product_specific`
- `bridge/bridgeMain.ts`: owner=`mcp_skill_plugin`, bytes=115571, action=`adapt_or_exclude_product_specific`
- `main.tsx`: owner=`unclassified_support`, bytes=803924, action=`adapt_or_exclude_product_specific`
- `screens/REPL.tsx`: owner=`experience_ui`, bytes=895850, action=`adapt_or_exclude_product_specific`
- `services/compact/compact.ts`: owner=`model_cost_context`, bytes=60814, action=`adapt_or_exclude_product_specific`
- `utils/attachments.ts`: owner=`support_util`, bytes=127423, action=`adapt_or_exclude_product_specific`
- `commands/insights.ts`: owner=`coding_workflow`, bytes=115949, action=`absorb_into_dsxu_mainline`
- `query.ts`: owner=`query_engine`, bytes=68683, action=`adapt_or_exclude_product_specific`
- `cli/print.ts`: owner=`unclassified_support`, bytes=212735, action=`adapt_or_exclude_product_specific`
- `utils/hooks.ts`: owner=`experience_ui`, bytes=159458, action=`absorb_into_dsxu_mainline`
### ui_interaction
- `utils/messages.ts`: owner=`experience_ui`, bytes=193203, action=`adapt_or_exclude_product_specific`
- `screens/REPL.tsx`: owner=`experience_ui`, bytes=895850, action=`adapt_or_exclude_product_specific`
- `components/PromptInput/PromptInput.tsx`: owner=`experience_ui`, bytes=355032, action=`adapt_or_exclude_product_specific`
- `utils/sessionStorage.ts`: owner=`support_util`, bytes=180620, action=`adapt_or_exclude_product_specific`
- `cli/print.ts`: owner=`unclassified_support`, bytes=212735, action=`adapt_or_exclude_product_specific`
- `utils/hooks.ts`: owner=`experience_ui`, bytes=159458, action=`absorb_into_dsxu_mainline`
- `ink/ink.tsx`: owner=`experience_ui`, bytes=251886, action=`adapt_or_exclude_product_specific`
- `services/api/claude.ts`: owner=`model_cost_context`, bytes=125779, action=`adapt_or_exclude_product_specific`
- `tools/AgentTool/UI.tsx`: owner=`tool_protocol`, bytes=125359, action=`adapt_or_exclude_product_specific`
- `components/Messages.tsx`: owner=`experience_ui`, bytes=147457, action=`adapt_or_exclude_product_specific`
### tool_runtime
- `utils/messages.ts`: owner=`experience_ui`, bytes=193203, action=`adapt_or_exclude_product_specific`
- `utils/attachments.ts`: owner=`support_util`, bytes=127423, action=`adapt_or_exclude_product_specific`
- `services/tools/toolExecution.ts`: owner=`tool_protocol`, bytes=60309, action=`adapt_or_exclude_product_specific`
- `screens/REPL.tsx`: owner=`experience_ui`, bytes=895850, action=`adapt_or_exclude_product_specific`
- `tools.ts`: owner=`tool_protocol`, bytes=17294, action=`absorb_into_dsxu_mainline`
- `cli/print.ts`: owner=`unclassified_support`, bytes=212735, action=`adapt_or_exclude_product_specific`
- `utils/hooks.ts`: owner=`experience_ui`, bytes=159458, action=`absorb_into_dsxu_mainline`
- `utils/collapseReadSearch.ts`: owner=`support_util`, bytes=37902, action=`review_absorb_as_shared_utility_only_if_imported`
- `utils/tasks.ts`: owner=`support_util`, bytes=26354, action=`review_absorb_as_shared_utility_only_if_imported`
- `services/api/claude.ts`: owner=`model_cost_context`, bytes=125779, action=`adapt_or_exclude_product_specific`
### permission_safety
- `tools/BashTool/bashPermissions.ts`: owner=`tool_protocol`, bytes=98756, action=`adapt_or_exclude_product_specific`
- `tools/PowerShellTool/powershellPermissions.ts`: owner=`tool_protocol`, bytes=67606, action=`adapt_or_exclude_product_specific`
- `utils/permissions/permissions.ts`: owner=`permission_gate`, bytes=52190, action=`adapt_or_exclude_product_specific`
- `utils/permissions/permissionSetup.ts`: owner=`permission_gate`, bytes=53439, action=`adapt_or_exclude_product_specific`
- `main.tsx`: owner=`unclassified_support`, bytes=803924, action=`adapt_or_exclude_product_specific`
- `utils/sandbox/sandbox-adapter.ts`: owner=`permission_gate`, bytes=35710, action=`adapt_or_exclude_product_specific`
- `tools/PowerShellTool/readOnlyValidation.ts`: owner=`tool_protocol`, bytes=67327, action=`adapt_or_exclude_product_specific`
- `tools/BashTool/bashSecurity.ts`: owner=`tool_protocol`, bytes=102561, action=`absorb_into_dsxu_mainline`
- `tools/PowerShellTool/pathValidation.ts`: owner=`tool_protocol`, bytes=73059, action=`adapt_or_exclude_product_specific`
- `utils/permissions/filesystem.ts`: owner=`permission_gate`, bytes=62254, action=`adapt_or_exclude_product_specific`
### recovery_remote
- `bridge/bridgeMain.ts`: owner=`mcp_skill_plugin`, bytes=115571, action=`adapt_or_exclude_product_specific`
- `screens/REPL.tsx`: owner=`experience_ui`, bytes=895850, action=`adapt_or_exclude_product_specific`
- `bridge/replBridge.ts`: owner=`mcp_skill_plugin`, bytes=100537, action=`adapt_or_exclude_product_specific`
- `cli/print.ts`: owner=`unclassified_support`, bytes=212735, action=`adapt_or_exclude_product_specific`
- `utils/hooks.ts`: owner=`experience_ui`, bytes=159458, action=`absorb_into_dsxu_mainline`
- `main.tsx`: owner=`unclassified_support`, bytes=803924, action=`adapt_or_exclude_product_specific`
- `hooks/useReplBridge.tsx`: owner=`experience_ui`, bytes=115652, action=`adapt_or_exclude_product_specific`
- `bridge/remoteBridgeCore.ts`: owner=`mcp_skill_plugin`, bytes=39434, action=`adapt_or_exclude_product_specific`
- `tasks/RemoteAgentTask/RemoteAgentTask.tsx`: owner=`agent_lifecycle`, bytes=126389, action=`adapt_or_exclude_product_specific`
- `utils/sessionStorage.ts`: owner=`support_util`, bytes=180620, action=`adapt_or_exclude_product_specific`
### coding_workflow
- `utils/worktree.ts`: owner=`coding_workflow`, bytes=49995, action=`adapt_or_exclude_product_specific`
- `utils/sessionStorage.ts`: owner=`support_util`, bytes=180620, action=`adapt_or_exclude_product_specific`
- `utils/collapseReadSearch.ts`: owner=`support_util`, bytes=37902, action=`review_absorb_as_shared_utility_only_if_imported`
- `components/LogSelector.tsx`: owner=`experience_ui`, bytes=200487, action=`adapt_or_exclude_product_specific`
- `main.tsx`: owner=`unclassified_support`, bytes=803924, action=`adapt_or_exclude_product_specific`
- `utils/attachments.ts`: owner=`support_util`, bytes=127423, action=`adapt_or_exclude_product_specific`
- `screens/REPL.tsx`: owner=`experience_ui`, bytes=895850, action=`adapt_or_exclude_product_specific`
- `tools/BashTool/bashSecurity.ts`: owner=`tool_protocol`, bytes=102561, action=`absorb_into_dsxu_mainline`
- `utils/shell/readOnlyCommandValidation.ts`: owner=`support_util`, bytes=68294, action=`review_absorb_as_shared_utility_only_if_imported`
- `utils/config.ts`: owner=`support_util`, bytes=63496, action=`adapt_or_exclude_product_specific`
### provider_model
- `services/api/claude.ts`: owner=`model_cost_context`, bytes=125779, action=`adapt_or_exclude_product_specific`
- `utils/auth.ts`: owner=`support_util`, bytes=65436, action=`adapt_or_exclude_product_specific`
- `main.tsx`: owner=`unclassified_support`, bytes=803924, action=`adapt_or_exclude_product_specific`
- `utils/model/model.ts`: owner=`model_cost_context`, bytes=21409, action=`adapt_or_exclude_product_specific`
- `cli/print.ts`: owner=`unclassified_support`, bytes=212735, action=`adapt_or_exclude_product_specific`
- `services/api/errors.ts`: owner=`unclassified_support`, bytes=41735, action=`adapt_or_exclude_product_specific`
- `bootstrap/state.ts`: owner=`unclassified_support`, bytes=56109, action=`adapt_or_exclude_product_specific`
- `utils/messages.ts`: owner=`experience_ui`, bytes=193203, action=`adapt_or_exclude_product_specific`
- `utils/model/modelOptions.ts`: owner=`model_cost_context`, bytes=18338, action=`adapt_or_exclude_product_specific`
- `utils/permissions/yoloClassifier.ts`: owner=`permission_gate`, bytes=52160, action=`adapt_or_exclude_product_specific`
### plugin_mcp_skill
- `services/mcp/client.ts`: owner=`mcp_skill_plugin`, bytes=119060, action=`adapt_or_exclude_product_specific`
- `commands/plugin/ManagePlugins.tsx`: owner=`mcp_skill_plugin`, bytes=321775, action=`adapt_or_exclude_product_specific`
- `services/mcp/config.ts`: owner=`mcp_skill_plugin`, bytes=51130, action=`adapt_or_exclude_product_specific`
- `services/mcp/auth.ts`: owner=`mcp_skill_plugin`, bytes=88879, action=`adapt_or_exclude_product_specific`
- `utils/plugins/pluginLoader.ts`: owner=`mcp_skill_plugin`, bytes=110261, action=`absorb_into_dsxu_mainline`
- `cli/print.ts`: owner=`unclassified_support`, bytes=212735, action=`adapt_or_exclude_product_specific`
- `main.tsx`: owner=`unclassified_support`, bytes=803924, action=`adapt_or_exclude_product_specific`
- `services/mcp/useManageMCPConnections.ts`: owner=`mcp_skill_plugin`, bytes=44866, action=`adapt_or_exclude_product_specific`
- `utils/plugins/mcpPluginIntegration.ts`: owner=`mcp_skill_plugin`, bytes=20113, action=`adapt_or_exclude_product_specific`
- `services/plugins/pluginOperations.ts`: owner=`mcp_skill_plugin`, bytes=35619, action=`absorb_into_dsxu_mainline`

## Largest Files Requiring Manual Reading
- `screens/REPL.tsx`: bytes=895850, owner=`experience_ui`, primary=`coding_workflow`, inlineSourceMap=yes
- `main.tsx`: bytes=803924, owner=`unclassified_support`, primary=`coding_workflow`, inlineSourceMap=yes
- `components/PromptInput/PromptInput.tsx`: bytes=355032, owner=`experience_ui`, primary=`coding_workflow`, inlineSourceMap=yes
- `commands/plugin/ManagePlugins.tsx`: bytes=321775, owner=`mcp_skill_plugin`, primary=`coding_workflow`, inlineSourceMap=yes
- `components/Settings/Config.tsx`: bytes=271407, owner=`experience_ui`, primary=`coding_workflow`, inlineSourceMap=yes
- `ink/ink.tsx`: bytes=251886, owner=`experience_ui`, primary=`coding_workflow`, inlineSourceMap=yes
- `tools/AgentTool/AgentTool.tsx`: bytes=233734, owner=`tool_protocol`, primary=`coding_workflow`, inlineSourceMap=yes
- `utils/ansiToPng.ts`: bytes=214955, owner=`support_util`, primary=`memory_context`, inlineSourceMap=no
- `cli/print.ts`: bytes=212735, owner=`unclassified_support`, primary=`coding_workflow`, inlineSourceMap=no
- `hooks/useTypeahead.tsx`: bytes=212610, owner=`experience_ui`, primary=`coding_workflow`, inlineSourceMap=yes
- `components/LogSelector.tsx`: bytes=200487, owner=`experience_ui`, primary=`coding_workflow`, inlineSourceMap=yes
- `utils/messages.ts`: bytes=193203, owner=`experience_ui`, primary=`coding_workflow`, inlineSourceMap=no
- `utils/sessionStorage.ts`: bytes=180620, owner=`support_util`, primary=`coding_workflow`, inlineSourceMap=no
- `components/mcp/ElicitationDialog.tsx`: bytes=179643, owner=`experience_ui`, primary=`coding_workflow`, inlineSourceMap=yes
- `utils/teleport.tsx`: bytes=175779, owner=`support_util`, primary=`coding_workflow`, inlineSourceMap=yes
- `tools/BashTool/BashTool.tsx`: bytes=160530, owner=`tool_protocol`, primary=`coding_workflow`, inlineSourceMap=yes
- `utils/hooks.ts`: bytes=159458, owner=`experience_ui`, primary=`coding_workflow`, inlineSourceMap=no
- `components/Stats.tsx`: bytes=152782, owner=`experience_ui`, primary=`coding_workflow`, inlineSourceMap=yes
- `components/ScrollKeybindingHandler.tsx`: bytes=149202, owner=`experience_ui`, primary=`coding_workflow`, inlineSourceMap=yes
- `components/VirtualMessageList.tsx`: bytes=148516, owner=`experience_ui`, primary=`coding_workflow`, inlineSourceMap=yes
- `components/Messages.tsx`: bytes=147457, owner=`experience_ui`, primary=`coding_workflow`, inlineSourceMap=yes
- `utils/processUserInput/processSlashCommand.tsx`: bytes=144807, owner=`support_util`, primary=`coding_workflow`, inlineSourceMap=yes
- `tools/PowerShellTool/PowerShellTool.tsx`: bytes=144624, owner=`tool_protocol`, primary=`coding_workflow`, inlineSourceMap=yes
- `utils/bash/bashParser.ts`: bytes=130810, owner=`support_util`, primary=`coding_workflow`, inlineSourceMap=no
- `commands/plugin/PluginSettings.tsx`: bytes=128668, owner=`mcp_skill_plugin`, primary=`coding_workflow`, inlineSourceMap=yes
- `utils/attachments.ts`: bytes=127423, owner=`support_util`, primary=`coding_workflow`, inlineSourceMap=no
- `tasks/RemoteAgentTask/RemoteAgentTask.tsx`: bytes=126389, owner=`agent_lifecycle`, primary=`coding_workflow`, inlineSourceMap=yes
- `services/api/claude.ts`: bytes=125779, owner=`model_cost_context`, primary=`coding_workflow`, inlineSourceMap=no
- `tools/AgentTool/UI.tsx`: bytes=125359, owner=`tool_protocol`, primary=`coding_workflow`, inlineSourceMap=yes
- `components/permissions/ExitPlanModePermissionRequest/ExitPlanModePermissionRequest.tsx`: bytes=121607, owner=`permission_gate`, primary=`coding_workflow`, inlineSourceMap=yes

## DSXU V20 Absorption Rules
- Equivalent behavior: merge into the named DSXU original-side owner and remove duplicate runtime paths.
- Different behavior: map to a named mainline owner, not a generic bucket.
- Product-specific Claude behavior: adapt only when it strengthens DSXU DeepSeek operation; otherwise exclude.
- Data support is mandatory: every senior-programmer-feel feature needs raw session/tool/cost/context/permission evidence, not a prose-only report.

## Next Implementation Priority
1. DSXU session evidence store and operator data model.
2. Permission-first tool execution plus rich permission UI.
3. Context/memory/compaction with visible state and recovery.
4. Coding-situation layer: git/LSP/diff/review/status.
5. Agent lifecycle evidence: transcript, tools subset, abort/cleanup, cost, owner.
6. V20 real-operation test harness using raw transcripts and UI screenshots.
