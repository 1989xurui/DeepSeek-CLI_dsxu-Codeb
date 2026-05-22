# DSXU V20 external / visible-state owner review - 2026-05-15

本轮覆盖 V20-GAP-04 到 V20-GAP-10：External Agent Host、External Chat Client API、Terminal Host、Browser Provider、Bridge/Remote/IDE/CI、UI/TUI operator state、Cost/Evidence/Recovery。目标是一次性确认这些能力是否已有 DSXU 主线 owner，避免再拆成一堆“待确认小桶”。

结论先写清楚：这 7 个 gap 都有命名 owner 覆盖，但都不是最终 PASS。它们下一步需要真实验收任务，而不是新增第二套 runtime。

| Gap | Owner | 当前裁决 | 证据 | 下一步 |
|---|---|---|---|---|
| V20-GAP-04 External Agent Host / AionUi-like contract | CLI / Query Loop / Bridge / UI | `OWNER_COVERED_NEEDS_EXTERNAL_HOST_ACCEPTANCE` | `getDsxuAgentSdkRuntimeProfile`、`getDsxuRemoteBridgeFacadeRuntimeProfile`、`getDsxuRemoteSessionCoordinatorRuntimeProfile`、`getDsxuRemoteIORuntimeProfile` | 用现有 SDK/bridge/remote IO 跑一次 external-host style 任务，证明消息、权限、最终证据进 DSXU owner。 |
| V20-GAP-05 External Chat Client / Cherry-like Agent API | Query Loop API + Model Router boundary | `PARTIAL_API_CONTRACT_NEEDS_ACCEPTANCE` | `src/entrypoints/agentSdkTypes.ts`、`src/services/api/sessionIngress.ts`、`src/services/api/dsxu.ts`、`src/services/api/dsxu-model.ts` | 定义并执行本地 Agent API smoke，证明 chat client 不能绕过 Tool Gate 或 Model Router。 |
| V20-GAP-06 Warp-like terminal host contract | CLI / Terminal Host / Tool Lifecycle | `OWNER_COVERED_NEEDS_TERMINAL_ACCEPTANCE` | `src/ink/terminal.ts`、`src/cli/remoteIO.ts`、`src/commands/terminalSetup/terminalSetup.tsx`、`src/entrypoints/dsxu-code.tsx` | 做终端宿主真实任务：权限、失败恢复、evidence 仍归 DSXU。 |
| V20-GAP-07 browser-use-like browser provider contract | Tool Lifecycle + Permission + Evidence | `OWNER_COVERED_NEEDS_REAL_BROWSER_ACCEPTANCE` | `createChromeContext`、`runDsxuBrowserProviderMcpServer`、`runComputerUseMcpServer`、`DsxuBrowserProvider` skill | 做真实浏览器操作证据包，含 manifest、permission、tool trace、screenshot/DOM/console、final report。 |
| V20-GAP-08 Bridge / Remote / IDE / CI clean-room facade | Bridge / Remote / CI + Permission Bridge | `OWNER_COVERED_NEEDS_BRIDGE_ACCEPTANCE` | `dsxuRemoteBridgeFacade`、`dsxuRemoteSessionCoordinator`、`remotePermissionProjection`、`dsxuSdkMessageProjection`、`AppStateStore` | 做 bridge lifecycle acceptance，覆盖 SDK message、permission request/response、reconnect/failure state。 |
| V20-GAP-09 UI/TUI work-state and operator dashboard | UI / TUI visible-state projection | `PARTIAL_VISIBLE_STATE_NEEDS_OPERATOR_ACCEPTANCE` | `AppStateStore`、permissions UI、MCP UI、agents UI、PromptInput footer | 做 operator-state acceptance，覆盖 progress、permission、MCP、agent、cost、recovery、evidence link。 |
| V20-GAP-10 Cost / evidence / recovery visible state | Model Router + Evidence + Recovery | `OWNER_COVERED_NEEDS_E2E_ACCEPTANCE` | `formatTotalCost`、`buildDSXUModelCostEvidenceFromUsage`、runtime evidence collector、recovery integration v3 | 做真实 coding recovery task，证明 route reason、cost、cache、recovery、final evidence 可见。 |

## 红线

- AionUi-like、Cherry-like、Warp-like、browser-use-like 都只是生态接入画像，不是 V20 内置依赖。
- External Host / Chat Client / Terminal Host / Browser Provider / Bridge 只能是 facade 或 tool provider boundary。
- UI/TUI 只能投影状态和用户操作，不能藏 Query Loop、Tool Gate、MCP runtime、provider runtime 或 agent orchestrator。
- Cost/evidence/recovery 不能停在测试里，最终必须进入真实 final report 和可见状态。

## Focused verification

本轮只跑 owner/profile 级验证，不作为最终六阶段测试：

```text
bun test src/dsxu/engine/__tests__/bridge-gate.test.ts src/dsxu/engine/__tests__/remote-lifecycle-v1.test.ts src/dsxu/engine/__tests__/browser-dev-server-proof-v1.test.ts src/dsxu/engine/__tests__/final-report-usage-evidence-v1.test.ts
```

结果：`8 pass / 0 fail / 68 expect`。

覆盖含义：

- retired bridge adapter 只剩 ACL tombstone，不是 product runtime。
- remote lifecycle 可把 connect/send/permission cancel/reconnect/disconnect 投影到可见 DSXU UI message。
- browser dev-server proof 能返回 screenshot proof 或明确 blocked evidence，不挂起。
- final report usage evidence 能把真实 adapter usage records 转成 cost / Pro ROI evidence。

限制：这不是 External Host、Agent API、Terminal Host、Browser Provider、Operator Dashboard 的最终真实验收。

## 下一步

当前应该继续推进 owner/Git signoff 与 `147` deletion mutation review；并行准备 real acceptance packets。最终六阶段测试仍然放在 owner/Git、ACL 和真实 gap 验收之后。
