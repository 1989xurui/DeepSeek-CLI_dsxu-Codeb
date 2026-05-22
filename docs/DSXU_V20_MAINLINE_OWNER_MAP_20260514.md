# DSXU V20 当前主线 Owner Map - 2026-05-14

## 1. 执行边界

本文件是 `DSXU_V20_MASTER_PLAN_20260514.md` 的 V20-C1 执行产物。

硬纪律：

- V20 不新增其它主链。
- V20 不新增其它产品入口。
- V20 不新增第二套 tool / provider / MCP / skill / permission / agent runtime。
- 所有 V20 改造必须在当前 DSXU 主线基础上执行：已有入口、已有 Query Loop、已有 Tool Gate、已有 DeepSeek Model Router、已有 Context、已有 Agent、已有 MCP/Skill/Plugin、已有 UI/TUI、已有 Evidence/Release owner。
- 重复等价行为合并到原侧 owner，另一份标 `replace/delete candidate`。
- 行为不同但有价值的能力映射到命名 mainline owner。
- 找不到 owner 的能力进入 `manual-owner-review`，不能落到 `misc`、`compat`、`support-service`、`shared-runtime` 大桶。

## 2. 当前产品入口

| 层级 | 当前入口 | 证据 | V20 决策 |
|---|---|---|---|
| npm / bin | `package.json` 的 `dsxu` / `dsxu-code` | `package.json:7`, `package.json:11` | 保留唯一产品入口，不新增 V20 入口 |
| DSXU formal entrypoint | `src/entrypoints/dsxu-code.tsx` | `src/entrypoints/dsxu-code.tsx:5`, `src/entrypoints/dsxu-code.tsx:67` | 设置 `DSXU_CODE_MODE=1` 后进入现有 CLI/TUI，不再新增入口 |
| CLI / TUI | `src/entrypoints/cli.tsx`, `src/screens/REPL.tsx` | `src/screens/REPL.tsx:5236`, `src/screens/REPL.tsx:5671` | UI/TUI 主线承载 MCP、权限、remote、commands、tools |
| SDK / non-interactive | `src/QueryEngine.ts` | `src/QueryEngine.ts:182`, `src/QueryEngine.ts:640` | SDK 复用 QueryEngine 和 `query()`，不能单独开 agent runtime |
| Query Loop | `src/query.ts` | `src/query.ts:2588` | 所有模型回合、工具递归、恢复、final gate 归这里 |
| Tool Registry | `src/tools.ts` | `src/tools.ts:266`, `src/tools.ts:432`, `src/tools.ts:480` | 所有 built-in + MCP 工具汇入这里，不另建工具池 |

结论：V20 后续 MCP registry、Claude-compatible intake、Bridge/Remote facade、V20 测试工具，都必须接入上表已有入口。新增文件可以存在，但只能是这些 owner 的实现细节，不能成为新的产品入口或平行主链。

## 3. Mainline Owner Map

| DSXU owner | 当前 source of truth | import/use evidence | Product runtime / evidence 边界 | V20 当前判断 |
|---|---|---|---|---|
| Query Loop | `src/query.ts`, `src/QueryEngine.ts` | `QueryEngine.submitMessage()` 调 `query()`：`src/QueryEngine.ts:640`；`query()` 定义：`src/query.ts:2588`；恢复 gate：`src/query.ts:135`, `src/query.ts:2183`, `src/query.ts:4559` | `query.ts` 是产品回合状态机；harness 只能证明，不替代主线 | `already-mainline`，后续只加证据和收口，不新增 loop |
| Tool Lifecycle | `src/tools.ts`, `src/services/tools/*`, `src/Tool.ts` | `getAllBaseTools()`：`src/tools.ts:266`；`assembleToolPool()`：`src/tools.ts:432`；`runTools()`：`src/services/tools/toolOrchestration.ts:57`；Streaming executor：`src/services/tools/StreamingToolExecutor.ts:49` | 工具定义、权限前置、执行、progress、result mapping 归产品 runtime；integration harness 只做验证 | `already-mainline`，V20 ToolDefinition 只能扩展这里 |
| Permission / Tool Gate | `src/hooks/useCanUseTool.tsx`, `src/utils/permissions/permissions.ts`, `src/components/permissions/*`, shell/file tool permission modules | `useCanUseTool` 调 `hasPermissionsToUseTool()`：`src/hooks/useCanUseTool.tsx:38`；主权限函数：`src/utils/permissions/permissions.ts:458`；headless hook：`src/utils/permissions/permissions.ts:386`；tool execution 记录 permission decision：`src/services/tools/toolExecution.ts:1056` | Bash、PowerShell、Edit、Write、MCP、Agent、Bridge/Remote 都必须过同一权限语义；UI 只投影，不拥有 runtime | `already-mainline`，不能新增 permission runtime |
| DeepSeek Model Router / Cost | `src/utils/model/deepseekV4Control.ts`, `src/services/api/deepseek-adapter.ts`, `src/cost-tracker.ts`, `src/services/api/dsxu.ts` | Flash/Pro 定义：`src/utils/model/deepseekV4Control.ts:1`；alias：`src/utils/model/deepseekV4Control.ts:191`；route：`src/utils/model/deepseekV4Control.ts:668`；cost estimate：`src/utils/model/deepseekV4Control.ts:297`；final usage evidence：`src/query.ts:343`, `src/query.ts:4189` | 模型策略必须是 DeepSeek 原侧；旧 provider 逻辑只可隔离、迁移或删除候选 | `already-mainline`，V20 目标是增强混合模型编排与证据 |
| Context / Memory / Compact / Resume | `src/services/compact/*`, `src/memdir/*`, `src/utils/sessionStorage.ts`, `src/utils/messages.ts`, `src/context.ts` | autocompact threshold：`src/services/compact/autoCompact.ts:73`；manual compact path：`src/commands/compact/compact.ts:101`；transcript persist：`src/QueryEngine.ts:431`, `src/QueryEngine.ts:578`；compact boundary replay：`src/QueryEngine.ts:567`, `src/QueryEngine.ts:878` | 产品 runtime 是 transcript、memory、compact boundary、source truth reread；测试 logs 不能冒充 target raw | `already-mainline`，V20 要补体验证据和 source truth discipline |
| Agent / Task | `src/tools/AgentTool/*`, `src/tasks/LocalAgentTask/*`, `src/tasks/InProcessTeammateTask/*`, `src/coordinator/*` | `AgentTool` 定义：`src/tools/AgentTool/AgentTool.tsx:311`；worker 工具池来自 `assembleToolPool()`：`src/tools/AgentTool/AgentTool.tsx:713`；background register：`src/tools/AgentTool/AgentTool.tsx:811`；runtime evidence：`src/tasks/LocalAgentTask/LocalAgentTask.tsx:301` | Agent 是受控工具和任务生命周期，不是第二套 query/runtime；remote isolation 默认不是主线 | `already-mainline`，V20 加强 parent synthesis / evidence / recovery |
| MCP / Skill / Plugin | `src/services/mcp/*`, `src/utils/plugins/*`, `src/skills/*`, `src/tools.ts`, `src/screens/REPL.tsx` | MCP transport schema：`src/services/mcp/types.ts:27`；`.mcp.json` schema：`src/services/mcp/types.ts:175`；connect flow：`src/services/mcp/client.ts:606`；REPL manager：`src/screens/REPL.tsx:5236`；plugin `mcpServers` schema：`src/utils/plugins/schemas.ts:569`; tool merge：`src/tools.ts:432` | MCP server 是 adapter boundary；工具曝光、权限、排序、证据仍归 Tool Lifecycle / Tool Gate | `already-mainline + real-gap`：registry/install UX 是缺口，但不能另建 runtime |
| Ecosystem Compatibility | `.mcp.json` intake, plugin schemas, memory/command/skill loaders, future Claude-compatible import | 当前 `.mcp.json` schema 已在 `src/services/mcp/types.ts:175`；plugin MCP server 已在 `src/utils/plugins/schemas.ts:569` | `CLAUDE.md`、`.claude/commands`、`.claude/skills` 是 intake 格式，不是 source truth | `real-gap`，必须映射到 Context、Commands、Skills、MCP owner |
| Bridge / Remote / CI | `src/hooks/useReplBridge.tsx`, `src/hooks/useRemoteSession.ts`, `src/hooks/useDirectConnect.ts`, `src/dsxu/engine/provider-backend/*`, `src/commands/bridge/*` | default bridge disabled：`src/hooks/useReplBridge.tsx:10`；remote session hook：`src/hooks/useRemoteSession.ts:73`；bridge command blocks remote-control alias：`src/commands/bridge/bridge.tsx:13`；remote agent isolation disabled by default：`src/tools/AgentTool/AgentTool.tsx:551` | 只允许 clean-room facade 接入 Query Loop / Permission Bridge；不能恢复旧 bridge 主链 | `already-boundary + real-gap`：未来只做 facade，不做第二 runtime |
| UI / TUI Visible State | `src/screens/REPL.tsx`, `src/components/*`, `src/hooks/notifs/*`, `src/components/permissions/*`, `src/components/Messages.tsx` | REPL 持有 permission/mcp/tasks state：`src/screens/REPL.tsx:803`；merged tools：`src/screens/REPL.tsx:996`；merged commands：`src/screens/REPL.tsx:1017`; permission overlay：`src/screens/REPL.tsx:5191`; MCP wrapper：`src/screens/REPL.tsx:5236` | UI 展示状态，不拥有业务 runtime；UI 体验测试必须基于真实状态 | `already-mainline`，V20 加强清晰、可信、可继续操作状态 |
| Coding Workflow | `src/commands/diff/*`, `src/commands/review/*`, `src/commands/doctor/*`, `src/tools/File*`, `src/tools/BashTool`, `src/tools/PowerShellTool`, LSP tool | `/diff`：`src/commands/diff/diff.tsx:5`；doctor：`src/commands/doctor/doctor.tsx:2`；review remote launch：`src/commands/review/ultrareviewCommand.tsx:10` | git/diff/LSP/review/doctor 必须进入真实代码现场；不可用报告自证替代 | `already-mainline + review-needed`，remote review 需继续看是否原侧化 |
| Evidence / Eval | `src/dsxu/engine/*evidence*`, `src/dsxu/engine/phase12-raw-comparison-v1.ts`, integration harness, `.dsxu/trace` | final usage evidence：`src/query.ts:343`；raw comparison 文件存在：`src/dsxu/engine/phase12-raw-comparison-v1.ts`; owner Git registers 存在：`src/dsxu/engine/owner-git-*.ts` | `.dsxu` 是证据库，不是 release runtime；target raw 不能伪造 | `already-mainline + blocked-input`：P12 target raw 仍是后续硬输入 |
| Release / Export | `scripts/dsxu-release-gate.ts`, `scripts/dsxu-health-audit.ts`, `src/dsxu/engine/final-release-preflight-register-v1.ts`, `src/dsxu/engine/clean-export-readiness-v1.ts` | release gate script：`package.json:13`；health audit script：`package.json:14`; final preflight / clean export engine files已存在 | release/export 最后才运行；不能用提前测试当放行 | `already-mainline`，最终阶段才跑全量测试和 clean export |

## 4. 首批风险分层

### 4.1 已经在主线上的能力

- Query Loop、Tool Lifecycle、Permission / Tool Gate、DeepSeek Model Router、Context / Compact、Agent / Task、MCP client、UI/TUI、Evidence/Release 都已经有产品主线。
- 因此 V20 不应该先新增同类实现，而应该先用 import/use 证据证明唯一主线，然后把重复旧块收口。

### 4.2 真实缺口但不能另开入口

- MCP Server registry / install UX：现有 MCP client、plugin schema、tool merge 已存在；新增 registry manifest 只能扩展 MCP / Skill / Plugin owner。
- Claude-compatible project intake：`.mcp.json` 已有 schema；`CLAUDE.md`、`.claude/commands`、`.claude/skills` 必须导入到 memory、commands、skills、MCP owner。
- Bridge / Remote / CI clean-room facade：现有 default bridge 已禁用旧 runtime；未来只能作为 remote/session/SDK facade 接入 Query Loop 和 Permission Bridge。

### 4.3 必须继续 owner review 的旧风险

- `src/dsxu/legacy/**` 仍需要按 import/use 判断是 product-specific exclude、test-only、replace/delete candidate，还是已被原侧 owner 吸收。
- `src/dsxu/engine/api-service.ts`、provider compat、legacy model 文件需要继续确认没有第二套 provider runtime。
- remote review / bridge / direct-connect 相关文件需要确认是否只是受控 facade，不是第二套任务编排。

## 5. 下一步执行

下一步进入 V20-C2 / C3 的批量动作：

1. 用 `docs/generated/DSXU_V20_CLAUDE_SRC_FILE_AUDIT_20260514.csv` 把 Claude 1902 文件映射到本 owner map。
2. 对 DSXU 当前 dirty / legacy / provider / bridge / MCP / agent 文件做状态分类：`already-mainline`、`duplicate-equivalent`、`wrong-owner`、`legacy-active`、`test-only`、`product-specific-exclude`、`real-gap`、`manual-owner-review`。
3. 优先收口重复和错 owner，再吸收真实缺口。
4. 不跑最终全量测试；只在 owner map 或缺口矩阵有实质变更后做 focused verification。
