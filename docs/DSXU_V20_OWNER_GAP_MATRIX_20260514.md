# DSXU V20 Owner Gap Matrix - 2026-05-14

## 1. 输入与边界

本文件是 `DSXU_V20_MASTER_PLAN_20260514.md` 的 V20-C2 / V20-C3 初始执行产物，依赖：

- `docs/DSXU_V20_MAINLINE_OWNER_MAP_20260514.md`
- `docs/generated/DSXU_V20_CLAUDE_SRC_FILE_AUDIT_20260514.csv`

本矩阵只做 owner 映射与差距判断，不新增主链、不新增入口、不新增 runtime。

## 2. Claude 1902 文件动作统计

| CSV 动作 | 数量 | V20 状态解释 | 处理 |
|---|---:|---|---|
| `absorb_into_dsxu_mainline` | 988 | 能力可进入 DSXU mainline，但必须落到 C1 owner | 映射到命名 owner，证明 import/use，不直接复制文件 |
| `adapt_or_exclude_product_specific` | 594 | Claude 产品专属或需 provider-neutral 改写 | 排除、改写、或映射到 DSXU 原侧 owner |
| `review_absorb_as_shared_utility_only_if_imported` | 278 | 只能在真实 owner import 时作为 utility | 不允许形成 shared-runtime 大桶 |
| `review_candidate` | 42 | owner 不清或 support 层过厚 | 必须 owner review，不能默认吸收 |

## 3. Owner Family 到 DSXU Owner 映射

| CSV owner_family | 数量 | DSXU owner | 判断 |
|---|---:|---|---|
| `experience_ui` | 545 | UI / TUI Visible State | 只吸收状态模型和交互机制，不复制变换后 UI 外壳 |
| `support_util` | 408 | 按真实 import 分派到具体 owner | 禁止作为 support bucket；没有真实 import 则不吸收 |
| `tool_protocol` | 191 | Tool Lifecycle | 工具 schema / validation / execution / evidence 进入现有 Tool Lifecycle |
| `coding_workflow` | 182 | Coding Workflow | git / diff / LSP / review / doctor 进入真实代码现场 |
| `mcp_skill_plugin` | 172 | MCP / Skill / Plugin + Ecosystem Compatibility | registry/intake 是 real-gap，但不能新 runtime |
| `permission_gate` | 107 | Permission / Tool Gate | shell/file/MCP/Agent/remote 权限归同一 gate |
| `model_cost_context` | 104 | DeepSeek Model Router + Context | provider 专属排除，DeepSeek V4 混合路由保留 |
| `unclassified_support` | 98 | manual owner review | 禁止保留为 owner；必须拆到命名 owner |
| `agent_lifecycle` | 93 | Agent / Task | parent/worker/background/resume/evidence 归 Agent owner |
| `query_engine` | 2 | Query Loop | 只能补强现有 `query.ts` / `QueryEngine.ts` |

## 4. 首批 Gap 分类

| 状态 | 当前来源 | 初始数量 / 范围 | 处理 |
|---|---|---:|---|
| `already-mainline` | C1 owner map + `absorb_into_dsxu_mainline` | 988 候选 | 逐 owner 证明 import/use，重复等价则合并 |
| `product-specific-exclude` | `adapt_or_exclude_product_specific` | 594 | Claude/Anthropic/订阅/GrowthBook/remote proprietary 不进入 DSXU runtime |
| `shared-utility-review` | `review_absorb_as_shared_utility_only_if_imported` | 278 | 只有真实 owner import 才保留，否则 replace/delete candidate |
| `manual-owner-review` | `review_candidate` | 42 | 全部拆 owner，不允许 `unclassified_support` |
| `real-gap` | C1 中缺 install/intake/facade 的能力 | 3 个功能包 | MCP registry、Claude-compatible intake、Bridge/Remote clean-room facade |
| `blocked-input` | P12 target-reference raw | target logs 仍需真实输入 | 不用 generic/task-only 证据替代 |

## 5. 42 个 review candidate

这些条目当前全部落在 `unclassified_support`，V20 不能把它们作为桶保留。下一步必须逐个归到命名 owner 或标 replace/delete candidate。

| 路径 | 初始信号 | 初始处理 |
|---|---|---|
| `cli/exit.ts` | CLI lifecycle | 映射到 UI/TUI 或 product-specific exclude |
| `cli/handlers/autoMode.ts` | permission / CLI mode | 映射到 Permission / Tool Gate |
| `cli/ndjsonSafeStringify.ts` | transport serialization | 映射到 Bridge/Remote/SDK facade 或 utility only-if-imported |
| `cli/transports/HybridTransport.ts` | transport | Bridge/Remote facade review |
| `cli/transports/SerialBatchEventUploader.ts` | transport/evidence | Evidence / Bridge review |
| `cli/transports/WebSocketTransport.ts` | transport | Bridge/Remote facade review |
| `cli/transports/WorkerStateUploader.ts` | worker state | Agent / Bridge review |
| `moreright/useMoreRight.tsx` | UI | UI/TUI review |
| `outputStyles/loadOutputStylesDir.ts` | output style | UI/TUI or plugin output owner |
| `projectOnboardingState.ts` | project state | Context / Memory review |
| `query/deps.ts` | query deps | Query Loop review |
| `replLauncher.tsx` | REPL launch | Entry/UI review; cannot become new entry |
| `services/analytics/index.ts` | telemetry | Evidence / telemetry review |
| `services/api/adminRequests.ts` | API service | Provider-specific exclude unless DeepSeek owner needs it |
| `services/api/emptyUsage.ts` | usage | DeepSeek Model Router / Cost review |
| `services/api/sessionIngress.ts` | session ingress | Bridge/Remote/SDK facade review |
| `services/autoDream/consolidationLock.ts` | background memory | Context / Agent review |
| `services/autoDream/consolidationPrompt.ts` | background memory | Context / Agent review |
| `services/extractMemories/prompts.ts` | memory prompt | Context / Memory review |
| `services/internalLogging.ts` | logging | Evidence / telemetry review |
| `services/MagicDocs/magicDocs.ts` | docs/product feature | product-specific exclude or Coding Workflow |
| `services/MagicDocs/prompts.ts` | docs/product prompt | product-specific exclude or Coding Workflow |
| `services/notifier.ts` | notification | UI/TUI visible state or task notification |
| `services/preventSleep.ts` | runtime utility | Task / long-running session utility only-if-imported |
| `services/PromptSuggestion/speculation.ts` | prompt suggestion | UI/TUI + Context review |
| `services/teamMemorySync/teamMemSecretGuard.ts` | team memory secret | Context / Permission review |
| `services/teamMemorySync/watcher.ts` | memory watcher | Context / Agent review |
| `services/tips/tipScheduler.ts` | tips | UI/TUI product-specific review |
| `services/toolUseSummary/toolUseSummaryGenerator.ts` | tool summary | Tool Lifecycle / Context review |
| `state/AppState.tsx` | state | UI/TUI / Query state owner |
| `state/selectors.ts` | state selectors | UI/TUI utility only-if-imported |
| `state/store.ts` | state store | UI/TUI / Query owner |
| `Task.ts` | task base | Agent / Task review |
| `tasks.ts` | task registry | Agent / Task review |
| `tasks/DreamTask/DreamTask.ts` | background task | Agent / product-specific review |
| `tasks/LocalMainSessionTask.ts` | session task | Agent / Task review |
| `tasks/LocalShellTask/guards.ts` | shell task guard | Permission / Tool Gate review |
| `tasks/LocalShellTask/killShellTasks.ts` | shell cleanup | Tool Lifecycle / Recovery review |
| `tasks/LocalShellTask/LocalShellTask.tsx` | shell task runtime | Tool Lifecycle / Agent review |
| `tasks/pillLabel.ts` | UI label | UI/TUI utility only-if-imported |
| `tasks/stopTask.ts` | task stop | Agent / Task owner |
| `upstreamproxy/relay.ts` | upstream proxy | Bridge/Remote/CI facade review; cannot become provider runtime |

## 6. High-Risk Packets

### V20-GM-01 Tool / Permission / Query Core

Scope:

- `query/deps.ts`
- `services/toolUseSummary/toolUseSummaryGenerator.ts`
- `tasks/LocalShellTask/*`
- current DSXU files: `src/query.ts`, `src/QueryEngine.ts`, `src/services/tools/*`, `src/hooks/useCanUseTool.tsx`, `src/utils/permissions/*`

Decision rule:

- If equivalent to existing `query.ts` / `services/tools` / Permission Gate behavior, merge or mark replace/delete candidate.
- If different, map to Query Loop, Tool Lifecycle, or Permission / Tool Gate.
- No second tool runner.

### V20-GM-02 MCP / Plugin / Ecosystem Compatibility

Scope:

- Claude bridge and MCP-like capability references.
- current DSXU: `src/services/mcp/*`, `src/utils/plugins/*`, `src/skills/*`, `src/tools.ts`

Decision rule:

- MCP registry / install UX is `real-gap`.
- `.mcp.json` exists as schema and must remain intake.
- `CLAUDE.md` / `.claude/commands` / `.claude/skills` become intake only, mapped to Context / Commands / Skills / MCP owner.
- No compatibility runtime.

### V20-GM-03 Bridge / Remote / CI Facade

Scope:

- Claude `bridge/*`, `cli/transports/*`, `upstreamproxy/relay.ts`
- current DSXU: `src/hooks/useReplBridge.tsx`, `src/hooks/useRemoteSession.ts`, `src/dsxu/engine/provider-backend/*`

Decision rule:

- Clean-room facade only.
- Must enter Query Loop and Permission Bridge.
- Existing default-mainline bridge disablement remains the safety baseline.
- No legacy bridge runtime reactivation unless explicitly marked migration/test-only.

### V20-GM-04 Model / Cost / Context

Scope:

- `assistant/sessionHistory.ts`, `services/api/*`, memory prompts, usage files.
- current DSXU: `src/utils/model/deepseekV4Control.ts`, `src/services/api/deepseek-adapter.ts`, `src/cost-tracker.ts`, `src/services/compact/*`, `src/memdir/*`

Decision rule:

- DeepSeek V4 Flash / Flash-MAX / Pro mixed routing is the only provider mainline.
- Claude provider / billing / admin / subscription logic is excluded or provider-neutralized.
- Cost and context evidence must be visible in final report and release gate.

### V20-GM-05 UI/TUI Experience And Evidence

Scope:

- `experience_ui` 545 files.
- current DSXU: `src/screens/REPL.tsx`, `src/components/*`, `src/hooks/notifs/*`, permission components.

Decision rule:

- Absorb state model and workflow ergonomics, not compiled UI shell.
- UI cannot own product runtime.
- Experience tests must operate through real REPL/TUI state.

## 7. 下一步批量执行顺序

1. 先处理 `review_candidate=42`：逐个归 owner 或 replace/delete candidate。
2. 同时处理 Bridge/Remote packet：证明 facade，不让它回到旧 bridge runtime。
3. 处理 MCP/Plugin packet：把 registry / compatible intake 标成 real-gap 但落到现有 owner。
4. 处理 Model/Cost/Context packet：确认 DeepSeek V4 混合路由唯一主线。
5. 再进入代码层合并/去重，不提前跑最终测试。
