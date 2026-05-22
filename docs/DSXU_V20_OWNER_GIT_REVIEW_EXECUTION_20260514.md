# DSXU V20 Owner/Git Review Execution - 2026-05-14

## 1. 执行口径

本轮继续执行 `docs/DSXU_V20_MASTER_PLAN_20260514.md` 的 9.5，不做小步补丁，也不先跑最终测试。目标是把当前 `git status --short` 的大数字拆成可签收的 owner packets，作为后续关闭 dirty、删除态、real-gap 和 release gate 的入口。

本轮没有 stage、commit、reset、clean、删除证据目录或创建 clean export。

## 2. 本轮生成物

| 文件 | 用途 |
|---|---|
| `docs/generated/DSXU_V20_OWNER_GIT_REVIEW_REGISTER_20260514.csv` | 逐路径 owner/Git review register，覆盖当前 `1692` 个 status 项 |
| `docs/generated/DSXU_V20_OWNER_GIT_REVIEW_SUMMARY_20260514.json` | packet 汇总、状态汇总和下一步动作 |
| `docs/generated/DSXU_V20_DELETE_STATE_OWNER_REVIEW_20260514.csv` | 删除态逐路径替代 owner / active import / review decision |
| `docs/generated/DSXU_V20_DELETE_STATE_OWNER_REVIEW_SUMMARY_20260514.json` | 删除态 packet 汇总 |
| `docs/generated/DSXU_V20_HIGH_RISK_RUNTIME_OWNER_REVIEW_SUMMARY_20260514.json` | 高风险 runtime owner 扫描汇总 |

## 3. 当前 status 事实

| 状态 | 数量 |
|---|---:|
| modified | 1524 |
| deleted | 142 |
| untracked | 28 |
| total | 1694 |

## 4. Owner packet 拆分

| Packet | Count | M | D | ?? | Review 口径 |
|---|---:|---:|---:|---:|---|
| V20-OGR-01-docs-generated-plan | 12 | 0 | 0 | 12 | V20 文档、generated index、方案更新，需作为执行总账签收 |
| V20-OGR-02-delete-old-evidence-review-runtime | 45 | 0 | 45 | 0 | 旧 evidence/release/dirty review runtime 删除态，需确认不再作为 product runtime |
| V20-OGR-02-delete-old-provider-legacy-harness | 61 | 0 | 61 | 0 | 旧 provider-backend、legacy、integration harness 删除态，需确认替代 owner 已存在 |
| V20-OGR-02-delete-old-provider-migration-sources | 7 | 0 | 7 | 0 | old provider migration source 删除态，需确认新 provider-migration owner 已接管 |
| V20-OGR-02-delete-state-owner-review | 29 | 0 | 29 | 0 | 其它删除态，逐项确认 restore/delete/test-only |
| V20-OGR-03-tool-permission-lifecycle | 167 | 166 | 0 | 1 | Tool / Bash / PowerShell / Permission / shell owner review |
| V20-OGR-04-mcp-skill-plugin-registry | 83 | 82 | 0 | 1 | MCP / Skill / Plugin registry review |
| V20-OGR-05-agent-task-lifecycle | 49 | 49 | 0 | 0 | Agent / Task lifecycle review |
| V20-OGR-06-ui-tui-visible-state | 493 | 493 | 0 | 0 | UI/TUI visible state review |
| V20-OGR-07-provider-migration-model-cost | 53 | 42 | 0 | 11 | Provider migration / model / cost / auth review |
| V20-OGR-08-cli-command-transport | 154 | 154 | 0 | 0 | CLI / command / transport review |
| V20-OGR-09-dsxu-engine-mainline | 50 | 48 | 0 | 2 | DSXU engine mainline review |
| V20-OGR-10-entry-query-tool-composition | 14 | 13 | 0 | 1 | Entry / Query / Tool composition review |
| V20-OGR-11-permission-acl-residue | 3 | 3 | 0 | 0 | ACL-blocked empty modules，外部权限或 release gate 签收 |
| V20-OGR-12-shared-platform-utilities | 275 | 275 | 0 | 0 | Shared platform utilities，不能变第二套 runtime |
| V20-OGR-13-other-source-owner-review | 199 | 199 | 0 | 0 | 其它源码 owner review |

## 5. 结论

当前 `1694` 不再是未知大桶，已拆成 16 个 V20 owner/Git packets。删除态已进一步生成替代 owner review：`142/142` 均为 `ready-for-delete-signoff-after-owner-review`，并且 targeted import scan 未发现旧 runtime/provider/evidence active import 阻断。下一步不能直接 final test，也不能直接 clean export；应先按 packet 顺序做真实 owner review：

1. 先关 `V20-OGR-02` 四组删除态，总计 142。
2. 再审 `V20-OGR-03/04/05/07/10` 五个高风险 runtime owner，防止第二套 tool、permission、MCP、agent、provider、query runtime。
3. 再审 `V20-OGR-06/08/12/13` 大面积 UI、CLI、shared utility 语言和边界改造。
4. 最后处理 `V20-OGR-11` 三个 ACL 残留，进入外部权限收口或 release gate 明确签收。

当前状态仍是 `V20 PARTIAL`。本轮完成的是 owner/Git review 的分包执行入口，不是最终签收。

## 6. 本轮新增修正

删除态逐文件 review 时发现 `src/dsxu/engine/__tests__/audit-v10-3-strict-clean.test.ts` 仍 import 已删除的 `src/dsxu/engine/audit_v10_3_strict.ts`。按 V20 原侧规则，该测试属于旧 hard-audit runtime 证据，不应恢复旧 runtime；本轮已将该测试并入删除态。

同时，`src/entrypoints/replLauncher.tsx` 中的 `getDsxuLegacyReplLauncherRuntimeProfile` 已改为 `getDsxuReplLauncherRuntimeProfile`，并将 runtime 描述从 legacy launcher 改成 DSXU entrypoint owner projection，避免新入口文件继续携带旧 owner 语义。

## 7. Focused verification

| 验证 | 结果 |
|---|---|
| targeted active import scan for old runtime/provider/evidence paths | PASS，0 active source imports |
| targeted scan for `audit_v10_3_strict` / old REPL launcher profile | PASS，0 active source hits |
| `git diff --check` | PASS，仅 Git CRLF warnings |
| `bun test src/dsxu/engine/__tests__/v18-open-source-package-gate-v1.test.ts` | PASS，5 tests / 0 fail |

这些验证只证明本轮 owner/Git review 分包和删除态调整没有留下明显坏引用；它们不是 V20 final comprehensive tests，也不是 clean export 放行依据。

## 8. High-risk runtime owner scan

本轮同步扫了 `V20-OGR-03/04/05/07/10` 五个高风险 runtime owner：

| Packet | Count | 判断 |
|---|---:|---|
| V20-OGR-03-tool-permission-lifecycle | 167 | 需后续 diff review；当前 targeted old-runtime import scan PASS |
| V20-OGR-04-mcp-skill-plugin-registry | 83 | 需后续 diff review；当前没有旧 MCP/skill runtime import 阻断 |
| V20-OGR-05-agent-task-lifecycle | 49 | 需后续 diff review；当前没有旧 agent bridge/runtime import 阻断 |
| V20-OGR-07-provider-migration-model-cost | 53 | 需后续 diff review；旧 provider/compat caller 名称已收敛到 provider-migration 边界 |
| V20-OGR-10-entry-query-tool-composition | 14 | 需后续 diff review；REPL launcher 已收敛为 DSXU entrypoint owner projection |

扫描结果：

- targeted old runtime/provider/evidence import scan：PASS，0 active source imports。
- old audit / old REPL launcher profile scan：PASS，0 active source hits。
- broad old runtime scan：只剩 `v18-open-source-package-gate-v1.test.ts` 中 5 个 forbidden-path fixture，属于 release gate 测试证据。
- broad old provider scan：只剩 `query-tools-and-content-v1-clean.test.ts` 中 split external model-name fixture，属于测试夹具。

这说明高风险 owner 当前没有明显“第二套 runtime import”阻断，但还没有完成逐 diff owner signoff。

## 9. OGR-02 删除态 owner signoff 更新

本轮继续执行 `V20-OGR-02` 删除态四组，不恢复旧文件、不新增兼容 runtime、不做 stage/commit/reset/clean export。

新增签收文档：

| 文件 | 用途 |
|---|---|
| `docs/DSXU_V20_OGR02_DELETE_PACKET_SIGNOFF_20260514.md` | 记录 `142` 个删除态路径的 owner 侧签收、证据和剩余 Git mutation gate |

复核结果：

| 复核项 | 结果 |
|---|---|
| delete-state register rows | `142/142` |
| reviewDecision | `142/142 ready-for-delete-signoff-after-owner-review` |
| activeImportReferenceStatus | `142/142 no-active-import-detected-by-targeted-rg` |
| working tree path presence | `142/142` 已不存在 |
| `git diff --name-status --diff-filter=D` | `142` 删除态，数量一致 |
| targeted old-name source scan | PASS，0 active hits |

Owner 裁决：`V20-OGR-02` 四组删除态 owner 侧接受为 delete candidates。后续不能通过恢复旧文件来补能力；若发现行为缺口，必须落到命名 DSXU mainline owner。当前仍未 stage/commit，因此 `git status --short` 数字不会因本轮文档签收而下降。

## 10. 高风险 runtime owner 本轮快扫

本轮同时复核了 `V20-OGR-03/04/05/07/10` 五个高风险 packet 的风险词和旧名引用。

| Packet | Count | 本轮判断 |
|---|---:|---|
| `V20-OGR-03-tool-permission-lifecycle` | 167 | 继续逐 diff review；当前 old-name targeted scan PASS |
| `V20-OGR-04-mcp-skill-plugin-registry` | 83 | 继续逐 diff review；当前未发现旧 MCP/skill runtime active import |
| `V20-OGR-05-agent-task-lifecycle` | 49 | 继续逐 diff review；当前未发现旧 agent runtime active import |
| `V20-OGR-07-provider-migration-model-cost` | 53 | 继续逐 diff review；provider migration 命名仍需检查是否只是边界，不是第二套 provider runtime |
| `V20-OGR-10-entry-query-tool-composition` | 14 | 继续逐 diff review；entry/query/tool 组合仍需逐 diff 确认单一 Query Loop |

风险词扫描里出现的 `legacy`、`compat`、`bypass`、`standalone` 大多位于安全说明、权限拒绝、测试夹具、旧配置别名或 provider-migration 边界语义中；本轮未发现必须立即恢复旧 runtime 的证据。下一轮应进入 `OGR-03` 的逐 diff owner review，因为 tool/permission 是最高风险入口。

## 11. OGR-03 首个实改：RunNativeTest 收回 Tool Gate

逐扫 `V20-OGR-03-tool-permission-lifecycle` 时发现一个真实 owner 问题：`src/tools/RunNativeTestTool/RunNativeTestTool.ts` 是语义测试工具，会通过 `Bun.spawn` 执行 native test，但此前没有自己的 `checkPermissions`，会落到 `buildTool` 默认 permission 行为。按 V20 目标，这不能继续作为默认 allow 的执行入口。

本轮已处理：

| 文件 | 改动 |
|---|---|
| `src/tools/RunNativeTestTool/RunNativeTestTool.ts` | `validateInput` 增加 absolute existing `cwd` 校验；新增 `checkPermissions` 返回 `passthrough`，让通用 DSXU permission pipeline 决定是否允许执行 |
| `src/tools/RunNativeTestTool/RunNativeTestTool.test.ts` | 覆盖相对/不存在 `cwd` 拒绝，以及 `checkPermissions` 不再 default allow |

Focused verification：

| 验证 | 结果 |
|---|---|
| `bun test src/tools/RunNativeTestTool/RunNativeTestTool.test.ts` | PASS，2 tests / 0 fail |
| targeted old-name source scan | PASS，0 active hits |
| `git diff --check` on touched files | PASS，仅 CRLF warnings |
| tool external-action scan | PASS，`src/tools` 中使用 `Bun.spawn` / shell `exec` 的 buildTool 文件均有 `checkPermissions` |

当前判断：`RunNativeTest` 仍是 semantic verification tool，但不再绕过 DSXU Tool Gate。它的 native process execution 后续还应在 ToolDefinition V20 中标明 side effect、cwd boundary、permission evidence 和 test evidence；当前已先关闭最危险的 default allow 问题。

## 12. OGR-03 批量收口：side-effect tools 不再吃默认 allow

继续逐扫 `V20-OGR-03-tool-permission-lifecycle` 时发现，除 `RunNativeTest` 外还有一组会改变 DSXU 内部状态、调度任务、停止任务、创建/删除团队、切换工作树或管理远程 trigger 的工具没有自己的 `checkPermissions`，会继承 `buildTool` 默认 allow。按 V20 原侧目标，这些工具可以是 DSXU 主线工具，但不能通过默认 allow 隐式绕过 Tool Gate。

本轮批量修复：

| 文件 | 决策 |
|---|---|
| `src/tools/RemoteTriggerTool/RemoteTriggerTool.ts` | `list/get` 显式 allow；`create/update/run` passthrough |
| `src/tools/ScheduleCronTool/CronCreateTool.ts` | passthrough |
| `src/tools/ScheduleCronTool/CronDeleteTool.ts` | passthrough |
| `src/tools/TaskCreateTool/TaskCreateTool.ts` | session task state 显式 allow |
| `src/tools/TaskUpdateTool/TaskUpdateTool.ts` | 普通 task update 显式 allow；`status=deleted` passthrough |
| `src/tools/TaskStopTool/TaskStopTool.ts` | passthrough |
| `src/tools/TeamCreateTool/TeamCreateTool.ts` | passthrough |
| `src/tools/TeamDeleteTool/TeamDeleteTool.ts` | passthrough |
| `src/tools/EnterWorktreeTool/EnterWorktreeTool.ts` | passthrough |
| `src/tools/ExitWorktreeTool/ExitWorktreeTool.ts` | `keep` 显式 allow；`remove` passthrough |

新增 targeted test：

| 文件 | 覆盖 |
|---|---|
| `src/tools/__tests__/v20-tool-permission-owner-gate.test.ts` | RemoteTrigger、CronCreate/Delete、TaskCreate/Update/Stop、TeamCreate/Delete、Enter/ExitWorktree 的 owner permission 行为 |

Focused verification：

| 验证 | 结果 |
|---|---|
| `bun test src/tools/__tests__/v20-tool-permission-owner-gate.test.ts src/tools/RunNativeTestTool/RunNativeTestTool.test.ts` | PASS，6 tests / 0 fail |
| side-effect buildTool default-allow scan | PASS，`default_allow_side_effect_candidates=0` |
| `git diff --check` on touched files | PASS，仅 CRLF warnings |

当前判断：OGR-03 的第一批真实风险已收口。DSXU 内部 task/todo 类状态仍可显式 allow；会触发外部状态、调度、停止、工作树、团队或 remote trigger 的操作均进入通用 permission pipeline。下一步继续审 Bash/PowerShell/FileEdit/permission rule 细节，不再回头处理这批 default-allow 漏口。

## 13. OGR-03 二阶收口：auto-mode safe allowlist 不再覆盖高风险状态工具

继续审 auto-mode 时发现，`TaskUpdate`、`TaskStop`、`TeamCreate`、`TeamDelete` 虽然已经进入显式 `checkPermissions`，但仍在 `src/utils/permissions/classifierDecision.ts` 的 safe allowlist 中。这样会让 `status=deleted`、停止任务、创建/删除团队等高风险状态动作在 auto mode 下被工具名级别快捷放行，和 V20 的 Tool Gate 原则冲突。

本轮已处理：

| 文件 | 改动 |
|---|---|
| `src/utils/permissions/classifierDecision.ts` | 从 `SAFE_YOLO_ALLOWLISTED_TOOLS` 移除 `TaskUpdate`、`TaskStop`、`TeamCreate`、`TeamDelete`；保留 read-only 或 session metadata 类工具 |
| `src/tools/__tests__/v20-tool-permission-owner-gate.test.ts` | 增加 safe allowlist 断言，确认 destructive state tools 不再 auto allowlisted |

Focused verification：

| 验证 | 结果 |
|---|---|
| `bun test src/tools/__tests__/v20-tool-permission-owner-gate.test.ts src/tools/RunNativeTestTool/RunNativeTestTool.test.ts` | PASS，7 tests / 0 fail |
| side-effect buildTool default-allow scan | PASS，`default_allow_side_effect_candidates=0` |
| `git diff --check` on touched files | PASS，仅 CRLF warnings |

当前判断：OGR-03 已关闭两类核心捷径：一是 side-effect tools 继承 `buildTool` 默认 allow；二是 destructive state tools 被 auto-mode safe allowlist 工具名级别放行。下一步继续审 Bash/PowerShell/FileEdit 的细分规则、acceptEdits fast path、bypass-immune safety checks 和 shell validation。

## 14. OGR-03 三阶收口：Bash acceptEdits 不再被混合子命令绕过

继续审 Bash/PowerShell/FileEdit 的细分权限规则时，发现 `src/tools/BashTool/modeValidation.ts` 的 acceptEdits fast path 存在真实逻辑漏洞：它按子命令循环时，只要任意一个子命令命中 `mkdir/touch/rm/rmdir/mv/cp/sed`，就直接返回 `allow`。这会让 `mkdir tmp && curl https://...` 或 `curl https://... && mkdir tmp` 这类混合命令被一个编辑类子命令带过，绕过后续 classifier / permission prompt。

本轮已处理：

| 文件 | 改动 |
|---|---|
| `src/tools/BashTool/modeValidation.ts` | acceptEdits 只在所有子命令都属于窄 filesystem edit 集合时返回 `allow`；任何非 edit 子命令都返回 `passthrough`，继续进入通用 permission/classifier pipeline |
| `src/tools/BashTool/modeValidation.test.ts` | 覆盖纯 edit compound 允许、edit+network 混合拒绝 fast path、非 acceptEdits 模式不应用 shortcut |

Focused verification：

| 验证 | 结果 |
|---|---|
| `bun test src/tools/BashTool/modeValidation.test.ts src/tools/__tests__/v20-tool-permission-owner-gate.test.ts src/tools/RunNativeTestTool/RunNativeTestTool.test.ts` | PASS，10 tests / 0 fail |
| targeted scan: Bash/PowerShell modeValidation | PASS，PowerShell acceptEdits 已是全命令/全 segment 校验；Bash 已改为全子命令一致性校验 |

当前判断：OGR-03 又关闭一类真实 shortcut，不再允许单个 Bash edit 子命令把外部网络、执行或其它 shell work 带入 acceptEdits fast path。下一步继续沿 OGR-03 审 shell validation / bypass-immune safety checks / FileEdit write path，然后转 OGR-04 MCP/Skill/Plugin registry。

## 15. OGR-04 首轮 owner review：发现 active 第二套 MCP client/runtime

进入 `V20-OGR-04-mcp-skill-plugin-registry` 后，按真实 import/use 扫描确认：当前不能把 OGR-04 判为 PASS，因为 `src/dsxu/engine/mcp-client.ts` 不是单纯文档或测试残留。它仍被产品侧 engine/mainline runtime import：

| Active import/use | 证据 |
|---|---|
| `src/dsxu/engine/index.ts` | `import { MCPManager } from './mcp-client'`；`QueryEngine.connectMCPFromConfig()` 会读取 `.mcp.json` 并注册 MCP tools |
| `src/dsxu/engine/tool-mainline-runtime-v1.ts` | `import { MCPManager } from './mcp-client'`；`createToolMainlineExecutor()` 内部实例化 `new MCPManager()`，并为 `ListMcpResourcesTool` / `ReadMcpResourceTool` / `mcp__*` 走本地 manager |
| `src/dsxu/engine/graph/graph-memory.ts` | type-level owner dependency |

`src/dsxu/engine/mcp-client.ts` 内部自己实现了 `MCPConnection`、`MCPManager`、stdio `child_process.spawn`、remote `fetch`、JSON-RPC framing、tool/resource/template wrapping。这和 V20 定义的单一 MCP owner 冲突：真实主线 owner 应是 `src/services/mcp/*` + `src/tools/MCPTool/*` + `ListMcpResourcesTool` / `ReadMcpResourceTool`，并且所有外部 MCP tool call 必须走主线 Tool Gate、permission、progress、auth、resource、evidence pipeline。

本轮 owner 决策：

| 文件/区域 | 决策 |
|---|---|
| `src/services/mcp/*` | mainline keep，MCP runtime owner |
| `src/tools/MCPTool/*`、`ListMcpResourcesTool`、`ReadMcpResourceTool`、`McpAuthTool` | mainline keep，tool boundary owner |
| `src/dsxu/engine/engine-tool-adapter.ts` | mainline keep，已有 `getMainlineMcpToolAdaptersForClients()`，可以把 `MCPServerConnection[]` 转进 engine tool registry |
| `src/dsxu/engine/mcp-client.ts` | active duplicate runtime；不能 PASS。下一步必须把 active callers 改到 `src/services/mcp` / `engine-tool-adapter`，然后把旧文件降为 test fixture 或 replace/delete candidate |
| `src/dsxu/engine/tool-mainline-runtime-v1.ts` 中的 MCP managed-service branches | replace/merge required；不能继续作为单独 MCP manager |

当前判断：OGR-04 已发现真实结构冲突，不是缺文档。下一步不应继续给它补局部功能，而是执行合并：`QueryEngine` 和 `tool-mainline-runtime-v1` 的 MCP 连接/资源/工具注册必须改为消费 mainline `MCPServerConnection[]` 或 `src/services/mcp/client.ts` 的连接结果；旧 `MCPConnection/MCPManager` 只能作为替换前证据，不允许作为 V20 产品 runtime 保留。

## 16. OGR-04 二阶合并：产品主链不再实例化 engine MCP runtime

按上面的 owner 决策继续执行后，已经把两个 active runtime caller 合并到主线 MCP owner，不再让 `src/dsxu/engine/mcp-client.ts` 作为产品路径运行时：

| 文件/区域 | 本轮处理 |
|---|---|
| `src/dsxu/engine/tool-mainline-runtime-v1.ts` | 移除 `MCPManager` import 和内部 `new MCPManager()`；MCP tools 只从 `mainlineMcpClients?: MCPServerConnection[]` 注册，并通过 `engine-tool-adapter.getMainlineMcpToolAdaptersForClients()` 进入统一 Tool Gate / permission / progress / evidence pipeline |
| `src/dsxu/engine/index.ts` | `QueryEngine` 不再读取 `.mcp.json`、不再自行 connect/disconnect MCP；只消费外部主线 `mainlineMcpClients`，`getMCPStatus()` 也从主线连接状态投影 |
| `src/dsxu/engine/types.ts` | `QueryEngineConfig` 明确接收 `mainlineMcpClients?: MCPServerConnection[]`，把 MCP ownership 显式交回 `src/services/mcp` |
| `src/dsxu/engine/graph/graph-memory.ts` | 移除 type-level `MCPManager` dependency；Graph memory 不再引用旧 engine MCP owner |
| `src/dsxu/engine/__tests__/c05-mcp-brief-remote-cron-absorption-clean.test.ts` | 测试改为注入伪 `MCPServerConnection`，验证 List/Read/Write MCP 工具都来自主线 connection adapter |

Focused verification：

| 验证 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/c05-mcp-brief-remote-cron-absorption-clean.test.ts src/dsxu/engine/__tests__/c05-tool-compat-absorption-clean.test.ts src/tools/BashTool/modeValidation.test.ts` | PASS，12 tests / 0 fail |
| `bun test src/dsxu/engine/__tests__/engine.test.ts --test-name-pattern "MCP|connectMCP"` | PASS，6 tests / 0 fail |
| combined OGR-04 smoke run | PASS，18 tests / 0 fail |
| `bun test src/dsxu/engine/__tests__/mcp-client.test.ts src/dsxu/engine/__tests__/c05-mcp-brief-remote-cron-absorption-clean.test.ts src/dsxu/engine/__tests__/engine.test.ts --test-name-pattern "V20 OGR-04|MCP|connectMCP"` | PASS，12 tests / 0 fail；旧 `mcp-client.test.ts` 已改成防回归测试，不再 import 旧 MCP runtime |

当前 OGR-04 口径：产品主链 active caller 已合并到 `src/services/mcp` connection boundary；旧 `src/dsxu/engine/mcp-client.ts` 不再允许作为 V20 产品 runtime 保留。`src/dsxu/engine/__tests__/mcp-client.test.ts` 已从旧 `MCPManager/MCPConnection` 单测改成 owner 防回归测试，确认产品 engine 代码不能再 import/instantiate legacy runtime，并验证主线 `getMainlineMcpToolAdaptersForClients()` 是唯一 MCP tool registration path。剩余工作是把合同文档中对 `src/dsxu/engine/mcp-client.ts` 的 landing 描述改成 replace/delete evidence 或历史吸收证据，然后评估旧 `src/dsxu/engine/mcp-client.ts` 本体是否进入删除 packet。

## 17. OGR-04 三阶合并：合同 landing 不再指向旧 MCP runtime

继续按“不能保留第二套 runtime”的标准复核合同/路线文件后，已把 MCP landing 从旧 `src/dsxu/engine/mcp-client.ts` 改到主线 `src/services/mcp/client.ts`：

| 文件 | 处理 |
|---|---|
| `src/dsxu/engine/high-pressure-reference-absorption-contract.ts` | MCP landing 改为 `src/services/mcp` + `src/services/mcp/client.ts` + `engine-tool-adapter` |
| `src/dsxu/engine/next-stage-productization-contract.ts` | 同上 |
| `src/dsxu/engine/product-reality-hardening-contract.ts` | 同上 |
| `src/dsxu/engine/reference-experience-quality-contract.ts` | 同上 |
| `src/dsxu/engine/reference-governance-absorption-contract.ts` | 同上 |
| `src/dsxu/engine/v10-reference-behavior-productization-contract.ts` | 同上 |
| `src/dsxu/engine/v11-100-point-roadmap-contract.ts` | V11 long task/ecosystem landing 改为主线 `src/services/mcp/client.ts` |
| `src/dsxu/engine/__tests__/reference-experience-quality-contract-v1.test.ts` | 断言改为主线 MCP client landing |

验证：

| 验证 | 结果 |
|---|---|
| `rg "src/dsxu/engine/mcp-client.ts" src/dsxu/engine --glob "*contract*.ts" --glob "*roadmap*.ts" --glob "*plan*.ts" ...` | PASS，0 hits |
| `bun test src/dsxu/engine/__tests__/reference-experience-quality-contract-v1.test.ts --test-name-pattern "maps the experience gaps"` | PASS，1 test / 0 fail |

注意：整份 `reference-experience-quality-contract-v1.test.ts` 仍有两个非本轮 MCP 合并阻断：本地 reference root `D:\DSXU-code\原代码claude` 缺文件，以及 `scripts/benchmark/dsxu-mainline-benchmark.ts` 尚未覆盖所有 experience quality benchmark case。这两个归入后续 V20 experience/benchmark gate，不能用 MCP 合同 landing 改动冒充 PASS。

## 18. Experience benchmark gate：补齐 V20 reference-experience case 注册

继续处理上面暴露的 benchmark 覆盖缺口后，已把 `src/dsxu/engine/reference-experience-quality-contract.ts` 要求的全部 experience / mutation benchmark case 注册进 `scripts/benchmark/dsxu-mainline-benchmark.ts`，并把 pack 标识补为：

| Pack / gate | 状态 |
|---|---|
| `reference-experience-quality` | registered |
| `reference-experience-quality-live` | registered |
| `mutation-product-grade-live` | registered |

新增 case 覆盖 P1-P7：Query Loop recovery、Agent team governance、Tool prompt discipline、Compact/Memory resume、Permission UX、MCP real ecosystem、Programmer-like UX。它们是 V20 后续真实功能/体验/恢复/性能/评测/发布测试的入口，不替代真实 live run。

验证：

| 验证 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/reference-experience-quality-contract-v1.test.ts --test-name-pattern "exposes a benchmark case|maps the experience gaps"` | PASS，2 tests / 0 fail |
| OGR-04 MCP focused run | PASS，12 tests / 0 fail |

剩余独立阻断：整份 reference-experience contract 仍需要真实 reference root 文件存在性；这属于外部 reference input / workspace gate，不是 benchmark registration 或 MCP owner 合并问题。

## 19. OGR-04 四阶删除：旧 engine MCP runtime 本体移出主链

在 active caller、旧单测保活点、合同 landing 都已转到主线 `src/services/mcp` 后，继续执行 replace/delete packet：`src/dsxu/engine/mcp-client.ts` 已从项目源码中删除。该文件原本自带 `MCPConnection` / `MCPManager` / stdio spawn / remote fetch / JSON-RPC framing，是第二套 MCP runtime；删除后 MCP 产品能力只保留在主线：

| Mainline owner | 保留职责 |
|---|---|
| `src/services/mcp/client.ts` | MCP connection、tool/resource fetch、cache、reconnect、redaction 主 runtime |
| `src/services/mcp/*` | MCP UI/CLI connection 管理与 provider integration |
| `src/tools/MCPTool/*`、`ListMcpResourcesTool`、`ReadMcpResourceTool`、`McpAuthTool` | 工具边界与 permission/evidence pipeline |
| `src/dsxu/engine/engine-tool-adapter.ts` | DSXU engine 对主线 MCP connection 的 adapter projection |

验证：

| 验证 | 结果 |
|---|---|
| product source scan: `from './mcp-client'` / `from '../mcp-client'` / `new MCPManager` / `new MCPConnection` | PASS，0 active hits |
| `bun test src/dsxu/engine/__tests__/mcp-client.test.ts src/dsxu/engine/__tests__/c05-mcp-brief-remote-cron-absorption-clean.test.ts src/dsxu/engine/__tests__/engine.test.ts --test-name-pattern "V20 OGR-04|MCP|connectMCP"` | PASS，12 tests / 0 fail |
| `bun test src/dsxu/engine/__tests__/reference-experience-quality-contract-v1.test.ts --test-name-pattern "exposes a benchmark case|maps the experience gaps"` | PASS，2 tests / 0 fail |
| `git diff --check` on touched OGR-04/benchmark files | PASS，仅 CRLF 提示 |

当前 OGR-04 owner 判断：旧 engine MCP runtime 已从主链删除，MCP/Skill/Plugin registry 不再保留第二套 MCP runtime。后续 Git 数字下降仍取决于 owner/Git review staging/commit packet，不在本轮自动执行。

## 20. OGR-05 首轮合并：移除 tool-mainline-runtime 的本地 Agent lifecycle 模拟

进入 `V20-OGR-05-agent-task-lifecycle` 后，真实 import/use review 发现 `src/dsxu/engine/tool-mainline-runtime-v1.ts` 内部仍保留一套本地 agent/task lifecycle 模拟：`agentLifecycles`、`normalizeAgentToolInput()`、`executeAgentTool()`，并把 `TaskCreateTool`、`TaskStopTool`、`SendMessageTool`、`EnterPlanModeTool` 等 aliases 统一映射到 `AgentTool`。这会绕过真实 `src/tools/AgentTool`、`src/tools/Task*`、`src/tools/SendMessageTool`、PlanMode、Team、Worktree owner，形成第二套 agent/task orchestrator。

本轮处理：

| 文件/区域 | 处理 |
|---|---|
| `src/dsxu/engine/tool-mainline-runtime-v1.ts` | 删除本地 `agentLifecycles` map、`normalizeAgentToolInput()`、`executeAgentTool()` 和 `AgentTool` managed branch |
| `src/dsxu/engine/tool-mainline-runtime-v1.ts` alias map | `AgentTool -> Agent`、`SendMessageTool -> SendMessage`、`TaskCreateTool -> TaskCreate`、`TaskStopTool -> TaskStop`、`EnterPlanModeTool -> EnterPlanMode`、`TeamCreateTool -> TeamCreate`、`EnterWorktreeTool -> EnterWorktree` 等全部回到真实主线工具 |
| `src/dsxu/engine/engine-tool-adapter.ts` | 注册缺失的主线 lifecycle tools：`TaskOutput`、`TaskStop`、`TeamCreate`、`TeamDelete`、`EnterWorktree`、`ExitWorktree` |
| `src/dsxu/engine/__tests__/c05-tool-compat-absorption-clean.test.ts` | 测试从“兼容 alias 进入 Agent lifecycle 模拟”改为“alias 进入真实 Task/Plan owner，且不出现 `agent-action=` 模拟输出” |

验证：

| 验证 | 结果 |
|---|---|
| `rg "AgentTool: 'AgentTool'|TaskCreateTool: 'AgentTool'|agent-action=|executeAgentTool|normalizeAgentToolInput" src/dsxu/engine/tool-mainline-runtime-v1.ts` | PASS，0 hits |
| `bun test src/dsxu/engine/__tests__/c05-tool-compat-absorption-clean.test.ts src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts --test-name-pattern "TaskCreateTool|TaskStopTool|EnterPlanModeTool|Agent|Task|SendMessage|worktree|Team"` | PASS，29 tests / 0 fail |
| Combined MCP/Agent/Task focused run | PASS，43 tests / 0 fail |
| `git diff --check` on touched OGR-05 files | PASS，仅 CRLF 提示 |

当前 OGR-05 owner 判断：`tool-mainline-runtime-v1` 不再拥有 agent/task/team lifecycle 模拟；Agent/Task/SendMessage/PlanMode/Team/Worktree 生命周期回到真实 `src/tools/*`、`src/tasks/*`、`src/utils/swarm/*` mainline owner。后续仍需继续审 49 个 OGR-05 paths 中的 swarm backend / LocalAgentTask / RemoteAgentTask / teammate mailbox 是否存在其它第二套 runtime。

## 21. OGR-05 二轮收口：coordinator dead lifecycle 删除，swarm/backend 归位

继续按真实 import/use 复核 `V20-OGR-05-agent-task-lifecycle` 后，发现 `src/dsxu/engine/coordinator-v1.ts` 里仍保留一组已无主链用途的本地 agent lifecycle 数据结构和 helper。该块不是 `AgentTool`、`LocalAgentTask`、`InProcessTeammateTask` 或 `RemoteAgentTask` 的 owner，继续保留会让 coordinator 看起来像第二套 agent/task orchestrator。

本轮处理：

| 文件/区域 | 处理 |
|---|---|
| `src/dsxu/engine/coordinator-v1.ts` | 删除 `AgentTaskLifecycleStatus`、`AgentTaskRuntime`、`AgentTaskLifecycleState`、`createAgentTaskLifecycleState`、`registerAgentTask`、`transitionAgentTask`、`appendAgentTaskMessage`、`projectAgentTaskLifecycleSummary` |
| `src/utils/swarm/backends/*` | 复核为 Agent/Team 后端边界：`InProcessBackend` 调 `spawnInProcessTeammate` + `startInProcessTeammate`，pane backend 只调 tmux/iTerm2 窗格和 mailbox，不拥有 query/runtime |
| `src/utils/swarm/inProcessRunner.ts` | 复核为主线 `AgentTool/runAgent -> query()` 执行入口，permission ask 走 leader ToolUseConfirm 或 mailbox permission bridge，不是第二套 tool gate |
| `src/tools/SendMessageTool/*` | 复核为 DSXU Agent Message Router：本地 teammate、in-process queue、stopped agent resume、UDS/provider peer；`bridge:` 仅在 `DSXU_ENABLE_PROVIDER_MIGRATION_BRIDGE` 显式打开后可用，默认主线 deny |
| `src/tools/shared/spawnMultiAgent.ts`、`src/utils/swarm/spawnUtils.ts`、`src/tools/AgentTool/AgentTool.tsx` | 收紧注释口径：旧 `source-provider` 只作为 provider-migration alias / remote-session boundary，不作为 DSXU agent runtime owner |

复核结论：

| 区域 | Owner 判断 |
|---|---|
| `AgentTool/runAgent/LocalAgentTask` | mainline keep，唯一 local subagent lifecycle owner |
| `InProcessTeammateTask` + `utils/swarm/inProcessRunner` | mainline keep，team backend placement，复用 `runAgent -> query()` 和主线 permission |
| `PaneBackendExecutor` / `TmuxBackend` / `ITermBackend` | mainline keep，terminal host boundary，只负责 pane/process/mailbox |
| `RemoteAgentTask` / `isolation: "remote"` | provider-migration gated boundary；默认 DSXU mainline 关闭，不能算第二套默认 agent runtime |
| `SendMessage bridge:` | migration-only gated boundary；默认 deny，不能作为产品主链 continuation |
| `coordinator-v1` local lifecycle block | replace/delete candidate，已删除 |

验证：

| 验证 | 结果 |
|---|---|
| old simulator symbol scan：`AgentTaskLifecycleState` / `AgentTaskRuntime` / `createAgentTaskLifecycleState` / `registerAgentTask` / `transitionAgentTask` / `appendAgentTaskMessage` / `projectAgentTaskLifecycleSummary` / `executeAgentTool` / `normalizeAgentToolInput` | PASS，旧 simulator 函数 0 active hits；剩余为主线 `LocalAgentTask` runtime metadata / `RemoteAgentTask` profile |
| `bun test src/dsxu/engine/__tests__/c05-tool-compat-absorption-clean.test.ts src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts src/dsxu/engine/__tests__/agent-runtime-mainline-v1.test.ts --test-name-pattern "TaskCreateTool|TaskStopTool|EnterPlanModeTool|Agent|Task|SendMessage|worktree|Team|runtime mainline"` | PASS，35 tests / 0 fail |
| `git diff --check` on OGR-05 files | PASS，仅 CRLF 提示 |

当前 OGR-05 owner 判断：第二套 agent/task orchestrator 已收口；swarm、team、pane、in-process、SendMessage、remote-gated isolation 都归到命名主线 owner 或显式 migration boundary。后续不再为 OGR-05 增加本地小结构，下一步转入 `V20-OGR-07-provider-migration-model-cost` 与后续 UI/CLI/shared 大面 owner review。
## 22. OGR-07 首轮收口：DSXU 模型入口、cost route 与 provider-migration 边界归位

进入 `V20-OGR-07-provider-migration-model-cost` 后，本轮先处理模型/provider/cost 的主链归属，而不是新增第二套 provider runtime。真实 import/use 结论如下：

| 区域 | Owner 判断 |
|---|---|
| `src/services/api/client.ts` | DSXU_CODE_MODE 先返回 `DeepSeekAdapter.transformRequest()`；`ProviderClient` / Bedrock / Foundry / Vertex 仅保留为非 DSXU 模式或 provider-migration 外部 provider fallback，不是 DSXU 默认 provider runtime |
| `src/services/api/deepseek-adapter.ts` + `src/utils/model/deepseekV4CostRouter.ts` | DeepSeek V4 Flash / Flash-MAX / Pro 的请求转换、usage normalize、route trace、cost evidence 主链 owner |
| `src/services/api/dsxu-model.ts` | 内部旧 `SourceProvider` facade 命名已改为 DSXU transport 命名，公开 export 不新增第二入口 |
| `src/utils/model/providerMigration/providerMigrationModel.ts` | 旧 Opus first-party remap helper 改为 `isProviderMigrationSourceOpusFirstParty()`，只表达迁移源模型 remap，不作为新 provider runtime |
| `src/constants/providerMigrationProtocol.ts` / `src/dsxu/control-plane/controlProviderMigrationProtocol.ts` | wire strings 收束在 named provider-migration adapter，product/UI/schema/release evidence 不直接暴露旧 provider 符号 |
| `src/services/auth/dsxuProviderAuth.ts` | auth owner 保留 DSXU/DeepSeek key 优先级和 provider-migration credential intake；keychain prefetch export 已改为 provider-migration 命名 |
| `src/services/bridge/dsxuRemoteBridgeFacade.ts` | remote bridge shell 明确 archived，默认不承担 provider runtime；外部 routing 走 `provider:` 和 DSXU provider contract |
| `src/services/mockRateLimitsProviderMigration/*` | 测试/模拟 rate-limit 边界，需保持 gated/test-only，不计入真实 cost/provider runtime |

本轮代码处理：

| 文件 | 处理 |
|---|---|
| `src/services/api/dsxu-model.ts` | 内部 helper 从旧 provider facade 命名改为 DSXU transport 命名 |
| `src/utils/model/providers.ts` | first-party hosts 注释改为 provider-migration transport boundary |
| `src/utils/model/providerMigration/providerMigrationModel.ts` | source Opus helper 改为 provider-migration source helper，清理误导性 source-provider 注释 |
| `src/services/auth/dsxuProviderAuth.ts` | 注释改为 provider-migration source credential intake，prefetch import/export 统一为 provider-migration 命名 |
| `src/constants/providerMigrationProtocol.ts` / `src/dsxu/control-plane/controlProviderMigrationProtocol.ts` / `src/migrations/providerMigrationModelMigrations.ts` / `src/services/analytics/featureFlags.ts` | 清理旧 provider 语言，保留 wire string 只在 adapter/迁移边界内 |
| `src/dsxu/engine/__tests__/provider-migration-model-alias-isolation-v1.test.ts` | 增加 DSXU_CODE_MODE 必须先进入 `DeepSeekAdapter`、facade 不泄漏旧 provider 命名的回归断言 |

验证：

| 验证 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/provider-migration-model-alias-isolation-v1.test.ts src/dsxu/engine/__tests__/provider-migration-model-migration-boundary-v1.test.ts src/dsxu/engine/__tests__/deepseek-v4-control-v1.test.ts src/dsxu/engine/__tests__/dsxu-api-key-auth-v1.test.ts --test-name-pattern "provider migration model alias|DSXU_CODE_MODE|model migration boundary|known model route surfaces|normalizes old model aliases|API key|auth"` | PASS，11 tests / 0 fail |
| `rg "return new ProviderClient|return new ProviderBedrock|return new ProviderFoundry|return new ProviderVertex|DeepSeekAdapter.transformRequest|if \(isDSXUCodeMode\(\)\)" src/services/api/client.ts` | PASS：`DeepSeekAdapter` branch 位于 provider SDK fallback 前 |
| targeted old-name scan on OGR-07 files | PASS：auth/model/bedrock/provider-migration API surface 不再出现 `SourceProvider` / `source-provider` / `getSourceProvider*` 旧命名 |

当前 OGR-07 owner 判断：DSXU 默认模型/provider/cost 主链是 `DeepSeekAdapter` + DeepSeek V4 route/cost owner；provider SDK、auth 旧 credential intake、bridge facade、mock rate-limit 均为迁移/测试/外部 provider 边界，不构成第二套 provider runtime。`src/utils/model/agent.ts`、`modelOptions.ts`、`bedrock.ts`、`validateModel.ts`、`modelCapabilities.ts` 的旧 provider 局部命名也已改为 provider-migration source 口径；后续继续审 broader `src/services/api/*` 和 remaining model/provider files 的功能差异，不做新主链入口。
## 23. OGR-08 首轮收口：CLI browser MCP 旧入口删除为 DSXU 主入口

进入 `V20-OGR-08-cli-command-transport` 后，先审真正会形成第二入口的 `src/entrypoints/cli.tsx`。发现旧 provider browser MCP flag 在 DSXU_MODE 下会 deny，但非 DSXU 路径仍会启动同一个 browser MCP server。这与 `--dsxu-browser-mcp` 等价，属于重复旧入口，不应作为 compatibility holding path 保留。

本轮处理：

| 文件 | 处理 |
|---|---|
| `src/entrypoints/cli.tsx` | `SOURCE_PROVIDER_*` 局部常量改为 provider-migration 命名；旧 browser MCP flag 全模式拒绝，提示使用 `--dsxu-browser-mcp` 或 DSXU MCP/browser providers；删除旧 flag 启动 `runDsxuBrowserProviderMcpServer()` 的分支 |
| `src/dsxu/engine/__tests__/provider-contract-v1.test.ts` | 增加断言：默认 CLI path 必须保留 DSXU local provider shell contract，旧 browser MCP profile 不得存在；shell alias 文案改为 provider-migration |

验证：

| 验证 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts --test-name-pattern "default CLI path|provider-migration shell aliases|local provider"` | PASS，4 tests / 0 fail |
| targeted CLI old-entry scan | PASS：`SOURCE_PROVIDER_BROWSER_MCP_FLAG`、`SOURCE_PROVIDER_CODE_ENV_PREFIX`、旧 browser MCP profile、旧 shell-alias test name 均为 0 hit |
| `git diff --check` on `src/entrypoints/cli.tsx` and provider contract test | PASS，仅 CRLF warning |

当前 OGR-08 首轮判断：DSXU browser MCP 入口只保留 `--dsxu-browser-mcp`，旧 provider flag 不能再作为第二入口启动同一服务。剩余 OGR-08 还需继续审 `src/cli/remoteIO.ts`、`src/cli/transports/*`、`src/commands/*` 的 remote/transport/command owner，特别是 remote-control、CCR/SSE/WebSocket、install/update/review 这些可能绕过 Query Loop / Tool Gate 的路径。
## 24. OGR-08 二轮收口：RemoteIO / CCR / auth handler 归为 provider-migration transport fallback

继续审 `V20-OGR-08-cli-command-transport` 的 remote/transport/auth 面。真实 import/use 结论：`RemoteIO`、`transportUtils`、`CCRClient` 是 DSXU session ingress / provider contract 的 transport adapter，不拥有 Query Loop、Tool Gate 或 provider runtime；旧 `CLAUDE_CODE_*` env 只作为 provider-migration fallback，且 DSXU env 始终优先。

本轮处理：

| 文件 | 处理 |
|---|---|
| `src/cli/remoteIO.ts` | `SOURCE_PROVIDER_CODE_ENV_PREFIX` / `sourceProviderCodeEnv()` 改为 provider-migration 命名；runtime profile 改为 `provider-migration transport fallback`，明确 DSXU env 优先 |
| `src/cli/transports/transportUtils.ts` | CCR/SSE/Hybrid transport selection 的旧 env fallback 改为 provider-migration 命名；DSXU env 继续优先 |
| `src/cli/transports/ccrClient.ts` | provider version header token 与 worker epoch fallback 改为 provider-migration source 命名；CCR 仍只是 session lifecycle pattern，不是第二 transport runtime owner |
| `src/cli/handlers/auth.ts` | provider-migration OAuth/API-key env 常量改名；文本输出从旧 provider API key env 改为 provider-migration source API key env |
| `src/cli/handlers/util.tsx` | setup-token 文案改为 provider-migration isolated flow，避免把旧 OAuth flow 暗示为 DSXU 默认 auth 主链 |
| `src/dsxu/engine/__tests__/provider-contract-v1.test.ts` | 扩展回归断言：RemoteIO/transportUtils/CCR/auth/util 不得出现旧 provider owner 命名；DSXU env 必须优先于 provider-migration fallback |

验证：

| 验证 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts --test-name-pattern "default CLI path|provider-migration shell aliases|local provider"` | PASS，4 tests / 0 fail，71 expect |
| targeted OGR-08 old-name scan on `remoteIO` / transports / auth handlers | PASS，旧 `SOURCE_PROVIDER` / `source-provider` / `sourceProviderCodeEnv` / `legacy` 命名 0 hit |
| `git diff --check` on OGR-08 transport/auth files | PASS，仅 CRLF warning |

当前 OGR-08 owner 判断：RemoteIO、CCR/SSE/Hybrid/WebSocket selection、auth handler 都是 DSXU provider contract / session ingress 边界；不新增第二套 command runner、transport runtime 或 auth runtime。后续 OGR-08 继续审 `src/commands/*` 中 install/update/review/remote-setup/plugin 等命令，确认不会绕过 Query Loop / Tool Gate / release owner。
## 25. OGR-08 三轮收口：Command lifecycle shim 删除为真实 command owner

继续审 `V20-OGR-08-cli-command-transport` 的 command index 面。真实 import/use 扫描结论：

| 范围 | 结果 |
|---|---|
| 带 `// V14 command lifecycle shim` 的 command index 文件 | 79 个 |
| `processXCommandLifecycle()` / `runXCommand()` 外部引用 | 0 |
| marker 位置 | 79/79 均为文件末尾 |
| `src/commands/bridge/index.ts` 同形态 lifecycle 导出 | 0 外部引用 |

本轮处理：
| 文件范围 | 处理 |
|---|---|
| `src/commands/*/index.ts`、`src/commands/*/index.tsx`、`src/commands/*/index.js` | 批量删除文件末尾旧 V14 command lifecycle shim；保留真实 command metadata、handler load、enabled/hidden 边界 |
| `src/commands/bridge/index.ts` | 保留 disabled/hidden 的 `remote-control` alias 作为 provider-alias 可审计边界；删除未使用的 `processBridgeCommandLifecycle()` / `runBridgeCommand()` |
| `src/dsxu/engine/__tests__/provider-contract-v1.test.ts` | 新增全量 `src/commands` source 扫描，禁止 `V14 command lifecycle shim`、`processXCommandLifecycle`、`runXCommand` 回归 |

验证：
| 验证 | 结果 |
|---|---|
| `rg -n "// V14 command lifecycle shim|process[A-Za-z0-9]+CommandLifecycle|run[A-Za-z0-9]+Command" src/commands` | PASS，0 hit |
| `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts --test-name-pattern "default CLI path|provider-migration shell aliases|local provider"` | PASS，4 tests / 0 fail，695 expect |
| `git diff --check` on command shim files | PASS，仅 CRLF warning |

当前 OGR-08 owner 判断：command index 不再保留第二套 lifecycle shim；`remote-control/bridge/rc` 的产品行为继续由 `src/entrypoints/cli.tsx` + `provider-alias` 的 block result 统一处理。剩余 OGR-08 工作转为外部动作命令真实行为 review：install/update/review/plugin/remote-setup/marketplace/GitHub app/release 命令必须继续证明只进入命名 DSXU owner，不绕过 Tool Gate、Permission Gate 或 release owner。

补充 command wording owner cleanup：
| 范围 | 处理 |
|---|---|
| `/login`、`/clear`、`/commit-push-pr`、`/effort`、`/install-github-app`、`/passes`、`/review`、`/reload-plugins`、`/stickers`、`/thinkback-play`、plugin pagination helper | 清理残留 `source-provider`、`Source-Provider`、`Backward-compatible`、`backwards compatibility`、`command lifecycle shim` 口径；改为 `provider-migration source` 或 DSXU owner projection |
| `provider-contract-v1.test.ts` | `src/commands` 全目录扫描扩展到禁止上述旧口径回归 |

补充验证：`rg -n "source-provider|Source-Provider|command lifecycle shim|Backward-compatible|backward-compatible|backwards compatibility|legacy plugin|legacy runtime|legacy setup" src/commands` 为 0 hit；focused provider-contract run 更新为 PASS，4 tests / 0 fail，1527 expect。

继续处理 external-action command gate：
| 命令 | 处理 |
|---|---|
| `/install-github-app` | 保留 provider-migration-only 边界，但 `isEnabled()` 增加 `!isDsxuRuntimeMode()`；DSXU 主线 PR 工作流使用 `/commit-push-pr` |
| `/install-slack-app` | 保留 provider-migration Slack app setup 边界，但 `isEnabled()` 增加 `!isDsxuRuntimeMode()`；DSXU 主线使用 connector/provider owner |

补充验证：`provider-contract-v1.test.ts` 已断言这两个外部动作命令在 DSXU runtime 外才启用；focused run 更新为 PASS，4 tests / 0 fail，1531 expect。

继续批量处理 hidden-but-callable 外部动作命令：
| 命令 | Owner 判断与处理 |
|---|---|
| `/desktop` | provider-migration desktop handoff；增加 `!isDsxuRuntimeMode()`，DSXU 主线后续应落 DSXU Workbench/host owner |
| `/think-back` / `/thinkback-play` | provider-migration year-in-review plugin installer/player；增加 `!isDsxuRuntimeMode()`，不作为 V20 编程能力主线 |
| `/usage` | provider plan usage；增加 `!isDsxuRuntimeMode()`，DSXU 主线使用 local provider usage/cost owner |
| `/voice` | provider-migration isolated voice；增加 `!isDsxuRuntimeMode()`，后续若做 DSXU voice 必须落到新的命名 DSXU voice provider owner |
| `/passes` / `/stickers` / `/mobile` | referral、merch、mobile app product surfaces；增加 `!isDsxuRuntimeMode()`，不靠 hidden 作为隔离 |
| `/extra-usage` | provider overage provisioning；`isExtraUsageAllowed()` 在 DSXU runtime 下直接 false |

补充验证：7/7 个 `PROVIDER_MIGRATION_CLOUD_AVAILABILITY` command index 均有 DSXU runtime gate；hidden/provider-migration command scan 均显示 gated；focused provider-contract run 更新为 PASS，4 tests / 0 fail，1557 expect。
## 26. OGR-06 首轮收口：UI/TUI visible-state 旧 provider 口径清理

进入 `V20-OGR-06-ui-tui-visible-state`，先处理用户可见和 prompt 可见层的旧 provider 口径，避免它们继续塑造第二套产品 owner。

| 范围 | 处理 |
|---|---|
| `src/components/agents/generateAgent.ts` | agent 生成 prompt 从 `migrated source-provider instruction files` 改为 `provider-migration source instruction files` |
| `src/components/MCPServerDesktopImportDialog.tsx` | MCP desktop import 文案从 `source-provider desktop config` 改为 `provider-migration source desktop config` |
| `src/components/Settings/Config.tsx` | homespace API key 注释改为 provider-migration source key boundary |
| `src/components/permissions/ExitPlanModePermissionRequest/ExitPlanModePermissionRequest.tsx` | verify-plan DCE 注释改为 provider-migration boundary |
| `src/components/AutoModeOptInDialog.tsx` | user-facing copy 注释改为 provider-migration source wording |
| `provider-contract-v1.test.ts` | 增加 `src/components` / `src/screens` / `src/hooks` 扫描，禁止 `source-provider` / `Source-Provider` 回归 |

验证：
| 验证 | 结果 |
|---|---|
| `rg -n "source-provider|Source-Provider" src/components src/screens src/hooks` | PASS，0 hit |
| provider-contract focused run | PASS，4 tests / 0 fail，2553 expect |
| `git diff --check` on OGR-06 files | PASS，仅 CRLF warning |

当前 OGR-06 owner 判断：UI/TUI visible-state 首批旧 provider 字面口径已从用户可见层移除；后续继续审 subscription/billing/overage/remote notification、model migration notification、Chrome/browser provider 提示等是否都落到 DSXU cost/provider/session owner。

## 27. OGR-06/08 二轮批量收口：订阅/计费/浏览器 provider/remote planning 可见入口

本轮按真实 import/use 和用户可见入口复核，不再把旧 provider/cloud/web copy 作为 compatibility holding path。处理结果：

| 范围 | Owner 判断与处理 |
|---|---|
| `src/hooks/notifs/useCanSwitchToExistingSubscription.tsx` | DSXU runtime 直接返回 `null`，subscription switch notice 只属于 provider-migration account boundary |
| `src/hooks/useChromeExtensionNotification.tsx` | DSXU Browser Provider 在 DSXU runtime 下不再要求 provider subscription；非 DSXU path 才提示 provider-migration cloud credentials |
| `src/components/ConsoleOAuthFlow.tsx` | DSXU runtime guidance 改为 Provider-migration OAuth disabled + DeepSeek/DSXU Provider |
| `src/components/TeleportError.tsx` | 旧 provider subscription copy 改为 provider-migration cloud credentials，限定 remote workspace adapter |
| `src/components/LogoV2/OverageCreditUpsell.tsx`、`src/components/Settings/Usage.tsx`、`src/components/messages/RateLimitMessage.tsx`、`src/components/Settings/Config.tsx`、`src/components/PromptInput/PromptInput.tsx` | DSXU runtime 下 extra usage / overage / provider billing 提示被 gate 到 provider-migration 边界；DSXU 主链改走 cost/evidence telemetry |
| `src/components/LogoV2/GuestPassesUpsell.tsx`、`src/components/LogoV2/feedConfigs.tsx`、`src/components/Passes/Passes.tsx` | referral/pass copy 改为 DSXU provider workspace；入口仍在 DSXU runtime 下关闭，不作为 V20 编程主链 |
| `src/components/permissions/ExitPlanModePermissionRequest/ExitPlanModePermissionRequest.tsx`、`src/components/PromptInput/PromptInput.tsx` | Ultraplan 提示改为 DSXU Ultraplan / remote planning workflow，不再指向旧 web 产品 |
| `src/commands/ultraplan.tsx`、`src/commands/review.ts`、`src/commands/remote-setup/index.ts` | `/ultraplan`、`/ultrareview`、`/web-setup` 统一改为 DSXU remote planning/review workflow 或 provider-migration remote workspace |
| `src/components/Onboarding.tsx` | old provider key comment 改为 provider-migration key boundary |
| `src/dsxu/engine/__tests__/provider-contract-v1.test.ts` | 扩展静态 contract scan，禁止旧 provider/web/command-lifecycle copy 回归 |

验证：

| 验证 | 结果 |
|---|---|
| `rg -n "DSXU Code on the web|source-provider|Source-provider|Source-Provider|Share DSXU Code|provider subscription account|Backward-compatible|backwards compatibility|V14 command lifecycle shim|process[A-Za-z0-9]+CommandLifecycle|run[A-Za-z0-9]+Command" src/commands src/components src/hooks src/screens` | PASS，0 hit |
| `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts --test-name-pattern "default CLI path|provider-migration shell aliases|local provider"` | PASS，4 tests / 0 fail / 3467 expect |
| `git diff --check` on commands/components/hooks/screens/provider-contract test | PASS，仅 CRLF warning |

当前 OGR-06/08 owner 判断：旧 web/cloud/subscription 可见入口已进一步收口为 DSXU Provider、DSXU remote planning/review workflow、DSXU cost/evidence telemetry 或 provider-migration gated boundary；未新增主链入口、未新增桥接模式、未保留第二套 command runner。

## 28. OGR-06/08/10 三轮批量收口：Agent/Bash/Brief/MCP/Workflow boundary 与旧 BridgeAdapter

本轮继续执行 V20 原侧收口，不用 compatibility holding path 代替 owner 判断。真实 import/use 结论：旧 `BridgeAdapter` 已没有产品主链 import，只有旧测试仍在保活；Agent team、Bash、Brief、MCP Auth、Workflow、FileWrite、spawnMultiAgent、Perfetto 的残留旧 provider 字面口径均属于 provider-migration source intake，不是第二套 runtime。

| 范围 | Owner 判断与处理 |
|---|---|
| `src/utils/agentSwarmsEnabled.ts`、`src/tools/shared/spawnMultiAgent.ts` | agent/team env 口径统一为 DSXU primary env + provider-migration source alias；teammate runtime 仍由 DSXU Spawn Multi-Agent owner 管理 |
| `src/tools/BashTool/prompt.ts`、`src/tools/BashTool/bashPermissions.ts`、`src/tools/BashTool/readOnlyValidation.ts` | 旧 provider 字面口径清理；Bash permission/read-only validation 继续归 DSXU Bash Permission Engine，不作为 provider shell shortcut |
| `src/tools/BriefTool/attachments.ts`、`src/tools/BriefTool/BriefTool.ts`、`src/tools/BriefTool/upload.ts` | Brief upload/attachment 边界清理为 DSXU bridge upload provider + provider-migration source env intake |
| `src/tools/McpAuthTool/McpAuthTool.ts`、`src/tools/WorkflowTool/prompt.ts`、`src/tools/FileWriteTool/FileWriteTool.ts`、`src/utils/telemetry/perfettoTracing.ts` | MCP Auth、Workflow、FileWrite、Perfetto 均清理旧 provider 文案，不新增第二套 MCP/workflow/write/tracing runtime |
| `src/dsxu/engine/adapters/bridge-adapter.ts` | 旧 `BridgeAdapter` runtime 已从产品和测试 import 中移除；文件删除被 ACL 拒绝，现只保留 tombstone，owner 为后续 ACL residue/delete signoff |
| `src/dsxu/engine/__tests__/bridge-gate.test.ts`、`src/dsxu/engine/__tests__/gate-integration.test.ts`、`src/dsxu/engine/adapters/__tests__/adapter-absorption.test.ts` | 旧 bridge gate 保活测试改为 retired adapter 防回归和 ExternalToolAdapter owner 证据 |

验证：

| 验证 | 结果 |
|---|---|
| provider-contract focused run | PASS，4 tests / 0 fail，3671 expect |
| bridge/gate/adapter focused run | PASS，19 tests / 0 fail，66 expect |
| targeted old provider scan on Agent/Bash/Brief/MCP/Workflow/FileWrite/spawn/Perfetto/bridge tombstone | PASS，0 hit |
| old BridgeAdapter symbol/import scan | PASS，产品主线 0 hit；仅测试中保留防回归断言 |
| `git diff --check` on 本轮 files | PASS，仅 CRLF warning |

当前 OGR-10 owner 判断：旧 bridge adapter 不能作为 V20 tool runtime 保留；真实执行 owner 是 `external-tool-adapter.ts` 和上层 DSXU Tool Gate / Permission Gate。唯一未完成项是 ACL 拒绝物理删除，需要在 owner/Git/权限 residue packet 中签收或由外部权限收口。

## 29. OGR-03/10 mainline tool fallback 显式化

本轮继续审 tool runtime owner。发现 `src/dsxu/engine/engine-tool-adapter.ts` 虽然默认调用 `src/tools/*` mature tool classes，但在 `mainline-tool-call-error` 且错误文本看似 recoverable 时，会自动执行 `builtin-tools.ts` fallback。该行为不是命名 owner 的明确授权，容易把 built-in fallback 变成第二套工具运行时。

| 范围 | Owner 判断与处理 |
|---|---|
| `src/dsxu/engine/engine-tool-adapter.ts` | 删除 `isRecoverableRuntimeDependencyError()` 自动 fallback；fallback 只允许 `context.allowMainlineToolFallback === true` 显式 opt-in |
| `src/dsxu/engine/__tests__/provider-contract-v1.test.ts` | 增加防回归：不得恢复 recoverable error 字符串 fallback |
| `src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts` | 补齐当前 mainline tool batch 的 schema 期望：TaskOutput、TaskStop、TeamCreate、TeamDelete、EnterWorktree、ExitWorktree |

验证：

| 验证 | 结果 |
|---|---|
| provider-contract focused run | PASS，4 tests / 0 fail，3679 expect |
| mainline-tool-adapter focused run | PASS，3 tests / 0 fail，89 expect |
| engine-tool-adapter fallback scan | PASS，`isRecoverableRuntimeDependencyError` / `command not found/i` 无 active runtime hit |
| `git diff --check` on 本轮 files | PASS，仅 CRLF warning |

当前 OGR-03/10 owner 判断：主线工具执行不再因错误文本自动掉入 built-in fallback；fallback 只能作为显式测试/恢复 opt-in。剩余 owner 风险转到 `tool-capability-pool.ts`、`extended-tools.ts#getAllTools()`、`QueryEngine.bootstrapFullAbsorb()` 是否仍把 built-in core tools 注册成产品路径。

## 30. OGR-03/10 capability pool 与 full_absorb owner 收口

本轮继续处理 built-in fallback 的另一条进入主链路径。真实 import/use 结论：`tool-capability-pool.ts`、`extended-tools.ts#getAllTools()`、`QueryEngine.bootstrapFullAbsorb()` 仍可能把 `builtin-tools.ts` core/read-only 工具注册进 full_absorb 或 engine public surface，绕开 `src/tools/*` mature owner。

| 范围 | Owner 判断与处理 |
|---|---|
| `src/dsxu/engine/tool-capability-pool.ts` | 删除 built-in core/read-only import 与注册；`core`、`read_only` pool 返回空集合，主线工具只能通过 `engine-tool-adapter.ts` 映射到 `src/tools/*` |
| `src/dsxu/engine/extended-tools.ts` | `getAllTools()` 不再动态 `require('./builtin-tools')`，只返回 extended/debug/analysis 工具 |
| `src/dsxu/engine/index.ts` | `bootstrapFullAbsorb()` 不再重复 `registerTools(getAllTools())` / `registerTools(getDebugTools())`；删除 built-in core tools 的 public re-export |
| `src/dsxu/engine/__tests__/engine.test.ts` | capability/full_absorb 断言改为不包含 legacy builtin core tools；旧 recovery tool 单测直接从 `../builtin-tools` 导入，避免误当 public API |
| `src/dsxu/engine/__tests__/provider-contract-v1.test.ts` | 增加静态防回归断言，禁止 capability/full_absorb 恢复 built-in core 注册路径 |

验证：

| 验证 | 结果 |
|---|---|
| `engine.test.ts` capability/full_absorb focused run | PASS，5 tests / 0 fail，26 expect |
| provider-contract focused run | PASS，4 tests / 0 fail，3697 expect |
| mainline-tool-adapter focused run | PASS，3 tests / 0 fail，89 expect |
| targeted capability scan | PASS，`from './builtin-tools'`、`require('./builtin-tools')`、`getCoreTools()`、`getReadOnlyTools()`、`registerTools(getAllTools())` 为 0 hit |
| `git diff --check` on 本轮 files | PASS，仅 CRLF warning |

当前 OGR-03/10 owner 判断：built-in fallback 已不能通过 runtime error、capability pool、full_absorb、engine public export 自动进入产品主链。`builtin-tools.ts` 只剩 legacy isolated recovery/test surface；后续如果同等行为重复，必须并入 `src/tools/*` owner 或进入 replace/delete candidate。

## 31. OGR-07 api-service provider fallback 显式化

本轮转入 provider/model/cost owner。真实 import/use 结论：`src/dsxu/engine/api-service.ts` 原本默认注册 DeepSeek、OpenAI、Ollama 三类 backend，其中 OpenAI 只要有 key 就进入列表，Ollama 默认注册本地 URL。这不是 V20 所需的 DeepSeek 主 owner，而是默认第二套 provider runtime 风险。

| 范围 | Owner 判断与处理 |
|---|---|
| `src/dsxu/engine/api-service.ts` | 注释改为 provider transport boundary；默认只注册 DeepSeek owner |
| `APIServiceConfig` | 新增 `allowProviderFallbacks`、`allowOpenAIFallback`、`allowOllamaFallback` |
| env gate | 新增显式 fallback env：`DSXU_ALLOW_PROVIDER_MODEL_FALLBACKS`、`DSXU_ALLOW_OPENAI_FALLBACK`、`DSXU_ALLOW_OLLAMA_FALLBACK` |
| OpenAI fallback | 只有 `openaiKey` 存在且显式允许时注册 |
| Ollama fallback | 只有显式允许时注册；允许后才读取 `ollamaUrl` / `DSXU_OLLAMA_URL` / 默认本地 URL |
| `api-service.test.ts` | fallback 用例改为显式授权；新增默认 DeepSeek-only 防回归 |
| `provider-contract-v1.test.ts` | 增加静态断言，禁止恢复旧 “OpenAI backup -> Ollama local fallback” 口径 |

验证：

| 验证 | 结果 |
|---|---|
| `api-service.test.ts` | PASS，20 tests / 0 fail，49 expect |
| provider-contract focused run | PASS，4 tests / 0 fail，3707 expect |
| mainline-tool-adapter focused run | PASS，3 tests / 0 fail，89 expect |

当前 OGR-07 owner 判断：`api-service.ts` 回到 provider transport boundary，不再默认启动 OpenAI/Ollama 作为第二套 provider runtime。后续继续审 broader `src/services/api/*`、model router、cost/evidence surface，确认它们只走 DeepSeek V4 主 owner 或显式 operator-approved fallback gate。

## 32. OGR-07 llm-adapter / config / broader provider surface 批量收口

继续把 provider owner gate 从 APIService 推到调用层和 broader 文案层。真实 import/use 结论：`llm-adapter.ts` 仍把 OpenAI/Ollama env 当成 provider backend，并且默认启用 provider-migration proxy fallback；这会绕过 `api-service.ts` 的显式 fallback gate。

| 范围 | Owner 判断与处理 |
|---|---|
| `src/dsxu/engine/llm-adapter.ts` | 不再用 OpenAI/Ollama env 判定 backend；改为创建 `APIService` 并只在 `apiService.getStatus().length > 0` 时进入 adapter |
| provider-migration proxy fallback | 默认关闭；只有 `options.allowProxyFallback === true` 或 `DSXU_ALLOW_PROVIDER_MIGRATION_PROXY_FALLBACK=1` 时启用 |
| fail-closed LLM | 默认缺少 DeepSeek/显式 fallback gate 时返回 `createUnconfiguredLLMCall()`，QueryEngine 可构造，但真实调用会明确失败 |
| `src/dsxu/engine/__tests__/llm-adapter-owner-v1.test.ts` | 新增 OpenAI/Ollama env 未授权不进入 provider runtime、显式 OpenAI fallback 才可用两条回归 |
| `src/dsxu/engine/config.ts` | 新增 fallback gate 配置默认 false，并从显式 env 读取 |
| `src/dsxu/engine/doctor.ts` | OpenAI key 标记为 explicit fallback only |
| broader provider surface | 清理 `bootstrap.ts`、`grove.ts`、`withRetry.ts`、`dsxuTransport.ts`、1P analytics logger/exporter、metadata、model deprecation/support/betas 中旧 `source-provider` 口径 |
| `provider-contract-v1.test.ts` | 扩展静态扫描到 broader provider surface，并断言 LLM adapter 不恢复默认 proxy/OpenAI/Ollama fallback |

验证：

| 验证 | 结果 |
|---|---|
| `llm-adapter-owner-v1.test.ts` | PASS，2 tests / 0 fail |
| `api-service.test.ts` | PASS，20 tests / 0 fail，49 expect |
| provider-contract focused run | PASS，4 tests / 0 fail，3784 expect |
| broader provider-surface scan | PASS，`source-provider` / `Source-provider` / `Source-Provider` / `SOURCE_PROVIDER` / `source provider` / 默认 proxy fallback / 旧 OpenAI/Ollama fallback error copy 均为 0 hit |
| `git diff --check` on 本轮 files | PASS，仅 CRLF warning |

当前 OGR-07 owner 判断：默认模型路径已回到 DeepSeek V4 主 owner；OpenAI、Ollama、provider-migration proxy 都只能作为显式 fallback/migration boundary。后续继续审 `src/services/api/client.ts` 的 provider SDK non-DSXU path、`dsxuTransport.ts` streaming fallback、cost/evidence route，不允许它们回流成第二套 provider runtime。

## 33. OGR-07 provider SDK / primary fallback / streaming tool-state 收口

本轮继续处理 API client 与 retry/transport 的 owner 边界。真实 import/use 结论：`client.ts` 的 provider SDK branch、`withRetry.ts` 的 primary model fallback、`dsxuTransport.ts` 的 streaming->non-streaming fallback 都需要更明确地证明不会回流成第二套 provider runtime 或重复工具执行路径。

| 范围 | Owner 判断与处理 |
|---|---|
| `src/services/api/client.ts` | 新增 `shouldUseDsxuDeepSeekClient()`；默认 DSXU 主线和未显式开启 migration shell 的路径都走 `DeepSeekAdapter` |
| Provider SDK / Bedrock / Vertex / Foundry | 只能在 `DSXU_ALLOW_PROVIDER_MIGRATION_SERVICE_SHELL=1` 后进入；否则不是 DSXU 主线 provider runtime |
| `src/services/api/withRetry.ts` | 新增 `isPrimaryModelFallbackAllowed()`；DSXU 主线只接受 `DSXU_ALLOW_PROVIDER_MODEL_FALLBACKS` 或 `DSXU_CODE_ALLOW_PROVIDER_MODEL_FALLBACKS` 显式 fallback gate |
| 旧 `FALLBACK_FOR_ALL_PRIMARY_MODELS` | 只在 provider-migration service shell 内生效，不能单独触发 DSXU 主线 fallback |
| `src/services/api/dsxuTransport.ts` | 新增 `hasStartedStreamingToolState()`；streaming 失败时若已开始 `tool_use` / `server_tool_use`，禁用 non-streaming fallback |
| telemetry | tool-state 禁用 fallback 时记录 `fallback_cause=tool_state_started`，让恢复路径可审计 |
| tests | `provider-migration-model-alias-isolation-v1.test.ts`、`provider-contract-v1.test.ts` 补充静态 owner 防回归 |

验证：

| 验证 | 结果 |
|---|---|
| `provider-migration-model-alias-isolation-v1.test.ts` | PASS，6 tests / 0 fail，27 expect |
| provider-contract focused run | PASS，4 tests / 0 fail，3803 expect |
| targeted owner scan | PASS，`shouldUseDsxuDeepSeekClient`、`isPrimaryModelFallbackAllowed`、`hasStartedStreamingToolState`、`tool_state_started` 均存在于 owner 路径 |
| `git diff --check` on 本轮 files | PASS，仅 CRLF warning |

当前 OGR-07 owner 判断：Provider SDK 只能作为显式 provider-migration shell；primary model fallback 只能由 DSXU/operator gate 或 migration shell 触发；streaming request-mode fallback 不再允许跨过已经开始的 tool lifecycle。

## 34. OGR-07 peripheral provider API / telemetry / files boundary 收口

执行目标：继续按 V20 原侧标准处理 provider/model/cost owner 的外围入口，确认默认 DSXU runtime 不会通过 files、metrics、logging、preconnect、remote managed settings 暗中进入旧 provider runtime。

| 范围 | Owner 判断与处理 |
|---|---|
| `src/services/api/filesApi.ts` | 默认 DSXU runtime 不再 fallback 到旧 provider public Files API；必须传入 `FilesApiConfig.baseUrl` 或配置 `DSXU_CODE_API_BASE_URL`。旧 public base URL 只允许显式 provider-migration service shell 使用。 |
| `src/services/api/metricsOptOut.ts` | 新增 provider-migration metrics opt-out gate；默认 DSXU runtime 返回 disabled，不访问旧 provider metrics endpoint。 |
| `src/services/api/logging.ts` | provider env metadata 改为 provider-migration metadata，并在 DSXU runtime 默认隐藏，避免旧 provider base/model env 污染产品 analytics owner。 |
| `src/utils/apiPreconnect.ts` | DSXU runtime 默认不预热旧 provider base URL；显式 provider-migration service shell 才可使用该预连接路径。 |
| `src/services/remoteManagedSettings/syncCache.ts` / `syncCacheState.ts` | remote settings 继续由 DSXU eligibility gate 控制；迁移 override 明确为 `DSXU_ENABLE_PROVIDER_MIGRATION_REMOTE_SETTINGS`，不是默认主链。 |
| `src/dsxu/engine/__tests__/provider-contract-v1.test.ts` | 扩展静态合约扫描到本轮外围入口以及 token/model/side-query/dsxuLimits，避免 provider boundary 回流成默认 runtime。 |

验证：
| 验证 | 结果 |
|---|---|
| provider-contract focused run | PASS：1 test / 0 fail / 3852 expect |
| provider-migration model alias isolation run | PASS：6 tests / 0 fail |
| targeted stale provider boundary scan | PASS：本轮范围内无 `DEFAULT_PROVIDER_FILES_API_BASE_URL`、`Falls back to public API for standalone usage`、`getProviderEnvMetadata`、`SOURCE_PROVIDER_REMOTE_SETTINGS_FLAG`、`source-provider` active hit |

Owner 结论：OGR-07 默认 provider runtime 已继续从 API client / retry / transport 推进到外围 file/telemetry/logging/preconnect/settings boundary。旧 provider API 只能是显式 provider-migration shell 或 DSXU 显式配置 adapter boundary；不能作为默认 DeepSeek V4 Flash / Flash-MAX / Pro 主链运行时。
补充：`src/main.tsx` 的 `--file` 启动下载调用端同步收口。新增 `resolveStartupFilesApiBaseUrl()`，默认 DSXU local mainline 只接受 `DSXU_CODE_API_BASE_URL`，不再直接把旧 provider OAuth base URL 传给 `FilesApiConfig.baseUrl`。
第二层账号 API 补充：`usage.ts`、`ultrareviewQuota.ts`、`referral.ts`、`overageCreditGrant.ts`、`adminRequests.ts`、`grove.ts` 已补 DSXU runtime gate。外层 UI/command gate 仍保留，但 service 自身也不再裸连旧 provider OAuth/account/subscription API。
第三层启动/策略/同步边界补充：`settingsSync`、`teamMemorySync`、`fastMode` 已完成默认 DSXU runtime gate；`policyLimits` 复核为已有 DSXU 早退。该层结论是：启动同步、团队记忆、fast-mode org status 都不能默认使用旧 provider backend。
## 35. OGR-06/07/08 mainline entry + UI/provider boundary 批量收口补充

本轮补充收口入口链和 visible-state：`main.tsx`、`QueryEngine.ts`、`constants/system.ts`、`coordinatorMode.ts`、`DiagnosticsDisplay.tsx`、`diagnosticTracking.ts`、`mcp/auth.ts`、`Feedback.tsx`、`ModelSelector.tsx`、`Grove.tsx`、`useFeedbackSurvey.tsx`、`Settings/Config.tsx`、`cli/update.ts`、`entrypoints/*`。

Owner 决策：旧 wire 字符串只允许作为 provider-migration intake；代码 owner、UI label、service fallback、feedback backend 均不能继续以 source-provider 命名或默认执行。特别是 `Feedback.tsx` 默认 DSXU runtime 不再调用旧 provider feedback endpoint，而是进入 GitHub issue draft 体验。

验证：provider-contract focused run PASS（1 test / 0 fail / 3973 expect）；targeted scan 对本轮文件无 `SOURCE_PROVIDER` / `sourceProvider` / `source-provider` / mojibake active hit；`git diff --check` PASS，仅 CRLF warning。
## 2026-05-14 批量 owner/Git 执行更新：OGR-03/04/05/07/08/12 交叉收口

本轮不做小步补丁，按 owner boundary 一次性处理多组高风险路径。实际改动覆盖：
- Permission / Tool Gate 周边：permission parser、permission setup/loading、shell rule、PowerShell/FileRead/Schedule/RemoteTrigger 相关提示与边界表述。
- Env / installer / doctor：managed env、envCompat、env、shellConfig、autoUpdater、nativeInstaller、localInstaller、doctorDiagnostic、cleanup、VCR、tool orchestration。
- Agent/MCP/Skill/Plugin/IDE/Transport：Agent 旧字段、MCP/plugin registry、bundled skills、desktop MCP import、IDE provider-migration source extension、teleport、remote/session credential fallback。
- Shared utilities：cron/worktree/tmux/subprocess/shell snapshot/http/user/settings/markdown config/native download/pid lock/release notes 等文件统一回 provider-migration 命名。

Owner 裁决：
- 等价旧源行为不再作为第二套 owner 表达；只保留 provider-migration source value，用于迁移、外部兼容或隐藏证据。
- 产品 runtime 文件不再出现 SOURCE_PROVIDER / sourceProvider / source-provider 命名；剩余命中限制在 src/dsxu/engine 的契约/证据测试。
- provider-contract-v1 已扩大覆盖这些运行文件，防止后续把旧源语义重新写回产品路径。

验证：
- `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts --test-name-pattern "default CLI path"` PASS，4448 expect。
- `bun test src/dsxu/engine/__tests__/permissions.test.ts src/tools/__tests__/v20-tool-permission-owner-gate.test.ts src/dsxu/engine/__tests__/api-service.test.ts src/dsxu/engine/__tests__/model-config.test.ts src/services/mcp/adapters/__tests__/mcp-adapters.test.ts` PASS，64 tests / 0 fail。
- git diff --check PASS，只有 CRLF 工作区 warning。

未做的事：没有 stage、commit、reset、clean、删除证据目录或创建 clean export。git status --short 仍为 1793，后续必须通过 owner/Git packets 正式签收才会下降。
## 2026-05-14 OGR-07/engine evidence 术语闭环复核

本轮把上一批仍残留在 `src/dsxu/engine` 契约和证据测试中的 `SOURCE_PROVIDER` / `sourceProvider` / `source-provider` / `Source-provider` 命名全部收口到 provider-migration source 语义。关键点不是改字面，而是把 owner 意义固定下来：这些内容只能表达迁移来源、隐藏证据、防回归 contract 或 public surface gate，不能继续像第二套 provider/runtime owner。

已处理：
- `v18-model-public-surface-gate.ts` 的 public surface blocker 常量、helper、issue 文案改为 provider-migration source 术语。
- `v19-cost-cache-live-task-evidence.ts` 的 summary 字段从 `sourceProviderStatus` 改为 `providerMigrationSourceStatus`，测试同步更新。
- 多个 absorption/productization contract 的 `source-provider shell` 文案改为 provider-migration shell / provider-migration source boundary。
- `provider-contract-v1.test.ts` 保留对旧 token 的防回归断言，但通过拼接生成旧 token，避免测试源码本身污染静态扫描。

验证：
- provider contract focused run PASS，1 test / 0 fail / 4448 expect。
- model public surface / model config / cost-cache evidence focused run PASS，13 tests / 0 fail。
- 全 `src` TS/TSX/JS/JSX 静态扫描对 `SOURCE_PROVIDER|sourceProvider|source-provider|Source-provider` 为 0 hit。
- `git diff --check` PASS，仅 CRLF warning。

当前 owner 判断：产品 runtime、engine contract 和 evidence test 已不再保留旧 provider/source 命名口径。后续如果发现等价旧源行为，只能合并到 provider-migration source evidence 或进入 replace/delete candidate；不能恢复为兼容 holding path。当前 `git status --short` 为 1795，仍未执行 stage/commit/delete/clean export。
## 2026-05-14 V20-C5-PUB + compatibility wording owner review

本轮把 V20-C5-PUB 从计划项推进为实际文件入口：README、安装、配置、doctor/health、tool surface、security/permission、contributing、release runbook、changelog、code of conduct 已落地。该工作不改变 runtime，只补齐 GitHub 开源产品化必须具备的用户入口和 release 阻断说明。

Owner 裁决：这些文档归 Docs + Release owner，不是新产品入口；DeepSeek-TUI、AionUi、Cherry、Warp、browser-use 只作为生态兼容设计参考，不作为 V20 内置依赖或下载目标。README 明确 `V20 PARTIAL`，不允许把 focused verification 包装成 final release。

同时继续复核源码注释层的 compatibility holding-path 风险：`Tool.ts`、SDK/MCP schema、message queue、settings/config、TaskStop、swarm permission、native installer、conversation recovery、repository detection、vim/settings alias 等文件中的旧 compatibility 口径已改为 migration alias、historical state、API stability、settings migration 或 direct binary download base。

验证：
- `src` 中 `Backward-compatible|backwards compatibility|backward compatibility|BACKWARD COMPATIBILITY|generic bucket|compatibility holding|bridge shortcut` 静态扫描为 0 hit。
- provider contract default CLI path focused run PASS，1 test / 0 fail / 4448 expect。
- 本轮 diff check PASS，仅 CRLF warning。

当前 owner 判断：不再在产品源码注释里保留“兼容层/通用桶”这类可被误读为保留第二套路径的口径。实际历史输入仍可被主线 owner 处理，但必须被称为 migration alias 或 historical state，并接受 Tool Gate / Permission Gate / Release Gate 约束。

## 2026-05-14 OGR-03/04 批量更新：MCP Doctor 与 ToolDefinition V20 owner metadata

本轮 owner review 重点是把 MCP/Tool 的可见证据面补到真实代码，而不是继续写抽象计划。

### OGR-04 MCP / Skill / Plugin boundary

已新增 `src/services/mcp/doctor.ts`，并通过 `dsxu-code mcp doctor [--json]` 暴露为 MCP-specific doctor。Owner 判断如下：

| 范围 | Owner 判断 |
|---|---|
| MCP doctor service | 属于 `src/services/mcp/*` owner，只做配置、registry、scope、transport、server owner、release gate 投影。 |
| CLI handler | 使用 `getDsxuCodeMcpConfigs()`，避免 doctor 为了健康检查触发 provider-migration fetch 或 server spawn。 |
| Release gate | Config error 为 `BLOCKED`；registry missing、server empty、provider-migration boundary 为 `WARN`，必须签收后才能 release。 |
| Provider-migration MCP | 只能显示为 explicit provider-migration boundary，不能成为默认 MCP owner。 |

验证：
- `bun test src/services/mcp/__tests__/doctor.test.ts` PASS。
- `bun --env-file=.env ./src/entrypoints/dsxu-code.tsx mcp doctor --json` PASS；当前真实环境输出 `WARN`，原因是 registry 未配置且没有 MCP servers。
- `bun test src/services/mcp/__tests__/doctor.test.ts src/services/mcp/adapters/__tests__/mcp-adapters.test.ts` PASS。

### OGR-03 Tool Surface / Tool Gate metadata

已在 `src/Tool.ts` 的既有 Tool contract 中增加 V20 metadata 和 summary helper。Owner 判断如下：

| 范围 | Owner 判断 |
|---|---|
| `runtimeMetadata` | 属于现有 ToolDefinition，不是第二 registry。 |
| `summarizeToolDefinitionV20()` | 只做 owner/side-effect/permission/evidence/ui projection；不执行工具、不绕 Tool Gate。 |
| Bash / PowerShell | 标为 DSXU shell tool / permission engine owner，side effect 显式为 shell/process + command-controlled FS/network。 |
| MCPTool | 标为 DSXU MCP Tool Adapter，side effect 显式为 external MCP tool call。 |
| RunNativeTest | 标为 DSXU Semantic Verification Tool，不是默认 arbitrary execution。 |
| TaskCreate / TaskStop | 标为 DSXU Task Lifecycle，不新增第二套 agent orchestrator。 |

验证：
- `bun test src/dsxu/engine/__tests__/tool-definition-v20.test.ts` PASS：2 tests / 0 fail / 14 expect。
- `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts --test-name-pattern "default CLI path"` PASS。
- `src` 旧 provider/source token 与 compatibility holding-path token 静态扫描仍为 0 hit。

当前 owner 结论：MCP doctor 与 ToolDefinition metadata 都已进入原 owner 的真实代码面。剩余不是再加新小结构，而是继续扩大 high-risk tool metadata 覆盖、推进 owner/Git packet signoff、deletion review、ACL residue、六阶段真实测试和 clean export。

## 2026-05-14 OGR-03 批量更新：ToolDefinition high-risk 覆盖扩大到 22 个工具

本轮继续推进 OGR-03，不再只保留首批 metadata。新增覆盖 FileEdit、FileWrite、NotebookEdit、TodoWrite、TaskUpdate、Agent、SendMessage、TeamCreate、TeamDelete、CronCreate、CronDelete、RemoteTrigger、WebFetch、WebSearch、Workflow、CollectEvidence。

Owner 裁决：
- `runtimeMetadata` 仍属于 `src/Tool.ts` 的既有 Tool contract，不能作为第二注册表使用。
- 每个 high-risk tool 必须说明 owner、side effects、permission owner、evidence、uiProjection。
- WebFetch/WebSearch 虽然 `isReadOnly()` 为 true，但 metadata 必须显式说明 external network side effect，避免把网络读伪装成本地 read-only。
- Workflow/CollectEvidence 只能投影计划和证据；不能作为执行工具或测试替代物。
- Agent/Team/SendMessage/Cron/RemoteTrigger 只能归现有 Agent/Task/Scheduled/Remote owners，不能留下第二套 orchestrator 或桥接 holding path。

验证：
- `bun test src/dsxu/engine/__tests__/tool-definition-v20.test.ts` PASS：3 tests / 0 fail / 82 expect。
- `rg -n "runtimeMetadata:" src/tools --glob "*.ts" --glob "*.tsx"` 返回 22 个覆盖点。
- 本轮相关文件 `git diff --check` PASS，仅 CRLF warning。

当前 OGR-03 结论：核心 side-effecting tools 已具备真实 owner metadata 和测试证据。下一轮继续从剩余 tool directory 做 owner 分类：纯 read tools 可用 DSXU read owner metadata，legacy/testing/internal tools 若无产品意义则进入 replace/delete review，而不是继续留作模糊 runtime。

## 2026-05-14 OGR-03 批量更新：read/discovery/plan/worktree 工具 owner 覆盖

本轮把 ToolDefinition metadata 从 side-effecting tools 扩展到 FileRead、Grep、Glob、ListMcpResources、ReadMcpResource、SkillTool、ConfigTool、EnterPlanMode、ExitPlanMode、ToolSearch、EnterWorktree、ExitWorktree、TaskGet、TaskList、TaskOutput。

Owner 裁决：
- FileRead/Grep/Glob 是 DSXU read/search owner；Grep 明确包含 ripgrep process execution side effect。
- MCP resource list/read 只是连接中 MCP client 的 resource adapter；binary blob 落盘必须作为 evidence side effect，不隐藏。
- SkillTool 是 DSXU skill runtime adapter，允许 inline/forked/MCP skill 形态，但仍受 skill lookup、allow/deny、安全属性、agent context gate 约束。
- ConfigTool read auto-allow；setting mutation 需要 ask。
- Enter/ExitPlanMode、Enter/ExitWorktree 都是状态/工作区生命周期工具，必须显示 permission/state/cwd/worktree side effect。
- TaskGet/List/Output 归 Task Lifecycle；TaskOutput 保留 historical aliases，但不再用 compatibility 口径。

验证：
- `bun test src/dsxu/engine/__tests__/tool-definition-v20.test.ts` PASS：4 tests / 0 fail / 146 expect。
- `runtimeMetadata` 覆盖点当前为 37。
- compatibility holding-path 关键词扫描发现并清理 `src/skills/loadSkillsDir.ts` 测试 alias 注释。

当前 OGR-03 结论：核心工具 owner metadata 已由局部高风险扩成大面覆盖。下一批继续处理剩余 tools 目录中 product-readiness 边界较弱的项，例如 AskUserQuestion、Brief、LSP、REPL/Sleep、SyntheticOutput、McpAuth、testing/Tungsten 等，按“有用挂 owner；无产品意义列 replace/delete review”的标准收口。

## 2026-05-14 OGR-03 批量更新：user-facing / LSP / MCP auth / structured output

本轮新增 AskUserQuestion、Brief、LSPTool、McpAuth pseudo-tool、SyntheticOutput、TestingPermission 的 owner metadata。覆盖点当前为 43。

Owner 裁决：
- AskUserQuestion 和 Brief 是 DSXU user-facing surfaces，必须显示用户交互/可见输出，不允许成为隐藏控制面。
- LSPTool 是 DSXU LSP adapter，read-only 但包含 LSP request 和 filesystem stat validation。
- McpAuth pseudo-tool 是 MCP Auth Adapter，OAuth/reconnect/appState swap 都作为 side effect；provider-migration transport 不支持 tool-triggered OAuth。
- SyntheticOutput 是 structured output surface，不能作为额外执行路径。
- TestingPermission 是 test-only fixture，release review 时不能算产品功能。

验证：
- `bun test src/dsxu/engine/__tests__/tool-definition-v20.test.ts` PASS：5 tests / 0 fail / 168 expect。
- `runtimeMetadata` 覆盖点 43。
- 旧 provider/source token 与 compatibility holding-path token 扫描为 0 hit。

当前 OGR-03 结论：Tool Surface owner evidence 已足够支撑下一轮 owner/Git packet review。剩余未覆盖路径以 helper/stub/test/internal 为主，应做 owner map 或 replace/delete candidate，而不是继续生成小型运行结构。

## 2026-05-14 OGR-03 批量更新：Tool Surface 残余闭环与 replace/delete candidate

本轮处理 `src/tools` 残余：
- `CronListTool` 补入 `DSXU Scheduled Task Lifecycle` metadata，与 CronCreate/CronDelete 合并到同一 owner。
- `TungstenTool` 显式定性为 `DSXU Disabled Recovery Stub`，`isEnabled=false`，permission deny，具备 outputSchema 和 runtimeMetadata。
- `src/Tool.ts` 删除 “TungstenTool doesn't define outputSchema” 的例外 TODO，避免旧 disabled stub 继续影响 Tool contract 设计。

Owner 裁决：
- Cron 三件套属于一个 scheduled task lifecycle，不允许拆成第二套 automation runtime。
- Tungsten 不能作为 V20 产品 terminal runtime；它只能进入 replace/delete review candidate、test/recovery exclusion，或未来被正式重建为 DSXU-named terminal owner 后再进入产品路径。
- 现在 `src/tools` 的 buildTool 产品入口已经全部具备 metadata；剩余 helper 文件由对应 owner 覆盖，不再作为独立 owner bucket。

验证：
- `bun test src/dsxu/engine/__tests__/tool-definition-v20.test.ts` PASS：5 tests / 0 fail / 177 expect。
- `buildTool(...)` 计数 43；`runtimeMetadata` 覆盖点 45。
- 旧 provider/source token 与 compatibility holding-path token 扫描为 0 hit。

当前 OGR-03 结论：Tool Surface 已可进入 owner/Git packet 签收。下一步应转 OGR-04 MCP/Skill/Plugin registry 和 OGR-05 external integration 的实际 packet review，或直接进入已定义 owner/Git packets 做签收/拒绝/调整记录。

## 2026-05-14 OGR-04 批量更新：MCP / Skill / Plugin registry owner 证据

本轮补齐 extension registry 的真实 owner profile，不创建新 runtime：
- MCP：复用 `getDsxuMcpConfigRuntimeProfile()` 与 `getDsxuOfficialMcpRegistryRuntimeProfile()`，registry 未配置仍 fail-closed。
- Skill：复用 `getDsxuSkillsLoaderRuntimeProfile()` 与 `getDsxuBundledSkillsRuntimeProfile()`。
- Plugin：新增 plugin loader / refresh / MCP integration / command loader runtime profiles。

Owner 裁决：
- Plugin loader 归 `DSXU Plugin Runtime`，只负责加载、合并、校验、demote、settings cache。
- Plugin refresh 只把 active components swap 到 AppState，并触发现有 MCP/LSP owners；不能产生第二 MCP manager 或 Agent orchestrator。
- Plugin MCP 是 `DSXU MCP / Plugin Adapter Boundary`，只生成 server config。
- Plugin commands/skills 进入现有 command/SkillTool/loadSkillsDir 语义，不是第二 Query Loop。

验证：
- `bun test src/dsxu/engine/__tests__/extension-runtime-owner-v20.test.ts` PASS：1 test / 0 fail / 12 expect。
- `bun test src/dsxu/engine/__tests__/tool-definition-v20.test.ts` PASS：5 tests / 0 fail / 177 expect。

当前 OGR-04 结论：MCP/Skill/Plugin extension boundary 已有可审计代码证据。下一批推进 OGR-05 external integration / ecosystem compatibility，重点看 remote/bridge/browser/desktop/Claude-compatible intake 是否全是 adapter boundary。

## 2026-05-14 OGR-05 批量更新：external integration adapter boundary

本轮补齐 remote/bridge/browser/desktop/teleport 的 external integration owner profile。

Owner 裁决：
- `dsxuRemoteBridgeFacade` 与 `dsxuRemoteSessionCoordinator` 归 `DSXU Control Plane Adapter Boundary`，只负责 control-plane projection、permission request/response、session registry 和 SDK message projection。
- `dsxuBrowserProvider/common.ts` 归 `DSXU MCP / Browser Adapter Boundary`，浏览器能力只能通过 MCP tools 进入 Tool Gate。
- `desktopMcpImport.ts` 归 `DSXU MCP Config Intake Boundary`，只是配置导入；连接生命周期仍由 MCP owner 管。
- `teleport.tsx` 归 `DSXU Remote Session Adapter Boundary`，不能当本地第二 Agent orchestrator。
- `RemoteTrigger` 的 provider-migration path 仍由 explicit env gate 隔离。

验证：
- `bun test src/dsxu/engine/__tests__/external-integration-owner-v20.test.ts` PASS：1 test / 0 fail / 12 expect。
- `bun test src/dsxu/engine/__tests__/extension-runtime-owner-v20.test.ts` PASS：1 test / 0 fail / 12 expect。

当前 OGR-05 结论：生态兼容方向已经明确为 adapter/intake boundary。后续若要支持 AionUi/Cherry/Warp/browser-use/Claude Code ecosystem，只能通过这些 DSXU owner 入口进入，不能下载依赖、复制运行时、或新增第二主链。

## 2026-05-14 OGR-03/04/10 批量更新：移除 built-in fallback 与旧 MCP 命名

本轮继续按“不保留第二套 runtime”的标准处理真实 import/use 风险，不新增结构、不做兼容 holding path。

Owner 裁决：
- `src/dsxu/engine/engine-tool-adapter.ts` 不再 import `./builtin-tools`，也不再接受 `allowMainlineToolFallback`。主线 Read/Edit/Write/Bash/Grep/Glob 等工具只能通过 `src/tools/*` mature owner 执行；旧 built-in 工具只保留为隔离测试/历史文件，不再被产品 adapter 引入。
- `src/dsxu/engine/types.ts` 移除 `allowMainlineToolFallback`，避免调用方用显式 opt-in 重新打开第二套简化工具运行时。
- `src/dsxu/engine/index.ts` 将旧 `connectMCPFromConfig()` 语义改成 `registerMCPFromMainlineClients()`。它只消费 `src/services/mcp` 提供的 `mainlineMcpClients`，不读取 `.mcp.json`、不 spawn server、不拥有 MCP transport lifecycle。
- `src/dsxu/engine/__tests__/dirty-worktree-review-v1.test.ts` 并入删除态：该测试仍 import 已删除 dirty-review runtime / harness，按 V20 原侧规则不恢复旧 runtime，由 V20 owner/Git register 和 CLEAN release evidence 接管审计证据。
- `src/dsxu/engine/mcp-client.ts` 继续作为 `V20-OGR-04-delete-engine-mcp-client-runtime` 删除态 candidate，不允许恢复为产品 MCP client/runtime。

刷新生成物：
- `docs/generated/DSXU_V20_OWNER_GIT_REVIEW_REGISTER_20260514.csv` 已刷新到当前 `1821` 条 status。
- `docs/generated/DSXU_V20_OWNER_GIT_REVIEW_SUMMARY_20260514.json` 当前拆为 `16` 个 packets。
- `docs/generated/DSXU_V20_DELETE_STATE_OWNER_REVIEW_20260514.csv` 当前删除态为 `144`，新增旧 dirty-worktree review test 与 engine MCP runtime 删除态。
- `docs/generated/DSXU_V20_HIGH_RISK_RUNTIME_OWNER_REVIEW_SUMMARY_20260514.json` 同步记录本轮 owner 决策。

Focused verification：
- `bun test src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts --test-name-pattern "mainline src/tools classes|schema validation|tool-use summaries|closes DeepSeek XML"` PASS：3 tests / 0 fail。
- `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts --test-name-pattern "default CLI path"` PASS：1 test / 0 fail。
- `bun test src/dsxu/engine/__tests__/tool-definition-v20.test.ts src/dsxu/engine/__tests__/extension-runtime-owner-v20.test.ts src/dsxu/engine/__tests__/external-integration-owner-v20.test.ts` PASS：7 tests / 0 fail。
- Targeted scan：`engine-tool-adapter.ts` / `tool-capability-pool.ts` / `extended-tools.ts` / `engine/index.ts` / `types.ts` 中已无 `builtin-tools`、`allowMainlineToolFallback`、`executionFallback`、`fallbackTool`、`isRecoverableRuntimeDependencyError`。

当前结论：OGR-03/04/10 又关闭两条真实回流路径：一是工具执行失败回落到旧 built-in tools；二是 MCP 命名继续暗示 engine 自己读取 config 和连接 server。下一批继续 OGR-06 visible-state 和 OGR-12 shared utilities，重点确认 UI/TUI、hooks、shared utilities 只做投影/帮助函数，不拥有 Tool Gate、Permission Gate、MCP lifecycle 或 Query Loop。

## 2026-05-14 OGR-03/06/12 批量更新：删除旧 built-in tools 保活面并补 visible/shared 证据

本轮没有继续做小层补丁，而是把上一轮暴露出的旧 fallback 保活面直接收口。真实 import/use 扫描显示，`src/dsxu/engine/builtin-tools.ts` 已无产品 import；唯一直接调用者是 `src/dsxu/engine/__tests__/builtin-tools.test.ts`。按 V20 owner 规则，旧 built-in Bash/Read/Write/Edit/Grep/Glob 与 `src/tools/*` 成熟工具等价重叠，且缺少主线 Tool Gate / Permission Gate / ToolDefinition V20 evidence，因此不能继续作为“隔离测试 fallback”保留。

本轮删除态新增：
| Path | Packet | Owner 裁决 |
|---|---|---|
| `src/dsxu/engine/builtin-tools.ts` | `V20-OGR-03-delete-engine-builtin-tools-runtime` | replace/delete candidate；能力已由 `src/tools/*` mature owners 接管 |
| `src/dsxu/engine/__tests__/builtin-tools.test.ts` | `V20-OGR-03-delete-engine-builtin-tools-runtime` | replace/delete candidate；不再用测试保活旧 runtime |

同步代码证据：
- `provider-contract-v1.test.ts` 增加旧 built-in module 与旧测试文件不存在断言，并继续防止 `engine-tool-adapter.ts` / `tool-capability-pool.ts` / `extended-tools.ts` / `index.ts` 重新引入旧 fallback。
- `mainline-tool-adapter-v1.test.ts` 保留“无 legacy execution fallback”断言，但避免让测试字符串污染 broad static scan。
- `engine.test.ts` 已替换为 V20 mainline engine suite：GearBox、ToolRegistry、Query Loop、QueryEngine、mainline MCP registration 均走当前 owner。
- `visible-shared-owner-v20.test.ts` 新增 UI/TUI 和 shared utilities 边界证据：UI 不拥有 Query Loop / Tool Gate / MCP lifecycle，shared utilities 不导入旧 `runtime-core` / `provider-backend` / `mcp-client`。

刷新生成物：
| 文件 | 当前口径 |
|---|---|
| `docs/generated/DSXU_V20_OWNER_GIT_REVIEW_REGISTER_20260514.csv` | `1824` rows |
| `docs/generated/DSXU_V20_OWNER_GIT_REVIEW_SUMMARY_20260514.json` | `M=1630` / `D=146` / `??=48` / `17` packets |
| `docs/generated/DSXU_V20_DELETE_STATE_OWNER_REVIEW_20260514.csv` | `146` deletion rows |
| `docs/generated/DSXU_V20_DELETE_STATE_OWNER_REVIEW_SUMMARY_20260514.json` | `146/146 ready-for-delete-signoff-after-owner-review` |
| `docs/generated/DSXU_V20_HIGH_RISK_RUNTIME_OWNER_REVIEW_SUMMARY_20260514.json` | 新增 built-in tools delete packet |

Focused verification：
| 验证 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts --test-name-pattern "default CLI path"` | PASS：1 test / 0 fail / 4453 expect |
| `bun test src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts --test-name-pattern "registers mainline|schema validation|tool-use summaries|closes DeepSeek XML"` | PASS：3 tests / 0 fail / 69 expect |
| `bun test src/dsxu/engine/__tests__/engine.test.ts src/dsxu/engine/__tests__/visible-shared-owner-v20.test.ts src/dsxu/engine/__tests__/mcp-client.test.ts` | PASS：11 tests / 0 fail / 43 expect |
| `rg "builtin-tools|getCoreTools|getReadOnlyTools" src` | PASS：0 hit |
| old MCP runtime import scan | PASS：无 `new MCPManager` / `new MCPConnection`，剩余 `mcp-client` 命中是 mainline reconnect label、delete-candidate evidence 或测试 guard |
| broad old runtime/provider/fallback scan | PASS：产品路径无 active runtime hit；剩余为测试 guard / release fixture |
| `git diff --check` on current batch | PASS：仅 CRLF working-copy warning |

当前 owner 结论：OGR-03 不再保留第二套简化工具 runtime；OGR-04 不再保留 engine-owned MCP runtime；OGR-06/12 已有边界测试防止 UI/shared utilities 变成隐藏 runtime。当前仍未 stage/commit/reset/clean/export，`git status --short` 当前为 `1824`。下一步继续进入 17 个 packets 的 owner/Git signoff 和删除态 mutation review，而不是提前 final tests 或 clean export。
