# DSXU 最新用户意图覆盖 BUG 优化与验收记录

日期：2026-05-22

## 目标

解决真实窗口里出现的“用户已经说不用处理/只分析/问为什么一直回复旧问题，但 DSXU 仍继续旧验证、旧工具、旧任务总结”的上下文污染问题。

目标体验：
- 最新用户消息优先于历史计划、任务账本、后台通知和恢复循环。
- 用户说“停下 / 不用处理 / 算了吧 / 先这样 / 换个话题 / 只分析不要操作”时，不再调用工具。
- 用户问“为什么你一直回复以前问题 / 问非所答”时，直接回答这个元问题，不再继续旧任务。
- 保留合法“继续执行，看后台任务输出结果”的能力。
- 不增加 provider/API 调用，不新增 shell 调用，不新增文件 IO 到默认主链。

## 根因

| 问题 | 根因 | 修复策略 |
|---|---|---|
| 用户取消后仍跑旧命令 | query loop 仍允许旧队列通知进入本轮 | 最新用户意图 gate 禁止 system queued drain |
| DeepSeek 继续生成 Bash/Read/Edit 旧任务 | prompt 约束不够硬 | tool batch gate 在工具执行前硬拦截 |
| 元问题被旧任务状态覆盖 | “为什么问非所答”未被识别成话题边界 | stale/meta question 分类为最新用户意图覆盖 |
| 隐晦中文停止短语漏判 | 只覆盖显式“不用处理/停止” | 补充“算了吧/先这样/别管那个了/换个话题”等短语 |
| 工具被挡后 provider 仍看到旧任务文本 | nudge 只是追加，未裁剪旧 messages | cancel/meta 场景只保留最新用户消息 + override nudge |
| compact/Agent/background 多源污染 | compact summary、Agent handoff、后台结果都可能把旧目标带回 | context view 对 cancel/meta 执行统一裁剪 |

## 已完成改动

| 文件 | 改动 |
|---|---|
| `src/dsxu/engine/latest-user-intent-override-v1.ts` | 新增最新用户意图分类器、nudge 构造、重复 nudge 防重、可复用 context view 裁剪；补充隐晦中文停止/换话题短语 |
| `src/query.ts` | 在 queued command drain 前检查最新用户意图；在 query loop 中注入 override nudge；cancel/meta 场景裁剪旧 provider context |
| `src/services/tools/dsxuToolBatchGate.ts` | 新增 `USER_INTENT_BLOCK`，在工具执行前阻断停止/只分析/元问题后的工具调用 |
| `src/dsxu/engine/__tests__/latest-user-intent-override-v1.test.ts` | 增加真实窗口问题、隐晦中文短语、并发 Agent、compact recovery 污染测试 |

## 覆盖场景

| 场景 | 用户输入 | 期望 |
|---|---|---|
| 显式停止 | `不用处理了` | 不再执行 Bash/Read/Edit，回复只确认最新意图 |
| 隐晦停止 | `算了吧` / `先这样` / `别管那个了` | 识别为取消当前任务，阻断旧工具 |
| 换话题 | `换个问题` / `换个话题` | 裁剪旧任务上下文，不再继续旧 Agent/验证 |
| 只分析 | `只分析，不要操作，不要执行命令` | 保留分析所需上文，但工具被禁用 |
| 元问题 | `为什么我问你问题，你一直回复以前问题？` | 不继续旧任务，解释上下文污染/恢复循环原因 |
| 合法继续 | `继续执行，看看后台任务输出结果` | 允许 queue drain，不误判为取消 |
| context 分析继续 | `继续分析上下文问题，别跑命令` | 不 drain 旧后台命令，按 analysis-only 禁工具 |
| 多源旧上下文 | compact summary + Agent handoff + background result | cancel/meta 后 provider messages 不含旧文件名、旧命令、旧错误 |
| 工具被挡后的下一轮 | 模型第一轮仍发旧 Bash，tool gate 阻断后进入下一轮 | 第二轮 provider messages 不含被挡旧命令 |

## 硬验收结果

### 上下文专项

命令：

```powershell
bun test src\dsxu\engine\__tests__\latest-user-intent-override-v1.test.ts src\dsxu\engine\__tests__\same-window-topic-boundary-v1.test.ts
```

结果：
- 19 pass
- 0 fail
- 96 expect

### Query Loop / Tool Gate 组合

命令：

```powershell
bun test src\dsxu\engine\__tests__\latest-user-intent-override-v1.test.ts src\dsxu\engine\__tests__\same-window-topic-boundary-v1.test.ts src\dsxu\engine\__tests__\intent-only-final-live-gate-v1.test.ts src\dsxu\engine\__tests__\tool-batch-gate-classification-v1.test.ts src\dsxu\engine\__tests__\query-loop-gate-state-v1.test.ts src\dsxu\engine\__tests__\query-message-shape-guard-v1.test.ts
```

结果：
- 59 pass
- 0 fail
- 211 expect

### 工具适配 / 权限 / 收敛组合

命令：

```powershell
bun test src\dsxu\engine\__tests__\semantic-tool-gate-v1.test.ts src\dsxu\engine\__tests__\edit-convergence-gate-v1.test.ts src\dsxu\engine\__tests__\tool-batch-gate-classification-v1.test.ts src\dsxu\engine\__tests__\mainline-tool-adapter-v1.test.ts
```

结果：
- 103 pass
- 0 fail
- 1037 expect

### 可见状态验收

命令：

```powershell
bun run visible-state:acceptance
```

结果：
- `PASS_VISIBLE_STATE_ACCEPTANCE`
- `readyEvents=8`
- `blockedGuards=side-effect tool path has blocked permission state`

### Live Provider 状态

命令：

```powershell
bun --env-file=.env run scripts/dsxu-training-live-provider-capture.ts --timeout-ms 90000
```

结果：
- `SKIPPED_NO_API_KEY`
- `.env` 中 `DEEPSEEK_API_KEY` 当前为空值；未调用 provider，未伪造 live 结果。

## 性能约束

本修复不应影响性能：
- 不新增默认 provider/API 调用。
- 不新增默认 shell 调用。
- 不新增默认文件 IO。
- 每轮最多轻量扫描消息列表一次，复杂度 `O(message_count)`。
- tool gate 仅在模型已经发出工具调用时做一次轻量分类。

## 未覆盖或需人工真实窗口观察

| 项目 | 状态 | 说明 |
|---|---|---|
| 30-45 分钟 senior coding window | 未在本轮重跑 | 用户后续要求上下文 bug 以 30 分钟内多场景测试为主；本轮用多场景回放覆盖长上下文污染路径 |
| DeepSeek live 遵循 nudge | 未完成 live 证明 | 当前 key 为空，已记录为 skipped；需配置非空 `DEEPSEEK_API_KEY` 后再跑 |
| TUI 人眼观感 | 未在本轮重跑 | 逻辑层已覆盖，真实 TUI 长窗口仍建议作为发布前人工验收 |

## 结论

上下文污染主类问题已经在代码层完成收口：
- cancel/meta 会裁剪旧上下文；
- analysis-only 会保留分析材料但禁工具；
- tool gate 会阻断模型继续旧工具；
- 隐晦中文停止/换话题短语已覆盖；
- 并发 Agent、compact recovery、后台结果污染已用回放测试覆盖。

当前剩余不是主链逻辑缺口，而是 live provider / TUI 长窗口的外部真实验收条件。
