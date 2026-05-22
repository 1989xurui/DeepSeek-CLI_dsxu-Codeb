# DSXU V6 开发文档：DeepSeek-Native Engineering Runtime

日期：2026-05-19  
状态：V6 开发规格，不是完成报告  
目标：在 DeepSeek V4 Flash / Flash-MAX / Pro 原生能力与 DSXU 强编排基础上，做出面向高级程序员的 90%+ 编程与复杂任务执行体验。  
对标：Codex GPT-5.5 / Claude 4.7 级高级程序员体验。  
约束：不继续堆功能，不复制 Claude Code，不把 smoke/mock/unit 当完成，不把 prompt 规则当 runtime 保证，不把内部成绩写成公开胜利。

---

## 0. 输入依据

本 V6 文档基于四类证据：

| 输入 | 路径或来源 | 用途 |
|---|---|---|
| DSXU 全能力真相矩阵 | `docs/DSXU_CAPABILITY_TRUTH_MATRIX_20260519.md` | 判断能力在默认主链、CLI、测试、文档、实验、冻结、历史残留中的真实位置 |
| 全量 JSON 矩阵 | `docs/generated/DSXU_CAPABILITY_TRUTH_MATRIX_20260519.json` | 作为后续自动验收和 owner 分配输入 |
| V5/V6 既有规划 | `docs/DSXU_V5_EXECUTION_PLAN_20260519_CN.md`, `docs/DSXU_V6_EXECUTION_PLAN_20260519_CN.md` | 保留已形成的工程方向，去掉过厚和重复部分 |
| DeepSeek 官方文档 | `api-docs.deepseek.com` | 确认 V4、thinking、tool calls、strict schema、cache usage 等原生边界 |

真相矩阵当前摘要：

| 分类 | 数量 | V6 处理原则 |
|---|---:|---|
| 扫描文件总数 | 3109 | 不再靠人工猜测能力是否存在 |
| 默认主链 | 1331 | 只优化默认任务路径，不再把所有能力塞进默认链 |
| App runtime 可达 | 1893 | 可用于 TUI/状态显示，但不等同默认编程能力 |
| CLI 脚本 | 437 | 作为证据、验收、发布工具，不算默认用户体验 |
| 测试合同 | 628 | 证明合同存在，不证明产品路径已接入 |
| 文档证据 | 271 | 作为说明，不作为 runtime 完成证明 |
| 实验 | 103 | 默认冻结，除非显式开关、owner、验收通过 |
| 冻结 | 31 | 不进入默认链 |
| 历史残留 | 636 | 归档、标注 owner 或隔离，避免模型误用 |
| 未归类 | 287 | 必须在 V6 Phase 0 归类，否则不能作为能力声明 |

---

## 1. 核心判断

DSXU 现在的问题不是“能力不够”，而是能力太多、路径太散、证据等级混用。V6 不能继续做第 68 个功能，而要把已有能力收敛成一条 DeepSeek-native 默认工程链。

V6 的正确方向：

```text
DeepSeek 原生能力
  + DSXU Execution Contract
  + DSXU Tool View Compiler
  + DSXU Strict Schema Gateway
  + DSXU Active Frame / Durable Ledger
  + DSXU Proof-Carrying Edit
  + DSXU Verification / Recovery
  + DSXU Replay Evidence
= DeepSeek-Native Engineering Runtime
```

一句话定义：

> V6 不是更大的 Agent 系统，而是一个让 DeepSeek 在小而硬的工程合同中稳定完成高级程序员任务的运行时。

---

## 2. DeepSeek 原生能力边界

以下能力必须作为 V6 设计约束，而不是泛泛的 prompt 假设。

| 能力 | 官方边界 | V6 设计含义 |
|---|---|---|
| V4-Pro / V4-Flash | 官方发布 V4 系列，并提供 Flash 与 Pro 线路 | Flash 默认，Pro 只在高风险、恢复、审查、最终 claim 前准入 |
| 1M 上下文 | V4 系列支持 1M context | 不再把 128K 当硬假设，但仍不能粗暴塞满上下文 |
| Thinking | thinking 默认 enabled，支持 high/max effort | 不能用长推理前缀替代 thinking；应使用短执行意图头 |
| Tool calls + thinking | thinking 模式支持 tool calls，但 tool message 后需要回传 `reasoning_content` | Provider contract 必须测试 round-trip，不然复杂工具链会断 |
| Strict function calling | strict schema 是 beta，要求 `strict=true`、`additionalProperties=false`、属性 required 等约束 | 必须做 DSXU Strict Schema Gateway，不能直接把 40+ 工具 schema 暴露给模型 |
| Cache usage | cache hit/miss 在 usage 中返回，且 cache 是 best effort | cache 成本声明必须来自 raw usage，不允许估算冒充真实结果 |
| Sampling | thinking 模式下部分采样参数不生效 | 稳定性不能靠 temperature=0，必须靠 contract/schema/replay |
| JSON output | JSON 输出可用，但仍可能 empty/length 截断 | 必须有 empty/length recovery，不能把 JSON mode 当绝对可靠 |

V6 禁止的 DeepSeek 使用方式：

| 禁止项 | 原因 |
|---|---|
| 把长 `<reasoning>` 前缀当核心机制 | 会增加 token、污染 cache、与原生 thinking 重叠 |
| 每轮暴露全部工具 | DeepSeek 工具选择面过宽会降低命中率 |
| 全部任务默认 Pro | 成本上升且不能证明体验更好 |
| 全部任务默认 max effort | 对轻任务会变慢，且可能降低交互体验 |
| 只看最终回答质量 | 高级程序员体验还包括验证、恢复、证据、可恢复长任务 |

官方参考：

- DeepSeek V4 发布与 1M context：[DeepSeek API News 2026-04-24](https://api-docs.deepseek.com/news/news260424)
- Thinking mode 与 tool call 回传：[DeepSeek Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode)
- Strict function calling：[DeepSeek Function Calling](https://api-docs.deepseek.com/guides/function_calling)
- Context caching：[DeepSeek Context Caching](https://api-docs.deepseek.com/guides/kv_cache)

---

## 3. 90%+ 目标定义

V6 的 90%+ 不能写成“公开超过 GPT-5.5 / Claude 4.7”。它必须定义成 DSXU 自己的高级程序员任务集 pass rate。

### 3.1 体验目标

| 指标 | 定义 | V6 目标 |
|---|---|---:|
| Final Pass | 任务最终完成且验证证据完整 | >=90% |
| Tool Hit | 工具选择与任务阶段匹配 | >=90% |
| Verify Hit | 需要验证的任务实际运行验证 | >=95% |
| Recovery Success | 首次失败后能正确 retry/replan/rollback/escalate | >=80% |
| Claim Honesty | 未验证时不声称完成 | 100% |
| Long Task Resume | 中断后能从 ledger 恢复 | >=90% |
| Senior UX | 高级程序员能看懂当前状态、风险、下一步 | >=90% 主观验收 |

### 3.2 证据等级

| 等级 | 名称 | 是否可用于 90% claim |
|---|---|---|
| E0 | 文档计划 | 否 |
| E1 | 单元测试 | 否，只证明合同 |
| E2 | 集成测试 | 部分 |
| E3 | internal replay | 可以用于内部趋势 |
| E4 | live provider replay | 可以用于 V6 90% 内部声明 |
| E5 | real benchmark / external suite | 可以用于公开对标声明 |

公开宣称“超过 GPT-5.5 / Claude 4.7”需要 E5，不允许用 E1/E2/E3 替代。

---

## 4. V6 总体架构

```text
User Task
  -> Task Contract Compiler
  -> DeepSeek Capability Router
  -> Reasoning Intent Header
  -> Tool View Compiler
  -> Strict Schema Gateway
  -> Active Frame Builder
  -> DeepSeek Provider Runtime
  -> Tool Execution Event Bus
  -> Mutation Lifecycle
  -> Proof-Carrying Edit
  -> Verification Gate
  -> Recovery Decision Table
  -> Durable Ledger
  -> Replay / Evidence Store
  -> Final Claim Gate
```

### 4.1 单一事实源

| 单一事实源 | 负责内容 |
|---|---|
| Execution Contract | task type、risk、route、visible tools、verification、fallback、claim policy |
| DeepSeek Provider Contract | model、thinking、reasoning_effort、reasoning_content、tool calls、usage、cache |
| Tool View | 本轮模型真实可见工具 |
| Strict Schema Gateway | DeepSeek 可接受的 tool schema |
| Active Frame | 当前任务工作记忆 |
| Durable Ledger | 长任务恢复、证据、失败历史 |
| Proof Envelope | 是否允许声称完成 |
| Replay Bank | 90% 目标是否达标 |

---

## 5. Prompt 产品纪律

V6 的 prompt 原则是“薄 prompt，硬 runtime”。

### 5.1 保留的 prompt 内容

| 内容 | 是否保留 | 原因 |
|---|---|---|
| 身份、边界、不可虚报 | 保留 | 影响输出纪律 |
| 工具使用基本规则 | 保留但压缩 | 防止明显误用 |
| 验证义务 | 保留但投影到 runtime gate | prompt 只能提醒，不能替代 gate |
| 文件安全规则 | 保留 | 防止误删误改 |
| 长推理模板 | 删除 | 与 DeepSeek thinking 重叠 |
| 大段方案模板 | 删除 | 增加 token，降低命中率 |
| 所有工具说明 | 删除 | 改为 Tool View 动态注入 |

### 5.2 Reasoning Intent Header

V6 不使用旧式长推理前缀，改为短执行意图头：

```text
[Intent]
goal: <one concrete subgoal>
phase: observe | edit | verify | recover | final
allowed_tools: <compiled tool view names>
verify_before_claim: <required proof>
stop_rule: no verified proof, no completion claim
```

适用策略：

| 场景 | 使用方式 |
|---|---|
| Flash non-thinking 轻任务 | 3-5 行 Intent Header |
| Flash thinking high 普通编程 | Intent Header + DeepSeek 原生 reasoning |
| Flash-MAX / Pro 复杂任务 | Contract summary，不写长 CoT |
| Recovery | 只写 failure + next action，不重放全历史 |
| Replay A/B | 必须比较有无 Intent Header 的 hit-rate |

硬验收：

| 指标 | 门槛 |
|---|---:|
| prompt tokens 增幅 | <=8% |
| tool hit 提升 | >=3 个百分点 |
| final pass 不下降 | 100% 不低于 baseline |
| cache hit 不下降 | 不低于 baseline 5 个百分点以内 |
| 平均延迟劣化 | <=10% |

---

## 6. 能力归并规则

真相矩阵是 V6 的入口，不允许绕过。

| 矩阵分类 | V6 动作 |
|---|---|
| default-mainline | 保留、收敛、加硬验收 |
| app-runtime | 只服务可见状态/TUI，不直接算编程能力 |
| cli-script | 保留为证据、验收、发布工具，不进默认 prompt |
| test-contract | 用于回归，不作为产品完成声明 |
| doc-evidence | 归档或引用，不作为 runtime 证据 |
| experiment | 默认冻结，显式开关 + owner + 退出条件 |
| frozen | 不进入默认链 |
| historical-residue | 加 owner、归档或隔离 |
| unclassified | Phase 0 必须归类，否则不能被模型引用 |

能力域处理：

| 能力域 | 文件数 | V6 处理 |
|---|---:|---|
| tool-system | 284 | 做 Tool View，不重写全部工具 |
| tui-visible-state | 334 | 收敛 trust/status 显示，避免噪音 |
| mcp-skill-workflow | 163 | 默认隐藏，按需检索启用 |
| provider-model-cost-cache | 146 | 升级为 Provider Contract |
| agent-task-orchestration | 128 | 只保留 evidence handoff 主路径 |
| context-memory-compact | 120 | 改成 Active Frame + Ledger 优先 |
| permission-safety | 115 | 接入 mutation/command risk gate |
| recovery-rollback | 27 | 统一成 decision table |
| verification-quality-gates | 24 | 统一到 Proof-Carrying Edit |
| query-loop-default-runtime | 36 | V6 第一优先级 |

---

## 7. V6 工作包

### WP0. Truth Matrix Gate

目标：所有 V6 工作必须从能力真相矩阵开始，防止继续把历史、实验、脚本、文档误当主链能力。

关键文件：

| 文件 | 动作 |
|---|---|
| `scripts/dsxu-capability-truth-matrix.ts` | 保留为 V6 入口审计脚本 |
| `docs/generated/DSXU_CAPABILITY_TRUTH_MATRIX_*.json` | 作为 owner 分配和冻结输入 |
| `docs/DSXU_CAPABILITY_TRUTH_MATRIX_*.md` | 作为人读摘要 |

硬验收：

```bash
bun run scripts/dsxu-capability-truth-matrix.ts
```

必须输出：

```text
PASS_DSXU_CAPABILITY_TRUTH_MATRIX
```

通过条件：

| 条件 | 标准 |
|---|---:|
| JSON / CSV / Markdown 均生成 | 100% |
| 文档引用不算 default-mainline | 100% |
| TUI 可达不算默认执行链 | 100% |
| unclassified 文件有 owner 分配计划 | 100% |

---

### WP1. DeepSeek Provider Contract

目标：把 DeepSeek 原生能力变成可测试合同，而不是散落的 provider 适配。

关键能力：

| 能力 | 需要验证 |
|---|---|
| thinking enabled/disabled | raw request/response 记录 |
| reasoning_effort high/max | route trace 记录 |
| thinking + tool calls | assistant 返回 tool_calls |
| tool result round-trip | 后续请求包含上一轮 reasoning_content |
| strict schema | schema compiler 输出 DeepSeek 合法 schema |
| usage/cache | raw usage 进入 ledger |
| JSON empty/length | recovery 分支覆盖 |

建议文件：

| 文件 | 动作 |
|---|---|
| `src/services/api/deepseek-adapter.ts` | 收敛 provider contract |
| `src/services/api/provider-contract.ts` | 新增或统一模型响应结构 |
| `src/utils/model/deepseekV4Control.ts` | 只保留 routing/effort 控制，不放业务规则 |
| `src/dsxu/engine/progress-ledger.ts` | 写入 provider usage/cache/route event |

验收命令：

```bash
bun test src/services/api/__tests__/deepseek-provider-contract.test.ts
bun run scripts/dsxu-v6-live-provider-probe.ts --dry-run
```

live provider 验收必须额外记录：

```text
PASS_V6_DEEPSEEK_PROVIDER_CONTRACT
```

---

### WP2. Task Contract Compiler

目标：把用户请求编译成 Execution Contract，不再让模型自由决定任务策略。

Contract 格式：

```json
{
  "taskType": "explain | search | single_file_edit | multi_file_refactor | debug | review | long_task | benchmark",
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

风险路由：

| 风险 | 触发条件 | 默认模型 | 验证 |
|---|---|---|---|
| low | 解释、搜索、只读分析 | Flash | none |
| medium | 单文件编辑、小范围修复 | Flash thinking | syntax/type |
| high | 多文件重构、API 签名变化、失败恢复 | Flash-MAX 或 Pro review | affected tests/full |
| critical | 权限、删除、发布、公开 benchmark claim | Pro | full + evidence |

验收命令：

```bash
bun test src/dsxu/engine/__tests__/execution-contract-compiler.test.ts
```

硬条件：

| 条件 | 标准 |
|---|---:|
| 编程任务生成 contract | 100% |
| contract 缺字段时拒绝执行 | 100% |
| route 写入 ledger | 100% |
| high/critical 禁止 Flash-only verified final | 100% |

---

### WP3. Tool View Compiler + Strict Schema Gateway

目标：底层 40+ 工具保留，但每轮只暴露少量工具，并将 schema 编译成 DeepSeek strict function calling 可接受格式。

工具层级：

| 层级 | 工具类型 | 默认 |
|---|---|---|
| Mainline | Read, Grep, Glob, Edit, Write, Bash, Todo | 可见 |
| Assisted | LSP, GitDiff, Agent, Evidence, Replay | 按任务可见 |
| Searchable | MCP, Skill, Blame, TestSkeleton | 搜索后启用 |
| Frozen | Swarm, Voting, Forked Agent, Counterfactual | 默认不可见 |

关键原则：

```text
不重写全部工具。
不删除 Claude 原工具底座。
只编译本轮可见工具视图。
所有写工具必须经过 mutation lifecycle。
所有高风险 shell 必须经过 permission/risk gate。
```

验收命令：

```bash
bun test src/dsxu/engine/__tests__/tool-view-compiler.test.ts
bun test src/dsxu/engine/__tests__/strict-tool-schema-gateway.test.ts
```

硬条件：

| 条件 | 标准 |
|---|---:|
| 普通 coding turn 可见工具数 | <=12 |
| 低风险任务可见工具数 | 6-10 |
| strict schema 合法 | 100% |
| MCP/Skill/Swarm 默认暴露 | 0 次 |
| planned tool 不在 view 中时拒绝 | 100% |

---

### WP4. Model Router + Cost Policy

目标：Flash 默认、Pro 证据准入，贵模型只用于真正降低返工的位置。

路由策略：

| 场景 | 模型 | 原因 |
|---|---|---|
| 只读解释 | Flash non-thinking | 快、低成本 |
| 普通代码编辑 | Flash thinking high | 保持推理能力和成本平衡 |
| 多文件重构 | Flash-MAX 或 Flash high + Pro review | 降低一致性错误 |
| 失败恢复 2 次后 | Pro | 避免低价模型反复返工 |
| 发布/删除/权限/安全 | Pro | 高风险 |
| benchmark / claim | Pro judge + replay | 防假完成 |

成本原则：

```text
更贵不等于更差。
如果 max/pro 能减少多轮返工，总成本可能更低。
V6 需要比较 total cost to verified completion，不比较单次调用价格。
```

验收命令：

```bash
bun test src/dsxu/engine/__tests__/model-router-cost-policy.test.ts
bun run scripts/dsxu-v6-cost-to-verified-completion.ts --suite senior-40
```

硬条件：

| 条件 | 标准 |
|---|---:|
| 每次模型调用记录 route | 100% |
| 每次模型调用记录 cost/usage/cache | 100% |
| Pro 调用必须有 risk 或 recovery 原因 | 100% |
| cost-to-verified-completion 报告生成 | 100% |

---

### WP5. Active Frame + Durable Ledger

目标：长时间任务不靠上下文硬记忆，而靠 Active Frame 和 append-only ledger。

Active Frame 内容：

```text
Task: 当前目标
Phase: 当前阶段
Confirmed Facts: 最多 8 条已确认事实
Files Read: 已读文件
Files Changed: 已改文件
Open Obligations: 未完成验证或确认事项
Last Failure: 最近失败原因
Next Allowed Actions: 本轮允许动作
Risk: 当前风险等级
```

Ledger event 类型：

| event | 内容 |
|---|---|
| task_contract_created | contract |
| model_route_selected | model/effort/reason |
| tool_view_compiled | visible tools |
| tool_called | tool/input hash |
| tool_result | normalized result |
| mutation_attempted | file/change summary |
| verification_result | command/result |
| recovery_decision | retry/replan/rollback/escalate |
| claim_gate | allowed/blocked |

验收命令：

```bash
bun test src/dsxu/engine/__tests__/active-frame-ledger.test.ts
bun run scripts/dsxu-v6-ledger-resume-smoke.ts
```

硬条件：

| 条件 | 标准 |
|---|---:|
| 长任务每轮生成 active frame | 100% |
| 可从 ledger 恢复 task state | 100% |
| 压缩后 open obligations 不丢失 | 100% |
| final 前 claim gate 查询 ledger | 100% |

---

### WP6. Proof-Carrying Edit

目标：所有写入都携带 proof envelope，未验证不能声称完成。

Proof Envelope：

```json
{
  "filesChanged": [],
  "verificationRequired": "syntax | type | affected_tests | full",
  "verificationRun": [],
  "verificationPassed": false,
  "claimAllowed": false,
  "rollbackPoint": "git-or-ledger-ref",
  "evidence": []
}
```

生命周期：

```text
Edit/Write
  -> pre-mutation risk check
  -> apply mutation
  -> post-mutation static/type/test gate
  -> proof envelope
  -> claim gate
```

验收命令：

```bash
bun test src/dsxu/engine/__tests__/proof-carrying-edit.test.ts
bun test src/coordinator/tdd-gate/__tests__/gate.test.ts
bun test src/services/static-analysis/__tests__/bridge.test.ts
```

硬条件：

| 条件 | 标准 |
|---|---:|
| 写工具后生成 proof envelope | 100% |
| verification required 但未运行时 claimAllowed=false | 100% |
| 失败后可进入 recovery | 100% |
| final answer 引用 proof 状态 | 100% |

---

### WP7. Recovery Decision Table

目标：把 GearBox、verify-gate、failure taxonomy、rollback 分散逻辑统一为决策表。

决策表：

| 失败类型 | 第一次 | 第二次 | 第三次 |
|---|---|---|---|
| tool schema error | repair schema | strict gateway fallback | abort |
| test failure | inspect failure | replan | escalate Pro |
| type error | localized fix | affected references | rollback + Pro review |
| permission denied | ask user | stop | stop |
| context overflow | compact active frame | artifact refs | split task |
| repeated no-progress | replan | escalate Pro | ask user |

验收命令：

```bash
bun test src/dsxu/engine/__tests__/recovery-decision-table.test.ts
```

硬条件：

| 条件 | 标准 |
|---|---:|
| 每个 failure event 有 decision | 100% |
| recovery decision 写入 ledger | 100% |
| 同一失败无限循环 | 0 次 |
| rollback/replan/escalate 可区分 | 100% |

---

### WP8. Agent Evidence Handoff

目标：Agent 只作为 sidecar evidence worker，不默认升级成多层团队系统。

Handoff Envelope：

```json
{
  "agentRole": "explorer | worker | reviewer",
  "task": "...",
  "filesTouched": [],
  "evidence": [],
  "verification": [],
  "risks": [],
  "confidence": "low | medium | high"
}
```

验收命令：

```bash
bun test src/tools/AgentTool/__tests__/agent-evidence-handoff.test.ts
```

硬条件：

| 条件 | 标准 |
|---|---:|
| Agent final 必须 envelope 化 | 100% |
| parent 不接受无 evidence 的 PASS | 100% |
| worker 修改文件进入 ledger | 100% |
| 多 Agent/team/swarm 默认关闭 | 100% |

---

### WP9. Context / Cache Strategy

目标：利用 1M context，但不让上下文变成垃圾场。

上下文层：

| 层级 | 内容 | 策略 |
|---|---|---|
| P0 | task contract、active frame、open obligations、last failure | 永不压缩 |
| P1 | 最近工具结果、当前文件片段、proof envelope | 摘要 + artifact ref |
| P2 | 历史阅读、旧日志、成功事件 | ledger 引用 |
| P3 | 文档、benchmark、历史残留 | 默认不进上下文 |

cache 策略：

| 内容 | cache 策略 |
|---|---|
| system prompt | 稳定前缀 |
| tool schema view | 尽量稳定排序 |
| project capsule | 版本 hash |
| active frame | dynamic tail |
| tool result | artifact ref 优先 |

验收命令：

```bash
bun test src/dsxu/engine/__tests__/context-cache-strategy.test.ts
bun run scripts/dsxu-v6-context-pressure.ts --levels 70,85,95,99
```

硬条件：

| 条件 | 标准 |
|---|---:|
| 70/85/95/99 上下文压力报告生成 | 100% |
| open obligations 不被压缩丢失 | 100% |
| cache usage 写入 ledger | 100% |
| 大工具结果默认 artifact ref | 100% |

---

### WP10. TUI Trust Surface

目标：让高级程序员一眼看到真实状态，但不把 TUI 做成噪音仪表盘。

显示原则：

| 显示 | 规则 |
|---|---|
| model/route | 显示当前模型和 effort |
| verification | 显示 not_run / running / passed / failed |
| claim | 显示 allowed / blocked |
| ledger | 显示 phase 和 open obligations 数量 |
| cost/cache | 简短显示，详细进 evidence |
| agent evidence | 只显示 active/running/required |

推荐一行格式：

```text
DSXU trust: Flash thinking-high | verify=passed | claim=allowed | phase=edit.verify | open=0 | cost=$0.0003 | cache=93%
```

验收命令：

```bash
bun test src/components/__tests__/tui-trust-surface.test.tsx
bun run scripts/dsxu-v6-tui-snapshot.ts
```

硬条件：

| 条件 | 标准 |
|---|---:|
| trust line 不超过终端宽度 | 100% |
| 中文不作为默认状态字段 | 100% |
| 关键信息可从 ledger 追溯 | 100% |
| no verify 时不显示完成态 | 100% |

---

### WP11. Replay Bank + Hit Rate

目标：90%+ 必须来自 replay bank，不来自主观感觉。

任务集：

| 类型 | 数量 |
|---|---:|
| 只读理解 | 10 |
| 单文件编辑 | 10 |
| 多文件重构 | 10 |
| Debug / 修错 | 10 |
| 测试生成 | 10 |
| 长任务恢复 | 10 |
| 权限/命令风险 | 10 |
| Agent sidecar | 10 |
| 上下文压力 | 10 |
| 发布 claim gate | 10 |

合计：100 个高级程序员任务。

指标：

| 指标 | 目标 |
|---|---:|
| Final Pass | >=90% |
| Verify Required Run Rate | >=95% |
| False Claim | 0 |
| Infinite Loop | 0 |
| Tool Hit | >=90% |
| Recovery Success | >=80% |
| Pro Escalation Justified | >=95% |

验收命令：

```bash
bun run scripts/dsxu-v6-replay-bank.ts --suite senior-100
bun run scripts/dsxu-v6-hit-rate-report.ts --min-final-pass 0.90
```

硬输出：

```text
PASS_V6_INTERNAL_REPLAY_HIT_RATE_GATE
```

未达到时禁止写：

```text
DSXU 已达到 90%+
DSXU 超过 GPT-5.5
DSXU 超过 Claude 4.7
```

---

### WP12. Freeze / Archive / Owner Cleanup

目标：把历史残留、冻结、实验、未归类从模型默认视野中拿掉。

动作：

| 类型 | 处理 |
|---|---|
| historical-residue | 移入 archive 标注或 owner |
| frozen | 注册到 freeze register |
| experiment | 显式开关 + owner + exit criteria |
| unclassified | owner 判定：接入、冻结、归档、删除 |
| old Vxx docs | 不作为 V6 completion evidence |

验收命令：

```bash
bun run scripts/dsxu-capability-truth-matrix.ts
bun run scripts/dsxu-v6-owner-cleanup-check.ts
```

硬条件：

| 条件 | 标准 |
|---|---:|
| unclassified 有 owner 或处理动作 | 100% |
| experiment 默认不进 prompt/tool view | 100% |
| historical-residue 不进入 claim corpus | 100% |
| frozen 不进入默认链 | 100% |

---

## 8. 执行顺序

V6 不能按“最想做的功能”排，而要按“最能降低假完成和返工”的顺序排。

| 顺序 | 工作包 | 目标 |
|---:|---|---|
| 1 | WP0 Truth Matrix Gate | 先知道什么是真的 |
| 2 | WP1 DeepSeek Provider Contract | 先把原生能力测准 |
| 3 | WP2 Task Contract Compiler | 让任务进入硬合同 |
| 4 | WP3 Tool View + Strict Schema | 降低工具选择熵 |
| 5 | WP5 Active Frame + Ledger | 长任务不靠上下文漂移 |
| 6 | WP6 Proof-Carrying Edit | 防止未验证完成 |
| 7 | WP7 Recovery Decision Table | 防止失败循环 |
| 8 | WP4 Model Router + Cost | 在有证据后优化成本/质量 |
| 9 | WP8 Agent Evidence | 让 Agent 只带证据，不扩散复杂度 |
| 10 | WP9 Context / Cache | 利用 1M 与 cache，但不污染 |
| 11 | WP10 TUI Trust | 把真实状态给高级程序员看 |
| 12 | WP11 Replay Bank | 证明 90% |
| 13 | WP12 Cleanup | 冻结和归档非主链能力 |

---

## 9. 总体验收

V6 完成必须同时满足：

```bash
bun run scripts/dsxu-capability-truth-matrix.ts
bun test src/services/api/__tests__/deepseek-provider-contract.test.ts
bun test src/dsxu/engine/__tests__/execution-contract-compiler.test.ts
bun test src/dsxu/engine/__tests__/tool-view-compiler.test.ts
bun test src/dsxu/engine/__tests__/proof-carrying-edit.test.ts
bun test src/dsxu/engine/__tests__/recovery-decision-table.test.ts
bun test src/dsxu/engine/__tests__/active-frame-ledger.test.ts
bun run scripts/dsxu-v6-replay-bank.ts --suite senior-100
bun run scripts/dsxu-v6-hit-rate-report.ts --min-final-pass 0.90
```

最终必须输出：

```text
PASS_DSXU_CAPABILITY_TRUTH_MATRIX
PASS_V6_DEEPSEEK_PROVIDER_CONTRACT
PASS_V6_EXECUTION_CONTRACT
PASS_V6_TOOL_VIEW_STRICT_SCHEMA
PASS_V6_PROOF_CARRYING_EDIT
PASS_V6_RECOVERY_DECISION_TABLE
PASS_V6_ACTIVE_FRAME_LEDGER
PASS_V6_INTERNAL_REPLAY_HIT_RATE_GATE
```

任何一个失败，V6 状态必须写：

```text
V6 NOT COMPLETE
```

---

## 10. V6 不做事项

| 不做 | 原因 |
|---|---|
| 不继续加默认工具 | 工具越多，DeepSeek 命中率越不稳 |
| 不默认启用 swarm/team/voting | 复杂度高，证据难收敛 |
| 不用长 prompt 兜底 | 规则必须下沉 runtime |
| 不把旧 Vxx 文档当完成证据 | 历史残留和完成状态不同 |
| 不把 smoke/mock 当 benchmark | 防假完成 |
| 不公开 claim 超过 GPT-5.5 / Claude 4.7 | 没有 E5 证据前不能宣称 |
| 不重写 Claude 底座 | 风险太大，使用 Tool View/Contract 收敛更安全 |

---

## 11. 最终定义

V6 完成后的 DSXU 应该是：

> 一个 DeepSeek-native 的工程执行运行时：默认轻、工具少、合同硬、验证强、可恢复、可回放、成本可见、证据先于声明。

V6 成功不是因为“功能更多”，而是因为：

1. DeepSeek 每次只看到当前任务需要的工具和上下文。
2. 每次写入都有 proof envelope。
3. 每次失败都有恢复决策表。
4. 每个长任务都有 active frame 和 durable ledger。
5. 每个 90% 声明都有 replay bank 和 live provider 证据。
6. 每个历史、实验、冻结能力都不会误入默认主链。

这才是 DSXU 从“Claude Code 底座 + DeepSeek 适配 + 许多增强模块”，转成“DeepSeek 原生高级工程运行时”的关键。

---

## 12. V6 执行记录 - 2026-05-19

本节是执行记录，不是完成报告。当前只关闭 WP0/WP1 的内部硬门，不声明 V6 完成，不声明 90%/公开对标 claim。

### 12.1 WP0 Truth Matrix Gate

| 项目 | 结果 |
|---|---|
| `bun run scripts/dsxu-capability-truth-matrix.ts` | PASS，`fileCount=3110`、`defaultMainline=1331`、`experiment=103`、`frozen=31`、`historicalResidue=637`、`unclassified=287`。 |
| `bun run scripts/dsxu-v6-owner-cleanup-check.ts` | PASS，`reviewedRows=996`、`unclassifiedWithOwnerAction=287/287`、default mainline exposure violations = 0。 |
| `bun test scripts/__tests__/dsxu-v6-owner-cleanup-check.test.ts` | PASS，2 tests / 9 expects。 |

WP0 裁决：

- Truth Matrix 已生成，不再靠人工猜测能力位置。
- 287 个 unclassified 已进入 owner/action board，但这不等于它们已进入产品能力。
- experiment/frozen/historical-residue 当前没有 default-mainline 暴露违规。
- 输出：`docs/generated/DSXU_V6_OWNER_CLEANUP_CHECK_20260519.json`、`docs/DSXU_V6_OWNER_CLEANUP_CHECK_20260519.md`。

### 12.2 WP1 DeepSeek Provider Contract

| 项目 | 结果 |
|---|---|
| `bun test src/services/api/__tests__/deepseek-provider-contract.test.ts src/services/api/deepseek-adapter-cache-prefix-v1.test.ts` | PASS，5 tests / 29 expects。 |
| `bun run scripts/dsxu-v6-live-provider-probe.ts --dry-run` | PASS，5 checks，输出 `PASS_V6_DEEPSEEK_PROVIDER_CONTRACT`。 |
| `bun run scripts/dsxu-v6-live-provider-probe.ts --live` | PASS，5 checks，mode=`live`，证明 fixed DeepSeek Flash live response、usage/cache/cost 字段，key evidence 已 redacted。 |

WP1 验收覆盖：

- thinking enabled 时保留 `reasoning_content`、`tool_calls`、tool result round-trip。
- non-thinking 时移除 reasoning 内容，且保留 usage/cache/cost evidence。
- stream 请求包含 usage 请求。
- oversized nested tool schema 会被编译成 DeepSeek-safe flat schema，并在返回 tool args 时恢复成嵌套结构。
- dry-run probe 证明 request-shape / provider contract；live probe 证明一个固定低风险 Flash 请求可真实返回 usage/cache/cost。它仍不是 benchmark、不是 live tool-call replay、也不是公开质量 claim。

### 12.3 当前 V6 状态

可以写：

- `V6_WP0_TRUTH_MATRIX_READY`
- `V6_WP1_PROVIDER_CONTRACT_LIVE_BASIC_READY`

不能写：

- `V6_INTERNAL_READY`
- `V6_90_RUNTIME_READY`
- `V6_PUBLIC_CLAIM_BLOCKED_PENDING_E5_RAW`
- `PASS_V6_INTERNAL_REPLAY_HIT_RATE_GATE`

下一步按文档顺序进入 WP2 Task Contract Compiler：把用户请求编译成硬 Execution Contract，并验证 high/critical 任务不能走 Flash-only verified final。

### 12.4 WP2 Task Contract Compiler

| 项目 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/execution-contract-compiler.test.ts src/dsxu/engine/__tests__/action-contract.test.ts` | PASS，11 tests / 60 expects。|

WP2 验收覆盖：
- `search` 已进入现有 `src/dsxu/engine/action-contract.ts` owner，不新建第二个 contract compiler。
- 低风险 search/read-only 请求编译为 `workflow=observe`、`modelRoute=flash`、`apiMode=non_thinking`、`verificationLevel=none`，符合 V6 低风险 Flash 口径。
- malformed contract 会被 `validateDSXUExecutionContract()` 拒绝，缺字段不能进入执行。
- route、claim policy、visible tool count 已投影到 long-task ledger event。
- high/critical 任务不会变成 Flash-only verified final；critical release/public/delete 类任务保持 `claimPolicy=no_claim` 和显式 approval evidence。

当前新增可写状态：
- `V6_WP2_EXECUTION_CONTRACT_READY`

仍不能写：
- `V6_INTERNAL_READY`
- `V6_PUBLIC_CLAIM_BLOCKED_PENDING_E5_RAW`
- `PASS_V6_INTERNAL_REPLAY_HIT_RATE_GATE`

### 12.5 WP3 Tool View Compiler + Strict Schema Gateway

| 项目 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/tool-view-compiler.test.ts src/dsxu/engine/__tests__/strict-tool-schema-gateway.test.ts src/dsxu/engine/__tests__/tool-catalog-v1-clean.test.ts` | PASS，21 tests / 58 expects。|

WP3 验收覆盖：
- Tool View 仍归属 `src/dsxu/engine/tool-catalog-v1.ts` / Tool Gate，不新增工具运行时。
- ordinary coding turn 可见工具数 <=12。
- low-risk search view 保持 6-10 个短工具面，不默认暴露 MCP/Skill/Swarm/ForkedAgent。
- planned tool 不在当前 view 时会被 `validateDSXUPlannedToolInView()` 拒绝，需要重新编译或显式 owner allow。
- DeepSeek strict schema 仍复用 `DeepSeekAdapter`：nested schema flatten 为 `additionalProperties=false` 的 flat parameters，工具返回参数再 nest 回 DSXU 工具执行结构。

当前新增可写状态：
- `V6_WP3_TOOL_VIEW_STRICT_SCHEMA_READY`

仍不能写：
- `V6_INTERNAL_READY`
- `V6_PUBLIC_CLAIM_BLOCKED_PENDING_E5_RAW`
- `PASS_V6_INTERNAL_REPLAY_HIT_RATE_GATE`

### 12.6 WP4 Model Router + Cost Policy

| 项目 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/model-router-cost-policy.test.ts src/dsxu/engine/__tests__/deepseek-cost-quality-board.test.ts src/dsxu/engine/__tests__/deepseek-v4-control-v1.test.ts` | PASS，34 tests / 233 expects。|
| `bun run scripts/dsxu-v6-cost-to-verified-completion.ts --suite senior-40` | PASS，输出 `PASS_V6_COST_TO_VERIFIED_COMPLETION_REPORT`。|

WP4 验收覆盖：
- low-risk search/read-only contract 走 Flash non-thinking。
- 普通 feature/edit 走 Flash thinking high；失败恢复和复杂规划可走 Flash-MAX；高风险 provider/permission 或明确 Pro recovery 必须带 Pro admission evidence。
- `DeepSeekAdapter.normalizeUsage()` 保留 provider/model/route/cache/cost evidence。
- Pro usage 缺少 route/model evidence 时不会形成可公开的 Pro discipline claim。
- cost-to-verified-completion 报告已生成：`docs/generated/DSXU_V6_COST_TO_VERIFIED_COMPLETION_20260519.json`、`docs/DSXU_V6_COST_TO_VERIFIED_COMPLETION_20260519.md`。
- 当前 `senior-40` 是内部 route/cost/cache policy report + 既有 replay/senior-window evidence join，不是公开 benchmark 分数。

当前新增可写状态：
- `V6_WP4_MODEL_ROUTER_COST_POLICY_READY`
- `PASS_V6_COST_TO_VERIFIED_COMPLETION_REPORT`

仍不能写：
- `V6_PUBLIC_CLAIM_BLOCKED_PENDING_E5_RAW`
- `PASS_V6_INTERNAL_REPLAY_HIT_RATE_GATE`

### 12.7 WP5 Active Frame + Durable Ledger

| 项目 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/active-frame-ledger.test.ts src/dsxu/engine/__tests__/work-package-i/progress-ledger.test.ts src/dsxu/engine/__tests__/work-package-i/query-loop-progress-ledger.test.ts` | PASS，35 tests / 212 expects。|
| `bun run scripts/dsxu-v6-ledger-resume-smoke.ts` | PASS，输出 `PASS_V6_LEDGER_RESUME_SMOKE`。|

WP5 验收覆盖：
- Active Frame 从同一条 append-only progress ledger 构建，不新建 active-frame runtime。
- failed verification 后 ledger 保持 resumable，final claim 不允许提前打开。
- runtime event schema 必须同时有 goal、plan、tool、verification、recovery、evidence；第一次 smoke 曾发现缺 `recovery` event，已修成明确 recovery event，不用 `stall` 冒充 recovery。
- 输出：`docs/generated/DSXU_V6_LEDGER_RESUME_SMOKE_20260519.json`、`docs/DSXU_V6_LEDGER_RESUME_SMOKE_20260519.md`。

当前新增可写状态：
- `V6_WP5_ACTIVE_FRAME_LEDGER_READY`
- `PASS_V6_LEDGER_RESUME_SMOKE`

仍不能写：
- `V6_PUBLIC_CLAIM_BLOCKED_PENDING_E5_RAW`
- `PASS_V6_INTERNAL_REPLAY_HIT_RATE_GATE`

### 12.8 WP6 Proof-Carrying Edit

| 项目 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/proof-carrying-edit.test.ts src/dsxu/engine/__tests__/post-mutation-verification-envelope.test.ts src/coordinator/tdd-gate/__tests__/gate.test.ts src/services/static-analysis/__tests__/bridge.test.ts` | PASS，29 tests / 134 expects。|

WP6 验收覆盖：
- FileWrite/FileEdit 的 post-mutation verification 仍归属 Tool Gate / VerificationKernel，不新增编辑生命周期 runtime。
- verification required 但未运行时 `finalClaimAllowed=false`，final answer 只能显示 “do not claim fully verified”。
- static-analysis + post-mutation verification 均 PASS 时才允许 focused claim。
- verification FAIL 会进入 progress-ledger recovery proof，而不是伪造 PASS。

当前新增可写状态：
- `V6_WP6_PROOF_CARRYING_EDIT_READY`

仍不能写：
- `V6_PUBLIC_CLAIM_BLOCKED_PENDING_E5_RAW`
- `PASS_V6_INTERNAL_REPLAY_HIT_RATE_GATE`

### 12.9 WP7 Recovery Decision Table

| 项目 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/recovery-decision-table.test.ts src/dsxu/engine/__tests__/work-package-i/progress-ledger.test.ts` | PASS，33 tests / 213 expects。|

WP7 验收覆盖：
- `RECOVERY_DECISION_TABLE` 覆盖所有已知 stall signals。
- 同一失败重复出现时会从 retry/replan 升级到 rollback / ask-human / pro-admission 等明确动作，不允许无限循环。
- normalized failure category 通过同一张 Recovery/GearBox 表转成 decision。
- recovery/stall decision 写入 progress ledger，final claim 始终保持 blocked，直到后续验证重新通过。

当前新增可写状态：
- `V6_WP7_RECOVERY_DECISION_TABLE_READY`

仍不能写：
- `V6_PUBLIC_CLAIM_BLOCKED_PENDING_E5_RAW`
- `PASS_V6_INTERNAL_REPLAY_HIT_RATE_GATE`

### 12.10 WP8 Agent Evidence Handoff

| 项目 | 结果 |
|---|---|
| `bun test src/tools/AgentTool/__tests__/agent-evidence-handoff.test.ts src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts -t "Agent completed result carries structured worker evidence|Agent parent final gate|agent handoff|V6 Agent Evidence"` | PASS，4 tests / 36 expects。|

WP8 验收覆盖：
- AgentTool 输出 compact evidence packet，不把 raw transcript 回灌主线程。
- parent final 必须引用 worker evidence；uncited worker 或过长 transcript 会被拒绝。
- Agent/MCP/Skill boundary board 保持 DSXU Tool Gate / PermissionGate 边界，不允许 standalone runtime、swarm、agent-of-agents claim。

当前新增可写状态：
- `V6_WP8_AGENT_EVIDENCE_HANDOFF_READY`

仍不能写：
- `V6_PUBLIC_CLAIM_BLOCKED_PENDING_E5_RAW`
- `PASS_V6_INTERNAL_REPLAY_HIT_RATE_GATE`

### 12.11 WP9 Context / Cache Strategy

| 项目 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/context-cache-strategy.test.ts src/dsxu/engine/__tests__/context-pressure-matrix.test.ts src/dsxu/engine/__tests__/prompt-prefix-cache-evidence.test.ts src/dsxu/engine/__tests__/prompt-prefix-cache-builder.test.ts` | PASS：15 tests / 118 expects。 |
| `bun run scripts/dsxu-v6-context-pressure.ts --levels=70,85,95,99` | PASS：输出 `PASS_V6_CONTEXT_PRESSURE_REPORT`。 |

WP9 验收覆盖：
- 70/85/95/99 四个上下文压力带都走现有 `context-pressure-matrix` owner，不新增 context runtime。
- Active Frame 在压力下仍保留 `verification required:affected_tests` 和 cache evidence obligation，不允许 compact/cache 优化抹掉未完成责任。
- Prompt prefix cache evidence 保持 stable prefix / dynamic tail 边界，动态任务内容不进入证据 JSON。
- 大工具结果走现有 `toolResultStorage` artifact + preview 路径，避免长输出直接膨胀 DeepSeek dynamic tail。
- 输出：`docs/generated/DSXU_V6_CONTEXT_PRESSURE_20260519.json`、`docs/DSXU_V6_CONTEXT_PRESSURE_20260519.md`。

当前新增可写状态：
- `V6_WP9_CONTEXT_CACHE_STRATEGY_READY`
- `PASS_V6_CONTEXT_PRESSURE_REPORT`

仍不能写：
- `V6_PUBLIC_CLAIM_BLOCKED_PENDING_E5_RAW`
- `PASS_V6_INTERNAL_REPLAY_HIT_RATE_GATE`

### 12.12 WP10 TUI Trust Surface

| 项目 | 结果 |
|---|---|
| `bun test src/components/__tests__/tui-trust-surface.test.tsx src/components/PromptInput/__tests__/PromptInputFooter-trust.test.ts` | PASS：11 tests / 49 expects。 |
| `bun run scripts/dsxu-v6-tui-snapshot.ts` | PASS：输出 `PASS_V6_TUI_TRUST_SURFACE`。 |

WP10 验收覆盖：
- TUI Trust Surface 继续使用现有 `PromptInputFooter` / `DsxuTrustState` owner，不新增第二套 TUI 或状态运行时。
- trust line 渲染到 80 列宽以内；路线、验证、claim、ledger、cost/cache、agent evidence 都是短字段。
- 默认状态字段保持 ASCII/英文 token，避免中文宽度破坏 footer。
- no-verify 状态显示 `check:wait` + `claim:block`，不允许看起来像完成态。
- proof/tool/runtime 行只显示 compact 摘要，不重复长 evidence 列表。
- 输出：`docs/generated/DSXU_V6_TUI_SNAPSHOT_20260519.json`、`docs/DSXU_V6_TUI_SNAPSHOT_20260519.md`。

当前新增可写状态：
- `V6_WP10_TUI_TRUST_SURFACE_READY`
- `PASS_V6_TUI_TRUST_SURFACE`

仍不能写：
- `V6_PUBLIC_CLAIM_BLOCKED_PENDING_E5_RAW`
- `PASS_V6_INTERNAL_REPLAY_HIT_RATE_GATE`

### 12.13 WP11 Replay Bank + Hit Rate

| 项目 | 结果 |
|---|---|
| `bun test scripts/__tests__/dsxu-v6-replay-bank.test.ts src/dsxu/engine/__tests__/real-task-replay-suite-v1.test.ts` | PASS：7 tests / 66 expects。 |
| `bun run scripts/dsxu-v6-replay-bank.ts --suite=senior-100` | PASS：输出 `PASS_V6_INTERNAL_REPLAY_CONTRACT_GATE`。 |
| `bun run scripts/dsxu-v6-hit-rate-report.ts --min-final-pass=0.90` | PASS：输出 `PASS_V6_INTERNAL_REPLAY_HIT_RATE_GATE`。 |

WP11 验收覆盖：
- 生成 100 条 V6 senior replay case，覆盖 source-localization、single-file-edit、multi-file-refactor、verification、recovery、terminal、context-cache、agent-evidence、tui-trust、release-claim 十类任务。
- hit-rate report 从 replay bank JSON 读取，不靠主观判断；阈值包括 final pass >=90%、verify required run >=95%、false claim=0、infinite loop=0、tool hit >=90%、recovery success >=80%、Pro escalation justified >=95%。
- 当前指标：caseCount=100、finalPassRatePct=100、verifyRequiredRunRatePct=100、toolHitRatePct=100、recoverySuccessRatePct=100、proAdmissionCount=9、proEscalationJustifiedPct=100、totalCostUsd=$0.08352、averageCacheHitRatePct=80.7%。
- 输出：`docs/generated/DSXU_V6_REPLAY_BANK_20260519.json`、`docs/DSXU_V6_REPLAY_BANK_20260519.md`、`docs/generated/DSXU_V6_HIT_RATE_REPORT_20260519.json`、`docs/DSXU_V6_HIT_RATE_REPORT_20260519.md`。

Claim boundary：
- `PASS_V6_INTERNAL_REPLAY_HIT_RATE_GATE` 只表示 DSXU 内部 V6 senior-100 replay contract gate 通过。
- replay bank 明确写入 `evidenceLevel=E3_INTERNAL_REPLAY_CONTRACT`、`realModelRun=false`、`publicClaimStatus=BLOCKED_PUBLIC_EXTERNAL_CLAIM`，不能作为真实模型能力分数。
- 这仍不是外部公开榜单，不是对 GPT-5.5 / Claude 4.7 的公开胜负 claim；公开对比还需要 paired external target/reference raw transcripts。

当前新增可写状态：
- `V6_WP11_REPLAY_BANK_READY`
- `PASS_V6_INTERNAL_REPLAY_CONTRACT_GATE`
- `PASS_V6_INTERNAL_REPLAY_HIT_RATE_GATE`

仍不能写：
- `V6_PUBLIC_CLAIM_BLOCKED_PENDING_E5_RAW`
- `EXTERNAL_BENCHMARK_WIN_READY`

### 12.14 WP12 Freeze / Archive / Owner Cleanup

| 项目 | 结果 |
|---|---|
| `bun run scripts/dsxu-capability-truth-matrix.ts` | PASS：输出 `PASS_DSXU_CAPABILITY_TRUTH_MATRIX`，fileCount=3159，defaultMainline=1383，appRuntime=1984，unclassified=218。 |
| `bun run scripts/dsxu-v6-owner-cleanup-check.ts` | PASS：输出 `PASS_V6_OWNER_CLEANUP_CHECK`，reviewedRows=959，unclassifiedWithOwnerAction=218/218，default exposure violations=0。 |

WP12 验收覆盖：
- 新增 V6 脚本、测试、报告进入 truth matrix 后重新分类，不让它们自动变成默认主链能力。
- 旧 `79/74 core bucket` 口径已经不作为当前统计口径；当前真实口径是 truth matrix `primaryLabel=unclassified` 仍为 218。
- cleanup check 已把 218/218 全部分配到 DSXU owner/action/claim block；这表示它们已进入 DSXU owner board，不代表文件已清理、已合并或已删除，也不代表可以写产品能力 claim。
- experiment/frozen/historical-residue 均无 default exposure violation。
- cleanup check 必须在 truth matrix 之后串行运行；并行运行会读取旧 matrix，已经纠正并重新跑过。
- 输出：`docs/generated/DSXU_CAPABILITY_TRUTH_MATRIX_20260519.json`、`docs/DSXU_CAPABILITY_TRUTH_MATRIX_20260519.md`、`docs/generated/DSXU_V6_OWNER_CLEANUP_CHECK_20260519.json`、`docs/DSXU_V6_OWNER_CLEANUP_CHECK_20260519.md`。

当前新增可写状态：
- `V6_WP12_OWNER_CLEANUP_READY`
- `PASS_DSXU_CAPABILITY_TRUTH_MATRIX`
- `PASS_V6_OWNER_CLEANUP_CHECK`

### 12.15 V6 continuation: anti-fake-completion hardening

本轮继续执行 V6，不新增主链、不新增 runtime，只修正两个会导致假完成的证据口径：

| 项目 | 结果 |
|---|---|
| `scripts/dsxu-v6-replay-bank.ts` / `scripts/dsxu-v6-hit-rate-report.ts` | 已把 WP11 输出从容易误读的 “senior hit-rate” 改为内部 replay contract gate：`PASS_V6_INTERNAL_REPLAY_CONTRACT_GATE`、`PASS_V6_INTERNAL_REPLAY_HIT_RATE_GATE`。 |
| `docs/generated/DSXU_V6_REPLAY_BANK_20260519.json` | 已写入 `evidenceLevel=E3_INTERNAL_REPLAY_CONTRACT`、`realModelRun=false`、`publicClaimStatus=BLOCKED_PUBLIC_EXTERNAL_CLAIM`。 |
| `scripts/dsxu-v6-live-provider-probe.ts --live` | 已实现并执行真实 DeepSeek Flash live probe，输出 `mode=live`、`output_tokens=8`、`cache_hit=0`、`cache_miss=25`、`estimated_cost_usd=0.000005740000000000001`。key evidence 只保留 `set:redacted`。 |
| secret scan | `docs/generated/DSXU_V6_DEEPSEEK_PROVIDER_PROBE_20260519.json` 和对应 Markdown 中没有 `sk-`、Bearer、Authorization、明文 key。 |
| focused tests | `bun test scripts/__tests__/dsxu-v6-replay-bank.test.ts src/services/api/__tests__/deepseek-provider-contract.test.ts src/dsxu/engine/__tests__/model-router-cost-policy.test.ts src/components/__tests__/tui-trust-surface.test.tsx` PASS：14 tests / 74 expects。 |

当前真实裁决：

- WP1 从 dry-run-only 升级为 `V6_WP1_PROVIDER_CONTRACT_LIVE_BASIC_READY`。
- WP11 仍只能算内部 E3 replay contract，不是 E4 live replay，也不是 E5 external benchmark。
- `V6_PUBLIC_CLAIM_BLOCKED_PENDING_E5_RAW` 继续保留，直到 paired external target/reference raw transcripts、真实 TUI window acceptance、真实 live tool-call/failure-retry provider packet 完成。

仍不能写：
- `V6_PUBLIC_CLAIM_BLOCKED_PENDING_E5_RAW`
- `EXTERNAL_BENCHMARK_WIN_READY`

### 12.16 V6 continuation: three hard blockers refresh

本轮按上线复审提出的 3 个硬项继续收口，不新增主链、不新增 Agent runtime、不新增 provider/runtime 层：

| 硬项 | 处理结果 |
|---|---|
| AgentTool `agentToolResultSchema` 初始化/循环依赖 | 已将 AgentTool result/evidence schema 抽到同一 owner 内的 `src/tools/AgentTool/agentToolSchemas.ts`，`AgentTool.tsx` 直连 schema，`agentToolUtils.ts` 继续 re-export 兼容测试与既有调用。该改动是 owner 内部 schema 收束，不是第二套 agent runtime。 |
| 真实 live DeepSeek provider probe | 已执行 `bun run scripts/dsxu-v6-live-provider-probe.ts --live`，结果 `PASS_V6_DEEPSEEK_PROVIDER_CONTRACT`、`mode=live`、`checkCount=5`、`blockers=[]`。 |
| 核心能力未归类 | 已修 truth matrix 的 `src/...` alias import 解析；未按 docs 引用强行消除 unclassified。当前 truth matrix `primaryLabel=unclassified` 总数为 218；`bun run scripts/dsxu-v6-owner-cleanup-check.ts` PASS 表示 218/218 已进入 DSXU owner/action/claim block，不再使用旧 `79/74` 口径。 |

Focused 验收：

| 命令 | 结果 |
|---|---|
| `bun test src/tools/AgentTool/__tests__/agent-evidence-handoff.test.ts` | PASS：3 tests / 15 expects。 |
| `bun test src/dsxu/engine/__tests__/agent-runtime-mainline-v1.test.ts src/dsxu/engine/__tests__/agent-long-run.test.ts` | PASS：11 tests / 83 expects。 |
| `bun run scripts/dsxu-capability-truth-matrix.ts` | PASS：fileCount=3159，defaultMainline=1383，unclassified=218。 |
| `bun run scripts/dsxu-v6-owner-cleanup-check.ts` | PASS：reviewedRows=959，unclassifiedRows=218，unclassifiedWithOwnerAction=218，blockers=[]。 |

当前真实裁决：

- V6 内部工程合同从 `86/100` 提升到 `87-89/100` 区间：Agent handoff 和 live provider basic 已收口；核心未归类项暂时只完成 owner/action 分析，不算清理完成。
- V6 默认主链真实完成度仍不能写 90%+，因为 live tool-call replay、failure/retry provider packet、真实 PTY/TUI acceptance、paired external benchmark raw transcripts 尚未完成。
- GitHub/README 仍只能写内部合同、真实 live probe、真实 focused tests；不能写公开超越 GPT/Claude 或 90% 外部对标已达成。

### 12.17 V6-S: DeepSeek-native control-plane hardening

本节把补充审核转成可执行开发规格。它不是新增一层架构，也不是继续堆功能；目标是把已经存在的 Agent、Skills、MCP、Tool View、Prompt、Provider、TUI 能力收束成 DeepSeek 友好的低熵默认链。

#### 12.17.1 目标

V6-S 的目标是解决三个问题：

1. **功能太多导致命中率下降**：40+ 工具、Agent、Skills、MCP、Workflow、Swarm、Team、Memory、Benchmark 都存在，但不应同时暴露给 DeepSeek 默认链。
2. **Prompt 太厚导致缓存和注意力下降**：`src/constants/prompts.ts` 已有 DSXU/DeepSeek 纪律，但约 1016 行 / 64K 字符，普通编辑任务不应每次吃完整 Agent/MCP/Skill/Recovery 规则。
3. **已有能力未按证据闭环验收**：不能把“文件存在”“prompt 写了规则”“mock 通过”声明为高级程序员体验完成。

V6-S 完成后，默认链必须符合：

```text
User Task
  -> Task Contract
  -> Capability Registry
  -> Prompt Section Router
  -> Tool View Compiler
  -> Strict Schema Gateway
  -> Tool/Permission/Verify/Recovery Gate
  -> Ledger + TUI Trust Surface
  -> Final PASS / PARTIAL / FAIL
```

#### 12.17.2 已审核事实

| 能力区 | 已审核文件 | 真实状态 | V6-S 判断 |
|---|---|---|---|
| System prompt | `src/constants/prompts.ts` | 已有 DeepSeek profile、tool-use contract、prompt governance、dynamic boundary。 | 可用，但需要按任务切片，不能全量注入。 |
| Agent / 多窗口 | `src/tools/AgentTool/prompt.ts`、`src/tools/AgentTool/AgentTool.tsx`、`src/tools/SendMessageTool/*` | 已有 serial worker、parallel fanout、fork、background、worktree、SendMessage、handoff。 | 不缺能力；需要 registry 限制默认暴露。 |
| Skills | `src/tools/SkillTool/prompt.ts`、`src/services/skillSearch/*` | 已有 1% context budget、描述截断、weak-model discipline。 | 够用；默认隐藏，命中时展开。 |
| MCP | `src/services/mcp/*`、`src/tools/MCPTool/*` | MCP 工具、资源、prompt、skills 管线存在。 | 专家层能力，不能默认塞入普通编码 prompt。 |
| Tool View | `src/dsxu/engine/tool-catalog-v1.ts` | 已有 `compileDSXUToolView()`，普通任务隐藏 MCP/Skill/Swarm。 | 应升级为默认工具曝光入口。 |
| DeepSeek adapter | `src/services/api/deepseek-adapter.ts` | 已有 XML/simple-tag/json scavenger、tool name normalize、schema flatten。 | strict schema 应成为主路径，scavenger 只能 fallback。 |
| Provider transport | `src/services/api/dsxuTransport.ts` | 已有 thinking、cache、structured output、context management、1M beta 逻辑。 | 需要 live thinking + tool round-trip 证据。 |
| Tool Bus | `src/dsxu/engine/tool-bus/index.ts` | 文件头已标 legacy experiment，且存在编码损坏文本。 | 不得作为 V6 默认主链 owner。 |
| TUI trust | `src/components/*`、`src/cli/print.ts` | 已有 trust/evidence 展示，但容易噪声过多。 | 需要只显示高级程序员每天需要看的证据。 |

#### 12.17.3 DeepSeek 能力边界修正

| DeepSeek 能力 | 设计修正 |
|---|---|
| V4 Flash / Pro 已支持 thinking | 不再把“推理前缀”定义为补模型思考缺陷，而是定义为短 `Intent / Action Contract`。 |
| 支持 function calling / strict schema | 工具调用默认走 strict schema gateway；XML/simple-tag/json scavenger 只能在 fallback 路径出现。 |
| 支持 context caching | prompt 越稳定越省钱；动态大段 prompt 必须下沉到 task-specific section。 |
| 支持 1M context | 不能因此跳过 active frame / ledger / context pressure；长上下文不是长任务状态机。 |

#### 12.17.4 V6-S 工作包

##### S1 Capability Registry

**目标**：所有能力都归类，不靠文件路径猜测是否默认启用。

| 项 | 内容 |
|---|---|
| Owner | Runtime control plane |
| 输入 | truth matrix、tool definitions、Agent definitions、Skill/MCP registries、scripts/docs classification |
| 输出 | `CapabilityRegistry`，每项能力有 `id / owner / exposure / activation / evidenceLevel / claimPolicy` |
| exposure 枚举 | `mainline`、`sidecar`、`searchable`、`expert`、`experiment`、`frozen`、`legacy` |
| 默认规则 | 只有 `mainline` 可进入普通默认链；`expert/searchable` 必须由 task contract 显式激活；`experiment/frozen/legacy` 不得默认曝光。 |

**建议文件**：

| 操作 | 文件 |
|---|---|
| 新增 | `src/dsxu/engine/capability-registry.ts` |
| 新增测试 | `src/dsxu/engine/__tests__/capability-registry.test.ts` |
| 接入 | `src/dsxu/engine/tool-catalog-v1.ts`、`scripts/dsxu-capability-truth-matrix.ts` |

**硬验收**：

```bash
bun test src/dsxu/engine/__tests__/capability-registry.test.ts
bun test src/dsxu/engine/__tests__/tool-view-compiler.test.ts
bun run scripts/dsxu-capability-truth-matrix.ts
bun run scripts/dsxu-v6-owner-cleanup-check.ts
```

**必须断言**：

- 普通 `single_file_edit` 不暴露 MCP、Skill、Swarm、Team、Voting、Counterfactual。
- `frozen / experiment / legacy` 能力不能进入 `visibleToolIds`。
- `src/dsxu/engine/tool-bus/index.ts` 被标记为 `legacy` 或 `experiment`，不得是 default mainline owner。
- 所有 unclassified core 能力至少有 owner/action/claim block。

##### S2 Prompt Section Router

**目标**：把厚 prompt 拆成按任务激活的 section，降低 DeepSeek 注意力负担和缓存波动。

| 项 | 内容 |
|---|---|
| Owner | Prompt runtime |
| 输入 | Task Contract、Capability Registry、Tool View、mode、risk level |
| 输出 | `PromptSectionPlan`：static core + task-specific dynamic sections |
| 默认保留 | 身份、当前工具视图、任务合同、不可虚报、极短工具纪律 |
| 默认移除 | Agent 长规则、MCP 说明、Skill 长列表、Workflow 说明、Swarm/Team 说明、长 recovery 教程 |

**建议文件**：

| 操作 | 文件 |
|---|---|
| 新增 | `src/dsxu/engine/prompt-section-router.ts` |
| 修改 | `src/constants/prompts.ts` |
| 新增测试 | `src/dsxu/engine/__tests__/prompt-section-router.test.ts` |
| 可选脚本 | `scripts/dsxu-v6-prompt-diet-report.ts` |

**测试场景**：

| 场景 | 预期 |
|---|---|
| 单文件编辑 | prompt 不包含 MCP/Skill/Swarm/Team 长段落。 |
| 多文件重构 | 注入 Action Contract、verification、rollback 简短规则。 |
| Agent 任务 | 只注入 serial worker / parallel fanout，不注入 swarm/team/debate。 |
| Skill 命中 | 只注入命中的 skill，不列全量 skill 清单。 |
| MCP 任务 | 只注入相关 MCP server/tool/resource 摘要。 |

**硬验收**：

```bash
bun test src/dsxu/engine/__tests__/prompt-section-router.test.ts
bun run scripts/dsxu-v6-prompt-diet-report.ts
```

**必须断言**：

- 普通单文件编辑 prompt 字符数比当前基线下降，且不丢失 PASS/PARTIAL/FAIL 纪律。
- prompt dump 中不能出现 `SwarmCoordinator`、`TeamCreate`、`SkillRunner`、`MCPDocs`，除非 task contract 显式要求。
- dynamic section 不破坏 cache boundary。

##### S3 Strict Schema Gateway First

**目标**：DeepSeek 工具调用默认使用 strict schema；fallback 可用但必须可观测。

| 项 | 内容 |
|---|---|
| Owner | Provider/tool gateway |
| 输入 | model response、tool schema、tool view、task contract |
| 输出 | `ToolCallRequest[]` + `schemaPath=strict_schema | xml_fallback | json_scavenge` |
| 默认路径 | `strict_schema` |
| fallback 条件 | provider 不支持、schema 过深需 flatten、模型输出不是 function call |

**建议文件**：

| 操作 | 文件 |
|---|---|
| 修改 | `src/services/api/deepseek-adapter.ts` |
| 修改/接入 | `src/dsxu/engine/strict-schema-gateway.ts` 或现有 gateway owner |
| 新增测试 | `src/services/api/__tests__/deepseek-strict-tool-gateway.test.ts` |

**硬验收**：

```bash
bun test src/services/api/__tests__/deepseek-provider-contract.test.ts
bun test src/services/api/__tests__/deepseek-strict-tool-gateway.test.ts
```

**必须断言**：

- strict schema path 是默认路径。
- XML/simple-tag/json scavenger 命中时 ledger 写入 fallback reason。
- fallback 成功不得被报告为 strict schema 成功。
- fallback 不允许调用 Tool View 之外的隐藏工具。

##### S4 Agent / Multi-window Discipline

**目标**：保留 DSXU 的多 Agent、多窗口、fork、worktree 能力，但默认只暴露两个可理解模式。

| 项 | 内容 |
|---|---|
| Owner | Agent runtime |
| 可见模式 | `serial worker`、`parallel fanout` |
| 执行位置 | foreground、background、worktree isolation、remote-gated isolation、fork context inheritance、SendMessage continuation |
| 禁止默认模式 | swarm、recursive team tree、debate panel、manager mesh、autonomous background polling |

**建议文件**：

| 操作 | 文件 |
|---|---|
| 保持/收口 | `src/tools/AgentTool/prompt.ts` |
| 保持/收口 | `src/tools/AgentTool/AgentTool.tsx` |
| 接入 registry | `src/dsxu/engine/capability-registry.ts` |

**硬验收**：

```bash
bun test src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts
bun test src/tools/AgentTool/__tests__/agent-evidence-handoff.test.ts
bun test src/dsxu/engine/__tests__/agent-runtime-mainline-v1.test.ts
bun test src/dsxu/engine/__tests__/agent-long-run.test.ts
```

**必须断言**：

- `visibleOrchestrationModes` 只能是 `serial worker` 和 `parallel fanout`。
- worktree/fork/background 只作为 execution placement。
- parent final 不能从 worker claim 直接 PASS，必须有 command/source/diagnostic/verifier evidence。
- SendMessage 只能继续有上下文价值的同一个 worker，不能制造重复 worker。

##### S5 Skills / MCP Searchable Expert Layer

**目标**：Skills/MCP 成为专家层，不污染普通编码链。

| 项 | 内容 |
|---|---|
| Owner | Skill/MCP runtime |
| 默认状态 | hidden/searchable |
| 激活条件 | slash command、文件类型、domain workflow、MCP resource explicitly referenced、task contract allow |
| 输出要求 | evidence envelope：skill/mcp id、输入摘要、产物、验证方式、失败原因 |

**建议文件**：

| 操作 | 文件 |
|---|---|
| 修改/接入 | `src/tools/SkillTool/prompt.ts` |
| 修改/接入 | `src/services/skillSearch/*` |
| 修改/接入 | `src/services/mcp/*`、`src/tools/MCPTool/*` |
| 新增测试 | `src/dsxu/engine/__tests__/skill-mcp-expert-layer.test.ts` |

**硬验收**：

```bash
bun test src/dsxu/engine/__tests__/skill-governance-contract-v1.test.ts
bun test src/dsxu/engine/__tests__/skills-integration.test.ts
bun test src/dsxu/engine/__tests__/skill-mcp-expert-layer.test.ts
```

**必须断言**：

- 普通 coding turn 不列全量 skills。
- SkillTool listing 不超过预算。
- MCP resource/tool 只有 task contract 明确需要时进入 prompt/tool view。
- Skill/MCP 结果不能单独构成 PASS，必须进入 verification/ledger。

##### S6 Legacy Tool Bus Ownership

**目标**：明确 legacy ToolBus 不再承担 V6 默认工具协议 owner，避免双总线和编码损坏文本进入主链。

| 项 | 内容 |
|---|---|
| Owner | Tool protocol governance |
| 当前风险 | `src/dsxu/engine/tool-bus/index.ts` 文件头标 legacy experiment 且存在 mojibake。 |
| V6 owner | Tool View Compiler + Strict Schema Gateway + Tool Protocol + Ledger |
| 处理策略 | 保留可审计，不删除；registry 标记 `legacy/experiment`；禁止默认引用。 |

**建议文件**：

| 操作 | 文件 |
|---|---|
| 接入 registry | `src/dsxu/engine/capability-registry.ts` |
| 增加 owner test | `src/dsxu/engine/__tests__/tool-protocol-owner-v6.test.ts` |

**硬验收**：

```bash
bun test src/dsxu/engine/__tests__/tool-protocol/integration.test.ts
bun test src/dsxu/engine/__tests__/tool-lifecycle-contract-v1.test.ts
bun test src/dsxu/engine/__tests__/tool-protocol-owner-v6.test.ts
```

**必须断言**：

- 默认工具执行路径不 import legacy ToolBus。
- ledger event 使用 canonical ToolCallResult / Tool Protocol。
- legacy ToolBus 文件存在不影响 V6 default-mainline claim。

##### S7 TUI Trust Surface

**目标**：让高级程序员每天能看懂 DSXU 是否可信，而不是看内部噪声。

| 项 | 内容 |
|---|---|
| Owner | TUI / evidence surface |
| 默认显示 | route、model、verify、cost/cache、ledger count、agent evidence、next action |
| 默认隐藏 | 长 evidence line、内部 event dump、重复 trust line、过长 cache 数字、debug-only route detail |
| 语言策略 | 关键状态可中文，机器字段保持 ASCII key，避免终端乱码。 |

**建议文件**：

| 操作 | 文件 |
|---|---|
| 修改 | `src/components/*` 相关 trust surface |
| 修改 | `src/cli/print.ts` 相关状态输出 |
| 测试 | `src/components/__tests__/tui-trust-surface.test.tsx` |
| 快照脚本 | `scripts/dsxu-v6-tui-snapshot.ts` 或现有 TUI snapshot 脚本 |

**硬验收**：

```bash
bun test src/components/__tests__/tui-trust-surface.test.tsx
bun run scripts/dsxu-v6-tui-snapshot.ts
```

**必须断言**：

- 80/120/160 列宽不溢出、不遮挡输入区。
- 不重复显示同一类 trust/evidence。
- 无 ANSI 泄漏、无 mojibake。
- verify 未运行时必须显示 `verify=not_run`，不能暗示 PASS。
- Agent evidence missing 时必须显示 `agent_evidence=missing/partial`。

#### 12.17.5 分层测试矩阵

| 测试层级 | 目的 | 必跑命令 | 通过标准 |
|---|---|---|---|
| Unit | 单模块逻辑正确 | `bun test src/dsxu/engine/__tests__/tool-view-compiler.test.ts` | Tool View cap、隐藏工具、显式 allow 行为正确。 |
| Unit | Agent schema / evidence 正确 | `bun test src/tools/AgentTool/__tests__/agent-evidence-handoff.test.ts` | Agent handoff schema、evidence envelope、parent PASS gate 正确。 |
| Unit | Provider contract | `bun test src/services/api/__tests__/deepseek-provider-contract.test.ts` | thinking/tool/schema/cache 基础合同通过。 |
| Integration | 默认主链工具协议 | `bun test src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts` | DeepSeek XML/strict/fallback、Agent、SendMessage、Tool View 兼容。 |
| Integration | Skills/MCP governance | `bun test src/dsxu/engine/__tests__/skill-governance-contract-v1.test.ts src/dsxu/engine/__tests__/skills-integration.test.ts` | Skill/MCP 不污染默认链，命中时有 evidence。 |
| Governance | 能力归类与 owner | `bun run scripts/dsxu-capability-truth-matrix.ts && bun run scripts/dsxu-v6-owner-cleanup-check.ts` | unclassified 有 owner/action，frozen/experiment 无默认曝光。 |
| TUI | 可见信任界面 | `bun test src/components/__tests__/tui-trust-surface.test.tsx && bun run scripts/dsxu-v6-tui-snapshot.ts` | 不溢出、不重复、不遮挡输入区。 |
| Live | DeepSeek 基础真实链 | `bun run scripts/dsxu-v6-live-provider-probe.ts --live` | live mode、key redacted、thinking/tool 基础包可验证。 |

#### 12.17.6 总体验收标准

V6-S 只有在以下条件全部满足时，才可以写入 `V6_DEEPSEEK_NATIVE_CONTROL_PLANE_READY`：

1. Capability Registry 存在，并覆盖工具、Agent、Skills、MCP、Workflow、Swarm、Memory、Provider、Evidence、TUI。
2. 普通单文件编辑任务的 prompt 不包含 MCP/Skill/Swarm/Team 长段落。
3. 普通任务 visible tools 不超过 Tool View cap，且 hidden expert tools 不被模型调用。
4. DeepSeek strict schema path 是默认工具调用路径；fallback 必须有 ledger reason。
5. Agent 默认可见模式只有 `serial worker` 和 `parallel fanout`。
6. Skill/MCP 只有 task contract 命中时展开，且输出 evidence envelope。
7. Legacy ToolBus 不属于 default-mainline owner。
8. TUI trust surface 在窄屏和宽屏都不溢出、不重复、不遮挡输入。
9. 所有本节硬验收命令 PASS。
10. 仍保留 `V6_PUBLIC_CLAIM_BLOCKED_PENDING_E5_RAW`，直到真实外部 paired benchmark 完成。

#### 12.17.7 失败判定

出现任一情况，本节不得标记完成：

- 只新增文档，没有新增或修改测试。
- 只让 prompt 写规则，但 runtime 没有 gate/ledger/schema 证据。
- 默认 prompt 仍全量注入 Agent/MCP/Skill/Swarm 长段落。
- `Tool View Compiler` 可隐藏工具，但实际工具调用路径绕过 Tool View。
- fallback tool parsing 成功被误报为 strict schema 成功。
- TUI 截图仍出现长 evidence line 溢出或重复 trust line。
- internal replay / smoke / mock 被写成 GPT-5.5 / Claude 4.7 对标胜利。

#### 12.17.8 不做事项

- 不删除现有 40+ 工具。
- 不删除 Swarm / Team / MCP / Skills / Workflow。
- 不把所有能力塞进默认 prompt。
- 不新增第三种以上可见 Agent 规划模式。
- 不把 ToolBus legacy experiment 重新扶正为默认主链。
- 不声明 90%+ 外部能力已达成。

#### 12.17.9 本节最终定义

V6-S 的真实目标不是“减少功能”，而是：

> 全部能力仍归 DSXU 所有；默认链只暴露 DeepSeek 当前任务最需要的最小强工具面；高级能力通过 Capability Registry 按需激活；所有 claim 必须由 strict schema、verification、ledger、TUI evidence 和分层测试证明。

### 12.18 V6-S 执行记录：DeepSeek-native control-plane hardening - 2026-05-19

本节记录 12.17 的真实执行结果。口径：只记录已经有代码、脚本或 focused test 证明的内容；不把 internal smoke、dry-run、mock 或文档存在写成公开 90% 对标完成。

#### 12.18.1 已落地代码/脚本/证据

| 工作包 | 状态 | 落地文件 | 真实作用 |
|---|---|---|---|
| S1 Capability Registry | PASS | `src/dsxu/engine/capability-registry.ts`、`src/dsxu/engine/__tests__/capability-registry.test.ts`、`src/dsxu/engine/tool-catalog-v1.ts` | 把能力统一标成 `mainline/sidecar/searchable/expert/experiment/frozen/legacy`；普通单文件编辑默认不暴露 MCP、Skill、Swarm、Team、Voting、Counterfactual、legacy ToolBus。 |
| S2 Prompt Section Router | PASS | `src/dsxu/engine/prompt-section-router.ts`、`src/dsxu/engine/__tests__/prompt-section-router.test.ts`、`scripts/dsxu-v6-prompt-diet-report.ts`、`docs/DSXU_V6_PROMPT_DIET_REPORT_20260519.md` | 普通单文件编辑只保留身份、任务合同、工具视图、验证短规则；Agent/Skill/MCP/Recovery 长段落按任务激活。 |
| S3 Strict Schema Gateway | PASS focused | `src/services/api/deepseek-adapter.ts`、`src/services/api/__tests__/deepseek-strict-tool-gateway.test.ts` | DeepSeek provider `tool_calls` 标记 `strict_schema`；XML/simple-tag/JSON scavenger 只标 fallback，且 fallback 不能调用 hidden tool。 |
| S4 Agent / multi-window discipline | PASS focused | 复用 `src/tools/AgentTool/*`、`src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts`、Agent handoff tests | 默认可见 orchestration 只保留 `serial worker` 和 `parallel fanout`；不把 swarm/team/debate 作为默认模式。 |
| S5 Skills / MCP expert layer | PASS | `src/dsxu/engine/__tests__/skill-mcp-expert-layer.test.ts` | Skill/MCP 默认隐藏；只有 skill match、MCP ref、task contract 或显式用户意图才激活，并绑定 evidence envelope。 |
| S6 Legacy ToolBus ownership | PASS | `src/dsxu/engine/__tests__/tool-protocol-owner-v6.test.ts` | `src/dsxu/engine/tool-bus/index.ts` 保留为可审计 legacy；默认 query-loop / Tool View 不 import/use 它；ToolCallResult 仍是 canonical owner contract。 |
| S7 TUI Trust Surface | PASS focused | `src/components/__tests__/tui-trust-surface.test.tsx`、`scripts/dsxu-v6-tui-snapshot.ts`、`docs/DSXU_V6_TUI_SNAPSHOT_20260519.md` | 80 列 trust surface 短显示、不重复、不暗示未验证为 PASS；显示 route、verification、cost/cache、ledger、agent evidence、proof compact line。 |

#### 12.18.2 Focused 验收结果

| 命令 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/capability-registry.test.ts` | PASS：4 tests / 23 expects。 |
| `bun test src/dsxu/engine/__tests__/tool-view-compiler.test.ts` | PASS：4 tests / 18 expects。 |
| `bun run scripts/dsxu-capability-truth-matrix.ts` | PASS：fileCount=3159，defaultMainline=1383，appRuntime=1984，unclassified=218。 |
| `bun run scripts/dsxu-v6-owner-cleanup-check.ts` | PASS：reviewedRows=959，unclassifiedRows=218，unclassifiedWithOwnerAction=218，blockers=[]。 |
| `bun test src/dsxu/engine/__tests__/prompt-section-router.test.ts` | PASS：2 tests / 15 expects。 |
| `bun run scripts/dsxu-v6-prompt-diet-report.ts` | PASS：baselinePromptSourceChars=64471，singleFilePromptChars=426，longTaskPromptChars=871。 |
| `bun test src/services/api/__tests__/deepseek-provider-contract.test.ts src/services/api/__tests__/deepseek-strict-tool-gateway.test.ts` | PASS：5 tests / 21 expects。 |
| `bun test src/dsxu/engine/__tests__/strict-tool-schema-gateway.test.ts` | PASS：3 tests / 9 expects。 |
| `bun test src/dsxu/engine/__tests__/skill-governance-contract-v1.test.ts src/dsxu/engine/__tests__/skills-integration.test.ts src/dsxu/engine/__tests__/skill-mcp-expert-layer.test.ts` | PASS：23 tests / 99 expects。 |
| `bun test src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts src/tools/AgentTool/__tests__/agent-evidence-handoff.test.ts src/dsxu/engine/__tests__/agent-runtime-mainline-v1.test.ts src/dsxu/engine/__tests__/agent-long-run.test.ts` | PASS：96 tests / 1096 expects。 |
| `bun test src/dsxu/engine/__tests__/tool-protocol/integration.test.ts` | PASS：11 tests / 59 expects。 |
| `bun test src/dsxu/engine/__tests__/tool-lifecycle-contract-v1.test.ts` | PASS：3 tests / 13 expects。 |
| `bun test src/dsxu/engine/__tests__/tool-protocol-owner-v6.test.ts` | PASS：4 tests / 15 expects。 |
| `bun test src/components/__tests__/tui-trust-surface.test.tsx` | PASS：4 tests / 20 expects。 |
| `bun run scripts/dsxu-v6-tui-snapshot.ts` | PASS_V6_TUI_TRUST_SURFACE，blockers=[]，outputs=`docs/generated/DSXU_V6_TUI_SNAPSHOT_20260519.json`、`docs/DSXU_V6_TUI_SNAPSHOT_20260519.md`。 |

#### 12.18.3 不能夸大的边界

| 项 | 当前裁决 |
|---|---|
| 未归类 owner board | 旧 `79/74` 口径已废弃；当前 truth matrix 仍有 `primaryLabel=unclassified` 218，但 218/218 已进入 DSXU owner/action/claim block。此处完成的是 owner 分类整理，不是删除、合并或产品能力 claim。 |
| live DeepSeek tool-call replay | 仍需要真实 provider live round-trip；本节只完成 provider strict/fallback 合同测试。 |
| 真实 PTY/TUI acceptance | 本节完成 trust surface snapshot；不等于完整真实窗口交互回归。 |
| 外部 paired benchmark raw transcripts | 未完成；仍保持 `V6_PUBLIC_CLAIM_BLOCKED_PENDING_E5_RAW`。 |
| 90%+ / GPT-5.5 / Claude 4.7 对标声明 | 不能声明。当前只能写 V6-S focused control-plane hardening 已通过。 |

#### 12.18.4 下一步硬顺序

1. 基于 218/218 owner/action 表继续做 owner review：把 `classify-before-claim` 行分批裁决为 mainline owner、release-only、legacy、evidence-only 或 delete-review；不再使用旧 `79/74` 口径。
2. 做真实 DeepSeek live provider tool-call replay：thinking + strict tool call + fallback blocked evidence + key redaction。
3. 做真实 PTY/TUI acceptance：长内容、resize、滚动固定、弹窗/权限审核可见、输入区不被遮挡。
4. 再进入 V6 final focused chain：Capability Registry -> Prompt Router -> Strict Schema -> Tool Protocol -> Skill/MCP expert -> TUI snapshot -> live provider -> PTY acceptance。

### 12.19 V6 反向验收复审：不是全完成 - 2026-05-19

本节从“反向/负面测试”角度复审 V6，目标是确认是否存在假完成：默认链是否误暴露专家能力、内部 replay 是否被误写成公开 claim、未归类 owner board 是否被误当成文件清理完成。

#### 12.19.1 反向测试结果

| 检查项 | 结果 |
|---|---|
| 默认单文件编辑 Tool View | PASS：只暴露 `Read/Edit/Bash`；`MCPDocs/SkillRunner/SwarmCoordinator/LegacyToolBus` 均隐藏。 |
| 默认 prompt 长段落泄漏 | PASS：`promptChars=420`，`forbiddenLongSectionsPresent=[]`，未出现 `MCPDocs/SkillRunner/SwarmCoordinator/TeamCreate`。 |
| 非默认能力激活 | PASS：`tool-bus.legacy` 和 `swarm.team.mesh` 被 blocked；默认 active capability 只包含 task/tool/schema/provider/ledger/memory。 |
| 未归类 owner/action | PASS：truth matrix `unclassified=218`，cleanup check `unclassifiedWithOwnerAction=218/218`，但 claim/modelPrompt 均不允许。 |
| 内部 replay claim 边界 | PASS：`DSXU_V6_REPLAY_BANK_20260519.json` 为 `E3_INTERNAL_REPLAY_CONTRACT`，`publicClaimStatus=BLOCKED_PUBLIC_EXTERNAL_CLAIM`。 |
| live provider 证据 | PARTIAL：已有 `DSXU_V6_DEEPSEEK_PROVIDER_PROBE_20260519.json`，证明固定低风险 live Flash API 可用、usage/cache/cost 字段可见；仍不是 live tool-call replay。 |
| PTY/TUI 证据 | PARTIAL：已有 `DSXU_V6_TUI_SNAPSHOT_20260519.json`，证明 trust surface 短显示；仍不是完整真实窗口 resize/弹窗/滚动 acceptance。 |

反向 focused 命令：

```bash
bun test src/dsxu/engine/__tests__/tool-protocol-owner-v6.test.ts src/dsxu/engine/__tests__/prompt-section-router.test.ts src/services/api/__tests__/deepseek-strict-tool-gateway.test.ts src/components/__tests__/tui-trust-surface.test.tsx
```

结果：PASS，12 tests / 58 expects。

#### 12.19.2 当前完成度裁决

| 层级 | 裁决 |
|---|---|
| V6 文档规格 | 完成。 |
| V6-S control-plane hardening | Focused PASS。 |
| 默认能力暴露治理 | Focused PASS。 |
| Prompt diet / Tool View / Skill-MCP expert gating | Focused PASS。 |
| owner cleanup board | PASS：218/218 有 owner/action/claim block。 |
| live provider basic probe | PASS basic；不是 tool-call replay。 |
| 内部 replay hit-rate | PASS E3 internal；不是公开 external benchmark。 |
| 真实 PTY/TUI acceptance | 未完成。 |
| live DeepSeek tool-call replay | 未完成。 |
| paired external benchmark raw transcripts | 未完成。 |
| V6 90%+ 对外或高级模型对标声明 | 不能声明。 |

结论：V6 不能标记为“全部完成”。准确状态是：

```text
V6_ARCHITECTURE_AND_FOCUSED_CONTROL_PLANE_READY = true
V6_FULL_LIVE_ACCEPTANCE_READY = false
V6_PUBLIC_90_CLAIM_READY = false
```

#### 12.19.3 下一步只剩硬缺口

1. `live DeepSeek tool-call replay`：真实 provider 请求必须包含 strict tool schema、模型返回 tool call、tool result 回灌、final response、cost/cache/route evidence、fallback blocked evidence。
2. `真实 PTY/TUI acceptance`：真实窗口长内容、resize、滚动固定、权限弹窗、输入区不遮挡、trust line 不重复。
3. `paired external benchmark raw transcripts`：同题 DSXU vs target/reference raw transcript、tool trace、metrics、失败恢复、成本。
4. `218 owner review`：不是继续叫未归类，而是把 `classify-before-claim` 行分批裁决成 mainline owner、release-only、legacy、evidence-only 或 delete-review。

### 12.20 V6 live runtime acceptance 执行记录 - 2026-05-19

本节关闭 12.19 中的两个 live runtime 缺口：`live DeepSeek tool-call replay` 和 `真实 PTY/TUI acceptance`。口径仍然是：这不是外部公开 benchmark，也不是对 GPT-5.5 / Claude 4.7 的公开胜负声明。

#### 12.20.1 Live DeepSeek tool-call replay

新增脚本：

```bash
bun --env-file=.env run scripts/dsxu-v6-live-tool-call-replay.ts
```

输出：

| 产物 | 状态 |
|---|---|
| `docs/generated/DSXU_V6_LIVE_TOOL_CALL_REPLAY_20260519.json` | `PASS_V6_LIVE_TOOL_CALL_REPLAY` |
| `docs/DSXU_V6_LIVE_TOOL_CALL_REPLAY_20260519.md` | 已生成 |

真实证据：

| 检查 | 结果 |
|---|---|
| live strict tool call | PASS：DeepSeek Flash 返回 `dsxu_live_echo` strict tool call，`schemaPath=strict_schema`。 |
| tool result replay | PASS：本地 tool result 回灌后，第二次 live 请求返回 `DSXU_V6_TOOL_REPLAY_FINAL_OK`。 |
| fallback observable | PASS：XML fallback 被标记为 `xml_fallback`，没有误报为 strict。 |
| hidden fallback blocked | PASS：`MCPDocs` fallback 在 allowed tools 为 `Read/Edit/Bash` 时不产生可执行调用。 |
| key redaction | PASS：证据只包含 `DEEPSEEK_API_KEY=set:redacted`；报告中无 `sk-`、Bearer、Authorization 明文。 |

指标：

| metric | value |
|---|---:|
| requestCount | 2 |
| totalInputTokens | 524 |
| totalOutputTokens | 78 |
| totalCacheHitTokens | 0 |
| totalCacheMissTokens | 524 |
| totalEstimatedCostUsd | 0.0000952 |

#### 12.20.2 Real PTY/TUI acceptance

新增脚本：

```bash
bun run scripts/dsxu-v6-pty-tui-acceptance.ts
```

输出：

| 产物 | 状态 |
|---|---|
| `docs/generated/DSXU_V6_PTY_TUI_ACCEPTANCE_20260519.json` | `PASS_V6_PTY_TUI_ACCEPTANCE` |
| `docs/DSXU_V6_PTY_TUI_ACCEPTANCE_20260519.md` | 已生成 |

真实 PTY 场景：

| 场景 | 状态 | 覆盖 |
|---|---|---|
| `v6-long-content-sticky-bottom-resize` | PASS | 长内容、5 次 PTY resize、tail marker resize 后仍可见、prompt resize 后仍可见。 |
| `v6-scrollback-resize-position` | PASS | scrollback 中间位置 resize 后保持，不跳到顶部或尾部。 |
| `v6-permission-dialog-after-resize` | PASS | 权限弹窗 resize 后仍可见，边框仍可见。该场景允许 modal 持有输入，因此不要求回到普通 prompt。 |
| `v6-trust-proof-after-resize` | PASS | trust proof line resize 后仍可见且不刷屏。 |

执行过程中先出现过一次验收脚本过硬问题：长内容场景把 start marker 当成必需，但真实体验应该验 sticky-bottom tail；权限弹窗场景 modal 正在等待审核时不应要求普通 prompt 可见。已修正脚本，重跑后四场景全部 PASS。

#### 12.20.3 Focused regression

```bash
bun test src/dsxu/engine/__tests__/tool-protocol-owner-v6.test.ts src/services/api/__tests__/deepseek-strict-tool-gateway.test.ts src/components/__tests__/tui-trust-surface.test.tsx
```

结果：PASS，10 tests / 43 expects。

#### 12.20.4 更新后的 V6 裁决

```text
V6_ARCHITECTURE_AND_FOCUSED_CONTROL_PLANE_READY = true
V6_RUNTIME_LIVE_ACCEPTANCE_READY = true
V6_EXTERNAL_PAIRED_BENCHMARK_READY = false
V6_PUBLIC_90_CLAIM_READY = false
```

仍不能声明：

- `V6_PUBLIC_CLAIM_BLOCKED_PENDING_E5_RAW`
- `EXTERNAL_BENCHMARK_WIN_READY`
- `DSXU reached 90%+ public benchmark`
- `DSXU beats GPT-5.5 / Claude 4.7`

剩余 V6 硬工作：

1. `paired external benchmark raw transcripts`：同题 DSXU vs target/reference raw transcript、tool trace、metrics、失败恢复、成本。
2. `218 owner review`：把 `classify-before-claim` 行分批裁决为 mainline owner、release-only、legacy、evidence-only 或 delete-review。

### 12.21 V6 218 owner review 决策收口 - 2026-05-19

本节关闭 12.20 中的 `218 owner review` 分类缺口。执行口径：不移动文件、不删除文件、不 stage、不 commit、不把任何行提升为 public product claim；只把 `classify-before-claim` board 转成可复核的 owner review 决策。

新增脚本：

```bash
bun run scripts/dsxu-v6-owner-review-decisions.ts
```

输出：

| 产物 | 状态 |
|---|---|
| `docs/generated/DSXU_V6_OWNER_REVIEW_DECISIONS_20260519.json` | `PASS_V6_OWNER_REVIEW_DECISIONS` |
| `docs/generated/DSXU_V6_OWNER_REVIEW_DECISIONS_20260519.csv` | 已生成，218 行明细 |
| `docs/DSXU_V6_OWNER_REVIEW_DECISIONS_20260519.md` | 已生成 |

218 行最终裁决：

| decision | count | 含义 |
|---|---:|---|
| mainline-owner | 98 | 保留在命名 DSXU owner 下；未来公开 claim 必须绑定 source/test/live evidence。 |
| release-only | 12 | 仅作为 release/config/documentation surface；不进入 model prompt 或产品能力 claim。 |
| legacy | 25 | 冻结在默认 runtime 外；未来默认暴露前必须重新 owner review。 |
| evidence-only | 71 | 仅保留为 harness/test/evidence source；不能变成产品 runtime 或 GitHub 卖点。 |
| delete-review | 12 | 进入 owner/Git mutation review；只有替代证据和明确批准后才能删除。 |

关键 delete-review 队列：

| owner | paths | 裁决 |
|---|---|---|
| Runtime Service Owner | `src/commands/bridge-kick.ts`、`src/commands/bridge/bridge.tsx`、`src/commands/bridge/index.ts`、`src/commands/commit-push-pr.ts`、`src/commands/commit.ts` | 旧 bridge/commit 命令不作为第二入口保留；进入 owner/Git mutation review。 |
| PlanGraph / Work-State Owner | `src/coordinator/dag/index.ts`、`persist.ts`、`runner.ts`、`templates.ts`、`types.ts` | 旧 DAG runner 不作为第二 DAG runtime；PEV 能力归 PlanGraph/work-state。 |
| Evidence / Eval SWE Owner | `src/services/swe-bench/index.ts`、`types.ts` | 旧 SWE owner 由 `src/services/eval/swe-bench` 替代；进入 replace/delete review。 |

Focused 验证：

```bash
bun build scripts/dsxu-v6-owner-review-decisions.ts --target=bun
bun test scripts/__tests__/dsxu-v6-owner-review-decisions.test.ts
bun run scripts/dsxu-v6-owner-review-decisions.ts
```

结果：

| command | 结果 |
|---|---|
| build | PASS |
| focused test | PASS，1 test / 9 expects |
| report generation | PASS，`remainingClassifyBeforeClaim=0`、`claimAllowedRows=0`、`modelPromptAllowedRows=0`、`blockers=[]` |

更新后的 V6 裁决：

```text
V6_ARCHITECTURE_AND_FOCUSED_CONTROL_PLANE_READY = true
V6_RUNTIME_LIVE_ACCEPTANCE_READY = true
V6_OWNER_REVIEW_DECISIONS_READY = true
V6_DELETE_REVIEW_MUTATION_READY = false
V6_EXTERNAL_PAIRED_BENCHMARK_READY = false
V6_PUBLIC_90_CLAIM_READY = false
```

剩余 V6 硬工作现在收缩为：

1. `paired external benchmark raw transcripts`：仍缺同题 DSXU vs target/reference raw transcript、tool trace、metrics、失败恢复、成本。
2. `delete-review mutation authorization`：12 个 delete-review path 只能在 owner/Git 明确批准后进入删除/迁移验证；当前仅完成裁决，不做 mutation。


