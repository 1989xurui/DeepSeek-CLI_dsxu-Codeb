# DSXU V20 real-gap 产品化覆盖复核 - 2026-05-14

本轮复核目标不是继续增加小层，而是把 V20-C5 真实缺口从“待实现列表”压成可执行 owner 裁决。判断标准保持不变：已有主线能力不重复造；只有合同但缺真实验收的，继续在原 owner 产品化；没有验收的不能写成 PASS；任何外部生态画像都不能成为第二套 runtime。

当前 `git status --short` 为 `1838`：`M=1630`、`D=147`、`??=61`。这个数字包含本轮新增的 real-gap 审核产物；它不会通过文档复核自动下降，下降只能来自后续明确 Git mutation / stage / commit review。

## 覆盖矩阵

| Gap | Owner | 当前裁决 | 证据 | 下一步 |
|---|---|---|---|---|
| Permission Queue / Tool Gate visible decision | Permission / Tool Gate | `MAINLINE_PRESENT_NEEDS_RUNTIME_ACCEPTANCE` | `src/components/permissions/PermissionPrompt.tsx`、`src/hooks/toolPermission/permissionLogging.ts`、`src/dsxu/control-plane/permissionControlBridge.ts`、`src/tools/__tests__/v20-tool-permission-owner-gate.test.ts` | 用真实 Bash/PowerShell/File/MCP/Agent 拒绝与恢复任务验收，不能建第二个 permission queue。 |
| MCP Server registry / install / status / doctor | MCP / Skill / Plugin | `MAINLINE_PRESENT_NEEDS_REAL_SERVER_ACCEPTANCE` | `src/services/mcp/officialRegistry.ts`、`src/services/mcp/doctor.ts`、`src/services/mcp/config.ts`、`src/commands/mcp/mcp.tsx`、`src/components/mcp/MCPSettings.tsx` | 用真实 manifest 完成 install/list/status/tool call 证据；不能恢复 engine MCP runtime。 |
| Claude-compatible project intake | Context / Memory + MCP / Skill / Plugin + Commands | `PARTIAL_CONTRACT_NEEDS_PRODUCTIZATION` | `.mcp.json` 解析在 `src/services/mcp/config.ts`，skills/commands 在 `src/skills/loadSkillsDir.ts`，hooks/settings 在 `src/utils/settings/types.ts` | 做 external-code-compatible intake 验收，证明 DSXU.md、commands、skills、hooks 都落到 DSXU owner。 |
| External Agent Host / AionUi-like contract | CLI / Query Loop / Bridge / UI | `PARTIAL_CONTRACT_NEEDS_PRODUCTIZATION` | `src/entrypoints/agentSdkTypes.ts`、`src/services/bridge/dsxuRemoteBridgeFacade.ts`、`src/services/bridge/dsxuRemoteSessionCoordinator.ts`、`src/cli/remoteIO.ts` | 产品化外部 Host 合同，只做 facade，真实执行进入 Query Loop / Tool Gate / Evidence。 |
| External Chat Client / Cherry-like Agent API | Query Loop API + Model Router boundary | `PARTIAL_CONTRACT_NEEDS_PRODUCTIZATION` | `src/entrypoints/agentSdkTypes.ts`、`src/services/api/sessionIngress.ts`、`src/services/api/dsxu.ts`、`src/services/api/dsxu-model.ts` | 定义本地 Agent API 验收，证明聊天客户端不能绕过 Tool Gate 或 Model Router。 |
| Warp-like terminal host contract | CLI / Terminal Host / Tool Lifecycle | `MAINLINE_PRESENT_NEEDS_RUNTIME_ACCEPTANCE` | `src/ink/terminal.ts`、`src/cli/remoteIO.ts`、`src/commands/terminalSetup/terminalSetup.tsx`、`src/entrypoints/dsxu-code.tsx` | 真实终端任务验收：权限、失败恢复和 evidence 投影仍属 DSXU。 |
| browser-use-like browser tool provider contract | Tool Lifecycle + Permission + Evidence | `MAINLINE_PRESENT_NEEDS_REAL_BROWSER_ACCEPTANCE` | `src/utils/dsxuBrowserProvider/mcpServer.ts`、`src/utils/computerUse/mcpServer.ts`、`src/skills/bundled/DsxuBrowserProvider.ts`、`src/components/DsxuBrowserProviderOnboarding.tsx` | 真实浏览器操作证据必须含 manifest、permission decision、tool trace、screenshot/DOM/console、final report。 |
| Bridge / Remote / IDE / CI clean-room facade | Bridge / Remote / CI + Permission Bridge | `MAINLINE_PRESENT_NEEDS_CONTRACT_ACCEPTANCE` | `src/services/bridge/dsxuRemoteBridgeFacade.ts`、`src/services/bridge/remotePermissionProjection.ts`、`src/services/bridge/dsxuSdkMessageProjection.ts`、`src/commands/bridge/bridge.tsx` | 验收 SDK message 和 permission request 均进入 DSXU owner，bridge 不直接执行工具。 |
| UI/TUI work-state and operator dashboard | UI / TUI visible-state projection | `PARTIAL_CONTRACT_NEEDS_PRODUCTIZATION` | `src/state/AppState.tsx`、`src/state/store.ts`、`src/components/permissions/*`、`src/components/mcp/*`、`src/components/agents/*` | 需要统一操作状态验收，覆盖 progress、permission、agent、cost、recovery、evidence link。 |
| Cost / evidence / recovery visible state | Model Router + Evidence + Recovery | `MAINLINE_PRESENT_NEEDS_E2E_ACCEPTANCE` | `src/cost-tracker.ts`、`src/dsxu/engine/final-report-usage-evidence.ts`、`src/dsxu/engine/runtime-evidence-collector-v1.ts`、`src/dsxu/engine/recovery/recovery-integration-v3.ts` | 真实 coding/recovery/cost 任务证明 final report 与 UI/TUI 都可见。 |
| DeepSeek-TUI-style open-source productization | Release / Export / Doctor | `PARTIAL_PRODUCTIZATION` | `README.md`、`docs/INSTALL.md`、`docs/CONFIGURATION.md`、`docs/DOCTOR_HEALTH.md`、`docs/RELEASE_RUNBOOK.md`、`package.json` | 补 package/release smoke、版本资产、checksum/rollback、发布后验证。 |
| Final six-stage V20 acceptance and clean export | Eval / Release | `NOT_STARTED_BY_DESIGN` | `docs/DSXU_V20_REAL_OPERATION_TEST_ACCEPTANCE_20260514.md`、`scripts/dsxu-release-gate.ts`、`scripts/dsxu-health-audit.ts` | 必须等 owner/Git、147 deletion、4 ACL、real-gap acceptance 全部关闭后再跑。 |

## MCP doctor 真实 smoke 结果

本轮实际执行 `bun --env-file=.env ./src/entrypoints/dsxu-code.tsx mcp doctor --json`。结果是 `WARN`，不是 PASS：

| 项 | 值 |
|---|---:|
| totalServers | 0 |
| registryConfigured | false |
| configErrors | 0 |

warnings：

- `DSXU_MCP_REGISTRY_URL is not configured; official registry lookup is fail-closed`
- `No MCP servers configured; install/status UX can only be smoke-tested`

Focused verification：`bun test src/services/mcp/__tests__/doctor.test.ts` PASS，`2 tests / 0 fail / 13 expect`。

裁决：MCP doctor 已能诚实报告 blocked/warn 状态，但这只能证明 doctor 主线可用，不能替代真实 MCP server manifest、install/list/status、tool discovery 和 tool call 证据。V20-GAP-02 继续保持 blocked，直到有真实 MCP server 验收包。

## Project intake owner 复核

本轮同时复核 external-code-compatible project intake 的现有 owner：

| Surface | Owner | 证据 | 裁决 |
|---|---|---|---|
| DSXU.md / DSXU.local.md | Context / Memory / Init | `src/commands/init.ts` | DSXU-native project memory intake，保留主线。 |
| `.mcp.json` | MCP / Skill / Plugin | `src/services/mcp/config.ts` | 由 `services/mcp` 解析和 policy-filter，不是 engine MCP runtime。 |
| `.dsxu/skills` / `.dsxu/commands` | Skills / Commands | `src/skills/loadSkillsDir.ts` | 进入 DSXU Skills Loader；`commands_DEPRECATED` 是 intake label，不是 runtime owner。 |
| settings hooks | Tool Lifecycle + Hooks | `src/utils/settings/types.ts`、`src/utils/hooks.ts`、`src/utils/sessionStart.ts` | 通过 managed policy / workspace trust / hook lifecycle 控制，不是第二套 tool runner。 |
| plugin commands / skills / hooks / MCP | DSXU Plugin Runtime + MCP Adapter Boundary | `src/utils/plugins/pluginLoader.ts`、`src/utils/plugins/mcpPluginIntegration.ts` | plugin customization 进入 plugin owner；plugin MCP 只是 adapter input。 |

Focused verification：`bun test src/dsxu/engine/__tests__/extension-runtime-owner-v20.test.ts` PASS，`1 test / 0 fail / 12 expect`。

裁决：V20-GAP-03 已有命名 owner 覆盖，但仍不是最终 PASS。还缺一次真实 external-code-compatible project intake 任务，证明 instructions、MCP、commands、skills、hooks 都进入 DSXU owner，并且没有新建兼容 holding runtime。

## 执行结论

V20-C5 不是完全空白：Permission、MCP、Bridge/Remote、browser provider、cost/evidence/recovery、开源文档入口都有主线代码证据。真正未完成的是产品化验收与统一可见状态，不是再抄一套外部项目。

接下来执行顺序固定为：

1. 继续 owner/Git signoff，尤其是 runtime-redline 已清的 `919` paths、OGR-12 `248` imported utilities、OGR-01 docs/evidence。
2. 进入 `147` deletion mutation-ready paths 的显式 Git review，保持删除，不恢复旧 runtime。
3. 关闭 `4` 个 ACL residue，权限允许后直接删除，不能保留 tombstone product path。
4. 按本矩阵推进 real-gap 产品化验收：MCP real server、external-code-compatible intake、external host/API、browser provider、terminal host、operator visible-state。
5. 最后才跑功能测试、体验测试、恢复测试、性能测试、评测测试、发布收口测试，以及 final preflight / clean export。

本轮不 stage、不 commit、不 reset、不 clean、不 export。
