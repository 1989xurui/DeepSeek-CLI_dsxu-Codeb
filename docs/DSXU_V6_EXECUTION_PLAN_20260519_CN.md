# DSXU V6 开发文档：DeepSeek-Native Engineering Runtime

日期：2026-05-19  
状态：Planning / Execution Spec  
目标：基于 DeepSeek V4 Flash / Flash-MAX / Pro 原生能力与 DSXU 强编排，做出面向高级程序员的 90%+ 编程与复杂任务执行体验。  
硬约束：不继续堆功能；不重写整个 Claude 底座；不把局部单测、mock、smoke、旧 trace 写成完成。  
当前状态：V6 未完成。本文是开发文档，不是完成报告。

---

## 1. 核心结论

DSXU 不能继续按“弱模型补丁框架”设计。DeepSeek V4 已经具备原生 thinking、tool calls、strict tool schema、1M context、低价 cache 和 Anthropic/OpenAI 兼容接口。V6 的正确方向是：

```text
DeepSeek 原生能力
  + DSXU Execution Contract
  + DSXU Tool View / Strict Schema
  + DSXU Active Frame / Durable Ledger
  + DSXU Proof / Verification / Recovery
  + DSXU Replay Evidence
= DeepSeek-Native Engineering Runtime
```

V6 的重点不是新增第 68 个功能，而是把现有几十个功能压成一条可验证主链。

---

## 2. DeepSeek 官方能力边界

### 2.1 已确认能力

| 能力 | 官方边界 | V6 设计含义 |
|---|---|---|
| V4 模型 | `deepseek-v4-flash`、`deepseek-v4-pro` | Flash 默认，Pro 证据准入 |
| Thinking | 默认 enabled，支持 `reasoning_effort=high/max` | 不再把“推理前缀”当 CoT 替代品 |
| Tool Calls | thinking mode 支持工具调用 | 必须正确回传 `reasoning_content` |
| Strict Function Calling | Beta，要求 `strict=true`、`additionalProperties=false`、所有属性 required | 需要 DSXU strict schema compiler |
| Context | 1M context | 可放 source capsule / ledger / artifact refs，但不能粗暴塞满 |
| Max output | 384K | 不能依赖超长输出解决工程正确性 |
| Cache | cache hit 极低价，best-effort | cache claim 必须靠 raw usage 证明 |
| Sampling | thinking mode 下 temperature/top_p 等不生效 | 稳定性不能靠 temperature=0，必须靠 contract/schema/replay |
| JSON output | 可保证 JSON，但可能空 content 或 length 截断 | 必须有 empty/length recovery |

### 2.2 公开性能边界

| 维度 | 判断 |
|---|---|
| V4-Pro | Agentic Coding 接近顶级闭源模型，但公开信息仍显示与最强 thinking 模式存在差距 |
| V4-Flash | 简单任务接近 Pro，高难任务有差距 |
| 成本 | 极低，适合用验证、重试、replay、局部 Pro 升级换稳定性 |
| 90%+ 目标 | 只能定义为 DSXU 高级程序员任务集的 final pass / hit-rate，不可提前声明公开 benchmark 超 GPT-5.5 / Claude 4.7 |

---

## 3. 推理前缀是否有效

### 3.1 结论

推理前缀有效，但不能再用旧方案的“长 CoT 前缀”。在 DeepSeek V4 上，正确形态应该叫：

```text
Reasoning Intent Prefix / Execution Intent Header
```

它不是替代 DeepSeek thinking，而是给 runtime 和模型一个短、硬、可校验的执行意图。

### 3.2 何时有效

| 场景 | 是否使用 | 形式 |
|---|---|---|
| Flash non-thinking 轻任务 | 可用 | 3 行 intent + 1 行 verify |
| Flash thinking high 普通编码 | 可用但短 | 当前目标、允许工具、验证义务 |
| Flash thinking max 复杂任务 | 不写长推理 | 只写 contract summary，真正推理由 `reasoning_content` 承载 |
| Pro max 审查/恢复 | 不写长推理 | 只写 evidence checklist |
| Replay/benchmark | 必须 A/B | 有无前缀必须用同题 replay 比较 |

### 3.3 推荐模板

```text
[Intent]
goal: <one concrete subgoal>
phase: read | edit | verify | recover | final
allowed_tools: <compiled tool view>
verify_before_claim: <required command or proof>
stop_rule: no final claim without proof
```

### 3.4 禁止模板

```text
请一步步深度思考……
请详细列出所有推理……
请在每次工具调用前输出完整分析……
```

原因：会增加 prompt 厚度、污染 cache、挤占 dynamic tail，并可能和 DeepSeek 原生 `reasoning_content` 冲突。

### 3.5 硬验收

推理前缀不能靠感觉说有效，必须 A/B 测：

| 指标 | 最低标准 |
|---|---|
| Tool Hit 提升 | >=3 个百分点 |
| Verify Hit 不下降 | 不低于 baseline |
| Final Pass 不下降 | 不低于 baseline |
| Cache hit 不下降 | 不下降超过 5 个百分点 |
| 平均延迟 | 不劣化超过 10% |
| prompt tokens | 不增加超过 8% |

测试命令：

```bash
bun run scripts/dsxu-v6-reasoning-prefix-ab.ts --cases 40
bun test scripts/__tests__/dsxu-v6-reasoning-prefix-ab.test.ts
```

通过状态：

```text
PASS_V6_REASONING_INTENT_PREFIX
```

---

## 4. DSXU 当前结构盘点

本次只读盘点结果：

| 范围 | 数量 | 说明 |
|---|---:|---|
| `src` 文件 | 2747 | 项目复杂度已经很高 |
| `src/dsxu/engine` 文件 | 565 | DSXU 强编排核心 |
| `src/tools` 文件 | 203 | 40+ 工具目录，远超简单工具集 |
| `src/commands` 文件 | 209 | 大量 slash/CLI 命令入口 |
| `src/services` 文件 | 232 | Provider、MCP、compact、experience、health、static-analysis 等 |
| `package.json` scripts | 124 | benchmark、release、evidence、live、v20/v24/v26/v5 混合 |

结论：

```text
V6 必须是结构收敛文档。
不能只优化工具。
不能只优化 query-loop。
不能只优化 prompt。
```

---

## 5. V6 架构目标

### 5.1 目标架构

```text
User Task
  -> Task Contract Compiler
  -> DeepSeek Effort Router
  -> Reasoning Intent Prefix
  -> Strict Tool Schema Gateway
  -> Small Tool View Runtime
  -> Source Capsule / Active Frame
  -> Tool Execution / Mutation Lifecycle
  -> Proof-Carrying Edit
  -> Verification / Recovery
  -> Durable Ledger
  -> Replay Bank
  -> Final Answer / Claim Gate
```

### 5.2 单源原则

| 单源 | 负责内容 |
|---|---|
| Execution Contract | 任务类型、风险、路由、工具窗口、验证义务 |
| DeepSeek Provider Contract | model、thinking、reasoning_effort、usage、cache、reasoning_content |
| Tool View | 模型本轮真实可见工具 |
| Strict Schema Gateway | DeepSeek 可接受的 tool schema |
| Active Frame | 当前任务工作记忆 |
| Durable Ledger | 长任务恢复与证据 |
| Proof Envelope | 修改后能否声明完成 |
| Replay Bank | 是否允许 90%/release/public claim |

---

## 6. V6 文件与功能归并图

### 6.1 核心 owner

| Owner | 关键文件 | V6 职责 |
|---|---|---|
| Provider Protocol | `src/services/api/deepseek-adapter.ts` | thinking、reasoning_content、tool calls、usage/cache、route trace |
| Query Runtime | `src/query.ts` | 默认主链、contract projection、trust state、context budget |
| Execution Contract | `src/dsxu/engine/action-contract.ts` | task/risk/route/tool/verification/fallback |
| Tool View | `src/dsxu/engine/tool-catalog-v1.ts`、`src/tools.ts` | 小工具窗口与真实工具单源 |
| Tool Execution | `src/services/tools/toolExecution.ts`、`src/services/tools/toolLifecycle.ts` | 工具调用、结果、runtime event |
| Mutation Proof | `src/dsxu/engine/post-mutation-verification-envelope.ts` | edit proof、claim allowed/block |
| TDD/SAST Gate | `src/coordinator/tdd-gate/**`、`src/services/static-analysis/**` | post-mutation verification |
| Ledger / Active Frame | `src/dsxu/engine/progress-ledger.ts` | 工作记忆、长任务恢复 |
| Agent / Task | `src/tools/AgentTool/**`、`src/tools/Task*Tool/**` | worker handoff、evidence envelope |
| MCP / Skill / Plugin | `src/services/mcp/**`、`src/tools/SkillTool/**`、`src/services/plugins/**` | 外部能力边界 |
| Context / Compact | `src/services/compact/**`、`src/services/contextCollapse/**` | 1M context 下的压缩策略 |
| Experience / Memory | `src/services/experience/**`、`src/services/SessionMemory/**` | 经验参考，不覆盖 source truth |
| TUI | `src/components/**`、`src/entrypoints/cli.tsx` | 高级程序员可见状态 |
| Evidence / Replay | `scripts/dsxu-v5-replay-bank.ts`、`scripts/dsxu-evidence-dashboard.ts` | completion claim gate |

### 6.2 功能归并方向

| 当前能力 | V6 处理 |
|---|---|
| 67+ 功能 | 不删，先分类为 mainline/assisted/searchable/sidecar/frozen/release-only |
| 40+ 工具 | 不重构底层，统一 Tool View 可见窗口 |
| V20/V24/V26 脚本 | 归入 legacy/evidence/release，不得混入 V6 完成口径 |
| Agent/Team/Fork/Voting | 默认冻结或 sidecar，不进主链 |
| Skill/MCP/Plugin | 搜索启用，默认隐藏，必须有 owner proof |
| Shell/PowerShell | 进入 mutation bypass gate |
| TUI trust line | 保留但节流，显示真实 runtime state |

---

## 7. V6 工作包

### WP0. DeepSeek Capability Probe

目标：用 live probe 固化 DeepSeek 官方能力在 DSXU 当前环境中的真实行为。

必须验证：

| 能力 | 验收 |
|---|---|
| thinking enabled/disabled | raw request/response 有记录 |
| `reasoning_effort=high/max` | raw payload 有记录 |
| thinking + tool calls | assistant message 包含 `reasoning_content` 与 tool_calls |
| tool call 后回传 reasoning_content | 不触发 400 |
| strict schema | 支持的 schema 通过，不支持的 schema 被标记 |
| cache usage | usage 中能提取 hit/miss |
| JSON empty/length | 能恢复或阻断 |
| 1M context smoke | 不作为性能 claim，只证明边界 |

测试命令：

```bash
bun run scripts/dsxu-v6-deepseek-capability-probe.ts
bun test scripts/__tests__/dsxu-v6-deepseek-capability-probe.test.ts
```

完成标准：

```text
PASS_V6_DEEPSEEK_CAPABILITY_PROBE
```

### WP1. Provider Protocol Correctness

目标：DeepSeek provider 层协议完全正确，尤其是 thinking tool call 的 `reasoning_content` 生命周期。

硬验收：

| 指标 | 标准 |
|---|---|
| thinking tool call round-trip | 100% |
| `reasoning_content` 丢失 | 0 |
| contract route 与 actual request model drift | 0 |
| actual response model missing | 0 |
| usage/cache missing | 0 |
| prompt/cache hash missing | 0 |

测试命令：

```bash
bun test src/services/api/deepseek-adapter-cache-prefix-v1.test.ts
bun test src/services/api/deepseek-trajectory-store.test.ts
bun run scripts/dsxu-v6-provider-protocol.ts
```

### WP2. DeepSeek Effort Router

目标：把任务分给正确的模型和 thinking 强度。

路由表：

| 场景 | 路由 |
|---|---|
| 闲聊/状态/轻解释 | Flash non-thinking |
| 普通代码阅读/小修改 | Flash thinking high |
| 多文件计划/复杂调试/失败恢复 | Flash thinking max |
| 高风险重构/算法/安全/发布声明 | Pro thinking max |
| 工具参数修复 | Flash thinking high + strict schema |

硬验收：

| 指标 | 标准 |
|---|---|
| Route Hit | >=88%，目标 >=92% |
| Pro admission 有理由 | 100% |
| Flash 可解决任务误升 Pro | <=5% |
| 高风险任务留在 non-thinking | 0 |

测试命令：

```bash
bun run scripts/dsxu-v6-effort-router.ts --cases 100
bun test scripts/__tests__/dsxu-v6-effort-router.test.ts
```

### WP3. Reasoning Intent Prefix

目标：保留推理前缀的命中率收益，但把它改成短、硬、可测的 execution intent。

规则：

1. 不要求模型输出长 CoT。
2. 不重复 DeepSeek 原生 `reasoning_content`。
3. 只给 goal、phase、allowed tools、verify obligation、stop rule。
4. 必须进入 A/B replay。

硬验收：

| 指标 | 标准 |
|---|---|
| Tool Hit 提升 | >=3pp |
| Final Pass 不下降 | 100% 不低于 baseline |
| cache hit 不显著下降 | <=5pp 下降 |
| latency 不显著恶化 | <=10% |

测试命令：

```bash
bun run scripts/dsxu-v6-reasoning-prefix-ab.ts --cases 40
bun test scripts/__tests__/dsxu-v6-reasoning-prefix-ab.test.ts
```

### WP4. Strict Tool Schema Gateway

目标：把 DSXU 工具 schema 编译成 DeepSeek strict mode 可接受的 schema。

硬验收：

| 指标 | 标准 |
|---|---|
| mainline 工具 strict-compatible | 100% |
| unsupported schema 有降级说明 | 100% |
| additionalProperties=false | 100% |
| required 字段完整 | 100% |
| strict schema API probe | PASS |

测试命令：

```bash
bun run scripts/dsxu-v6-strict-tool-schema.ts
bun test scripts/__tests__/dsxu-v6-strict-tool-schema.test.ts
bun run prebuild
```

### WP5. Small Tool View Runtime

目标：真实模型可见工具窗口默认 6-12 个，不只是文档 helper。

硬验收：

| 指标 | 标准 |
|---|---|
| 默认可见工具数 | <=12 |
| 常规 coding 工具数 | 6-10 |
| Tool View 与 query-loop 实际工具一致 | 100% |
| fallback ToolSearch 有理由 | 100% |
| frozen/sidecar 工具默认暴露 | 0 |

测试命令：

```bash
bun test src/dsxu/engine/__tests__/tool-catalog-v1-clean.test.ts
bun test src/tools/__tests__/tool-registry-simple-mode.test.ts
bun run scripts/dsxu-v6-tool-view-runtime.ts
```

### WP6. Execution Lifecycle / Mutation Gate

目标：所有副作用进入同一编辑生命周期。

生命周期：

```text
source truth
  -> edit intent
  -> mutation event
  -> static analysis
  -> focused verification
  -> proof envelope
  -> final claim gate
```

必须覆盖：

```text
Edit
Write
NotebookEdit
Bash write
PowerShell write
Workflow write
command mutation
Agent worker mutation
MCP/Skill side effect
```

硬验收：

| 指标 | 标准 |
|---|---|
| mutation source coverage | 100% |
| post-mutation envelope | 100% |
| shell bypass | 0 |
| command bypass | 0 |
| final claim without proof | 0 |

测试命令：

```bash
bun test src/coordinator/tdd-gate/__tests__/gate.test.ts
bun test src/dsxu/engine/__tests__/post-mutation-verification-envelope.test.ts
bun test src/services/static-analysis/__tests__/bridge.test.ts
bun run scripts/dsxu-v6-mutation-bypass.ts
```

### WP7. Context / Working Memory Runtime

目标：利用 1M context，但不让上下文变成垃圾堆。

工作记忆分层：

| 层 | 内容 | 规则 |
|---|---|---|
| Stable Prefix | 系统协议、工具 schema、固定 policy | 尽量稳定，利于 cache |
| Execution Contract | 当前任务契约 | 每轮必须存在 |
| Active Frame | 当前 phase、open obligations、latest verified source | 永不被 compact 覆盖 |
| Source Capsule | 相关文件、符号、依赖、测试 | 按需刷新 |
| Durable Ledger | tool/verify/recovery/cost/cache event | append-only |
| Artifact Store | 大工具结果、日志、长 diff | 引用化，不全文塞上下文 |
| Experience Memory | 项目经验、失败模式 | 只作参考，不覆盖 source truth |

硬验收：

| 指标 | 标准 |
|---|---|
| resume phase recovery | 100% |
| open obligations loss | 0 |
| source truth stale claim | 0 |
| active frame overwritten by compact | 0 |
| tool result over budget | 0 |
| cache-safe prefix drift unknown | 0 |

测试命令：

```bash
bun test src/dsxu/engine/__tests__/work-package-i/progress-ledger.test.ts
bun test src/dsxu/engine/__tests__/work-package-i/query-loop-progress-ledger.test.ts
bun test src/dsxu/engine/__tests__/memory-resume.test.ts
bun run scripts/dsxu-v6-working-memory.ts
```

### WP8. Agent / MCP / Skill Orchestration

目标：多 Agent、MCP、Skill 不是默认扩大工具面，而是受 contract 管控的 sidecar 能力。

硬验收：

| 指标 | 标准 |
|---|---|
| Agent worker handoff schema | 100% |
| worker evidence envelope | 100% |
| parent final claim checks worker proof | 100% |
| MCP/Skill source proof | 100% |
| unapproved sidecar tool exposure | 0 |

测试命令：

```bash
bun test src/dsxu/engine/__tests__/agent-mcp-skill-ownership-v1.test.ts
bun run scripts/dsxu-agent-mcp-skill-boundary-acceptance.ts
bun run scripts/dsxu-v6-agent-orchestration.ts
```

### WP9. TUI Senior Programmer Experience

目标：高级程序员看到的是可用状态，不是刷屏报告。

显示原则：

```text
少行数
高信号
不乱码
不重复
真实 runtime
可展开
默认安静
```

硬验收：

| 指标 | 标准 |
|---|---|
| evidence flood | 0 |
| footer overflow | 0 |
| mojibake | 0 |
| trust state drift | 0 |
| permission dialog unreadable | 0 |
| long task state invisible | 0 |

测试命令：

```bash
bun run test:experience
bun test src/components/PromptInput/__tests__/PromptInputFooter-trust.test.ts
bun test src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts
bun run scripts/dsxu-v6-tui-senior-experience.ts
```

### WP10. Replay Bank / 90% Claim Gate

目标：90%+ 只能由 replay raw evidence 证明。

分层：

| 层 | 标准 |
|---|---|
| 20-case unblock | 修复 route consistency，accepted >=20 |
| 100-case internal | final pass >=90% |
| 30 paired public | 公开对标前必须完成 |
| failed case handling | 失败 case 必须 owner、原因、修复验证 |

硬验收：

| 指标 | 标准 |
|---|---|
| route missing | 0 |
| prompt/cache hash missing | 0 |
| edit proof missing | 0 |
| raw trace missing | 0 |
| 100 replay final pass | >=90% |
| public claim without paired evidence | 0 |

测试命令：

```bash
bun run scripts/dsxu-v5-replay-bank.ts
bun run scripts/dsxu-v6-replay-bank.ts --cases 100
bun run scripts/dsxu-public-comparable-benchmark-manifest.ts --required-pairs 30
bun run scripts/dsxu-v6-final-gate.ts --mode release
```

---

## 8. V6 执行顺序

必须按顺序：

1. WP0 DeepSeek Capability Probe
2. WP1 Provider Protocol Correctness
3. WP2 DeepSeek Effort Router
4. WP3 Reasoning Intent Prefix A/B
5. WP4 Strict Tool Schema Gateway
6. WP5 Small Tool View Runtime
7. WP6 Execution Lifecycle / Mutation Gate
8. WP7 Context / Working Memory Runtime
9. WP8 Agent / MCP / Skill Orchestration
10. WP9 TUI Senior Programmer Experience
11. WP10 Replay Bank / 90% Claim Gate

禁止：

```text
跳过 WP0 直接写模型能力结论
跳过 WP1 直接跑 replay
跳过 WP5 继续暴露大工具面
跳过 WP10 宣称 90%+
```

---

## 9. V6 完成定义

### 9.1 Internal Ready

允许写：

```text
V6_INTERNAL_READY
```

必须满足：

| 条件 | 标准 |
|---|---|
| WP0-WP9 | PASS |
| 20-case native replay | PASS |
| mutation bypass | 0 |
| tool view drift | 0 |
| route missing | 0 |
| TUI focused | PASS |

### 9.2 90% Runtime Ready

允许写：

```text
V6_90_RUNTIME_READY
```

必须满足：

| 条件 | 标准 |
|---|---|
| 100 replay cases | PASS |
| final pass | >=90% |
| route/tool/source/edit/verify/recovery hit | 全部达标 |
| failed case owner | 100% |
| raw trace saved | 100% |

### 9.3 Public Claim Ready

允许写：

```text
V6_PUBLIC_CLAIM_BLOCKED_PENDING_E5_RAW
```

必须满足：

| 条件 | 标准 |
|---|---|
| 30 paired public comparable raw evidence | PASS |
| benchmark methodology | documented |
| package/build gate | PASS |
| commercial/IP/secret scan | PASS |
| clean export artifact | PASS |

---

## 10. 禁止假完成状态

任何情况下都不能写：

```text
V6_DONE_WITH_REPLAY_BLOCKED
V6_DONE_WITH_TOOL_VIEW_HELPER_ONLY
V6_DONE_WITH_REASONING_PREFIX_UNTESTED
V6_DONE_WITH_ROUTE_DRIFT
V6_DONE_WITH_CACHE_64_AS_80
V6_DONE_WITH_PUBLIC_CLAIM_BLOCKED
V6_DONE_WITH_UNCLASSIFIED_COMMANDS
V6_DONE_WITH_MUTATION_BYPASS
V6_DONE_WITH_NOT_RUN_RELEASE_GATES
```

---

## 11. 最终裁决

推理前缀可以提高命中率，但 V6 不应使用厚重推理前缀。正确做法是：

```text
DeepSeek 原生 thinking 负责深推理。
Reasoning Intent Prefix 负责短意图和工具边界。
Execution Contract 负责硬约束。
Tool View 负责降低选择熵。
Strict Schema 负责减少参数错误。
Ledger / Proof / Replay 负责证明真的完成。
```

V6 的本质是：

```text
让 DeepSeek 在小而清晰的工程空间里工作，
让 DSXU runtime 替模型管理边界、证据、恢复和记忆。
```

当前建议状态：

```text
V6_DEEPSEEK_NATIVE_PLAN_READY
V6_NOT_IMPLEMENTED
V5_REPLAY_BLOCKED_MUST_CARRY_FORWARD
```


