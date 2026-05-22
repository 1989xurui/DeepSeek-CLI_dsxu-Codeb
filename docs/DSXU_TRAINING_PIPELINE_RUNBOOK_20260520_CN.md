# DSXU Training Pipeline Runbook

版本：2026-05-20  
状态：V1 可执行运行手册  
边界：离线训练轨迹与内部证据链，不是 live provider 成绩，不是 SWE-bench 成绩，不是公开胜利声明。

---

## 1. 目标

这条链路用于把 DSXU 的运行过程整理成可验证、可评分、可回放、可消融的训练轨迹数据：

```text
runtime / synthetic evidence
  -> dsxu.training-trajectory.v1
  -> validator
  -> SEES scorer
  -> golden fixtures
  -> internal synthetic replay
  -> ablation
  -> runtime import / runtime capture
  -> V1 reality run report
```

核心目的不是证明 DSXU 已经超过 GPT-5.5 或 Claude 4.7，而是建立一条防假完成的数据基础设施。

---

## 2. 一键验收

首选命令：

```bash
bun run training:v1
```

等价直接命令：

```bash
bun run scripts/dsxu-training-v1-runner.ts --output docs/generated/DSXU_TRAINING_V1_RUN_20260520.json
```

通过条件：

- `status = PASS`
- `stepCount = 23`
- `passedGates = 13`
- `failedGates = []`
- `publicClaimAllowed = false`

主报告：

```text
docs/generated/DSXU_TRAINING_V1_RUN_20260520.json
```

每一步 stdout/stderr：

```text
docs/generated/DSXU_TRAINING_V1_RUN_LOGS_20260520/
```

---

## 3. 子命令

| 命令 | 作用 | 公开 claim |
|---|---|---|
| `bun run training:test` | 跑训练模块单元测试 | 不允许 |
| `bun run training:export` | 导出 dry-run 训练轨迹 | 不允许 |
| `bun run training:validate` | 验证轨迹 schema 与反作弊硬门 | 不允许 |
| `bun run training:score` | 计算 SEES 分数 | 不允许 |
| `bun run training:golden` | 生成 60 条 golden fixtures | 不允许 |
| `bun run training:replay` | 生成 300 条内部合成 replay | 不允许 |
| `bun run training:ablation` | 跑 A0-A4 内部消融 | 不允许 |
| `bun run training:export-runtime` | 导入 redacted runtime JSONL | 不允许 |
| `bun run training:capture` | 捕获命令生成的 runtime evidence | 不允许 |
| `bun run training:reachability` | 用 mock provider/tool 跑真实 query-loop 事件流，并导出训练轨迹 | 不允许 |
| `bun run training:capture-query-loop` | 通过 env opt-in 方式验证 `runQuery` 会写训练轨迹 | 不允许 |
| `bun run training:v1` | 跑完整 V1 reality run | 不允许 |

---

## 4. V1 硬门

V1 runner 必须同时通过以下 gate：

| Gate | 含义 |
|---|---|
| `commands-succeeded` | 17 个命令全部 exit 0 |
| `unit-tests-passed` | 训练模块单元测试通过 |
| `dry-run-valid` | dry-run 轨迹可验证、可评分 |
| `golden-fixtures-valid` | 60 条 golden fixture 的预期通过/拒绝全部匹配 |
| `golden-score-valid` | golden fixture 的 SEES 区间全部匹配 |
| `replay-fixtures-valid` | 300 条内部 replay 的预期通过/拒绝全部匹配 |
| `replay-score-valid` | replay 的 SEES 区间全部匹配 |
| `ablation-valid` | A0-A4 内部消融通过，且禁止公开 claim |
| `runtime-import-valid` | runtime import 可接受，但仍禁止公开 claim |
| `runtime-capture-valid` | runtime capture 产生轨迹、未超时、exit 0、禁止公开 claim |
| `claim-boundary-clean` | 合成/replay/runtime capture artifact 都不能被当成公开 benchmark |

任何一个 gate 失败，`training:v1` 必须失败。

---

## 5. 数据分层

| 层级 | 文件/目录 | 可用于 |
|---|---|---|
| dry-run | `docs/generated/DSXU_TRAINING_TRAJECTORY_DRY_RUN_20260520.json` | schema 和 exporter smoke |
| golden | `docs/training/golden/` | validator/scorer 合同测试 |
| internal replay | `.dsxu/training/replay/` | 内部回放、消融、回归 |
| runtime import | `docs/generated/DSXU_TRAINING_RUNTIME_IMPORT_20260520.json` | 导入 redacted runtime sample |
| runtime capture | `docs/generated/DSXU_TRAINING_RUNTIME_CAPTURE_20260520.json` | 捕获命令型 runtime sample |
| query-loop reachability | `docs/generated/DSXU_TRAINING_QUERY_LOOP_REACHABILITY_20260520.json` | 验证 query-loop 事件流可转成训练轨迹 |
| query-loop opt-in capture | `docs/generated/DSXU_TRAINING_QUERY_LOOP_CAPTURE_20260520.json` | 验证 `DSXU_TRAINING_QUERY_LOOP_CAPTURE_FILE` 可写入训练轨迹 |
| V1 reality run | `docs/generated/DSXU_TRAINING_V1_RUN_20260520.json` | 总验收 |

禁止混用：

- internal replay 不等于真实任务 benchmark。
- runtime capture 不等于 live provider 质量成绩。
- query-loop reachability 使用 mock provider/tool，只证明事件链路可触达。
- query-loop opt-in capture 使用 env 开关，只证明 `runQuery` 可写入 redacted training artifact。
- dry-run 不等于默认主链已经接入。
- SEES 分数不等于公开排行榜分数。

---

## 6. 失败处理

如果 `training:v1` 失败：

1. 先看主报告的 `failedGates`。
2. 再看 `steps` 中第一个 `status = failed` 的 step。
3. 打开对应日志：

```text
docs/generated/DSXU_TRAINING_V1_RUN_LOGS_20260520/<step>.stderr.log
docs/generated/DSXU_TRAINING_V1_RUN_LOGS_20260520/<step>.stdout.log
```

处理顺序：

```text
schema/validator 失败
  -> 先修 trajectory 结构或反作弊 hard gate
score 失败
  -> 修 SEES 预期区间或 scorer cap
runtime import/capture 失败
  -> 检查 JSONL 是否 redacted、tool_call/tool_result 是否配对
claim-boundary 失败
  -> 先阻断 publicClaimAllowed，再讨论是否升级证据等级
```

---

## 7. 当前已验证结果

最近一次本地结果：

```text
bun test src/dsxu/training/__tests__
34 pass
0 fail
145 expect() calls
```

```text
bun run training:v1
status: PASS
stepCount: 23
passedGates: 13
failedGates: []
publicClaimAllowed: false
```

---

## 8. 下一阶段边界

V1 已经完成的是训练轨迹数据基础设施。

已经补充完成的是：

- query-loop reachability probe：真实 `queryLoop` 事件流可以转成 `dsxu.training-trajectory.v1`。
- query-loop opt-in capture：设置 `DSXU_TRAINING_QUERY_LOOP_CAPTURE_FILE` 时，`runQuery` 会写入 redacted training artifact；写入失败不会阻塞主结果。

还没有完成、不能宣称已经完成的是：

- 默认 query-loop 主链无开关自动导出真实用户运行轨迹。
- live DeepSeek provider 大规模任务对比。
- SWE-bench / public challenge 正式成绩。
- 用这些样本真正训练或微调 DeepSeek。
- 证明 DSXU 达到或超过 GPT-5.5 / Claude 4.7。

下一阶段如果继续执行，应优先做：

1. live opt-in capture：在真实 DeepSeek provider 与真实工具执行下采集少量本地证据。
2. live provider capture：真实 DeepSeek request/response 是否能进入同一 schema。
3. 真实任务集：从 internal replay 升级到 replay + real task mixed set。
4. dashboard：把 V1 report 显示成高级程序员能一眼判断可信度的界面。
 
 

---

## 9. Live Provider Capture（可选，不进入 `training:v1`）

新增命令：

```bash
bun run training:live-provider-capture
```

设计边界：
- 没有 `DEEPSEEK_API_KEY` 时，命令不会伪造通过结果，只会生成 `SKIPPED_NO_API_KEY` artifact。
- 有 `DEEPSEEK_API_KEY` 时，命令通过现有 `DeepSeekAdapter` 发起一次最小 chat completion，并使用 `DSXU_DEEPSEEK_TRAJECTORY_FILE` 写入 redacted JSONL。
- artifact 默认输出到 `docs/generated/DSXU_TRAINING_LIVE_PROVIDER_CAPTURE_20260520.json`。
- redacted JSONL 默认输出到 `.dsxu/training/live-provider/deepseek-live-provider-smoke-20260520.jsonl`。
- 该命令不加入 `training:v1`，因为 live provider 依赖网络、额度、key、供应商状态，不能作为离线主线 gate。
- 即使 live provider smoke 成功，`publicClaimAllowed=false`、`liveProviderClaimAllowed=false` 仍然保持不变；它只能证明“provider 链路可达且能被导入训练轨迹 schema”，不能证明 DSXU 任务能力、SWE-bench 分数或超过 Claude/GPT。

强制 live 的发布前检查可使用：

```bash
bun run training:live-provider-capture -- --require-live
```

验收标准：
- 无 key：artifact status 必须是 `SKIPPED_NO_API_KEY`，退出码为 0，且 `publicClaimAllowed=false`。
- 有 key 且 provider 正常：artifact status 必须是 `PASS_LIVE_PROVIDER_CAPTURE`，`import.validation.status=accepted`，`import.score.status=scored`，且 artifact/trace 不包含 API key 或原始回复正文。
- provider 失败：artifact status 必须是 `FAIL_LIVE_PROVIDER_CAPTURE`，不能变成公开 claim。
 

---

## 10. Training Evidence Dashboard（声明分层面板）

新增命令：

```bash
bun run training:dashboard
```

默认输出：

```text
docs/generated/DSXU_TRAINING_EVIDENCE_DASHBOARD_20260520.json
```

它只读取现有训练证据，不调用 provider，不重新运行测试。用途是把证据分成六类 claim：
- offline training pipeline：`training:v1` 通过时，只允许内部声明。
- internal replay calibration：replay + score + ablation 通过时，只允许内部声明。
- query-loop training reachability：reachability + opt-in capture 通过时，只允许内部声明。
- live provider smoke：live provider capture 通过时，只允许说明 provider 链路可达。
- public benchmark claim：默认阻断。
- superiority claim：默认阻断，不能用内部 replay/live smoke 声称超过 GPT/Claude。

验收标准：
- dashboard `publicClaimAllowed` 必须始终为 `false`。
- public benchmark 和 superiority claim 必须为 `blocked`。
- internal claim 只有在对应 artifact 存在且通过时才是 `allowed-internal`。
- `evidenceCompletenessScore` 是证据完整度，不是模型能力分数，不能当作公开成绩。
