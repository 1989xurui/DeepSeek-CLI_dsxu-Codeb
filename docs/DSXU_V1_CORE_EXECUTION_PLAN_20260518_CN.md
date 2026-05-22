# DSXU Code V1 核心能力执行方案

日期：2026-05-18

范围：只处理核心能力主链。商业/IP 清理、真实公开评估、开源/商业发布、市场宣传与对外 benchmark claim 均不放入本 V1。

## 目标定位

DSXU Code 的目标不是做一个普通 AI 助手，也不是简单复刻 Claude Code，而是在 DeepSeek V4 Flash / Flash max-effort / Pro 混合模型基础上，通过强编排、工具、权限、上下文、恢复、Agent、成本和证据系统，做出接近或超过 Claude Code 4.7 体验的 AI 编程与复杂任务执行工具。

特别要满足高级程序员的感受：

1. 不乱改。
2. 不虚报完成。
3. 失败后不瞎试。
4. 长时间任务可恢复。
5. 每个 PASS 都有证据。
6. 便宜模型先跑，贵模型只在有证据时升级。

V1 的核心不是继续加模块，而是让已有强能力进入一条默认主链：

```text
模型路由 -> Runtime State Card -> 工具结果 -> 权限 -> 写入生命周期 -> 验证/审查/回滚 -> 任务账本 -> 证据包
```

## 真实审核口径

本方案基于真实代码检索和关键主链文件读取，不是只根据想象设计；但也不声称已经逐行人工读完整个仓库。审核范围覆盖 DSXU 作为 AI 编程与长时间复杂任务执行工具的核心路径。

已审核重点：

| 主题 | 代码位置 | 真实结论 |
| --- | --- | --- |
| Prompt 产品纪律 | `src/constants/prompts.ts` | 已有 DeepSeek tool-use contract、prompt governance contract、dynamic boundary，规则很厚。 |
| 工具结果协议 | `src/dsxu/engine/tool-protocol.ts`、`src/services/tools/toolExecution.ts` | `ToolCallResult` 已存在，但 legacy/provider/MCP 多套结果形态仍并存。 |
| Write/Edit 验证链 | `src/tools/FileEditTool/FileEditTool.ts`、`src/tools/FileWriteTool/FileWriteTool.ts` | Write/Edit 已调用 TDD 与 SAST hook，但默认多由 env/config 开关控制。 |
| TDD gate | `src/coordinator/tdd-gate/post-write-hook.ts` | 默认语义是 post-mutation verification，不是完整 TDD；默认是否启用取决于配置。 |
| 静态分析 gate | `src/services/static-analysis/tool-gate.ts` | 默认由 `DSXU_STATIC_ANALYSIS_TOOL_GATE` 控制，阻断由 blocking env 控制。 |
| 回滚语义 | `src/dsxu/engine/post-mutation-verification-envelope.ts`、`src/dsxu/engine/code-mode-surgical-loop.ts` | 已有 rollback availability；部分路径仍是 suggestion-only。 |
| 任务账本 | `src/dsxu/engine/progress-ledger.ts`、`src/dsxu/engine/session.ts`、`src/dsxu/engine/task-control-plane.ts` | ledger、checkpoint、session snapshot 存在，但不是统一 durable task ledger。 |
| 压缩恢复 | `src/services/compact/prompt.ts`、`src/dsxu/engine/system-prompt.ts` | 已明确 Task-State Snapshot 只用于导航，不能当 PASS 证据。 |
| 工具批量 gate | `src/services/tools/dsxuToolBatchGate.ts` | 已有 repeated tool、post-pass、repeated failed verification、unsafe same-batch verification 等 gate。 |
| Recovery/GearBox | `src/dsxu/engine/gear-box.ts`、`src/dsxu/engine/failure-taxonomy.ts`、`src/dsxu/engine/recovery/*` | 已有 retry/replan/rollback/ask-human/abort，但需要统一 decision table 和事件化。 |
| Agent handoff | `src/tools/AgentTool/prompt.ts`、`src/tools/AgentTool/built-in/verificationAgent.ts` | Agent prompt 很成熟，已有 serial worker / parallel fanout、handoff package、VERDICT 规则。 |
| Evidence dashboard | `scripts/dsxu-evidence-dashboard.ts` | 脚本可运行，当前是报告，不是日常信任界面。 |
| SWE-bench smoke | `scripts/dsxu-swe-bench-runner.ts`、`src/services/eval/swe-bench/runner.ts` | 默认 internal-smoke，且 `publicBenchmarkClaimAllowed=false`。 |
| package scripts | `package.json` | `test:six-stage-final`、`acceptance:senior-coding-window` 存在；`evidence:dashboard`、`benchmark:swe-bench` 未找到。 |
| DeepSeek thinking 路由 | `src/constants/prompts.ts`、`src/query.ts`、`src/bootstrap/state.ts`、相关 tests | 已有 thinking/route 相关代码；仍需补 provider projection 合同测试。 |

## 已执行验证命令结论

| 命令 | 结果 |
| --- | --- |
| `bun test src/coordinator/tdd-gate/__tests__/gate.test.ts` | PASS，5 tests |
| `bun test src/services/static-analysis/__tests__/bridge.test.ts` | PASS，9 tests |
| `bun run scripts/dsxu-evidence-dashboard.ts` | PASS，scoreFloor 72，evidence files 123，passing gates 37，parse errors 0 |
| `bun run scripts/dsxu-swe-bench-runner.ts --instances "mock-001,mock-002" --timeout 60000` | PASS，internal smoke 2/2 |
| `bun test` | 5 分钟内未自然结束，进程已停止，不能声称全绿 |
| `bun run test:six-stage-final` | 3 分钟内未自然结束，不能声称通过 |
| `bun run acceptance:senior-coding-window` | 3 分钟内未自然结束，不能声称通过 |
| `bun run evidence:dashboard` | FAIL，package script 缺失 |

## 不应误称的内容

1. 不能说 `bun test` 已全绿。
2. 不能说已有正式 SWE-bench 成绩。
3. 不能说 DSXU 已经达到 90+。
4. 不能把 internal smoke 当公开 benchmark。
5. 不能把 prompt 规则当作 runtime 安全保证。
6. 不能继续新增大模块来掩盖主链没有收敛的问题。

## 弱模型主链原则

DeepSeek Flash 不是 GPT-5.5。GPT-5.5 可以承受厚 prompt、多目标、多工具、多约束并行；弱模型更容易在厚 prompt 下出现遗忘、绕工具、重复验证、误报 PASS、过度发散。

因此 V1 的产品纪律是：

```text
薄 prompt -> 小状态卡 -> 窄工具面 -> 硬证据 -> 可恢复账本 -> 明确 final gate
```

每一轮给模型的状态面应该很小：

| 字段 | 含义 |
| --- | --- |
| STATE | 当前阶段：plan/read/edit/verify/review/final/recovery |
| ALLOWED_NEXT | 本轮允许的 1-3 个动作 |
| BLOCKED | 当前禁止动作，例如已 PASS 后继续工具、compact 后直接 claim PASS |
| EVIDENCE_REQUIRED | 进入下一阶段需要的证据 |
| RECOVERY_IF_FAILS | 失败后 runtime 应执行 retry/replan/rollback/escalate/ask-human/abort 哪一类 |
| FINAL_CLAIM_ALLOWED | 是否允许模型给出 PASS/完成结论 |

## 逐项纳入 V1 结论

| # | 优化项 | 已有程度 | 是否放 V1 | 原因 |
| --- | --- | --- | --- | --- |
| 1 | Prompt Diet + Runtime State Card | Prompt 纪律已有但偏厚 | 是，P0 | 弱模型不能靠长 prompt 稳定执行。 |
| 2 | Canonical Tool Result Contract | 有 `ToolCallResult`，但多形态并存 | 是，P0 | 所有证据、恢复、账本都依赖统一结果。 |
| 3 | DeepSeek Thinking + Tool Message Projection | 有 thinking 相关代码和测试迹象 | 是，P0 | DeepSeek V4 tool call 正确性的底座。 |
| 4 | Verified Edit Lifecycle 默认体验 | Write/Edit 已接 hook，但多为开关控制 | 是，P0 | 高级程序员信任来自写后验证。 |
| 5 | Final Answer Contract | Prompt/test 中已有纪律 | 是，P0 | 防止未验证工作被说成完成。 |
| 6 | Stage-Scoped Tool Surface | 有 prompt/batch gate，但工具面还可更窄 | 是，P1 | 降低弱模型工具选择错误。 |
| 7 | Minimal Durable Task Ledger | ledger/checkpoint/session/DAG persist 分散存在 | 是，P1，薄版 | 长任务恢复必须有统一现场。 |
| 8 | Stall Recovery Decision Table | recovery/gate 分散存在 | 是，P1 | 把重复失败变成明确动作。 |
| 9 | Agent Handoff Schema Validation | Agent prompt 很成熟 | 是，P1 | 只做 runtime 校验，不扩展 Agent 模式。 |
| 10 | Compact Trust Boundary Runtime Gate | prompt 已声明 snapshot 不是 PASS | 是，P1 | compact/resume 后要重读源和验证。 |
| 11 | Evidence Task Packet | dashboard 已有 | 是，P1/P2 | 先做 CLI/JSON 证据包，不急做完整 UI。 |
| 12 | Light PreEditCheck | 主要靠后置 hook | 是，P1 | 只查高频低级错。 |
| 13 | TestSkeleton | 可做 | 否，P2 | 容易生成形式测试，先做实验证链。 |
| 14 | BlameContext | 有价值 | 否，P2/P3 | 对弱模型可能引入噪声。 |
| 15 | 跨会话经验学习 | experience-store 已有 | 否，后置 | 没有干净事件账本前会放大错误经验。 |
| 16 | 正式 SWE-bench | smoke 边界已有 | 否，发布/评估阶段 | V1 只保留 mock/real 分层。 |
| 17 | 更多 Agent 模式 / swarm | Agent prompt 明确只允许两种模式 | 否 | 弱模型下会放大协调错误。 |
| 18 | 更厚 Claude Prompt 吸收 | 已吸收不少 | 否 | DeepSeek 场景要 runtime gate，不是继续堆 prompt。 |

## V1 执行顺序

### P0-0：Prompt Diet + Runtime State Card

目标：把厚 prompt 纪律压成每轮可执行的小状态卡。

需要做：

| 工作 | 要求 |
| --- | --- |
| 定义 `RuntimeStateCard` | 包含 state、allowedNext、blockedActions、evidenceRequired、recoveryIfFails、finalClaimAllowed |
| 接入已有 gate | tool batch gate、compact boundary、verification state、ledger state、agent state 都投影到状态卡 |
| 压缩 prompt tail | 保留核心规则，重复规则转 runtime block |
| final claim 计算 | `finalClaimAllowed` 只能来自 evidence，不来自模型文字 |
| 弱模型可读性测试 | 每张卡最多 3 个 allowed next，不能同时出现 PASS 和 missing evidence |

验收：

```bash
bun test src/dsxu/engine/__tests__/prompt-governance-contract.test.ts
bun test src/dsxu/engine/__tests__/semantic-tool-gate-v1.test.ts
bun test src/dsxu/engine/__tests__/mainline-completion-contract.test.ts
```

### P0-1：修验证入口与主链测试现实

目标：先让验证命令有边界、有名字、可复现。

需要做：

| 工作 | 要求 |
| --- | --- |
| 补 `evidence:dashboard` | 映射到 `bun run scripts/dsxu-evidence-dashboard.ts` |
| 补 `benchmark:swe-bench` | 映射到 `bun run scripts/dsxu-swe-bench-runner.ts` |
| 切分测试层级 | `test:mainline`、`test:slow`、`test:acceptance` |
| 限定最终验证耗时 | 每个命令要么完成，要么明确归类为 slow |
| 产出 owner map | 按真实日志分类 slow/fail owner |

验收：

```bash
bun run evidence:dashboard
bun run benchmark:swe-bench --instances "mock-001,mock-002" --timeout 60000
bun run test:mainline
```

### P0-2：统一工具结果协议

目标：让所有工具结果进入同一个内部协议。

需要做：

| 工作 | 要求 |
| --- | --- |
| 宣布 canonical shape | 主链内部统一使用 `ToolCallResult` |
| 隔离 provider shape | provider `tool_result` 只存在于模型消息边界 |
| 隔离 legacy shape | `content/isError` 只存在于兼容层和测试 |
| conversion audit | legacy/provider/MCP -> `ToolCallResult` 有单一路径 |
| 事件化 | 每个 `ToolCallResult` 可转换为 runtime event/evidence |
| 清理协议文件注释 | 修复 mojibake，降低维护风险 |

### P0-3：DeepSeek Thinking + Tool Message Projection

目标：保证 DeepSeek thinking + tool call 多轮消息结构正确。

需要做：

| 工作 | 要求 |
| --- | --- |
| provider 合同测试 | `content`、`reasoning_content`、`tool_calls` 可 round-trip |
| tool turn 保留 reasoning | assistant tool call 后的 reasoning 内容按 provider 要求保留/回传 |
| 安全丢弃 reasoning | 无 tool call 的场景按 provider 规则裁剪 |
| 明确路由 | Flash 默认，Flash max 用于复杂/恢复，Pro 需要 admission evidence |
| Flash-MAX 命名 | 只是 DSXU route alias，不是官方模型名 |

### P0-4：Verified Edit Lifecycle 默认体验

目标：每次写代码都留下验证和证据。

需要做：

| 工作 | 要求 |
| --- | --- |
| 每次 Write/Edit 发生命周期事件 | PreEdit、Mutation、SAST、TDD/PostVerify、Review、RollbackAvailability、Evidence |
| gate 默认可见 | 即使不阻断，也要展示检查结果 |
| 风险阻断 | protected/config/test/security 文件、验证失败后继续写等场景阻断 |
| 安全回滚 | 有 old content 且无用户改动风险时允许恢复；否则创建 manual review |
| Light PreEditCheck | JSX/import/type signature/target existence 轻量检查 |

### P1-5：Runtime Event Schema 作为账本输入

目标：event 不是报告投影，而是 ledger/evidence/recovery 的统一输入。

需要做：

| 工作 | 要求 |
| --- | --- |
| 推广事件源 | `DSXUWorkStateEvent` 或兼容扩展作为主链事件 |
| 补事件 emitters | tool、permission、model route、verification、rollback、recovery、agent、cost/cache |
| correlation IDs | taskId、turnId、toolUseId/modelCallId |
| append-only log | JSONL 或等价持久化 |
| UI 投影分离 | timeline 是投影，不是唯一源头 |

### P1-6：长任务账本 + Stall Recovery Decision Table

目标：长时间任务不靠聊天上下文硬撑。

需要做：

| 工作 | 要求 |
| --- | --- |
| 合并任务状态 | goal、plan、phase、events、checkpoints、verification、recovery、route、cost |
| 持久化 checkpoint | 支持进程中断后恢复 |
| 定义 stall 类型 | 重复读、无 diff、重复验证失败、上下文压力、成本压力、Agent timeout、权限循环 |
| 定义动作表 | retry、replan、rollback、Flash max、Pro、ask-human、abort |
| GearBox 事件化 | 每次齿轮变化都有证据原因 |
| Agent handoff 校验 | handoff package 字段不完整则不允许启动复杂 worker |
| compact trust gate | compact 后改代码/claim PASS 前必须重读 source truth |

### P1-7：Evidence Workbench 的最小形态

目标：先做任务证据包，不做大型 UI。

需要做：

| 工作 | 要求 |
| --- | --- |
| package script | `evidence:dashboard` 必须存在 |
| task evidence packet | goal、plan、modified files、checks、results、rollback、model/cost/cache、risk |
| smoke/real 标签 | internal smoke 永远不能成为 public benchmark claim |
| 高级程序员摘要 | 风险、未验证区域、下一步、真实命令 |
| 本地历史 | 最近 N 个任务证据包可查看 |

## 后置事项

这些不进入 V1：

1. 商业/IP 清理。
2. 开源/商业发布包。
3. 正式 SWE-bench 公共成绩。
4. Cross-session experience learning。
5. TestSkeleton。
6. BlameContext。
7. 多 Agent swarm。
8. 更厚 Claude prompt 吸收。

## V1 完成后的预期结果

V1 完成后，DSXU 不应该因为模块数量或 smoke 测试就宣称 90+。真正的分数提升来自：

1. 每轮模型收到小状态卡，而不是厚 prompt 墙。
2. 验证命令有边界。
3. 工具结果协议唯一。
4. DeepSeek thinking/tool-call message projection 正确。
5. Write/Edit 默认进入可见验证生命周期。
6. 长任务有 durable ledger。
7. 重复失败有明确 recovery decision。
8. 证据包能区分 mock、smoke、real benchmark。

一句话：V1 是“主链收敛版 DSXU”，不是“继续加模块版 DSXU”。
