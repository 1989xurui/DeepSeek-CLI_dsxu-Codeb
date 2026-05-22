# DSXU Training Data Flywheel Master Plan

版本：2026-05-20  
状态：一步到位总规划 / 分阶段硬验收执行  
目标：把 DSXU 从“强运行时约束 DeepSeek”升级为“DeepSeek-native 高级程序员行为数据飞轮”。  

---

## 0. 总目标

DSXU 的目标不是单一命中率，而是高级程序员体验：

```text
DeepSeek V4 Flash / Flash-MAX / Pro 原生能力
+ DSXU 强编排、工具、权限、上下文、恢复、Agent、成本和证据系统
=> 面向高级程序员的 90%+ 编程与复杂任务执行体验
```

对标体验：

- Codex GPT-5.5 级复杂编码执行。
- Claude 4.7 级工具纪律、验证习惯、恢复、长任务连续性。
- Composer 2.5 类数据飞轮：不是只靠 prompt，而是把产品工作流变成模型行为数据。

---

## 1. 核心结论

不能只做 20 条样本，也不能只做一个 exporter。

一步到位应该规划完整闭环：

```text
Runtime Evidence
  -> Training Trajectory Exporter
  -> Validator
  -> SEES Scorer
  -> Golden / Replay / Real Task Dataset
  -> Preference Pair Generator
  -> Ablation / Reality Run
  -> Router Policy / Few-shot / SFT / DPO
  -> Dashboard
  -> New Runtime Evidence
```

这叫：

```text
DSXU Training Data Flywheel
```

但执行必须分闸门：

```text
没有 schema 不做 exporter
没有 exporter 不做 validator
没有 validator 不做样本
没有样本不做 replay
没有 replay 不做训练
没有 raw evidence 不做公开 claim
```

---

## 2. 当前 DSXU 已有承接点

| 能力 | 当前 owner | 状态 | V2 处理方式 |
|---|---|---|---|
| 工具统一结果 | `src/dsxu/engine/tool-protocol.ts` | 已有 | 作为 `toolTrace` 主来源 |
| runtime event | `src/dsxu/engine/progress-ledger.ts` | 已有 | 作为 `stateTrace` 主来源 |
| work state | `src/dsxu/engine/work-state-timeline.ts` | 已有 | 作为长任务投影 |
| DeepSeek request trace | `src/services/api/deepseek-trajectory-store.ts` | 已有 | 作为模型/工具/usage 轨迹 |
| verification agent | `src/tools/AgentTool/built-in/verificationAgent.ts` | 已有 | 输出 verdict 训练标签 |
| localized feedback | `src/dsxu/engine/progress-ledger.ts` | 部分接入 | 扩展为失败恢复样本 |
| Agent evidence | `src/tools/AgentTool`, `src/services/AgentSummary` | 部分接入 | 统一为 handoff evidence packet |
| cost/cache | `src/services/api/deepseek-adapter.ts` | 已有 | 绑定到 outcome |
| public evidence gate | `raw-evidence-readiness-register-v1.ts` 等 | 部分接入 | 作为 claim gate 训练标签 |

核心问题：

```text
owner 很多，但缺一个统一训练数据导出面。
```

---

## 3. 总体系统设计

### 3.1 模块图

```text
src/dsxu/training/
  schema.ts
  exporter.ts
  redaction.ts
  validator.ts
  scorer.ts
  preference.ts
  replay.ts
  ablation.ts
  quality-tier.ts
  dashboard.ts
  dataset-manifest.ts
```

### 3.2 CLI 入口

```text
scripts/dsxu-training-export.ts
scripts/dsxu-training-validate.ts
scripts/dsxu-training-score.ts
scripts/dsxu-training-preference.ts
scripts/dsxu-training-replay.ts
scripts/dsxu-training-ablation.ts
scripts/dsxu-training-dashboard.ts
```

### 3.3 输出目录

```text
.dsxu/training/raw/
.dsxu/training/validated/
.dsxu/training/rejected/
.dsxu/training/preference/
.dsxu/training/replay/
.dsxu/training/reports/
docs/generated/
```

---

## 4. Schema：dsxu.training-trajectory.v1

### 4.1 顶层结构

```json
{
  "schemaVersion": "dsxu.training-trajectory.v1",
  "datasetTier": "gold|silver|bronze|rejected",
  "task": {},
  "intentUnderstanding": {},
  "stateTrace": [],
  "toolTrace": [],
  "sourceTruth": {},
  "editTrace": {},
  "verification": {},
  "recovery": {},
  "agentHandoff": {},
  "contextMemory": {},
  "costRoute": {},
  "antiCheat": {},
  "communication": {},
  "outcome": {},
  "scores": {},
  "evidence": {}
}
```

### 4.2 必填字段

| 字段 | 说明 | 硬门 |
|---|---|---|
| `task.taskId` | 任务 ID | 必须唯一 |
| `task.category` | 任务类型 | 必须在枚举内 |
| `task.acceptanceCriteria` | 验收标准 | 不可为空 |
| `stateTrace` | 状态机轨迹 | 不可为空 |
| `toolTrace` | 工具调用轨迹 | 必须检查 result pair |
| `sourceTruth` | 源码证据 | 不得存源码正文 |
| `verification` | 验证结果 | final claim 必须绑定 |
| `antiCheat` | 反作弊检查 | P0 硬门 |
| `scores.sees` | 高级工程体验总分 | 必须可复算 |

### 4.3 数据脱敏规则

禁止写入训练集：

- 完整源码文件正文。
- 完整第三方 prompt。
- Claude 源码和 prompt 原文。
- API key / token / secret。
- 大型命令输出全文。
- 用户私有路径中的敏感片段。

允许写入：

- 文件路径。
- line range。
- hash。
- 命令。
- exit code。
- error signature。
- artifact path。
- 验证摘要。

---

## 5. 数据质量分级

### 5.1 Gold

可用于 SFT/DPO。

要求：

- schema 100% 合法。
- 有 source truth。
- 有验证证据。
- 没有 false pass。
- 没有 oracle / solution / old artifact。
- 有清晰 outcome。
- 若失败，有 localized feedback。
- 若 Agent 参与，有 evidence packet。

### 5.2 Silver

可用于 replay / router policy / few-shot。

允许：

- 部分验证不可运行，但必须有原因。
- 部分字段缺失，但不能违反硬门。
- 可用于“模型如何报告 PARTIAL”。

### 5.3 Bronze

只用于分析，不进入训练。

特点：

- 证据不足。
- 任务结果不明确。
- 缺少验证。
- 可用于构造负例。

### 5.4 Rejected

禁止进入训练。

条件：

- false pass。
- 用旧报告当证据。
- oracle/solution 泄漏。
- Agent fake pass。
- tool result 未配对。
- public claim 无 raw evidence。
- 存储完整源码正文或 secret。

---

## 6. 能力矩阵

### 6.1 22 项能力

| 层 | 能力 | 样本覆盖 |
|---|---|---|
| 基础编码 | 单文件修改 | 基础编辑 |
| 基础编码 | 多文件一致性 | 多文件编程 |
| 基础编码 | 代码定位 | 工具纪律 |
| 基础编码 | 代码生成质量 | 基础/多文件 |
| 基础编码 | 最小修改 | 反作弊/复杂编程 |
| 复杂工程 | 架构理解 | 架构/重构 |
| 复杂工程 | 类型迁移 | 多文件编程 |
| 复杂工程 | 重构能力 | 架构/重构 |
| 复杂工程 | 测试生成 | 测试与验证 |
| 复杂工程 | 依赖影响分析 | 多文件/架构 |
| 长任务 | 工作记忆连续性 | 长任务连续性 |
| 长任务 | Compact/Resume | 长任务连续性 |
| 长任务 | Task Ledger | 长任务连续性 |
| 长任务 | Agent 分工 | Agent 协作 |
| 长任务 | 并发调度 | 工具纪律 |
| 验证恢复 | 验证习惯 | 测试与验证 |
| 验证恢复 | 失败恢复 | 错误恢复 |
| 验证恢复 | 反假完成 | 反作弊 |
| 验证恢复 | 反作弊 | 反作弊 |
| 验证恢复 | 风险识别 | 权限与安全 |
| 体验成本 | 沟通风格 | 沟通/TUI |
| 体验成本 | 成本/性能 | 成本/路由 |

---

## 7. 样本规模

### 7.1 起步黄金集

| 类型 | 数量 |
|---|---:|
| 基础编辑 | 10 |
| 多文件编程 | 10 |
| 验证习惯 | 10 |
| 错误恢复 | 10 |
| 长任务连续性 | 10 |
| 反作弊/假完成 | 10 |

合计：60。

### 7.2 核心 replay 集

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

合计：300。

### 7.3 V2 完整训练集

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

合计：980。

### 7.4 Preference pairs

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

## 8. Preference Pair 生成规则

### 8.1 chosen / rejected

每个 pair 必须包含：

| 字段 | 说明 |
|---|---|
| `pairId` | 唯一 ID |
| `taskId` | 原任务 |
| `stateBeforeDecision` | 决策前状态 |
| `chosen` | 推荐行为 |
| `rejected` | 不推荐行为 |
| `preferenceReason` | 偏好原因 |
| `label` | 标签 |
| `evidence` | 支撑证据 |

### 8.2 典型 pair

| 类型 | chosen | rejected |
|---|---|---|
| 工具选择 | exact path -> Read | exact path -> directory search |
| 验证 | run focused test before final | claim done without test |
| 恢复 | inspect failure then patch one hypothesis | repeat same failing command |
| 长任务 | resume from ledger and reread source | rely on memory summary only |
| Agent | require evidence packet | accept “done” text |
| 沟通 | say verified / unverified exactly | overclaim or hide failure |

---

## 9. Replay 与 Ablation

### 9.1 Replay 目标

验证规则是否真的提升高级工程体验，而不是只让文档更漂亮。

### 9.2 Ablation 分组

| 组 | 配置 |
|---|---|
| A0 | baseline，无 training trajectory 规则 |
| A1 | 只启用 exporter 观察 |
| A2 | exporter + validator |
| A3 | exporter + validator + localized feedback |
| A4 | A3 + Agent evidence |
| A5 | A4 + cost/route policy |
| A6 | A5 + full claim gate |

### 9.3 指标

| 指标 | 目标 |
|---|---:|
| false pass | 0 |
| repeated failure | 相比 A0 下降 |
| invalid tool call | <= 5% |
| long task resume | >= 90% |
| cost to verified completion | <= baseline * 1.2 |
| public claim violation | 0 |

---

## 10. Scorer：SEES

### 10.1 总分

```text
SEES =
  20% Task Success
+ 20% Complex Coding
+ 15% Long Task
+ 15% Verification / Evidence
+ 10% Recovery
+  8% Tool Discipline
+  7% Anti-cheat
+  5% Communication
```

### 10.2 分数上限规则

| 条件 | SEES 上限 |
|---|---:|
| false pass | 80 |
| public claim without raw evidence | 80 |
| destructive action without permission | 80 |
| oracle/solution used | 70 |
| agent parent fake pass | 75 |
| tool result unpaired | 85 |
| source body leaked | 60 |

---

## 11. 训练使用方式

### 11.1 不微调也能用

在没有微调条件时，数据可用于：

- router policy。
- few-shot pack。
- runtime validator。
- failure recovery policy。
- Agent handoff guard。
- final claim gate。
- dashboard。

### 11.2 SFT

只允许 Gold 样本进入。

用途：

- 学会正确工具顺序。
- 学会验证前不 final。
- 学会失败后局部化。
- 学会长任务 resume。

### 11.3 DPO / Preference Learning

使用 preference pairs。

优先训练：

- false pass 拒绝。
- tool misuse 拒绝。
- repeated failure 拒绝。
- agent fake pass 拒绝。
- overclaim 拒绝。

### 11.4 Router Policy

训练目标：

| 情况 | 路由 |
|---|---|
| 小任务 | Flash |
| 普通编码 | Flash thinking high |
| 复杂规划 | Flash-MAX / Pro |
| 失败恢复 | Flash-MAX / Pro |
| 安全/权限/发布 claim | Pro admission |
| FIM | 仅补全 lane |

---

## 12. Dashboard

### 12.1 必须展示

| 面板 | 内容 |
|---|---|
| SEES 总分 | 总分和趋势 |
| 硬门状态 | false pass / public claim / oracle leak |
| 长任务 | resume success、open obligations |
| 验证 | verified completion、failed verification |
| Recovery | changed strategy、rollback/replan |
| Agent | evidence packet、parent synthesis |
| Tool | invalid tool call、unpaired result |
| Cost | cost to verified completion、cache hit |
| Dataset | gold/silver/bronze/rejected 数量 |

### 12.2 发布限制

Dashboard 不能把 internal smoke 展示成公开 benchmark。

必须分层显示：

| 证据层 | 可发布性 |
|---|---|
| mock | 不可发布 |
| unit | 不可发布 |
| integration | 内部 |
| replay | 内部或开发文档 |
| live provider | 可描述 |
| real benchmark | 可发布，但必须附 raw evidence |

---

## 13. 执行路线

### Stage 0：冻结新功能

目标：防止继续加功能导致不可控。

允许：

- training schema。
- exporter。
- validator。
- scorer。
- replay。
- dashboard。

禁止：

- 新工具。
- 新 Agent 团队模式。
- 新 prompt 大段规则。
- 未经验证的自动主链阻断。

验收：

```text
新增代码只在 src/dsxu/training、scripts/dsxu-training-*、docs/generated 范围内。
```

### Stage 1：Schema + Exporter

验收命令：

```text
bun test src/dsxu/training/__tests__/schema.test.ts
bun test src/dsxu/training/__tests__/exporter.test.ts
bun run scripts/dsxu-training-export.ts --dry-run
```

硬门：

| 指标 | 标准 |
|---|---:|
| schema valid | 100% |
| source body stored | 0 |
| secret stored | 0 |
| exporter crash affects mainline | 0 |

### Stage 2：Validator

验收命令：

```text
bun test src/dsxu/training/__tests__/validator.test.ts
bun run scripts/dsxu-training-validate.ts --input .dsxu/training --strict
```

硬门：

| 指标 | 标准 |
|---|---:|
| false pass rejected | 100% |
| oracle leak rejected | 100% |
| stale edit rejected | 100% |
| agent fake pass rejected | 100% |

### Stage 3：Scorer

验收命令：

```text
bun test src/dsxu/training/__tests__/scorer.test.ts
bun run scripts/dsxu-training-score.ts --input .dsxu/training
```

硬门：

| 条件 | 标准 |
|---|---:|
| false pass caps score | <= 80 |
| public claim caps score | <= 80 |
| oracle leak caps score | <= 70 |

### Stage 4：Golden Dataset

验收命令：

```text
bun run scripts/dsxu-training-validate.ts --input docs/training/golden --strict
bun run scripts/dsxu-training-score.ts --input docs/training/golden
```

硬门：

| 指标 | 标准 |
|---|---:|
| golden count | 60 |
| schema pass | 60/60 |
| seeded blockers rejected | 100% |
| expected score range matched | 100% |

### Stage 5：Replay + Ablation

验收命令：

```text
bun run scripts/dsxu-training-replay.ts --suite core-300
bun run scripts/dsxu-training-ablation.ts --suite core-300
```

硬门：

| 指标 | 标准 |
|---|---:|
| false pass | 0 |
| long task resume | >= 85% |
| invalid tool call | <= 5% |
| cost bounded | <= baseline * 1.2 |

### Stage 6：V2 Dataset

验收：

| 项目 | 标准 |
|---|---:|
| trajectory | >= 980 |
| preference pairs | >= 2000 |
| Gold ratio | >= 60% |
| Rejected reason coverage | >= 95% |
| hard gate violation in Gold | 0 |

### Stage 7：Training / Policy

进入条件：

- Stage 1-6 全部通过。
- false pass 为 0。
- replay 有正向提升。
- 数据分级稳定。

优先顺序：

```text
router policy
few-shot pack
runtime validator tuning
SFT
DPO
```

---

## 14. 不能偷懒清单

以下任何一种都不能算完成：

- 只有文档，没有测试。
- 只有 mock，没有 seeded negative。
- 只有成功样本，没有失败样本。
- 只有命中率，没有 SEES。
- 只有 internal smoke，没有 raw evidence。
- 只有 prompt，没有 runtime event。
- 只有 Agent 自称 PASS，没有父级证据检查。
- 只有导出，没有 validator。
- 只有 validator，没有 rejected 样本。
- 只有 20 条样本就开始微调。

---

## 15. 最终硬验收

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
| Gold hard gate violation | 0 |
| source body leak | 0 |
| secret leak | 0 |

---

## 16. 最终判断

V1 文档是基础轨道。

这份 V2 总规划才是完整闭环：

```text
数据采集
-> 数据校验
-> 数据评分
-> 数据分级
-> replay/ablation
-> preference pairs
-> policy / SFT / DPO
-> dashboard
-> 真实任务继续采集
```

如果 DSXU 要达到高级程序员 90%+ 体验，必须做这个数据飞轮。

否则继续加功能，只会让系统越来越复杂，但 DeepSeek 仍然不会真正学会 DSXU 的工作流。

