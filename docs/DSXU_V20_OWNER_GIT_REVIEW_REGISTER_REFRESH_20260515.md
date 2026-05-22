# DSXU V20 Owner/Git Review Register Refresh - 2026-05-15

本记录是 V20 当前 Owner/Git signoff 的最新执行口径，不是最终 PASS，也不是 Git mutation。它的目的只有一个：把 `git status --short` 中的当前 1863 条变更全部归到命名 owner，避免继续停留在 generic/shared/other holding bucket。

## 当前计数

| 项 | 数量 |
|---|---:|
| `git status --short` total | 1869 |
| modified | 1646 |
| deleted | 147 |
| untracked | 76 |
| current refresh rows | 20 |
| owner remap rows | 58 |
| C2 priority rows | 320 |
| deletion-ready rows | 147 |
| other source bucket rows | 0 |

已刷新文件：

- `docs/generated/DSXU_V20_OWNER_GIT_REVIEW_REGISTER_20260515.csv`
- `docs/generated/DSXU_V20_OWNER_GIT_REVIEW_SUMMARY_20260515.json`
- `docs/generated/DSXU_V20_OWNER_PACKET_SIGNOFF_MATRIX_20260515.csv`
- `docs/generated/DSXU_V20_OWNER_PACKET_SIGNOFF_MATRIX_SUMMARY_20260515.json`

## 本轮 remap 规则

不能把已经有明确主线归属的路径留在 generic/shared 桶里。Agent/swarm、hooks、LSP/coding intelligence、external deep link、terminal transport、voice UI 均已按真实 import/use 证据回到命名 owner。

| 原风险 | 当前 owner |
|---|---|
| `src/tools/AgentTool/**`、`src/tools/SendMessageTool/**`、`src/utils/swarm/**` | `V20-OGR-05-agent-task-lifecycle` |
| hooks schema/types/utils/execution helpers | `V20-OGR-03-tool-permission-lifecycle` |
| `src/services/lsp/**` | `V20-OGR-09-dsxu-engine-mainline` |
| `src/services/voice*` | `V20-OGR-06-ui-tui-visible-state` |
| `src/utils/deepLink/**` | `V20-OGR-05-external-integration-adapter-boundary` |
| `src/utils/fullscreen.ts`、`src/utils/terminalPanel.ts` | `V20-OGR-08-cli-command-transport` |

## Packet signoff matrix

| Packet | Count | Decision |
|---|---:|---|
| `V20-OGR-01-docs-generated-plan` | 52 | docs/generated owner signoff required |
| deletion packets total | 147 | explicit Git mutation review only |
| `V20-OGR-03-tool-permission-lifecycle` | 192 | Tool Gate / Permission single runtime |
| `V20-OGR-04-mcp-skill-plugin-registry` | 141 | MCP / Skill / Plugin single registry/runtime boundary |
| `V20-OGR-05-agent-task-lifecycle` | 202 | AgentTool / Task single orchestrator |
| `V20-OGR-05-external-integration-adapter-boundary` | 32 | adapter boundary only |
| `V20-OGR-06-ui-tui-visible-state` | 474 | visible-state projection only |
| `V20-OGR-07-provider-migration-model-cost` | 107 | DeepSeek provider/router/cost owner |
| `V20-OGR-08-cli-command-transport` | 180 | entry transport only |
| `V20-OGR-09-dsxu-engine-mainline` | 67 | DSXU engine mainline |
| `V20-OGR-10-entry-query-tool-composition` | 20 | entry/query/tool composition |
| `V20-OGR-12-shared-platform-utilities` | 254 | imported utility only if used |

## 当前裁决

1. C2 1902 文件吸收签收仍只代表 owner disposition 完成，不代表功能验收 PASS。
2. `V20-OGR-12-shared-platform-utilities` 已从旧口径收窄，不能作为第二套 runtime 或后续兼容 holding path。
3. `147` 条 deletion-ready 只能在显式 Git mutation review 后处理；若发现真实能力差异，只能补入命名 DSXU owner，不能恢复旧 runtime。
4. 本轮没有 stage、commit、reset、clean、删除 ACL residue、删除 evidence 目录或创建 clean export。

## 下一步

继续按固定顺序执行：Owner/Git packet signoff -> `147` deletion mutation review -> `4` ACL residue -> real-gap acceptance -> 六阶段测试 -> final preflight / clean export。
