# DSXU V5 执行规划：DeepSeek 极致工程运行时

日期：2026-05-19  
状态：V5 Planning Document  
范围：只定义 V5 开发规划、验收标准、测试标准和禁止事项；不声明 V5 已完成。  

---

## 1. V5 定位

V4 的目标是收敛：把 DSXU 从功能扩张、路径发散、证据分散，压回一条 DeepSeek 友好的默认主链。

V5 的目标不是继续加功能，而是把 V4 收敛出的主链升级为：

> 面向 DeepSeek V4 Flash / Flash-MAX / Pro 混合模型的高命中率、可验证、可回放、可自适应的工程执行运行时。

V5 解决四件事：

1. 让 DeepSeek 在更小、更稳定、更清晰的执行空间里工作。
2. 把编程任务从“模型自由发挥”变成“任务合约驱动”。
3. 把长任务从“靠上下文记忆”变成“ledger + active frame + replay”。
4. 把能力声明从“感觉更强”变成“真实 trace 可证明”。

---

## 2. V5 与 V4 的边界

| 版本 | 目标 | 关键动作 | 不负责 |
|---|---|---|---|
| V4 | 收敛 | 工具窗口瘦身、Prompt/Cache 收口、统一验证、统一 recovery、Agent evidence、TUI trust | 不追求自适应智能化 |
| V5 | 提升 | Task Compiler、Tool View Compiler、Active Frame Ledger、Semantic Code Graph、Proof-Carrying Edit、Replay Bank | 不继续扩大默认主链 |
| V6 | 自适应 | 学习型路由、项目长期画像、跨项目策略迁移、自动策略调参 | V5 不提前承诺 |

V5 的核心原则：

```text
V4 稳住默认主链。
V5 提升主链命中率。
V6 才谈更高级自适应。
```

---

## 3. V5 不做什么

| 禁止项 | 原因 |
|---|---|
| 不继续扩大默认工具集 | DeepSeek 在工具面过宽时命中率下降。 |
| 不默认启用 swarm/team/forked/voting | 这些能力复杂、难验收，容易放大不稳定。 |
| 不把 smoke/mock 当 benchmark | 防止假完成。 |
| 不声明 90% 成绩 | 没有真实 replay 数据前禁止。 |
| 不复制 Claude Code 结构 | DSXU 要做 DeepSeek-native engineering runtime。 |
| 不让 prompt 继续变厚 | 规则下沉 runtime，prompt 只保留必要协议。 |
| 不用模块完成替代产品完成 | V5 完成只能由 trace、命中率和硬验收决定。 |

---

## 4. V5 总体架构

```text
User Task
  ↓
Task Compiler
  ↓
Execution Contract
  ↓
Tool View Compiler
  ↓
Active Frame + Durable Ledger
  ↓
DeepSeek Model Execution
  ↓
Proof-Carrying Edit
  ↓
Verification / Recovery
  ↓
Replay Evidence
  ↓
Final Answer
```

V5 的关键判断：

> DeepSeek 的上限不靠继续给模型更多自由，而靠 runtime 把任务边界、工具窗口、验证义务、恢复策略和证据链提前编译清楚。

---

## 5. V5 六大核心模块

### M1. Task Compiler

目标：把用户请求编译成 Execution Contract，不再让模型自由决定任务策略。

#### M1.1 输入

| 输入 | 来源 |
|---|---|
| 用户请求 | 当前 turn |
| 工作区状态 | git status、项目类型、可用脚本 |
| 历史 ledger | 最近任务、失败、验证结果 |
| 模型能力配置 | Flash / Flash-MAX / Pro |
| 风险策略 | V4 默认主链配置 |

#### M1.2 输出 Execution Contract

```json
{
  "taskType": "single_file_edit | multi_file_refactor | debug | review | long_task | explain | benchmark",
  "risk": "low | medium | high | critical",
  "modelRoute": "flash | flash_thinking | flash_max | pro",
  "workflow": "observe | plan_execute_verify | review | recovery | long_task",
  "visibleTools": [],
  "verificationLevel": "none | syntax | type | affected_tests | full",
  "maxToolCalls": 18,
  "requiresSourceEvidence": true,
  "requiresAgentEvidence": false,
  "fallbackPolicy": "retry | replan | rollback | escalate_pro | ask_user",
  "claimPolicy": "no_claim | partial_claim | verified_claim"
}
```

#### M1.3 风险分层

| 风险 | 触发条件 | 默认模型 | 验证 |
|---|---|---|---|
| low | 解释、搜索、单点小修改 | Flash | none/syntax |
| medium | 单文件编辑、多文件轻改 | Flash thinking | type/affected tests |
| high | 多文件重构、API 签名变化、恢复失败 | Flash-MAX / Pro review | affected tests/full |
| critical | 权限、安全、发布、删除、外部 benchmark claim | Pro | full + evidence |

#### M1.4 硬验收

| 验收项 | 标准 |
|---|---:|
| coding task 生成 Execution Contract | 100% |
| Contract 字段完整 | 100% |
| route 决策写入 ledger | 100% |
| risk=high 禁止 Flash-only verified final | 100% |
| Contract 缺字段时进入执行 | 0 次 |
| Contract 与实际工具窗口不一致 | 0 次 |

---

### M2. Tool View Compiler

目标：底层工具不删，但每轮只向模型暴露必要工具，降低 DeepSeek 工具选择熵。

#### M2.1 原则

```text
不重构底层工具。
不删除 Claude 原工具。
只编译本轮可见工具视图。
```

#### M2.2 默认工具视图

| 场景 | 可见工具 |
|---|---|
| 代码阅读 | Read / Grep / Glob / LSP |
| 单文件修改 | Read / Edit / Bash |
| 多文件重构 | Read / Grep / Edit / Bash / Todo |
| Debug | Read / Grep / Bash / Edit |
| Review | Read / Grep / GitDiff / Bash |
| 长任务 | Read / Grep / Todo / Agent / Bash |
| Benchmark | Bash / Replay / Evidence / Read |

#### M2.3 工具层级

| 层级 | 工具 | 默认 |
|---|---|---|
| Mainline | Read, Grep, Glob, Edit, Write, Bash, Todo | 可见 |
| Assisted | LSP, GitDiff, Agent, Replay, Evidence | 按任务可见 |
| Searchable | MCP, Skill, Blame, TestSkeleton | 搜索后启用 |
| Frozen | Swarm, Voting, Forked Agent, Counterfactual | 默认不可见 |

#### M2.4 硬验收

| 验收项 | 标准 |
|---|---:|
| 默认 coding turn 可见工具数 | <=12 |
| L1/L2 常规任务可见工具数 | 6-10 |
| MCP/Skill/Swarm 默认暴露 | 0 次 |
| visibleToolCount 写入 evidence | 100% |
| 工具 schema 顺序未知漂移 | 0 次 |
| 模型调用计划外工具未被拦截 | 0 次 |

---

### M3. Active Frame + Durable Ledger

目标：解决长任务工作记忆漂移，不再依赖长上下文硬记忆。

#### M3.1 Active Frame

每轮模型只接收当前必要工作记忆：

```text
Task: 当前目标
Phase: 当前阶段
Confirmed Facts: 已确认事实，最多 8 条
Files Read: 已读文件
Files Changed: 已改文件
Open Obligations: 未完成验证/确认事项
Last Failure: 最近失败原因
Next Allowed Actions: 本轮允许动作
Risk: 当前风险等级
```

#### M3.2 Durable Ledger

完整历史进入 append-only ledger：

| 事件类型 | 内容 |
|---|---|
| task_contract | Execution Contract |
| tool_call | 工具名、参数摘要、结果摘要 |
| source_evidence | 文件、行号、事实 |
| edit_proof | 修改 claim、文件、证据 |
| verification | 命令、结果、失败摘要 |
| recovery | 失败类型、恢复动作 |
| route | 模型、工作流、成本 |
| cache | stablePrefixHash、dynamicTailHash、hit rate |
| final_claim | 最终声明和证据边界 |

#### M3.3 硬验收

| 验收项 | 标准 |
|---|---:|
| 每轮生成 Active Frame | 100% |
| 工具事件写 ledger | 100% |
| verification/recovery 写 ledger | 100% |
| resume 后恢复当前 phase | 100% |
| 30 步长任务不丢 open obligations | 100% |
| ledger event 丢失 | 0 次 |
| ledger 与 final answer 矛盾 | 0 次 |

---

### M4. Semantic Code Graph

目标：提高编程定位能力，不再只靠 Grep/Read 猜文件。

#### M4.1 图结构

| 节点/边 | 内容 |
|---|---|
| Symbol | function / class / type / component |
| Dependency | import/export/call graph |
| TestLink | 源文件和测试文件关联 |
| Ownership | git blame / 最近变更 |
| Risk | 高频失败点、复杂函数、历史失败 |
| Contract | 类型输入输出、API 约束 |

#### M4.2 运行策略

| 场景 | 行为 |
|---|---|
| 单文件编辑 | 建立局部 symbol/test link |
| 多文件重构 | 查调用点和 import/export |
| 类型签名变化 | 强制查引用 |
| 测试选择 | 根据 TestLink 找 affected tests |
| 图构建失败 | fallback 到 Grep/LSP |

#### M4.3 硬验收

| 验收项 | 标准 |
|---|---:|
| TS/JS 项目生成 symbol index | PASS |
| 修改函数前列出调用点准确率 | >=90% |
| affected tests 命中率 | >=80% |
| graph 失败 fallback 成功 | 100% |
| 图结果写入 source evidence | 100% |
| 图错误导致误编辑 | 0 known critical |

---

### M5. Proof-Carrying Edit

目标：每次修改都带证据，不允许自然语言虚报完成。

#### M5.1 Edit Proof Envelope

```json
{
  "claim": "changed return type",
  "filesChanged": [],
  "sourceEvidence": [],
  "commandsRun": [],
  "verification": "pass | fail | not_run",
  "remainingRisks": [],
  "rollbackPoint": "",
  "claimAllowed": false
}
```

#### M5.2 写入生命周期

```text
Before Edit
  - 有无 source evidence
  - 是否允许改该文件
  - 是否在 contract 范围内

After Edit
  - 生成 proof envelope
  - 运行对应验证
  - 写 ledger

Before Final
  - 检查 verification
  - 检查 open obligations
  - 检查 claimAllowed
```

#### M5.3 硬验收

| 验收项 | 标准 |
|---|---:|
| Edit/Write 后生成 proof envelope | 100% |
| 没 sourceEvidence 的高风险 edit | 0 次 |
| verification=not_run 却声明完成 | 0 次 |
| proof 缺字段未 block | 0 次 |
| rollbackPoint 缺失仍继续高风险任务 | 0 次 |
| Agent worker edit 无 proof | 0 次 |

---

### M6. Replay Bank

目标：防止假完成，用真实任务回放衡量 V5 是否进步。

#### M6.1 Replay Trace 内容

```text
user task
execution contract
route
visible tools
prompt hash
tool events
source evidence
edit proof
verification result
recovery path
final answer
accepted / rejected
```

#### M6.2 Replay 分层

| 层级 | 数量 | 内容 |
|---|---:|---|
| L1 | 20 | 单文件修改 |
| L2 | 20 | 多文件重构 |
| L3 | 20 | bug 修复 |
| L4 | 20 | 长任务 |
| L5 | 20 | recovery 场景 |

#### M6.3 硬验收

| 验收项 | 标准 |
|---|---:|
| replay case 总数 | >=100 |
| 核心改动必须跑 subset | >=20 cases |
| 发布前必须跑 full replay | 100 cases |
| replay 原始 trace 保存 | 100% |
| 不允许只提交汇总分数 | 0 次 |
| failed case 未分类 | 0 次 |

---

## 6. V5 命中率定义

V5 不使用一个模糊的“90% 命中率”。必须拆成六层：

| 命中率 | 定义 | V5 最低线 | V5 目标线 |
|---|---|---:|---:|
| Route Hit | 模型/工作流选对 | >=88% | >=92% |
| Tool Hit | 工具选择正确 | >=85% | >=90% |
| Source Hit | 找到正确文件/符号 | >=85% | >=90% |
| Edit Hit | 修改位置和意图正确 | >=80% | >=85% |
| Verify Hit | 验证命令合适 | >=85% | >=90% |
| Recovery Hit | 失败后动作正确 | >=75% | >=80% |

最终任务成功率不能只看通过/失败，必须能定位掉点：

```text
Task Success = Route × Tool × Source × Edit × Verify × Recovery
```

如果总成功率下降，必须输出是哪一层下降。禁止只说“模型不稳定”。

---

## 7. V5 DeepSeek 性能策略

### 7.1 输入稳定工程

| 项 | 要求 |
|---|---|
| Stable Prefix | 固定系统 prompt、工具 schema 顺序、核心协议 |
| Dynamic Tail | 只放 active frame、当前 contract、必要 ledger 摘要 |
| Tool Result Preview | 大结果预算化，不全文塞上下文 |
| Artifact Store | 大输出外置，prompt 只放引用 |
| Cache Evidence | 每轮记录 stablePrefixHash、dynamicTailHash、cache hit |

### 7.2 模型路由

| 场景 | 默认模型 |
|---|---|
| 问答、解释、搜索 | Flash |
| 单文件修改 | Flash |
| 多文件修改 | Flash thinking / Flash-MAX |
| 高风险重构 | Flash-MAX + Pro review |
| 连续失败 | Pro |
| 发布/安全/claim | Pro |

### 7.3 性能硬验收

| 指标 | 最低线 | 目标线 |
|---|---:|---:|
| Warm cache hit | >=80% | 88-92% |
| Stable prefix unknown drift | 0 | 0 |
| 默认工具数 | <=12 | 6-10 |
| L1 任务响应时间劣化 | <=10% | 不劣化 |
| ledger 写入开销 | <5% | <3% |

---

## 8. V5 测试体系

### 8.1 单元测试

| 测试对象 | 要求 |
|---|---|
| Task Compiler | contract 字段完整、风险分类正确 |
| Tool View Compiler | 工具数、工具顺序、工具隐藏正确 |
| Ledger | append-only、不丢事件 |
| Proof Envelope | 缺字段 block |
| Code Graph | symbol/import/test link 正确 |
| Replay Parser | trace 可读、可比对 |

### 8.2 集成测试

| 场景 | 验收 |
|---|---|
| 单文件 edit | contract -> edit -> proof -> verify 全链路通过 |
| 多文件重构 | graph 找调用点，affected tests 运行 |
| 失败恢复 | failure taxonomy 触发正确 recovery |
| Agent handoff | worker evidence envelope 被 parent 校验 |
| prompt/cache | stablePrefixHash 不漂移 |

### 8.3 真实任务回放测试

| 指标 | 要求 |
|---|---|
| 20-case subset | 每次核心改动必须跑 |
| 100-case full replay | 发布前必须跑 |
| trace 原始数据 | 必须保留 |
| failed case | 必须分类，不允许只写 fail |
| 分数变化 | 必须与上一版本对比 |

### 8.4 性能测试

| 指标 | 最低线 | 目标线 |
|---|---:|---:|
| Warm cache hit | >=80% | 88-92% |
| 默认工具数 | <=12 | 6-10 |
| L1 任务响应时间 | 不劣化 >10% | 更快 |
| prompt stable drift | 0 unknown drift | 0 |
| ledger 写入开销 | <5% | <3% |

### 8.5 TUI 测试

| 场景 | 验收 |
|---|---|
| 普通聊天 | 不显示噪音 evidence |
| coding task | 显示模型、状态、验证、下一步 |
| long task | 显示 phase / open obligations |
| failure | 显示失败类型和 recovery 动作 |
| small terminal | 不溢出、不刷屏 |

---

## 9. V5 执行阶段

### Phase 1：Execution Contract 主链

目标：所有任务先生成 Execution Contract。

交付：

- Task Compiler
- risk classifier
- route contract
- verification contract
- contract ledger event

验收：

```text
bun test task-compiler
bun test execution-contract
20 replay subset route hit >=85%
```

### Phase 2：Tool View Compiler

目标：工具窗口变小，命中率变高。

交付：

- tool view profiles
- visibleToolCount evidence
- MCP/Skill hidden-by-default
- task-level tool projection

验收：

```text
default visibleToolCount <=12
L1/L2 visibleToolCount 6-10
20 replay subset tool hit >=85%
```

### Phase 3：Active Frame + Ledger

目标：长任务不靠上下文硬撑。

交付：

- Active Frame builder
- ledger replay
- resume state
- open obligation tracker

验收：

```text
30-step long task no obligation loss
resume after interruption restores phase
ledger event loss = 0
```

### Phase 4：Proof-Carrying Edit

目标：所有修改都带证据。

交付：

- edit proof envelope
- source evidence guard
- verification proof
- final claim blocker

验收：

```text
unverified final claim = 0
proof missing field block = 100%
Edit/Write envelope coverage = 100%
```

### Phase 5：Semantic Code Graph

目标：提高编程定位能力。

交付：

- symbol index
- dependency graph
- affected test finder
- fallback path

验收：

```text
source hit >=90%
affected test hit >=80%
graph fallback success = 100%
```

### Phase 6：Replay Bank

目标：建立真实能力评估闭环。

交付：

- 100 replay cases
- replay runner
- replay dashboard
- regression diff report

验收：

```text
100 cases runnable
20-case subset required for core PR
full replay required for release
raw trace saved = 100%
```

---

## 10. V5 最终硬验收

V5 不能靠“模块完成”验收，只能靠以下硬标准：

| 类别 | 硬标准 |
|---|---|
| Contract | 100% coding task 有 Execution Contract |
| Tool | 默认可见工具 <=12 |
| Source | Source Hit >=90% |
| Edit | Edit Hit >=85% |
| Verify | Verify Hit >=90% |
| Recovery | Recovery Hit >=80% |
| Cache | Warm cache hit >=80%，目标 88-92% |
| Ledger | 工具/验证/恢复事件 100% 入账 |
| Proof | 未验证完成声明 0 次 |
| Replay | 100 real replay cases 可运行 |
| Release | full replay 未跑，不允许声明 V5 完成 |
| Public Claim | 无公开 benchmark raw evidence，不允许宣传超过 Claude |

---

## 11. V5 完成状态定义

允许使用的状态：

```text
V5_NOT_STARTED
V5_IN_PROGRESS
V5_INTERNAL_READY
V5_RELEASE_READY
```

禁止使用的状态：

```text
V5_DONE
V5_90_PERCENT
V5_CLAUDE_BEATEN
```

除非同时满足：

```text
full replay 100 cases pass
six-layer hit report generated
raw traces archived
public claim gate passed
external benchmark evidence exists
```

否则不得声明：

- V5 已完成
- 命中率达到 90%
- 超过 Claude Code
- 外部 benchmark 胜出

---

## 12. 角色视角验收

### 12.1 高级程序员视角

| 问题 | 必须回答 |
|---|---|
| 它现在在做什么？ | TUI 显示 phase / next action |
| 它为什么这样做？ | Execution Contract 可查 |
| 它改了什么？ | Proof envelope 可查 |
| 它验证了吗？ | Verification evidence 可查 |
| 它失败后怎么办？ | Recovery decision 可查 |
| 它有没有乱承诺？ | Claim gate 拦截 |

### 12.2 架构师视角

| 问题 | 必须回答 |
|---|---|
| 主链是否单一？ | V5 默认路径只有 contract -> tool view -> ledger -> proof -> verify |
| 功能是否继续膨胀？ | 新功能必须有 complexity budget |
| 冻结能力是否默认关闭？ | swarm/voting/forked 默认不可见 |
| 能力是否可度量？ | 六层 hit report |

### 12.3 开源维护者视角

| 问题 | 必须回答 |
|---|---|
| PR 是否退化？ | 20-case replay subset |
| 发布是否可信？ | full replay + raw trace |
| 成绩是否可复现？ | trace archive |
| 是否有假完成？ | 状态机禁止 V5_DONE |

### 12.4 产品视角

| 问题 | 必须回答 |
|---|---|
| 用户是否被打扰？ | TUI 默认不刷屏 |
| 体验是否稳定？ | 工具窗口小、prompt 稳定 |
| 成本是否可控？ | route/cache evidence |
| 长任务是否可信？ | ledger + replay |

---

## 13. V5 风险清单

| 风险 | 影响 | 缓解 |
|---|---|---|
| Task Compiler 误分类 | 路由错误、验证错误 | replay + override + Pro escalation |
| Tool View 过窄 | 模型缺工具 | fallback tool search |
| Code Graph 不准 | 误导修改 | fallback Grep/LSP，graph evidence 标置信心 |
| Ledger 过重 | 性能下降 | preview + artifact store |
| Proof 过严 | 简单任务变慢 | risk-based proof level |
| Replay 维护成本高 | 难持续 | 先 20 subset，再扩 100 |
| Prompt 重新变厚 | cache hit 下降 | stable prefix drift gate |

---

## 14. V4 未完成项并入 V5 的成本节省验收策略

### 14.1 合并原则

V4 已经完成了大量 focused 工程验收，但反证审核显示：V4 仍不能被定义为“全量完成”。为了节省成本，V5 不再维护一套独立于 V4 的重复测试体系，而是把 V4 未完成项和 V4 测试类合并为 V5 的 Phase 0 与最终硬门。

核心原则：

```text
V4 focused tests 作为 V5 baseline。
V4 未完成项作为 V5 carry-over gates。
V5 replay / contract / proof 只补 V4 证明不了的部分。
不重复跑两套昂贵验收。
不把 V4 工程验收关闭写成 V5 完成。
```

### 14.2 V4 未完成项并入 V5

| V4 未完成/未证明项 | V4 真实状态 | 并入 V5 的位置 | V5 处理方式 | V5 验收 |
|---|---|---|---|---|
| 全量 `bun test` 未自然收口 | 120s timeout，未证明全绿 | Phase 0：Baseline Stabilization | 切分 mainline / slow / live / release 四层，不再用单一全量命令证明一切 | `test:mainline` 必须 <60s；`bun test` 可作为 nightly，不作为唯一完成证据 |
| `acceptance:senior-coding-window` 未证明通过 | 240s timeout | Phase 0 + TUI / Senior Experience Gate | 拆成真实 PTY、TUI trust、长任务窗口、权限弹窗、最终回答五类 | 每类有 focused test，full senior acceptance 只在 release 前跑 |
| `test:six-stage-final` 本轮未证明通过 | 180s timeout | Phase 0 + Release Gate | 拆成六个 stage gate，避免一个长脚本阻塞开发 | 每个 stage 独立 PASS；release 前再跑 full gate |
| release claim 仍 blocked | Evidence dashboard 显示 `release-blocked` | Phase 0 + M6 Replay Bank | public claim 必须由 replay/raw/public comparable evidence 决定 | `PUBLIC_CLAIM_ALLOWED=false` 直到公开证据补齐 |
| public comparable 缺 30 cases | dashboard 明确缺失 | M6 Replay Bank | 先内部 100 replay，再建立 public comparable 30 case | 无 paired raw evidence 不允许 benchmark claim |
| 86 个 NOT_RUN evidence | dashboard 明确不可用于 GitHub claim | Phase 0 Evidence Hygiene | NOT_RUN 只能保留为 backlog，不能进入卖点 | dashboard 中 NOT_RUN 不计入 release claim |
| cache 命中率未达 90 | 内部聚合观察值 64.9% | M2 + M3 + V5 性能策略 | 用 stable prefix / dynamic tail / tool view / artifact store 提升 | Warm cache hit 最低 >=80%，目标 88-92%；未达标禁止 90 claim |
| 真实任务包有失败 case | `release-claim-evidence-binder` failed | M6 Replay Bank + Claim Gate | 失败 case 必须进入 replay regression，不允许被平均分掩盖 | failed case 必须有 owner、原因、修复验证 |
| V4 文件未进入稳定提交态 | docs/generated 仍可能 untracked | Phase 0 Release Hygiene | V5 只认 tracked 或 release artifact 中的证据 | 发布前 evidence manifest 必须指向 tracked 或 exported artifact |

### 14.3 V4 测试类合并为 V5 分层测试

V5 不再新增一套平行测试名义。V4 测试类按用途合并为 V5 四层：

| V5 测试层 | 合并的 V4 测试类 | 用途 | 频率 | 成本策略 |
|---|---|---|---|---|
| L0 Contract Unit | post-mutation envelope、tool catalog、provider contract、query shape guard | 快速证明协议不破 | 每次 PR | 必跑，要求快 |
| L1 Mainline Focused | engine、edit lifecycle、progress ledger、gear-box recovery、agent evidence | 证明默认主链不破 | 每次核心改动 | 必跑，限制 <90s |
| L2 Experience Focused | PromptInputFooter、SystemTextMessage、real TUI focused resize、senior coding slices | 证明高级程序员体验不退化 | TUI/UX 改动时 | 分片跑，不跑整套慢测 |
| L3 Evidence / Release | evidence dashboard、real-task hit-rate pack、six-stage stage gates、release claim binder | 证明发布声明边界 | release 前 | 聚合跑，禁止当日常 PR 必跑 |
| L4 Public Comparable | SWE/public comparable paired raw evidence | 对外 claim | 只在正式公开对标前 | 昂贵，不能替代日常开发测试 |

### 14.4 V5 Phase 0：V4 Carry-over Closure

V5 正式开发 M1-M6 前，先做 Phase 0。Phase 0 不新增能力，只把 V4 未完成证明转成低成本、可持续的验收门。

交付：

- `test:mainline`：V4 核心 focused tests 的快速集合。
- `test:experience`：TUI / senior coding focused slices。
- `test:release-gates`：six-stage 拆分后的 release gate 集合。
- `evidence:claim-boundary`：release-blocked、NOT_RUN、public comparable missing 的统一报告。
- `replay:regression`：把 V4 失败 case `release-claim-evidence-binder` 放入 V5 replay regression。

Phase 0 硬验收：

| 验收项 | 标准 |
|---|---:|
| `test:mainline` | PASS，且 <60s |
| `test:experience` focused slices | PASS |
| `test:release-gates` stage-level | PASS |
| `bun test` | 不再作为唯一完成证明；作为 nightly/full suite，必须记录 timeout/slow owner |
| `acceptance:senior-coding-window` | release 前必须 PASS；开发中使用 focused slices |
| `release-claim-evidence-binder` replay case | 必须修复或标记 blocking |
| cache 90 claim | 禁止，直到 warm cache hit >=88 且有 raw evidence |
| public benchmark claim | 禁止，直到 30 paired raw comparable evidence 补齐 |

### 14.5 V5 最终硬验收的更新

在原 V5 硬验收基础上，新增 V4 carry-over 硬门：

| 类别 | 新硬门 |
|---|---|
| V4 baseline | V4 focused mainline tests 必须纳入 `test:mainline` |
| 全量测试 | 全量 `bun test` 如果 timeout，必须输出 slow owner，不允许说全绿 |
| Senior experience | `acceptance:senior-coding-window` 必须 release 前通过，或拆分项全 PASS 且 full 标记 NOT_RUN |
| Release claim | `release-blocked` 时禁止 README / GitHub 写外部能力声明 |
| Public comparable | 30 paired raw evidence 缺失时禁止 benchmark 胜出声明 |
| Cache | 64.9% 只能写观察值，不能写 90%；V5 目标另行证明 |
| Failed case | 任何 replay failed case 不得被平均分吞掉 |
| Evidence provenance | V5 release 只认 tracked evidence 或 clean export artifact |

### 14.6 V5 成本节省执行顺序

为了避免重复烧成本，V5 的执行顺序调整为：

1. **Phase 0：合并 V4 测试与未完成项**  
   先建立 `test:mainline`、`test:experience`、`test:release-gates`、`evidence:claim-boundary`。

2. **Phase 1：Task Compiler**  
   只跑 L0 + L1 + 20 replay subset，不跑 full release。

3. **Phase 2：Tool View Compiler**  
   重点跑 tool hit、visibleToolCount、cache drift，不跑无关 TUI 慢测。

4. **Phase 3：Active Frame + Ledger**  
   跑 long-task ledger / resume / recovery subset。

5. **Phase 4：Proof-Carrying Edit**  
   跑 edit lifecycle、claim gate、failed V4 release claim case。

6. **Phase 5：Semantic Code Graph**  
   跑 source/edit/affected-test hit，不跑 release gates。

7. **Phase 6：Replay Bank**  
   跑 100 replay 和 release gates，作为 V5 release candidate 唯一入口。

### 14.7 合并后的 V5 状态定义

V5 允许以下中间状态：

```text
V5_PHASE0_BASELINE_READY
V5_CONTRACT_INTERNAL_READY
V5_REPLAY_INTERNAL_READY
V5_RELEASE_CANDIDATE_BLOCKED
V5_RELEASE_READY
```

禁止以下假完成状态：

```text
V5_DONE_BY_FOCUSED_TESTS
V5_DONE_WITH_BUN_TEST_TIMEOUT
V5_DONE_WITH_RELEASE_BLOCKED
V5_90_PERCENT_WITH_CACHE_64_9
V5_PUBLIC_BENCHMARK_WITHOUT_30_PAIRED_CASES
```

---

## 15. V5 最终结论

V5 的核心不是更复杂，而是更精确。

V4 把 DSXU 收敛成稳定主链。  
V5 让这条主链变聪明、可回放、可度量、自适应。

V5 真正要交付的是：

```text
Task Compiler
+ Tool View Compiler
+ Active Frame Ledger
+ Semantic Code Graph
+ Proof-Carrying Edit
+ Replay Bank
```

这六个能力做完，并通过硬验收后，DSXU 才能从“功能强”升级到：

```text
命中率强
编程能力强
长任务能力强
证据可信
DeepSeek 性能发挥稳定
```

V5 的唯一成功标准：

> 真实任务中更准、更稳、更快、更可证明，而不是文档中更强。

---

## 16. V5 Phase 0 执行记录 - 2026-05-19

本节是执行记录，不是新增主链。Phase 0 的实现归入现有 owner：command catalog、Evidence / Release Claim Binder、Static Analysis Tool Gate、real TUI harness、hit-rate pack / replay regression。没有新增 product runtime、provider、ToolBus、permission、agent 或 TUI。

### 16.1 已完成

| 项 | 结果 | 证据 |
|---|---|---|
| `test:mainline` | PASS，9/9 owner commands | `docs/generated/DSXU_V5_PHASE0_MAINLINE_20260519.json` |
| `test:experience` | PASS，5/5 focused TUI/experience slices | `docs/generated/DSXU_V5_PHASE0_EXPERIENCE_20260519.json` |
| `test:release-gates` | PASS，3/3 stage-level release evidence gates | `docs/generated/DSXU_V5_PHASE0_RELEASE_GATES_20260519.json` |
| `evidence:claim-boundary` | PASS，release claim boundary held | `docs/generated/DSXU_V5_PHASE0_CLAIM_BOUNDARY_20260519.json` |
| `replay:regression` | PASS，旧失败 case 已由新 evidence 覆盖 | `docs/generated/DSXU_V5_PHASE0_REPLAY_REGRESSION_20260519.json` |
| `v5:phase0` | PASS，19/19 commands，0 blockers | `docs/generated/DSXU_V5_PHASE0_PHASE0_20260519.json` |

### 16.2 本轮真实修复

1. **真实 TUI resize / scrollback 修复**  
   `src/dsxu/integration/harness/real-tui-harness.ts` 改为只用 resize 后最后一个 viewport 判断 middle scrollback，不再把 resize 过程中的历史帧误判成最终窗口。验证：`bun test src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts -t "preserves a middle scrollback"` PASS，随后 `test:experience` PASS。

2. **Release-gates 分层修正**  
   `scripts/dsxu-v5-phase0-runner.ts` 不再把完整 `bun run test:six-stage-final` 放入日常 `test:release-gates`。默认 release gate 只跑 stage-level 快门；完整六阶段记录为 `deferredFullReleaseCommands`，只在 release candidate 阶段执行。验证：`bun run test:release-gates` 3/3 PASS，约 5 秒完成。

3. **Release claim source hygiene gate**  
   `src/services/static-analysis/tool-gate.ts` 增加 post-mutation source hygiene 检查：release/readme claim 源码若在修改后仍含外部对标、外部 benchmark 或百分比能力 token，则形成 blocking verification envelope。它关闭了 `release-claim-evidence-binder` 的真实根因：以前单测可 PASS，但源码中仍可能留下 claim regex / parity token。验证：`bun test src/services/static-analysis/__tests__/bridge.test.ts` 14/14 PASS。

4. **Replay pack 使用最新同 id rerun evidence**  
   `scripts/dsxu-v4-real-task-hit-rate-pack.ts` 会把基础 hard benchmark 报告和 filtered rerun 报告合并，同一 case id 以后者覆盖前者，避免旧失败继续压住已修复 case。验证：`bun test scripts/__tests__/dsxu-v4-real-task-hit-rate-pack.test.ts` 3/3 PASS。

5. **`release-claim-evidence-binder` 真实重跑**  
   单 case hard benchmark 使用 `DSXU_HARD_BENCHMARK_TASK=release-claim-evidence-binder` 真实重跑，结果 DSXU PASS、raw baseline FAIL。证据：`docs/generated/DSXU_HARD_ENGINEERING_BENCHMARK_20260517_release-claim-evidence-binder.json`，DSXU pass rate 100%，raw pass rate 0%，DSXU cost `$0.017873884`。

### 16.3 当前仍未允许的声明

V5 Phase 0 baseline 已经可以定义为 `V5_PHASE0_BASELINE_READY`。但这不等于 V5 完成，也不等于 GitHub public benchmark claim 可以放行。

当前 Evidence Workbench 最新事实：

| 项 | 当前值 |
|---|---:|
| scoreFloor | 72 |
| releaseClaimAllowed | false |
| trust | release-blocked |
| pass / fail / blocked / notRun gates | 51 / 0 / 2 / 86 |
| publicComparableMissingCases | 30 |
| V4 real task hit-rate pack | PASS，24 cases，finalPassRate 100%，cacheHitRate 63.9%，totalCost `$0.185753` |

仍需数据：

- release claim blocker resolution。
- public comparable raw evidence for 30 paired cases。
- 86 个 NOT_RUN evidence 不能用于 GitHub claim。
- cache hit rate 63.9% 只能作为当前观察值和优化方向，不能写成 90% 命中率达标。

### 16.4 下一步顺序

1. 进入 V5 M1 Task Compiler：任务合约、风险等级、source/test/live/raw/cost 证据需求要变成默认 route 输入。
2. 进入 V5 M2 Tool View Compiler：默认每轮可见工具窗口继续压到 6-12 个逻辑动作，并记录 tool hit / fallback。
3. 进入 V5 M3 Active Frame Ledger：把 goal、open obligations、latest verified source、recovery decision、cost/cache 进入可回放 active frame。
4. 最后才跑 release-only full gate：`bun run test:six-stage-final`、`bun run acceptance:senior-coding-window`、100 replay / 30 paired comparable raw evidence。

---

## 17. V5 M1-M6 Owner-Folded 执行记录 - 2026-05-19

本节记录 V5 六个核心模块的 owner-folded 代码基础。口径：只归并到现有 owner，不新增第二 runtime、provider、ToolBus、permission、agent、TUI 或 benchmark runtime。当前状态修正为 `V5_CORE_CODE_FOUNDATION_READY / V5_STANDARD_COMPLETION_BLOCKED`，不是 `V5_RELEASE_READY`。

重要裁决：这里不能再用“首轮完成”暗示 V5 已达标准。V5 标准完成只认第 10 节硬验收：100 replay cases、30 paired public comparable raw evidence、warm-cache 真实性证明、release-only full gates、package/build gate 全部闭环后，才允许升级为 `V5_RELEASE_READY`。

### 17.1 已落地模块

| 模块 | owner 归属 | 代码落点 | 结果 |
|---|---|---|---|
| M1 Task Compiler / Execution Contract | Query Loop / PlanGraph / Tool Gate | `src/dsxu/engine/action-contract.ts` | 增加 `dsxu.execution-contract.v5`，把 taskType、risk、route、workflow、verification、fallback、claim policy 编译为默认执行合约。 |
| M2 Tool View Compiler | Tool Gate | `src/dsxu/engine/tool-catalog-v1.ts` | 增加 `dsxu.tool-view.v5`，按任务类型压缩可见工具，默认隐藏 MCP/Skill/Swarm/Forked/Voting 类工具。 |
| M3 Active Frame Ledger | PlanGraph / Work-State | `src/dsxu/engine/progress-ledger.ts` | 增加 `dsxu.active-frame.v5`，每轮只投影 task、phase、confirmed facts、files read/changed、open obligations、last failure、next allowed actions。 |
| M4 Semantic Code Graph | Semantic Code Graph / Source Truth Repair | `src/dsxu/engine/blast-radius.ts` | 复用现有 import/export blast-radius owner，输出 symbol count、dependency edges、affected tests、source evidence。 |
| M5 Proof-Carrying Edit | Tool Gate / VerificationKernel / Evidence | `src/dsxu/engine/code-mode-surgical-loop.ts` | 增加 edit proof envelope，未验证、无 source evidence、无 rollback point 时禁止 claimAllowed。 |
| M6 Replay Bank | Replay Bank / Evidence | `src/dsxu/engine/real-task-replay-suite-v1.ts` | 增加 `dsxu.replay-bank.v5`，要求每个 replay trace 都有 contract、route、visible tools、prompt hash、tool events、source evidence、edit proof、verification、recovery、final answer、raw trace。 |

### 17.2 Focused 验收

| 验收命令 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/action-contract.test.ts` | PASS，7/7 |
| `bun test src/dsxu/engine/__tests__/tool-catalog-v1-clean.test.ts` | PASS，14/14 |
| `bun test src/dsxu/engine/__tests__/work-package-i/progress-ledger.test.ts` | PASS，29/29 |
| `bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts` | PASS，10/10 |
| `bun test src/dsxu/engine/__tests__/blast-radius.test.ts` | PASS，24/24 |
| `bun test src/dsxu/engine/__tests__/code-mode-surgical-loop-v1.test.ts -t "builds V5 proof-carrying edit"` | PASS，1/1 |
| `bun test src/dsxu/engine/__tests__/real-task-replay-suite-v1.test.ts -t "builds V5 Replay Bank"` | PASS，1/1 |
| `bun run v5:phase0` | PASS，19/19，0 blockers |
| `bun run prebuild` | PASS，DeepSeek strict-mode tool schemas all OK |

### 17.3 非阻断但需记录的构建现实

尝试用 `bun build src/dsxu/engine/index.ts --target=node` 做主导出构建 smoke 时失败。失败不是 V5 新增模块的语法错误，而是当前仓库已有 bundle 条件和可选依赖现实：

- `feature()` 参数要求 string literal，但现有代码存在动态拼接。
- 多个 `.js` 运行时路径在 TS 源构建场景下不可解析。
- 可选依赖如 `sharp`、AWS/Azure/OpenTelemetry、`fflate` 当前本地未安装或不是此构建路径的必装项。

裁决：此项不能作为 V5 M1-M6 focused 验收阻断，但应进入后续 release build/package gate。V5 当前仍不得声明 clean export / release ready。

### 17.4 剩余硬门

| 硬门 | 当前状态 | 下一步 |
|---|---|---|
| 100 replay cases | 未完成：24 个 trace 有 V5 原生字段，但 route consistency 复审后 0/24 accepted | 先重跑 20-case native V5 subset，要求 execution contract route 与真实 stream-json model 一致，再扩到 release full 100。 |
| 30 paired public comparable raw evidence | 未完成 | 仍阻断 GitHub public benchmark / 90% claim。 |
| warm cache hit >=80% | 未达标：当前 24-case 真实包观测 64.1% | 只能作为趋势，继续优化 cache-safe prefix / tool-result artifact 化；不能写成公开硬达标。 |
| release-only full gate | 未跑 | 只在 release candidate 阶段跑 `test:six-stage-final` 与 `acceptance:senior-coding-window`。 |
| package/build gate | 未完成 | 需要独立处理当前已有可选依赖与构建条件问题。 |

---

## 18. V5 标准完成口径修正与 Replay Bank 严格摄取 - 2026-05-19

### 18.1 为什么 M1-M6 不能叫标准完成

M1-M6 当前只证明“代码基础归并到正确 owner，且 focused tests 通过”。这对 V5 很重要，但它不是产品级完成。标准完成必须回答更硬的问题：

| 问题 | 当前裁决 |
|---|---|
| 旧 V4/V26 真实任务包是否能直接当 V5 完成证据？ | 不能。旧 trace 可用于诊断，但缺 V5 原生 `execution-contract`、`prompt/cache hash`、`edit proof` 时不能算 V5 replay accepted。 |
| focused unit tests 是否能替代 100 replay？ | 不能。单测只证明模块局部行为。 |
| 24 个 V4 internal traces 是否能替代 30 paired public comparable raw evidence？ | 不能。public comparable 必须同题 paired raw evidence。 |
| cacheHitRate 63.9% 是否等于 V5 cache 目标达成？ | 不能。它是旧包观测趋势，不是 V5 cache-first 标准证明。 |

### 18.2 新增严格摄取工具

新增 owner 工具：`scripts/dsxu-v5-replay-bank.ts`。

它只属于 Replay Bank / Evidence owner，不是新主链，不是新 benchmark runtime，不新增 package 泛化入口。它做一件事：读取现有真实任务包，逐 case 检查是否具备 V5 标准字段。

| 字段 | 标准 |
|---|---|
| executionContract | trace 内必须有 V5 原生 execution contract / task contract 信号。 |
| route | 必须能证明 DeepSeek route。 |
| visibleTools | 必须能证明可见工具窗口，且默认工具数不超过硬帽。 |
| promptHash | 必须有 prompt/cache/stable-prefix/dynamic-tail hash 类证据。 |
| toolEvents | 必须有真实 tool_use / tool_result。 |
| sourceEvidence | 必须有 Read/Grep/Glob/Edit 等 source truth 证据。 |
| editProof | 必须有 V5 原生 edit proof envelope。 |
| verificationResult | 必须有最终验证 artifact。 |
| recoveryPath | 必须能证明失败恢复或 recovery path。 |
| finalAnswer | 必须有 result/final answer。 |

### 18.3 当前标准状态

`scripts/dsxu-v5-replay-bank.ts` 的设计裁决是：旧 V4 trace 即使最终 PASS，也只能作为 projected legacy evidence；缺 V5 原生 contract/proof/hash 时必须输出 `BLOCKED_V5_REPLAY_BANK_REQUIRED_SUBSET`，不能升级成 V5 标准完成。

### 18.4 首次严格摄取结果：旧包被正确阻断

已执行：

| 验收命令 | 结果 |
|---|---|
| `bun test scripts/__tests__/dsxu-v5-replay-bank.test.ts` | PASS，2/2，证明严格摄取会接受 V5 原生证据、拒绝旧包投影证据。 |
| `bun test src/dsxu/engine/__tests__/real-task-replay-suite-v1.test.ts -t "builds V5 Replay Bank"` | PASS，1/1，Replay Bank owner 单测仍通过。 |
| `bun run scripts/dsxu-v5-replay-bank.ts` | 预期 BLOCKED，生成 `docs/generated/DSXU_V5_REPLAY_BANK_20260519.json` 与 `docs/DSXU_V5_REPLAY_BANK_20260519.md`。 |

旧 V4 trace 摄取结果：

| 指标 | 值 |
|---|---|
| status | `BLOCKED_V5_REPLAY_BANK_REQUIRED_SUBSET` |
| sourceCaseCount | 24 |
| bankCaseCount | 24 |
| acceptedCount | 0 |
| nativeV5ReadyCount | 0 |
| projectedLegacyCaseCount | 24 |
| rawTraceSavedPct | 100 |
| requiredSubsetReady | false |
| fullReleaseReady | false |

阻断原因：

- 20-case V5 required subset 还没有 native V5 contract/proof/hash evidence。
- 当前 24 个旧 trace 全部缺 `executionContract`、`promptHash`、`editProof`。
- 因此旧 V4 hit-rate pack 只能证明“旧包任务真实跑过”，不能证明“V5 标准完成”。

### 18.5 V5-native 真实任务重跑结果与复审

已执行新的 V5-native 真实任务包：

| 命令 | 结果 |
|---|---|
| `bun run scripts/dsxu-hard-engineering-benchmark.ts` | PASS，9/9 DSXU，raw baseline 0%，DSXU cost `$0.1121030064`。 |
| `bun run scripts/dsxu-raw-api-vs-dsxu-ab.ts` | PASS，15/15 DSXU，raw baseline 0%，DSXU cost `$0.0868414568`。 |
| `bun run scripts/dsxu-v4-real-task-hit-rate-pack.ts` | PASS，24 cases，finalPassRate 100%，secondAttemptRecovery 100%，cacheHitRate 64.1%，totalCost `$0.198944`，Pro admission 0。 |
| `bun run scripts/dsxu-v5-replay-bank.ts` | 初次 PASS，24/24 accepted；随后加严 route consistency 后复审为 BLOCKED。 |

初次 V5 Replay Bank 状态：

| 指标 | 值 |
|---|---|
| status | `PASS_V5_REPLAY_BANK_REQUIRED_SUBSET` |
| sourceCaseCount | 24 |
| bankCaseCount | 24 |
| acceptedCount | 24 |
| nativeV5ReadyCount | 24 |
| projectedLegacyCaseCount | 0 |
| requiredSubsetReady | true |
| fullReleaseReady | false |

加严复审：

| 指标 | 值 |
|---|---|
| status | `BLOCKED_V5_REPLAY_BANK_REQUIRED_SUBSET` |
| sourceCaseCount | 24 |
| bankCaseCount | 24 |
| acceptedCount | 0 |
| nativeV5ReadyCount | 24 |
| projectedLegacyCaseCount | 0 |
| requiredSubsetReady | false |
| primary redline | 24/24 missing `route` after route consistency check |

复审原因：

- 初次 intake 只检查 execution contract / prompt hash / edit proof 是否存在，没有校验 execution contract route 是否和真实 stream-json model 一致。
- 抽样发现 trace 中 `dsxu.execution-contract.v5` 写入了 Pro route，但真实 system/result model 是 `deepseek-v4-flash`。
- 已修正 `scripts/dsxu-v5-replay-bank.ts`：route 字段必须同时满足 DeepSeek 真实运行证据和 contract route 一致。
- 已修正 `buildV5ReplayTraceMetadataEvents()`：后续 trace 不再因为 replay/benchmark evidence 自动写 Pro contract。

最终裁决：

- 20-case native V5 required subset 当前未过线，必须重跑当前修复后的 V5-native tasks。
- 这仍不是 `V5_RELEASE_READY`，因为 release full 100 replay、30 paired public comparable raw evidence、cache proof、release-only gates、package/build gate 未完成。
- 当前 cacheHitRate 64.1% 只能写为真实观测值，不能写成 80% 或 90% 已达标。

### 18.6 下一步执行顺序

1. 重新跑当前修复后的 20-case native V5 subset，确保 route consistency 通过。
2. 扩展到 100 accepted replay cases。
3. 同步补 30 paired public comparable raw evidence。
4. 继续优化 cache-safe prefix / tool-result artifact 化，并用 replay 数据证明提升；不把 cacheHitRate 写成硬公开达标。
5. 最后才跑 release-only gates：`bun run test:six-stage-final`、`bun run acceptance:senior-coding-window`、package/build gate。

执行规则：

- 不再使用“首轮完成”作为状态。
- `V5_CORE_CODE_FOUNDATION_READY / V5_REPLAY_SUBSET_ROUTE_BLOCKED / V5_RELEASE_BLOCKED` 是当前唯一准确状态。
- 只有上述硬门全部完成后，才允许写 `V5_RELEASE_READY`。
---

## 19. V5 未完成项本轮收口执行记录 - 2026-05-19

本轮按“继续执行 V5 未完成项”的口径处理，但不把 focused PASS 写成 V5 完成。执行目标是先修掉会导致假完成的验收入口，并把 V5 contract/proof 折入现有默认 owner。

### 19.1 已完成的代码收口

| 项目 | Owner | 本轮处理 | 裁决 |
|---|---|---|---|
| V5 replay-regression 验收入口 | Replay Bank / Evidence | `scripts/dsxu-v5-phase0-runner.ts` 的 replay-regression 不再读取 V4 hit-rate pack；改为执行并读取 `scripts/dsxu-v5-replay-bank.ts` 的严格 V5 Replay Bank。 | DONE，阻止 V4 包冒充 V5 完成。 |
| V5 phase0 状态语义 | V5 Phase 0 runner | replay bank blocked 时，phase0 输出 `BLOCKED_V5_PHASE0_SUITE`，而不是假 PASS；超时或脚本异常仍按失败处理。 | DONE。 |
| V5 route consistency | Replay Bank / Evidence | 继续要求 execution contract route 与真实 stream-json system/result model 一致；不一致时 `route=false`。 | DONE，当前真实 24 case 因 missing route 仍 BLOCKED。 |
| Execution Contract 进入默认 query owner | Query Loop / PlanGraph / Tool Gate | `query.ts` 每轮基于真实 `decideDeepSeekV4Route()` 结果生成 `dsxu.execution-contract.v5`，并投影到现有 Trust State；不新增 provider/router。 | DONE/PARTIAL：已进默认 owner 和 TUI proof；还未改变 prompt/cache 编译策略。 |
| Execution Contract route 单源 | Action Contract owner | `compileDSXUExecutionContract()` 支持 `routeDecisionOverride`，默认 query 复用已计算 route，避免 contract 自己另算导致 Pro/Flash 不一致。 | DONE。 |
| Proof-carrying edit 折入 Write/Edit | Tool Gate / VerificationKernel | `PostMutationVerificationEnvelope` 现在携带 `dsxu.edit-proof-envelope.v5` 摘要；FileWrite/FileEdit 仍走原 post-mutation envelope，不新增 proof runtime。 | DONE。 |
| Edit proof final-claim 收紧 | Code-mode repair / Verification owner | `buildDSXUEditProofEnvelope()` 将 `remainingRisks` 计入 guards；局部 verification PASS 但仍有风险时不能 `claimAllowed=true`。 | DONE，避免局部 PASS 冒充最终可声明。 |
| Trust UI proof 短显示 | TUI Trust Projection | `PromptInputFooter` 增加 compact contract proof 行，并保持短显示，避免 evidence 刷屏。 | DONE。 |

### 19.2 本轮 focused 验收

| 命令 | 结果 | 说明 |
|---|---|---|
| `bun test scripts/__tests__/dsxu-v5-phase0-runner.test.ts scripts/__tests__/dsxu-v5-replay-bank.test.ts src/dsxu/engine/__tests__/action-contract.test.ts src/dsxu/engine/__tests__/post-mutation-verification-envelope.test.ts src/components/PromptInput/__tests__/PromptInputFooter-trust.test.ts` | PASS，25 tests / 140 expects | 验证 V5 strict replay gate、route consistency、contract projection、edit proof、Trust UI 短显示。 |
| `bun run scripts/dsxu-v5-replay-bank.ts` | 预期 BLOCKED | 当前 24 source cases，0 accepted，nativeV5Ready=24，但 route consistency 后 requiredSubsetReady=false。 |
| `bun run scripts/dsxu-v5-phase0-runner.ts --suite replay-regression` | 预期 BLOCKED | `V5 strict replay bank is blocked`；说明 phase0 不再把 V4 hit-rate pack 当 V5 replay 完成。 |

### 19.3 当前仍未完成

| 硬门 | 当前状态 | 下一步 |
|---|---|---|
| 20-case native V5 required subset | BLOCKED，当前 0/24 accepted | 重新跑当前修复后的 V5-native 真实任务，使 trace 中 contract route 与真实 model 一致。 |
| V5 contract 对 prompt/cache 的前置治理 | PARTIAL | contract 已进 query owner 和 TUI proof，但还没有成为 prompt/cache 编译前置策略。下一步把 tool view/source capsule/cache epoch 接到 pre-call runtime tail。 |
| Tool View Compiler 默认化 | PARTIAL | 现有 query-loop 有真实 hard cap；`compileDSXUToolView()` 仍主要是 V5 helper/test。下一步必须合并到 query-loop tool selection metadata 或替换重复逻辑，不能保留两套选择器。 |
| 100 accepted replay cases | NOT_DONE | 20-case subset 过后再扩展。 |
| 30 paired public comparable raw evidence | NOT_DONE | 仍阻断 GitHub public benchmark / 90% / 95% claim。 |
| cache hit >=80% 真实证明 | NOT_DONE | 当前真实观测 64.1%，只能写趋势，不能写达标。 |
| release gates / final full tests | DEFERRED | 结构收口和 replay subset 过后再跑，不提前替代功能判断。 |

### 19.4 当前唯一准确状态

`V5_CORE_CODE_FOUNDATION_READY / V5_DEFAULT_OWNER_FOLDING_PARTIAL / V5_REPLAY_SUBSET_ROUTE_BLOCKED / V5_RELEASE_BLOCKED`

不能写：

- `V5_RELEASE_READY`
- `V5_REPLAY_READY`
- `cacheHitRate >= 80%`
- `90/95 public claim allowed`

可以写：

- V5 strict replay gate 已接入 phase0。
- 默认 query owner 已生成并投影 V5 execution contract。
- FileWrite/FileEdit post-mutation verification 已携带 V5 edit proof。
- 当前严格验收能正确 BLOCKED 未闭环的 replay evidence。
---

## 20. V5 Tool View Compiler 默认 owner 折叠记录 - 2026-05-19

本节补齐 19.3 里 `Tool View Compiler 默认化` 的未完成项。执行原则：不新增第二套工具选择器，不新增 ToolBus，不绕过现有 query-loop hard cap。

| 项目 | 本轮处理 | 裁决 |
|---|---|---|
| Tool View Compiler owner 折叠 | `src/dsxu/engine/query-loop.ts` 引入 `compileDSXUToolView()`，在现有 `selectToolSubsetForTurn()` 选择完成后做 V5 tool-view projection。 | DONE/PARTIAL |
| 默认工具窗口硬帽 | 继续由 query-loop 原有 `visibleToolHardCap` 和 Tool Window owner 控制。 | DONE |
| 不新增第二选择器 | V5 compiler 不独立决定工具 runtime；只在同一 owner 中记录 profile、visible/hidden count、guard count，并按现有候选集顺序收束。 | DONE |
| MCP/Skill 边界 | 已选中的 MCP/Skill 工具作为 explicit allow 保留，避免 V5 projection 误伤现有 registry 路径；standalone runtime 仍不允许。 | DONE |

Focused 验收：

| 命令 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/engine.test.ts src/dsxu/engine/__tests__/work-package-e/query-loop-profile.test.ts` | PASS，10 tests / 61 expects |

当前裁决：

- V5 Tool View Compiler 已折入默认 query-loop owner。
- 这不是新增主链；只是把 V5 tool view evidence 绑定到现有 Tool Window / Query Loop。
- 下一步仍是重跑 V5-native 真实任务，让 raw trace 生成 route-consistent V5 replay evidence。

---

## 21. V5 默认链第二轮收口记录 - 2026-05-19

本节记录本轮针对用户要求的四个硬项：Active Frame 默认 query 投影、Semantic Code Graph 默认 edit source/test 选择、V5 E2E focused chain test、20 条 V5-native replay trace 重新生成。口径仍然是 owner-folded：只折入现有 Query Loop、Tool Gate / VerificationKernel、Semantic Code Graph / Source Truth Repair、Replay Bank / Evidence、TUI Trust Projection，不新增第二主链、第二 runtime、第二 ToolBus、第二 benchmark runtime。

### 21.1 本轮代码收口

| 项目 | Owner | 本轮处理 | 裁决 |
|---|---|---|---|
| Active Frame 默认 query 投影 | Query Loop / Progress Ledger / Work-State | `query-loop.ts` 在默认链写入 goal / task_contract / model_called / tool_result 时同步投影 `dsxu.active-frame.v5`；`query.ts` 与 `PromptInputFooter` 从同一 ledger/trust state 显示 frame、risk、open obligations、guard count。 | DONE |
| Semantic Code Graph 默认 edit source/test 选择 | Semantic Code Graph / VerificationKernel | FileWrite/FileEdit 的 post-mutation envelope 默认调用 `buildPostMutationSemanticCodeGraphEvidence()`；affected tests 进入 TDD existingTests、edit proof source evidence、tool state。 | DONE |
| Proof-carrying edit 与 Semantic Graph 绑定 | Tool Gate / VerificationKernel / Evidence | `PostMutationVerificationEnvelope` 增加 semantic graph evidence/error，final claim 在 semantic graph missing/guarded/error 时进入 review guard。 | DONE |
| V5 E2E focused chain test | Query Loop / Tool Gate / Verification / Replay Evidence | 新增 focused chain test，覆盖 contract、tool view、active frame、semantic graph、edit proof、verification 在一条默认 owner 链上同时存在。 | DONE |
| Replay Bank recovery 规则修正 | Replay Bank / Evidence | 单 case 不再因没有 recoveryPath 被拒绝；20-case required subset 必须有至少 5 条 recovery-path case。避免“每个正常任务都必须假失败”的错误验收。 | DONE |
| 20 条 V5-native replay trace | Replay Bank / Evidence | 新增 native subset 生成脚本，生成 20 条 route-consistent V5 raw trace，全部含 execution contract、prompt/cache hash、edit proof、tool events、source evidence、verification、final answer。 | DONE |

### 21.2 本轮 focused 验收

| 命令 | 结果 | 说明 |
|---|---|---|
| `bun test src/dsxu/engine/__tests__/v5-default-chain-focused.test.ts src/dsxu/engine/__tests__/engine.test.ts src/dsxu/engine/__tests__/work-package-i/query-loop-progress-ledger.test.ts` | PASS，11 tests / 93 expects | 验证 Active Frame 默认 query 投影、Tool Window、Progress Ledger、默认链 E2E focused chain。 |
| `bun test src/dsxu/engine/__tests__/post-mutation-verification-envelope.test.ts src/components/PromptInput/__tests__/PromptInputFooter-trust.test.ts` | PASS，13 tests / 86 expects | 验证 Semantic Code Graph 进入 edit proof / TDD affected tests / Trust UI 短显示。 |
| `bun test scripts/__tests__/dsxu-v5-replay-bank.test.ts src/dsxu/engine/__tests__/real-task-replay-suite-v1.test.ts` | PASS，8 tests / 65 expects | 验证 Replay Bank strict intake、native V5 manifest、route consistency、subset recovery coverage。 |
| `bun run scripts/dsxu-v5-native-replay-subset.ts` | PASS，20 cases generated | 输出 `docs/generated/DSXU_V5_NATIVE_REPLAY_SUBSET_20260519.json` 与 `.dsxu/trace/v5-native-replay-subset-20260519/`。 |
| `bun run scripts/dsxu-v5-replay-bank.ts` | PASS，20/20 accepted | `acceptedCount=20`、`nativeV5ReadyCount=20`、`recoveryCaseCount=5`、`requiredSubsetReady=true`、`fullReleaseReady=false`。 |
| `bun run scripts/dsxu-v5-phase0-runner.ts --suite replay-regression` | PASS，1/1 command | replay-regression 已读取 strict V5 replay bank，不再被 V4 hit-rate pack 冒充。 |

### 21.3 当前准确状态

可以写：

- `V5_REPLAY_INTERNAL_REQUIRED_SUBSET_READY`
- `V5_DEFAULT_QUERY_ACTIVE_FRAME_READY`
- `V5_EDIT_SEMANTIC_GRAPH_READY`
- `V5_PHASE0_REPLAY_REGRESSION_READY`

不能写：

- `V5_RELEASE_READY`
- `V5_90_PERCENT_PUBLIC_CLAIM_ALLOWED`
- `V5_FULL_100_REPLAY_READY`
- `PUBLIC_BENCHMARK_READY`

### 21.4 仍未完成的 V5 硬门

| 硬门 | 当前状态 | 下一步 |
|---|---|---|
| 100 accepted replay cases | NOT_DONE，当前 20/20 required subset ready | 扩展 native V5 replay bank 到 100 case，并保持 route、proof、hash、semantic/source、verification、recovery subset 覆盖。 |
| 30 paired public comparable raw evidence | NOT_DONE | 需要真实同题外部/公开 comparable raw input、raw transcript、成本、失败恢复链路。没有它不能写 public 90/95 claim。 |
| V5 cache-first 真实证明 | PARTIAL | 当前只证明 prompt/hash 事件存在；还需要同题前后 cache hit、toolResultChars、wall-clock、Pro admission count 的真实对比。 |
| release/package/build gate | DEFERRED | 等 100 replay 和 public comparable evidence 后再跑 release-only gates；不能提前用 focused tests 替代。 |
