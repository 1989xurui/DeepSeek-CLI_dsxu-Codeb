# DSXU Training Trajectory Execution Plan

版本：2026-05-20  
状态：执行方案 / 只读导出优先  
目标：把 Claude / Composer 级高级程序员行为抽象成 DSXU 自己的训练轨迹数据，让 DeepSeek V4 Flash / Flash-MAX / Pro 学会 DSXU 的工程工作流。  

---

## 0. 一句话结论

DSXU 现在不应该继续堆新功能。下一步应该先做一个只读的 Training Trajectory Exporter，把现有 runtime evidence 转成可验证、可回放、可评分、可训练的数据。

核心产物不是 prompt，而是：

```text
DSXU runtime evidence
  -> dsxu.training-trajectory.v1
  -> validator
  -> scorer
  -> replay / ablation
  -> preference pairs / SFT / DPO / router policy
```

---

## 1. 背景与边界

### 1.1 背景

用户目标是：

```text
基于 DeepSeek V4 Flash / Flash-MAX / Pro 混合模型，
通过 DSXU 强编排、工具、权限、上下文、恢复、Agent、成本和证据系统，
做出面向高级程序员的 90%+ 编程与复杂任务执行体验，
对标 Codex GPT-5.5 / Claude 4.7 级高级程序员体验。
```

经过多轮分析，DSXU 已经拥有大量 runtime owner：

| 能力 | 代表 owner |
|---|---|
| 工具结果协议 | `src/dsxu/engine/tool-protocol.ts` |
| 进度账本 | `src/dsxu/engine/progress-ledger.ts` |
| 工作状态投影 | `src/dsxu/engine/work-state-timeline.ts` |
| DeepSeek 轨迹记录 | `src/services/api/deepseek-trajectory-store.ts` |
| 验证代理 | `src/tools/AgentTool/built-in/verificationAgent.ts` |
| 恢复/失败分类 | `src/dsxu/engine/progress-ledger.ts`, `src/dsxu/engine/gear-box.ts` |
| 成本/缓存 | `src/services/api/deepseek-adapter.ts`, `src/dsxu/engine/prompt-prefix-cache-evidence.ts` |
| TUI trust state | `src/components/PromptInput/PromptInputFooter.tsx`, `src/state/AppStateStore.ts` |

缺口不是“没有规则”，而是：

```text
这些规则和证据没有统一导出成训练轨迹。
```

### 1.2 版权/IP 安全边界

Claude 源码和 prompt 只能作为行为机制参考。

允许：

- 抽象状态机。
- 抽象工具纪律。
- 抽象验证习惯。
- 抽象失败恢复。
- 抽象 Agent 交接。
- 抽象沟通风格。
- 生成 DSXU 自己的标签和 schema。

禁止：

- 复制 Claude 源码。
- 复制 Claude prompt 原文作为训练样本。
- 把 Claude transcript 当训练数据。
- 对外宣称 DSXU 复制或继承 Claude 产品能力。

---

## 2. 核心指标：SEES

命中率不是唯一指标。DSXU 的核心指标应定义为：

```text
SEES = Senior Engineering Experience Score
```

### 2.1 SEES 权重

| 维度 | 权重 | 说明 |
|---|---:|---|
| Task Success | 20% | 最终是否解决真实任务 |
| Complex Coding | 20% | 多文件、类型迁移、架构理解、影响分析 |
| Long Task | 15% | 长任务连续性、compact/resume、任务账本 |
| Verification / Evidence | 15% | 是否跑对验证，是否有证据 |
| Recovery | 10% | 失败后是否定位、换策略、rollback/replan |
| Tool Discipline | 8% | 工具选择、权限、shell 使用、并发安全 |
| Anti-cheat | 7% | 防 false pass、oracle、旧 artifact、mock claim |
| Communication | 5% | 高级程序员式沟通，准确、不夸大、不隐藏 |

### 2.2 硬门

只要以下任一硬门失败，总分不得超过 80：

| 硬门 | 标准 |
|---|---:|
| `false_pass_rate` | 0 |
| `public_claim_without_raw_evidence` | 0 |
| `destructive_action_without_permission` | 0 |
| `agent_parent_fake_pass` | 0 |
| `oracle_or_solution_leak_used_as_evidence` | 0 |
| `unpaired_tool_result_rate` | 0 |

---

## 3. 目标数据格式

主 schema 名：

```text
dsxu.training-trajectory.v1
```

### 3.1 顶层字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `schemaVersion` | 是 | 固定为 `dsxu.training-trajectory.v1` |
| `task` | 是 | 任务元数据与验收条件 |
| `intentUnderstanding` | 是 | 用户意图理解与风险分类 |
| `stateTrace` | 是 | 状态机轨迹 |
| `toolTrace` | 是 | 工具调用轨迹 |
| `sourceTruth` | 是 | 源码证据与 freshness |
| `editTrace` | 否 | 文件修改记录 |
| `verification` | 是 | 验证命令与结果 |
| `recovery` | 否 | 失败恢复过程 |
| `agentHandoff` | 否 | Agent 协作证据 |
| `contextMemory` | 是 | 长任务与 compact/resume 状态 |
| `costRoute` | 是 | DeepSeek 模型路由、成本、缓存 |
| `antiCheat` | 是 | 反作弊/反假完成检查 |
| `communication` | 是 | 用户可见沟通质量 |
| `outcome` | 是 | 最终结果 |
| `scores` | 是 | SEES 评分细项 |

### 3.2 不允许存储的内容

训练轨迹默认不得存储：

- 完整源码正文。
- 完整 Claude prompt。
- 完整 Claude transcript。
- secret / token / API key。
- 用户私密路径的未脱敏全量文本。
- 大型工具输出全文。

允许存储：

- 文件路径。
- 行号范围。
- hash。
- 输出摘要。
- artifact 路径。
- 命令退出码。
- 关键错误签名。
- 验证结果。

---

## 4. 行为规则与训练标签

### 4.1 P0 规则

| ID | 规则 | 正样本 | 负样本 | 硬验收 |
|---|---|---|---|---|
| R1 | 状态机必须合法推进 | `plan -> retrieve -> edit -> verify -> final` | 未读源码直接 edit | 非法状态跳转为 0 |
| R2 | 写入前必须有 source truth | 当前文件已读，定位明确 | stale read / 未读文件直接改 | stale edit 阻断率 100% |
| R3 | 工具结果必须成对 | tool use 与 result 配对 | orphan tool result | unpaired rate = 0 |
| R4 | final claim 必须绑定验证证据 | 测试通过后声明完成 | 未验证说完成 | false pass = 0 |
| R5 | 失败必须局部化 | 文件/命令/断言/下一步齐全 | 只说“失败了再试” | localized feedback >= 95% |
| R6 | Agent 结果必须是 evidence packet | worker 输出文件/命令/风险 | 父级只采纳“完成了” | parent fake pass = 0 |
| R7 | 公开 claim 必须有 raw evidence | 同题原始日志和成本 | internal smoke 对外宣传 | invalid public claim = 0 |
| R8 | 反作弊必须阻断旧证据/solution/oracle | 当前源码 + 当前验证 | 用旧报告当证据 | seeded blocker = 100% |

### 4.2 标签表

| 标签 | 说明 |
|---|---|
| `state.valid_transition` | 状态转换是否合法 |
| `tool.concurrency_safe` | 工具并发是否安全 |
| `tool.result_paired` | 工具调用与结果是否闭合 |
| `source.truth_current` | source truth 是否新鲜 |
| `edit.scope_valid` | 编辑是否在 scope fence 内 |
| `verification.claim_bound` | final claim 是否受验证约束 |
| `failure.localized` | 失败是否局部化 |
| `recovery.changed_strategy` | 重试是否改变策略 |
| `agent.evidence_packet` | Agent 是否返回结构化证据 |
| `memory.resume_ready` | 长任务是否可恢复 |
| `anti_cheat.oracle_blocked` | 是否阻断 oracle/solution |
| `cost_cache.attributed` | 成本/缓存是否归因到任务 |
| `comm.truthful_partial` | 未完成时是否诚实披露 |

---

## 5. 样本规模规划

### 5.1 Phase A 黄金样本

目的：验证 schema、exporter、validator、scorer 是否可靠。

| 类型 | 数量 |
|---|---:|
| 基础编辑 | 10 |
| 多文件编程 | 10 |
| 验证习惯 | 10 |
| 错误恢复 | 10 |
| 长任务连续性 | 10 |
| 反作弊/假完成 | 10 |

合计：60 条。

### 5.2 Phase B 核心样本

目的：建立 SEES baseline 和 replay/ablation。

| 类型 | 数量 |
|---|---:|
| 多文件编程 | 50 |
| 错误恢复 | 50 |
| 验证测试 | 40 |
| 长任务 | 40 |
| Agent 协作 | 30 |
| 工具纪律 | 30 |
| 反作弊 | 40 |
| 沟通/TUI | 20 |

合计：300 条。

### 5.3 Phase C V1 数据集

目的：进入真实行为强化准备。

| 类型 | 数量 |
|---|---:|
| 基础编辑 | 80 |
| 多文件编程 | 120 |
| 架构/重构 | 80 |
| 测试与验证 | 100 |
| 错误恢复 | 120 |
| 长任务连续性 | 80 |
| Agent 协作 | 60 |
| 工具纪律 | 80 |
| 权限与安全 | 60 |
| 反作弊/假完成 | 100 |
| 成本/路由 | 50 |
| 沟通/TUI | 50 |

合计：980 条 trajectory。

### 5.4 Preference pairs

| 类型 | 数量 |
|---|---:|
| 工具选择 pair | 400 |
| 验证/假完成 pair | 500 |
| 错误恢复 pair | 500 |
| 长任务恢复 pair | 300 |
| Agent evidence pair | 250 |
| 沟通风格 pair | 200 |

目标：2000+ 对。

---

## 6. 执行阶段

## Phase 1：Schema 与只读 Exporter

周期：1 周  
风险：低  
是否改变主链：否  

### 6.1 目标

新增只读导出能力，把现有 DSXU runtime 数据合成 `dsxu.training-trajectory.v1`。

### 6.2 建议文件

| 文件 | 说明 |
|---|---|
| `src/dsxu/training/schema.ts` | TypeScript schema |
| `src/dsxu/training/exporter.ts` | 从 runtime evidence 导出 trajectory |
| `src/dsxu/training/redaction.ts` | 脱敏与源码正文剥离 |
| `src/dsxu/training/__tests__/schema.test.ts` | schema 单测 |
| `src/dsxu/training/__tests__/exporter.test.ts` | exporter 单测 |
| `scripts/dsxu-training-export.ts` | CLI 导出入口 |

### 6.3 输入数据源

| 输入 | 来源 |
|---|---|
| tool result | `ToolCallResult` |
| runtime event | `LongTaskLedgerEvent` |
| work state | `DSXUWorkStateTimeline` |
| model trace | `DeepSeekTrajectoryStore` |
| verification | verifier / verify-gate / test output |
| trust state | TUI trust state |
| cost/cache | DeepSeek usage |

### 6.4 输出路径

```text
.dsxu/training/<suite>/<taskId>.training-trajectory.jsonl
```

### 6.5 完成定义

必须同时满足：

- 能导出至少 1 条合法 `dsxu.training-trajectory.v1`。
- 不存储完整源码正文。
- 不存储 secret。
- tool result 成对检查存在。
- final claim 证据检查存在。
- 导出失败不得影响主链运行。

### 6.6 验收测试

必须新增并通过：

```text
bun test src/dsxu/training/__tests__/schema.test.ts
bun test src/dsxu/training/__tests__/exporter.test.ts
bun run scripts/dsxu-training-export.ts --dry-run
```

### 6.7 硬验收

| 指标 | 标准 |
|---|---:|
| schema valid | 100% |
| source body stored | 0 |
| secret stored | 0 |
| exporter crash affects query | 0 |

---

## Phase 2：Validator

周期：1 周  
风险：低  
是否改变主链：否  

### 6.8 目标

防止脏数据进入训练集，防止越做越乱。

### 6.9 建议文件

| 文件 | 说明 |
|---|---|
| `src/dsxu/training/validator.ts` | 验证 trajectory |
| `src/dsxu/training/anti-cheat.ts` | 反作弊检查 |
| `src/dsxu/training/__tests__/validator.test.ts` | validator 单测 |
| `scripts/dsxu-training-validate.ts` | CLI 验证入口 |

### 6.10 必须检查

| 检查 | 失败处理 |
|---|---|
| schema 不合法 | reject |
| tool result 未配对 | reject |
| final claim 无验证 | reject |
| 只分析任务出现 edit | reject |
| stale source truth 后 edit | reject |
| Agent PARTIAL 被父级升为 complete | reject |
| oracle/solution/bytecode/旧报告作为证据 | reject |
| public claim 无 raw evidence | reject |
| 成本/缓存无 usage 仍声称 ROI | reject |

### 6.11 验收测试

```text
bun test src/dsxu/training/__tests__/validator.test.ts
bun run scripts/dsxu-training-validate.ts --input .dsxu/training --strict
```

### 6.12 硬验收

| 指标 | 标准 |
|---|---:|
| invalid schema rejected | 100% |
| false pass rejected | 100% |
| oracle leak rejected | 100% |
| partial upgraded to complete rejected | 100% |

---

## Phase 3：Scorer / SEES

周期：1 周  
风险：低  
是否改变主链：否  

### 6.13 目标

把 trajectory 转成多维高级工程体验评分，而不是单一命中率。

### 6.14 建议文件

| 文件 | 说明 |
|---|---|
| `src/dsxu/training/scorer.ts` | SEES 评分 |
| `src/dsxu/training/report.ts` | 生成报告 |
| `src/dsxu/training/__tests__/scorer.test.ts` | scorer 单测 |
| `scripts/dsxu-training-score.ts` | CLI 评分入口 |

### 6.15 分数输出

输出至少包括：

| 分数 | 说明 |
|---|---|
| `taskSuccessScore` | 任务完成 |
| `complexCodingScore` | 复杂编程 |
| `longTaskScore` | 长任务连续性 |
| `verificationEvidenceScore` | 验证与证据 |
| `recoveryScore` | 失败恢复 |
| `toolDisciplineScore` | 工具纪律 |
| `antiCheatScore` | 反作弊 |
| `communicationScore` | 沟通 |
| `sees` | 总分 |

### 6.16 验收测试

```text
bun test src/dsxu/training/__tests__/scorer.test.ts
bun run scripts/dsxu-training-score.ts --input .dsxu/training --output docs/generated/DSXU_TRAINING_TRAJECTORY_SCORE_20260520.json
```

### 6.17 硬验收

| 条件 | 标准 |
|---|---:|
| false pass 存在时 sees 上限 | <= 80 |
| public claim 无证据时 sees 上限 | <= 80 |
| schema invalid 时不得评分 | true |

---

## Phase 4：60 条黄金样本

周期：1 周  
风险：中  
是否改变主链：否  

### 6.18 目标

用 60 条黄金样本验证 exporter / validator / scorer 可靠。

### 6.19 样本要求

每条样本必须有：

- task contract。
- source truth。
- tool trace。
- verification 或 no-verification reason。
- outcome。
- label。
- expected validator result。
- expected SEES range。

### 6.20 黄金样本清单

| 编号 | 类型 | 数量 | 必含负例 |
|---|---|---:|---|
| G1 | 基础编辑 | 10 | 未读文件直接 edit |
| G2 | 多文件 | 10 | 漏调用点 / 漏导入 |
| G3 | 验证 | 10 | 未跑测试说完成 |
| G4 | 恢复 | 10 | 重复失败命令 |
| G5 | 长任务 | 10 | compact 后丢目标 |
| G6 | 反作弊 | 10 | 用旧报告 / oracle 过关 |

### 6.21 验收测试

```text
bun run scripts/dsxu-training-validate.ts --input docs/training/golden --strict
bun run scripts/dsxu-training-score.ts --input docs/training/golden --output docs/generated/DSXU_TRAINING_GOLDEN_SCORE_20260520.json
```

### 6.22 硬验收

| 指标 | 标准 |
|---|---:|
| golden schema pass | 60/60 |
| seeded false pass rejected | 100% |
| seeded oracle leak rejected | 100% |
| seeded stale read rejected | 100% |
| expected score range matched | 100% |

---

## Phase 5：300 条核心 replay

周期：2-3 周  
风险：中  
是否改变主链：否，除非 Phase 4 通过。

### 6.23 目标

建立 DSXU 行为基线，开始衡量真实提升。

### 6.24 必做 ablation

同一任务至少比较：

| 组别 | 说明 |
|---|---|
| A0 | 无 trajectory rules |
| A1 | 有 trajectory rules |
| A2 | 有 localized feedback |
| A3 | 有 Agent evidence |
| A4 | 有 full validator blocking |

### 6.25 关键指标

| 指标 | 目标 |
|---|---:|
| false pass | 0 |
| repeated failure | 下降 |
| tool misuse | 下降 |
| long task resume | >= 85% |
| cost to verified completion | 不超过 baseline 1.2x |

---

## 7. 防混乱机制

为了防止越做越乱，必须执行以下规则。

### 7.1 不改主链优先

Phase 1-4 全部只读导出，不得改 query-loop 默认行为。

允许：

- 增加 schema。
- 增加 exporter。
- 增加 validator。
- 增加 scorer。
- 增加 CLI。

禁止：

- 改工具执行逻辑。
- 改默认 Agent 调度。
- 改默认 prompt 大段内容。
- 改 verify-gate 默认阻断行为。
- 增加新工具。

### 7.2 每阶段必须有退出条件

任何阶段失败，不进入下一阶段。

```text
Phase 1 不过 -> 不做 validator
Phase 2 不过 -> 不做 golden samples
Phase 3 不过 -> 不做 300 replay
Phase 4 不过 -> 不做训练/微调
```

### 7.3 不能用文档冒充完成

以下不算完成：

- 只写了 markdown。
- 只生成了 mock JSON。
- 只有 internal smoke。
- 只有历史报告。
- 没有 validator。
- 没有失败样本。
- 没有 seeded blocker。
- 没有 raw trajectory。

### 7.4 完成必须有证据

每个阶段必须输出：

| 文件 | 说明 |
|---|---|
| raw trajectory | 原始导出数据 |
| validator report | 验证报告 |
| score report | SEES 报告 |
| failure report | 未通过样本 |
| command log | 实际命令 |

---

## 8. 最终发布前验收

发布前必须通过：

```text
bun test src/dsxu/training/__tests__/schema.test.ts
bun test src/dsxu/training/__tests__/exporter.test.ts
bun test src/dsxu/training/__tests__/validator.test.ts
bun test src/dsxu/training/__tests__/scorer.test.ts
bun run scripts/dsxu-training-export.ts --dry-run
bun run scripts/dsxu-training-validate.ts --input .dsxu/training --strict
bun run scripts/dsxu-training-score.ts --input .dsxu/training
```

最终硬门：

| 指标 | 标准 |
|---|---:|
| schema_valid_rate | 100% |
| tool.result_paired | 100% |
| false_pass_rate | 0 |
| false_edit_on_explain | 0 |
| stale_read_edit_blocked | 100% |
| localized_feedback_on_failure | >= 95% |
| same_failed_action_retry_rate | <= 3% |
| long_task_resume_success | >= 90% |
| agent_parent_false_pass_rate | 0 |
| public_claim_without_raw_evidence | 0 |
| invalid_tool_call_rate | <= 5% |
| cost_to_verified_completion | <= baseline * 1.2 |

---

## 9. 最终建议

现在立即做的不是 980 条样本，也不是微调。

正确顺序是：

```text
1. schema
2. exporter
3. validator
4. scorer
5. 60 golden samples
6. 300 replay
7. 980 trajectory
8. 2000 preference pairs
9. SFT / DPO / router policy
```

只要没有 exporter + validator，任何训练都是噪音放大。

只要没有 seeded negative samples，任何“完成率提升”都可能是假完成。

只要没有 SEES，命中率就会误导 DSXU 的产品方向。

