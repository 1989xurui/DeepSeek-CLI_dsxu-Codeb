# DSXU V20 全代码主链整合与清理评估

日期：2026-05-14

适用目标：`DSXU_V20_MASTER_PLAN_20260514.md`

## 0. 结论先行

这次评估不是继续补小补丁，而是把 DSXU 当前源码放回 V20 目标下重新判定：哪些已经在主链，哪些只是从 Claude 风格迁移来的外壳，哪些有吸收价值，哪些是重复旧块或垃圾候选。

当前判断：

1. DSXU 已经不是“缺功能的空壳”，而是已经吸收了大量 Claude 风格的 TUI、工具、MCP、权限、上下文、任务、桥接和证据结构。
2. 真正风险不在“功能太少”，而在“过多来源混在一起后，主链边界不够硬”：`runtime-core.ts`、`legacy provider`、`provider compat/bridge`、V14/V15 shim、CLI transport、MagicDocs/autoDream/tips/teamMemory 等块，容易形成第二套运行时或产品幽灵功能。
3. V20 不能继续用“兼容、桥接、临时保留”当产品路径。能合并进原侧 owner 的就合并；不能证明 import/use 价值的就进入 replace/delete candidate；不同但有价值的能力必须挂到命名主链 owner。
4. 当前 `git status --short` 只剩 V20 文档/生成索引 8 项，源码本身没有新的 dirty 变更。后续要让源码数字下降或结构变干净，必须按 owner packet 进入真实 Git review/删除确认，不应继续用本地小补丁绕开。
5. 在用户确认本评估口径后，下一步最合理动作不是全面测试，而是先做源码结构收口：V14/V15 shim、`runtime-core.ts`、legacy/provider compat、bridge/remote、42 个 review candidates 五类清理包。

## 1. 评估边界

本文件只做代码结构、主链归属、清理候选和执行顺序评估。它不替代最终测试，也不替代 P12 target raw input、owner/Git signoff、pending deletion Git review。

本次不直接删除源码，原因是：

1. 用户要求先全面分析整合方案，确认合理后再执行。
2. DSXU 当前源码已经大量吸收 Claude 风格，不能用文件名或旧标签直接判断垃圾。
3. 有些“旧名”仍被产品路径 import，例如 legacy provider 与 bridge facade，必须先迁移或证明不用，再删除。

## 2. 当前源码事实

### 2.1 工作区状态

当前 dirty 只集中在 V20 文档与生成索引：

| 项 | 当前状态 |
|---|---:|
| `git status --short` 计数 | 8 |
| 源码 dirty | 0 |
| dirty 类型 | V20 文档 / generated CSV |

这说明前一轮“2609”已经不是当前源码 dirty 事实；现在的问题从“Git 数字很大”转成“V20 主链是否该继续吸收、合并和删除旧块”。

### 2.2 `src` 总体规模

| 区域 | 文件数 | 说明 |
|---|---:|---|
| `src` 总计 | 2752 | 当前 DSXU 源码主范围 |
| `src/dsxu` | 730 | DSXU 自有引擎、legacy、provider/backend、evidence/test 等集中区 |
| `src/utils` | 585 | 上下文、权限、模型、bash、消息、配置、插件等共享工具 |
| `src/components` | 393 | TUI/React 体验层 |
| `src/commands` | 208 | CLI 命令层 |
| `src/services` | 203 | MCP、API、compact、tool summary 等服务 |
| `src/tools` | 199 | 工具定义与工具生命周期 |
| `src/hooks` | 104 | TUI hook、权限、桥接、远程会话等 |
| `src/ink` | 96 | TUI 基础组件 |
| `src/coordinator` | 26 | 协调器相关 |
| `src/skills` | 23 | skill runtime / registry 相关 |
| `src/cli` | 19 | CLI print、transport、handler 等 |
| `src/tasks` | 12 | task runtime |
| `src/state` | 6 | App state/store/selectors |

### 2.3 超大源码文件

| 文件 | 行数级别 | 初步判断 |
|---|---:|---|
| `src/dsxu/engine/runtime-core.ts` | 8899 | P0 结构风险。过宽运行时容器，必须拆薄，不应保留第二套 runtime。 |
| `src/screens/REPL.tsx` | 5366 | 主 TUI 入口，保留但要避免继续膨胀。 |
| `src/cli/print.ts` | 5362 | CLI 输出大文件，需归 UI/CLI owner，不能混业务 runtime。 |
| `src/utils/messages.ts` | 5138 | 消息/上下文核心工具，保留但要控制职责。 |
| `src/utils/sessionStorage.ts` | 4712 | 会话持久化核心，保留。 |
| `src/utils/hooks.ts` | 4708 | hook 大集合，需后续拆 owner。 |
| `src/main.tsx` | 4566 | 产品入口主链，不能新增替代入口。 |
| `src/query.ts` | 4557 | Query Loop 主链，不能新增第二 query loop。 |
| `src/dsxu/engine/tool-runtime-dirty-review-v1.ts` | 4076 | P0/P1 审查对象。名字与内容都显示 dirty review 过渡性质。 |

## 3. V20 判断标准

每个文件或能力按七个维度评估：

| 维度 | 问题 |
|---|---|
| 目标价值 | 是否增强 DeepSeek V4 Flash / Flash-MAX / Pro 混合模型下的高级编程与复杂任务体验？ |
| 原侧 owner | 是否能挂到已有主链 owner，而不是创建新入口、新 runtime、新工具系统？ |
| import/use 证据 | 是否被真实产品路径 import/use？是否只是测试、报告、证据或旧文档引用？ |
| 唯一性 | 是否与已有 DSXU 功能重复？重复是否等价？ |
| 风险 | 是否会造成第二套 permission、provider、MCP、agent、tool lifecycle、query loop？ |
| 可测试性 | 是否能用真实功能、体验、恢复、性能、评测、发布测试证明？ |
| 发布边界 | 是否应进入 clean export？是否只是本地 evidence、migration、compat、test-only？ |

### 3.1 状态标签

| 标签 | 含义 | 处理 |
|---|---|---|
| `keep-mainline` | 已是主链 owner 的必要实现 | 保留并加强测试 |
| `merge-into-owner` | 有价值但位置/边界不对 | 合并到命名 owner |
| `replace-delete-candidate` | 与主链重复或旧实现无独立价值 | owner review 后删除或替换 |
| `product-specific-exclude` | Claude/Anthropic 产品绑定，不适合 DSXU 产品路径 | 隔离、移除或转 DSXU 等价实现 |
| `test-evidence-only` | 只应服务测试/报告/证据 | 不进入 runtime 主链 |
| `manual-owner-review` | import/use 复杂，不能自动删 | 建 owner packet 审核 |
| `real-gap` | DSXU 目标需要但当前没有 | 在现有 owner 内实现 |

## 4. 主链 owner 现状

### 4.1 Product Entry / Query Loop

主链事实：

| 主链点 | 文件 |
|---|---|
| CLI/bin 入口 | `package.json` |
| DSXU mode 入口 | `src/entrypoints/dsxu-code.tsx` |
| TUI 主入口 | `src/main.tsx`、`src/screens/REPL.tsx` |
| Query Loop | `src/query.ts` |
| SDK / noninteractive | `src/QueryEngine.ts` |

判断：

1. 入口主链已经存在，不允许新增产品入口。
2. Query Loop 以 `src/query.ts` 与 `src/QueryEngine.ts` 为主，V20 不能再造第二个 query engine。
3. `runtime-core.ts` 里如果仍保留 query/provider/tool/permission 综合 factory，只能拆回这些 owner。

处理方向：

| 项 | 决策 |
|---|---|
| `src/query.ts` | `keep-mainline` |
| `src/QueryEngine.ts` | `keep-mainline` |
| `src/dsxu/engine/runtime-core.ts` 内 query/provider/tool 综合 runtime | `merge-into-owner` 或 `replace-delete-candidate` |

### 4.2 Tool Lifecycle / Tool Gate

主链事实：

| owner | 文件 |
|---|---|
| 工具注册 | `src/tools.ts` |
| 工具定义 | `src/Tool.ts`、`src/tools/*` |
| 工具服务 | `src/services/tools/*` |
| 权限判断 | `src/hooks/useCanUseTool.tsx`、`src/utils/permissions/permissions.ts` |
| Shell/File adapter | `src/tools/BashTool/*`、`src/tools/EditTool/*`、`src/tools/WriteTool/*`、PowerShell 相关 utils |

判断：

1. DSXU 已有完整工具生命周期，不需要第二套 tool runtime。
2. 所有 tool helper 必须进入 Tool Gate、Bash/PowerShell adapter、control-plane permission bridge、visible-state projection。
3. `tool-runtime-dirty-review-v1.ts`、`runtime-core.ts` 内任何独立工具执行/权限/生命周期逻辑都要拆出或删除。

处理方向：

| 项 | 决策 |
|---|---|
| `src/tools.ts` | `keep-mainline` |
| `src/services/tools/*` | `keep-mainline` |
| `src/dsxu/engine/tool-runtime-dirty-review-v1.ts` | P0 owner review，不能当 runtime 主链 |
| `runtime-core.ts` tool helper | 合并进 Tool Lifecycle 或删除 |

### 4.3 Permission / Control Plane

主链事实：

| owner | 文件 |
|---|---|
| 权限核心 | `src/utils/permissions/permissions.ts` |
| TUI 权限 hook | `src/hooks/useCanUseTool.tsx` |
| 权限 UI | `src/components/permissions/*`、相关 dialogs |
| visible state | REPL / state / bridge projection |

判断：

1. 权限主链存在。
2. V20 要加强的是“可解释、可恢复、可审计”的权限体验，不是新增 permission manager。
3. 任何 `PermissionManager` 或本地 quick gate 如果没有导入主链，必须删除或转测试证据。

处理方向：

| 项 | 决策 |
|---|---|
| 主权限文件 | `keep-mainline` |
| 非主链 PermissionManager | `replace-delete-candidate` |
| adapter permission bridge | 只允许作为 projection，不允许成为产品权限主链 |

### 4.4 DeepSeek Model Router / Cost / Evidence

主链事实：

| owner | 文件 |
|---|---|
| DeepSeek 控制 | `src/utils/model/deepseekV4Control.ts` |
| Provider adapter | `src/services/api/deepseek-adapter.ts` |
| API service | `src/services/api/dsxu.ts`、`src/dsxu/engine/api-service.ts` |
| 成本 | `src/cost-tracker.ts` |
| 模型选择 | `src/utils/model/*` |

判断：

1. V20 的核心是 DeepSeek V4 Flash / Flash-MAX / Pro 混合模型，不是复制 Claude provider runtime。
2. Anthropic/Claude legacy provider 只能作为 migration/intake/test 或 DSXU 等价能力参考。
3. `api-service.ts` 当前不是垃圾，但只能是 provider transport/health/fallback boundary，不能承担第二 QueryEngine 或 runtime。

处理方向：

| 项 | 决策 |
|---|---|
| DeepSeek model owner | `keep-mainline` |
| `src/dsxu/engine/api-service.ts` | `keep-mainline` 但收窄职责 |
| legacy provider model files | `merge-into-owner` 或 `product-specific-exclude` |
| Claude/Anthropic-only billing/subscription/GrowthBook | P1 release/product review |

### 4.5 Context / Memory / Compact / Resume

主链事实：

| owner | 文件 |
|---|---|
| Compact | `src/services/compact/*` |
| Memory | `src/memdir/*` |
| Session | `src/utils/sessionStorage.ts` |
| Messages | `src/utils/messages.ts` |
| Context | `src/context.ts` |

判断：

1. 这是 DSXU 对标高级程序员体验的核心：长任务、恢复、证据、上下文压缩、任务连续性。
2. 不能把 autoDream/teamMemory/MagicDocs 这类侧线直接当主链，必须映射到 Context/Memory/Task/Evidence。
3. 如果这些模块只是旧产品记忆/提示/运营逻辑，不应进入 DSXU runtime。

处理方向：

| 项 | 决策 |
|---|---|
| compact/session/messages | `keep-mainline` |
| autoDream/teamMemory/MagicDocs | P1 owner review，按真实价值吸收或删除 |
| 纯 prompt/speculation/tips | 若无产品路径价值，`replace-delete-candidate` |

### 4.6 Agent / Task / Coordinator

主链事实：

| owner | 文件 |
|---|---|
| Agent Tool | `src/tools/AgentTool/*` |
| Local Agent Task | `src/tasks/LocalAgentTask/*` |
| In Process Teammate | `src/tasks/InProcessTeammateTask/*` |
| Coordinator | `src/coordinator/*` |

判断：

1. V20 要的是一个主线 Agent lifecycle，不是多个 agent orchestrator。
2. Claude 风格的 task、shell task、dream task、teammate task 如果有价值，必须归到 Agent/Task owner。
3. remote/local shell/worker state 不能独立变成 agent runtime。

处理方向：

| 项 | 决策 |
|---|---|
| AgentTool/LocalAgentTask | `keep-mainline` |
| LocalShellTask/Task.ts/tasks.ts candidates | `manual-owner-review` |
| DreamTask/autoDream | 价值审查后 merge 或 delete |

### 4.7 MCP / Skill / Plugin / Ecosystem Intake

主链事实：

| owner | 文件 |
|---|---|
| MCP service | `src/services/mcp/*` |
| MCP CLI handler | `src/cli/handlers/mcp.tsx` |
| Plugin schema/loader | `src/utils/plugins/*` |
| Skill | `src/skills/*` |
| Tool registry integration | `src/tools.ts` |

判断：

1. MCP/Skill/Plugin 主链存在，但 V20 对标高级体验还缺“注册表/安装/状态/doctor/冲突解释”的产品级闭环。
2. `CLAUDE.md`、`.claude/*` 等生态兼容只能作为显式 intake，不应默认变成 DSXU 源 truth。
3. 不能保留独立 MCP runtime；所有 MCP 能力进入 `src/services/mcp/*` 和 `src/tools.ts`。

处理方向：

| 项 | 决策 |
|---|---|
| MCP service | `keep-mainline` |
| Plugin/Skill schema | `keep-mainline` |
| Claude ecosystem intake | `real-gap`，但必须作为显式 intake |
| registry install UX | `real-gap` |

### 4.8 Bridge / Remote / CI Facade

主链事实：

| owner | 文件 |
|---|---|
| TUI bridge hook | `src/hooks/useReplBridge.tsx` |
| Remote session | `src/hooks/useRemoteSession.ts` |
| Direct connect | `src/hooks/useDirectConnect.ts` |
| Provider compat facade | `src/dsxu/engine/provider-backend/dsxu-provider-compat.ts` |
| CLI transports | `src/cli/transports/*` |
| Bridge commands | `src/commands/bridge/*` |

判断：

1. 这是最高风险区之一。当前 provider compat facade 仍被多个产品文件 import。
2. 如果它只是 archived stub，不能继续被当 runtime 调用；如果它是 DSXU remote/bridge facade，就要改名、拆 owner、收敛到桥接边界。
3. bridge/remote/direct-connect 可以保留为 adapter boundary，但不能成为第二产品 runtime。

处理方向：

| 项 | 决策 |
|---|---|
| `dsxu-provider-compat.ts` | P0 拆分：real facade / archived stubs / delete candidates |
| CLI transports | P1 owner review |
| bridge commands/hooks | `merge-into-owner` |
| standalone remote runtime | 不允许 |

### 4.9 UI / TUI Experience

主链事实：

| owner | 文件 |
|---|---|
| Main REPL | `src/screens/REPL.tsx` |
| Components | `src/components/*` |
| Ink primitives | `src/ink/*` |
| CLI print | `src/cli/print.ts` |
| State | `src/state/*` |

判断：

1. DSXU 已经有大量 Claude 风格体验层，这是优势。
2. 真正要补的是“高级程序员体验”的闭环：计划、上下文、权限、工具进度、恢复、成本、证据、失败解释在 UI 中统一表达。
3. 编译/转换痕迹、V14 shim、旧 gating 不应污染主 UI 源码。

处理方向：

| 项 | 决策 |
|---|---|
| REPL/components/ink | `keep-mainline` |
| V14 lifecycle shim | P0 清理候选 |
| 体验 copy 中 Claude/Anthropic 产品名 | P1 产品化替换 |

## 5. 垃圾与清理候选

这里的“垃圾”不是按名字粗删，而是按 V20 标准判断：不属于主链、无真实 import/use 价值、与主链重复、旧产品绑定、或会制造第二套 runtime 的内容。

### 5.1 P0：必须先处理的结构垃圾/风险

| 候选 | 证据 | 风险 | 处理 |
|---|---|---|---|
| V14 lifecycle shim | 821 个文件含 V14 shim 标记 | 大面积迁移噪声，掩盖真实 owner | 批量 import/use 验证后删除或收束到单一 owner |
| `src/dsxu/engine/runtime-core.ts` | 8899 行，导出大量 runtime/factory | 第二 runtime 风险最高 | 拆到 Query/Tool/Permission/Model/Agent/MCP owner；剩余薄 facade 或删除 |
| `src/dsxu/engine/tool-runtime-dirty-review-v1.ts` | 4076 行，文件名就是 dirty review | 工具运行时重复风险 | 与 `src/tools.ts` / Tool Gate 对齐，重复删除 |
| `src/dsxu/engine/provider-backend/dsxu-provider-compat.ts` | 多个产品路径 import，且含 archived/stub API | 旧 provider/bridge 幽灵主链 | 拆 real bridge facade；archived stubs 进入 delete candidate |
| legacy provider outward imports | `src/utils/auth.ts`、model utils、tools、commands 仍 import legacy | Claude provider 逻辑污染 DeepSeek 主链 | 迁移到 DeepSeek owner、显式 migration gate 或删除 |

### 5.2 P1：高价值但边界不清的审查包

| 候选 | 初步 owner | 判断 |
|---|---|---|
| `src/cli/transports/*` | Bridge/Remote/CI Facade | 可保留为 adapter boundary，但不能成为 runtime |
| `src/services/MagicDocs/*` | Context/Evidence/UX | 若只是旧产品功能，删除；若可转 DSXU 自动文档证据，合并 |
| `src/services/autoDream/*` | Agent/Context | 需证明真实复杂任务价值，否则删除 |
| `src/services/teamMemorySync/*` | Context/Memory | 需变成 DSXU memory owner，不可保留旧 team sync |
| `src/services/tips/*`、`PromptSuggestion/*` | UX | 只保留能提升编程执行的建议系统 |
| `src/state/*` | UI/TUI visible state | 保留，但必须只投影状态，不承载 runtime |

### 5.3 P1：42 个 review candidates

从 Claude 1902 文件索引转入 DSXU 评估后，仍需人工 owner review 的候选有 42 个。当前扫描显示其中 `src/replLauncher.tsx` 与 `src/upstreamproxy/relay.ts` 在 DSXU 当前源码中不存在，倾向于已被移动/删除，不应为了兼容再复活。

| 类型 | 文件示例 | 处理 |
|---|---|---|
| CLI / transport | `cli/exit.ts`、`HybridTransport.ts`、`WebSocketTransport.ts`、`WorkerStateUploader.ts` | Bridge/CLI owner review |
| onboarding / output | `outputStyles/loadOutputStylesDir.ts`、`projectOnboardingState.ts` | UI/UX owner review |
| memory / docs / dream | `MagicDocs/*`、`autoDream/*`、`teamMemorySync/*` | Context/Evidence/Agent owner review |
| task / shell task | `Task.ts`、`tasks.ts`、`LocalShellTask/*` | Agent/Task owner review |
| analytics / logging / notifier | `analytics/index.ts`、`internalLogging.ts`、`notifier.ts`、`preventSleep.ts` | Release/privacy/runtime owner review |

### 5.4 P2：发布与体积清理

| 候选 | 判断 |
|---|---|
| `src/utils/vendor/ripgrep/*/rg*` | 不是源码垃圾，但必须明确 release/export 是否内置 vendor binary。 |
| `src/components/LogoV2/assets/*.png` | 不是源码垃圾，属于 UI asset；release policy 审核即可。 |
| TODO/FIXME | 当前 TODO 153、FIXME 2；不阻断主链，但要进入 V20 polish backlog。 |
| `.dsxu` / evidence | 当前作为证据库，不进 clean export；不是源码清理对象。 |
| `node_modules` | 本地测试/构建依赖，不进 release/export。 |

## 6. 为什么不能“先测试再说”

最终测试只能证明现状，不能替代功能判断。

当前 V20 真正未闭环的是结构与输入：

1. P12 target-reference real raw input 仍需要真实 manifest。
2. Owner/Git packets 需要显式签收，不能本地自动 stage/delete。
3. P0 结构风险如果不先处理，即使测试通过，也可能只是证明“重复 runtime 也能跑”，不等于 V20 主链干净。
4. clean export 不能在旧 provider/bridge/shim/runtime 边界未收口时放行。

所以测试顺序应保持：

1. 功能测试
2. 体验测试
3. 恢复测试
4. 性能测试
5. 评测测试
6. 发布收口测试

但进入这六类测试前，必须先完成 P0/P1 owner 收口，否则测试会放大错误结构。

## 7. 下一步整合方案

### Packet A：建立源码候选总账

目标：把所有疑似旧块、重复块、shim、compat、legacy、review candidate 放进同一张表，避免后续反复补桶。

产物：

1. V14/V15 shim 文件清单。
2. `runtime-core.ts` export/import/use 清单。
3. `provider-compat` import/use 清单。
4. legacy provider outward import 清单。
5. 42 review candidates 当前存在性与 owner 判定。

通过标准：

1. 每个候选只有一个 owner。
2. 没有 `misc`、`support bucket`、`later`。
3. 每个候选标记 `merge-into-owner`、`replace-delete-candidate`、`test-evidence-only`、`keep-mainline`。

### Packet B：V14/V15 shim 清理

目标：清理迁移噪声，不让它继续冒充产品结构。

做法：

1. 先确认 V14/V15 shim 是否被任何真实 runtime import。
2. 对纯注释/标记/无用导出批量删除。
3. 对仍被 import 的 helper 合并到命名 owner。

不允许：

1. 新增 `compat/shim` 总入口。
2. 把所有 shim 放进一个 shared runtime。

### Packet C：`runtime-core.ts` 拆薄

目标：去掉第二 runtime 风险。

做法：

1. 将 query 相关逻辑归 `src/query.ts` / `src/QueryEngine.ts`。
2. 将 tool 相关逻辑归 `src/tools.ts` / `src/services/tools/*`。
3. 将 permission 相关逻辑归 `src/utils/permissions/*` / `useCanUseTool`。
4. 将 model/provider 相关逻辑归 DeepSeek adapter / API service。
5. 将 MCP/skill 相关逻辑归 `src/services/mcp/*` / `src/skills/*`。
6. 将 test/mock/evidence helper 移到 test/evidence owner。

通过标准：

1. `runtime-core.ts` 不再导出独立 runtime factory。
2. 产品路径不通过 `runtime-core.ts` 调用第二套工具、权限、MCP、provider。
3. 只允许保留薄 composition 或删除。

### Packet D：Legacy Provider / Claude Product 逻辑隔离

目标：DeepSeek 主链不能继续被 Claude/Anthropic provider 产品逻辑驱动。

做法：

1. 统计所有 `src/dsxu/legacy/*` outward imports。
2. 分成三类：
   - DSXU 需要的通用能力：迁移到 DeepSeek owner。
   - 生态 intake/migration：显式 gate。
   - Claude 产品专属：删除或 release exclude。
3. 替换 UI/copy/命令中的 Claude/Anthropic-only 语义。

通过标准：

1. 默认产品路径不依赖 legacy provider。
2. legacy 仅能在显式 migration/intake/test 模式出现。

### Packet E：Bridge / Remote / Direct Connect 收口

目标：只保留 adapter boundary，不保留 standalone runtime。

做法：

1. 拆 `dsxu-provider-compat.ts`：
   - real bridge facade
   - archived no-op/stub delete candidate
   - DSXU owner replacement
2. CLI transports 统一到 Bridge/Remote owner。
3. UI hooks 只做 visible state projection。

通过标准：

1. 没有 provider compat 主导的产品 runtime。
2. remote/bridge 是 opt-in adapter，不影响本地主链。

### Packet F：MCP / Skill / Plugin 体验增强

目标：把已有 MCP/Skill/Plugin 从“能用”变成高级程序员体验。

做法：

1. 在现有 `src/services/mcp/*` 和 `src/cli/handlers/mcp.tsx` 增加 registry/install/status/doctor。
2. `.mcp.json`、Claude Desktop、plugin manifest 做显式 intake。
3. MCP 工具进入 `src/tools.ts` 的同一工具生命周期和权限 gate。

通过标准：

1. 没有第二 MCP runtime。
2. 用户能看到 MCP 能力来源、权限、失败原因、恢复建议。

### Packet G：Agent / Tool / Context / Cost 体验闭环

目标：让 DeepSeek 模型在编程复杂任务中表现得像高级程序员。

做法：

1. Agent 任务有明确 plan、tool budget、context budget、rollback/recovery 状态。
2. Tool 执行有权限、进度、失败解释、重试策略。
3. Context 有压缩、恢复、证据链接。
4. Cost 有 Flash / Flash-MAX / Pro 路由依据。

通过标准：

1. 不靠模型裸能力硬扛。
2. UI/TUI 能解释为什么选择某模型、某工具、某恢复策略。

### Packet H：最终测试与发布收口

触发条件：

1. P12 target-reference raw input 已导入或明确切到 owner/Git signoff 路径。
2. P0/P1 owner packets 完成。
3. Pending deletion candidates 完成 Git review。
4. Permission/ownership residues 有外部签收或保留说明。

测试顺序：

1. 功能测试
2. 体验测试
3. 恢复测试
4. 性能测试
5. 评测测试
6. 发布收口测试

通过标准：

1. clean export 不含 evidence、node_modules、`.dsxu`、旧 compat runtime。
2. 产品默认路径只走 DSXU 主链。
3. V20 验收文档全部 PASS。

## 8. 对标能力判断

如果只看当前 DSXU 已吸收的文件与结构，产品已经具备对标高级 AI coding agent 的基础：

| 能力面 | 当前水平 | 主要差距 |
|---|---|---|
| TUI/交互体验 | 高 | copy、visible state、旧 shim 清理 |
| 工具系统 | 高 | tool runtime 边界要收口 |
| 权限系统 | 中高 | 需统一解释与恢复 |
| Context/Resume | 中高 | 需和 Agent/Cost/Evidence 串成闭环 |
| MCP/Plugin/Skill | 中高 | 缺 registry/install/doctor 产品闭环 |
| Agent/Task | 中 | 防止多 orchestrator，强化长任务执行 |
| Model Router/Cost | 中 | DeepSeek 混合模型策略要更明确 |
| Evidence/Release | 高 | P12 target raw input 与 owner/Git signoff 未闭环 |
| 结构洁净度 | 中 | legacy/compat/runtime-core/shim 需要清理 |

保守判断：

1. 不清理 P0 结构风险：体验可能达到 75-82，但长期维护和 release 质量不稳。
2. 完成 P0/P1 收口，补齐 MCP/Agent/Cost/Context 体验闭环：可达到 88-92。
3. 再加真实 P12 raw input、全链路体验测试、恢复测试、评测测试与 clean export：才有资格宣称 90+。

## 9. 需要用户确认的执行口径

如果确认本评估合理，下一步不再继续“补小层”，而是按下面顺序执行：

1. 建 `V20 source cleanup register`：一次性列出 V14/V15 shim、runtime-core、provider-compat、legacy imports、42 review candidates。
2. 先处理 P0：
   - V14/V15 shim。
   - `runtime-core.ts` 拆薄。
   - `tool-runtime-dirty-review-v1.ts` 归并。
   - `dsxu-provider-compat.ts` 拆 real facade / delete candidate。
   - legacy provider outward import 迁移/隔离。
3. 再处理 P1：
   - CLI transports。
   - MagicDocs / autoDream / teamMemory / tips。
   - task/shell task candidates。
   - source normalization。
4. 然后进入功能、体验、恢复、性能、评测、发布收口测试。

本评估建议：先执行 Packet A + P0 清理 register，不直接大规模删除；等每个候选有 owner、import/use 证据和处理标签后，再进入实际源码删除/合并。
