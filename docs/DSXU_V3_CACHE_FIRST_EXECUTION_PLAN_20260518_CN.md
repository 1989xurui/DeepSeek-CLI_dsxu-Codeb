# DSXU V3 Cache-First 执行方案

日期：2026-05-18  
目标：在不削弱 DSXU 编程能力、验证能力、Agent 能力和高级程序员体验的前提下，把 DeepSeek 主链 warm-session cache hit 提升到 90% 左右。

本方案只处理核心性能和缓存命中问题，不处理商业发布、IP 清理、官网文案、外部 benchmark 宣传。

---

## 1. 目标定义

### 1.1 北极星目标

DSXU 的定位是：

在 DeepSeek V4 Flash / Flash-MAX / Pro 混合模型基础上，通过强编排、工具、权限、上下文、恢复、Agent、成本和证据系统，做出接近或超过 Claude Code 4.7 体验的 AI 编程与复杂任务执行工具，尤其让高级程序员感觉可信、可控、可持续执行。

V3 的专项目标是：

| 指标 | 当前证据 | V3 目标 |
|---|---:|---:|
| public challenge cache hit | 66.8% | 第一阶段 80%+，最终 85-90% |
| warm-session coding cache hit | 局部可到 90%+，不稳定 | 稳定 88-92% |
| stable prefix hash 漂移 | 已能观测，不能阻断 | 无理由漂移为 0 |
| dynamic miss tokens | 偏高 | 减少 60-75% |
| 高级程序员体验 | 保留验证和证据，但底部显示已瘦身 | 不因 cache 优化减少验证、工具、Agent |
| 性能 | 不明确 | p95 latency 不上升超过 5% |

### 1.2 90% 的正确口径

90% 不应按所有请求粗暴平均。正确口径是：

```text
warm_session_cache_hit_rate =
  sum(prompt_cache_hit_tokens after first warm turn)
  /
  sum(prompt_cache_hit_tokens + prompt_cache_miss_tokens after first warm turn)
```

冷启动首轮、/new、/clear、MCP 工具集变化、workspace 切换、auto-compact 后第一个 cache epoch，不强行要求 90%。

### 1.3 不做的事

| 不做 | 原因 |
|---|---|
| 不大删 prompt 纪律 | DeepSeek 弱模型需要工具纪律、验证纪律、不可虚报纪律 |
| 不禁用工具、MCP、Agent | 会降低高级程序员体验 |
| 不牺牲 TDD / SAST / Verify / Rollback | cache 不能优先于正确性 |
| 不把 mock/smoke 当正式 cache 成绩 | 只能作工程回归 |
| 不在没有 raw trace 前宣传 90% | 证据先于声明 |

---

## 2. 已审核的真实现状

### 2.1 DSXU 已经有 prompt prefix evidence，但只是旁路

已确认：

| 文件 | 现状 |
|---|---|
| `src/query.ts` | 默认主链已导入 `recordDSXUQueryPromptPrefixCacheEvidence` |
| `src/query.ts` | 每轮 query setup 调用 `recordDSXUQueryPromptPrefixCacheEvidence(...)` |
| `src/dsxu/engine/prompt-prefix-cache-evidence.ts` | 记录 stable/dynamic hash、token 估算、volatile finding |
| `src/dsxu/engine/prompt-prefix-cache-builder.ts` | 能检测 stable prefix 污染、runtime/task section 泄漏 |

结论：

DSXU 已经能观测 cache prefix 问题，但它不改写 provider prompt，不阻断污染，也不强制稳定前缀。

### 2.2 DSXU 真实 provider prompt 仍走旧路径

已确认：

| 文件 | 现状 |
|---|---|
| `src/query.ts` | 每轮构造 `fullSystemPrompt` |
| `src/services/api/dsxuTransport.ts` | `buildSystemPromptBlocks()` 仍调用 `splitSysPromptPrefix()` |
| `src/utils/api.ts` | `splitSysPromptPrefix()` 负责 system prompt 分块和 cache_control |
| `src/services/api/deepseek-adapter.ts` | DeepSeek adapter 会 normalize system blocks，去掉 boundary marker 后拼接 system content |

结论：

V3 不能只改 evidence。必须让真实发送给 DeepSeek 的 prompt 形态变稳定。

### 2.3 DSXU 当前命中率不稳定

已有证据：

| 来源 | 数据 |
|---|---:|
| public challenge before ablation | 45.5% |
| public challenge after ablation | 66.8% |
| 单任务 trace | 可到 80%+ |
| TUI 局部显示 | 可见 90%+ 单轮/局部 |

结论：

DSXU 不是没有能力高命中，而是没有稳定地把高命中变成默认主链属性。

### 2.4 Reasonix 为什么能到 90% 左右

对比目录：`D:\DSXU-external-analysis\DeepSeek-Reasonix`

关键实现：

| Reasonix 文件 | 机制 |
|---|---|
| `src/memory/runtime.ts` | `ImmutablePrefix` 固定 system/toolSpecs/fewShots，并维护 fingerprint |
| `src/memory/runtime.ts` | `AppendOnlyLog` 历史只追加 |
| `src/memory/runtime.ts` | `VolatileScratch` 每轮 reset，不进入上游 prompt |
| `src/loop.ts` | `CacheFirstLoop` 每轮由 `prefix.toMessages() + log + pendingUser` 组包 |
| `benchmarks/tau-bench/report.md` | 24 runs，Reasonix cache hit 90.2%，baseline 32.8% |

Reasonix 的本质不是 prompt 更短，而是：

```text
ImmutablePrefix 固定
+ AppendOnlyLog 只追加
+ VolatileScratch 不上游
= DeepSeek 前缀连续命中
```

DSXU V3 要吸收的是这个结构原则，不是复制 Reasonix。

---

## 3. V3 总体策略

### 3.1 设计原则

1. 保留 DSXU 强能力，不削弱验证、工具、Agent、恢复。
2. 所有动态状态后置，不进入 stable prefix。
3. 工具 schema session 内稳定，变更必须进入 cache epoch。
4. compact、MCP drift、workspace switch、system rebuild 都是显式 cache epoch。
5. cache hit 用真实 DeepSeek usage 字段计算，不用估算冒充。
6. 先观测，再阻断，再优化，不一步到位重构。

### 3.2 目标形态

当前 DSXU 大致是：

```text
每轮重建 fullSystemPrompt
+ 每轮注入 context hygiene / route evidence / runtime state
+ tools / MCP / Skill 状态可能变化
+ messages
```

V3 目标是：

```text
StablePrefix(session 固定)
+ DynamicRuntimeTail(每轮短、后置)
+ AppendOnlyMessageLedger
+ CacheEpoch(只有明确事件才重置)
```

---

## 4. 执行顺序总览

| 阶段 | 名称 | 目的 | 风险 | 预计收益 |
|---|---|---|---:|---:|
| P0 | Cache Baseline 固化 | 先知道当前 miss 从哪里来 | 低 | 证据基线 |
| P1 | Stable Prefix Lock | 无理由 hash 漂移归零 | 低 | 高 |
| P2 | Dynamic Runtime Tail | 把动态 runtime 从 system prompt 前部移走 | 中 | 高 |
| P3 | Tool Schema Freeze | 固定工具顺序和 schema hash | 中 | 高 |
| P4 | Cache Epoch | 让必要 miss 可解释、可统计、可预热 | 低 | 中高 |
| P5 | Append-only Ledger Discipline | 减少历史重写造成的 miss | 中 | 高 |
| P6 | Warm Prefix | 不改变能力，降低 epoch 后冷 miss | 低 | 中 |
| P7 | Cache Dashboard + Benchmark | 让 90% 可证明 | 低 | 高 |

建议执行周期：3-5 周。  
不建议一次性大改 query-loop。

---

## 5. P0：Cache Baseline 固化

### 5.1 目的

先建立可复算基线，区分：

- 真实 cache hit 低
- 统计口径低
- first turn 冷启动低
- compact/MCP/system rebuild 导致的合理 miss
- 无理由 stable prefix 漂移

### 5.2 操作明细

新增：

| 文件 | 作用 |
|---|---|
| `scripts/dsxu-cache-hit-baseline-report.ts` | 从 trace / generated JSON 汇总 cache hit、miss、stable hash 漂移 |
| `docs/generated/DSXU_V3_CACHE_BASELINE_20260518.json` | 当前基线 |
| `docs/generated/DSXU_V3_CACHE_BASELINE_20260518.md` | 人可读报告 |

统计字段：

```ts
type CacheBaselineRow = {
  source: string
  workflowKind: string
  model: string
  querySource: string
  turnCount: number
  cacheHitInputTokens: number
  cacheMissInputTokens: number
  cacheHitRatePct: number
  stablePrefixHash?: string
  dynamicTailHash?: string
  stableHashChanged?: boolean
  driftReason?: string
  boundaryFound?: boolean
  volatileFindingCount?: number
  dynamicTailApproxTokens?: number
}
```

### 5.3 验收命令

```bash
bun run scripts/dsxu-cache-hit-baseline-report.ts --from docs/generated --from .dsxu/trace --out docs/generated/DSXU_V3_CACHE_BASELINE_20260518.json
```

### 5.4 通过标准

| 标准 | 要求 |
|---|---|
| 能汇总现有证据 | PASS |
| 能区分 cold / warm / epoch | PASS |
| 能输出 stable hash 变化次数 | PASS |
| 能输出 top miss 来源 | PASS |
| 不改变运行时行为 | PASS |

失败处理：

只修报告脚本，不动 query-loop。

---

## 6. P1：Stable Prefix Lock

### 6.1 目的

让 stable prefix 成为主链合同。不是马上改写 prompt，而是先让无理由漂移变成可见错误。

### 6.2 操作明细

修改：

| 文件 | 操作 |
|---|---|
| `src/dsxu/engine/prompt-prefix-cache-builder.ts` | 增加 `driftReason`、`cacheEpochId`、`toolSchemaHash`、`stablePrefixLockStatus` |
| `src/dsxu/engine/prompt-prefix-cache-evidence.ts` | 记录上一轮 stable hash，判断是否漂移 |
| `src/query.ts` | 每轮 evidence 记录时传入 `cacheEpochId`、`queryChainId`、`toolSchemaHash` |
| `src/dsxu/engine/__tests__/prompt-prefix-cache-evidence.test.ts` | 增加 hash drift 测试 |

新增：

| 文件 | 作用 |
|---|---|
| `src/dsxu/engine/cache-prefix-drift-reason.ts` | 定义 drift reason 枚举 |

建议枚举：

```ts
type CachePrefixDriftReason =
  | 'none'
  | 'cold_start'
  | 'cache_epoch_reset'
  | 'tool_schema_changed'
  | 'mcp_tools_changed'
  | 'workspace_changed'
  | 'system_prompt_rebuilt'
  | 'compact_boundary'
  | 'model_family_changed'
  | 'unknown_unexpected_drift'
```

### 6.3 验收命令

```bash
bun test src/dsxu/engine/__tests__/prompt-prefix-cache-builder.test.ts src/dsxu/engine/__tests__/prompt-prefix-cache-evidence.test.ts
```

### 6.4 通过标准

| 标准 | 要求 |
|---|---|
| 同一 session 无工具/系统变化时 stable hash 不变 | PASS |
| hash 变化必须带 drift reason | PASS |
| unknown drift 在测试中 fail | PASS |
| 仍不 mutate provider prompt | PASS |
| 原有 prompt evidence 测试全绿 | PASS |

---

## 7. P2：Dynamic Runtime Tail 后置

### 7.1 目的

把每轮变化的 runtime 信息从 system prompt 前部移到后置 dynamic capsule，降低 miss tokens。

### 7.2 当前问题

`src/query.ts` 每轮构造：

```ts
appendSystemContext(systemPrompt, {
  ...systemContext,
  'Context Window & Hygiene': contextBudgetContext,
  'DSXU Model Route Evidence': ...
})
```

这些内容每轮变化，容易污染 system prompt。

### 7.3 操作明细

修改：

| 文件 | 操作 |
|---|---|
| `src/query.ts` | 不再把 route/context/verify runtime 直接拼进 stable system prompt |
| `src/utils/api.ts` | 保留 `SYSTEM_PROMPT_DYNAMIC_BOUNDARY` 语义，确保 boundary 后内容不进入 stable scope |
| `src/dsxu/engine/runtime-tail-capsule.ts` | 新增 runtime tail capsule builder |
| `src/dsxu/engine/__tests__/runtime-tail-capsule.test.ts` | 测试 runtime state 后置 |

新增 capsule 形态：

```text
<dsxu-runtime-state schema="dsxu.runtime-tail.v1">
route=model=deepseek-v4-flash reason=coding_flash_non_thinking
context_pressure=normal
verification=not_run
recovery=idle
next_action=visible_final_answer_or_next_tool
</dsxu-runtime-state>
```

放置原则：

| 内容 | 放哪里 |
|---|---|
| 工具纪律、权限纪律、输出合同 | stable prefix |
| 当前任务、route evidence、context pressure | dynamic tail |
| 最近工具结果 | message log / artifact，不进 stable |
| verification / recovery 状态 | dynamic tail |
| trace path、时间戳、绝对路径 | dynamic tail 或 evidence file |

### 7.4 验收命令

```bash
bun test src/dsxu/engine/__tests__/runtime-tail-capsule.test.ts src/dsxu/engine/__tests__/prompt-prefix-cache-evidence.test.ts
```

### 7.5 通过标准

| 标准 | 要求 |
|---|---|
| stable prefix 不包含 `Context Window & Hygiene` 动态值 | PASS |
| stable prefix 不包含最新 route evidence 文本 | PASS |
| runtime tail 包含 route/context/verify/recovery 必要信息 | PASS |
| 模型仍能看到 runtime 状态 | PASS |
| dynamicTailApproxTokens 下降或不增加 | PASS |

性能要求：

| 指标 | 要求 |
|---|---|
| p95 request setup 时间 | 不增加超过 5% |
| query-loop pass rate | 不下降 |
| final gate 行为 | 不退化 |

---

## 8. P3：Tool Schema Freeze

### 8.1 目的

DSXU 工具多，工具 schema 是 cache prefix 的大头。V3 不删工具，而是让工具 schema 在 session 内稳定。

### 8.2 操作明细

修改：

| 文件 | 操作 |
|---|---|
| `src/tools.ts` 或工具注册入口 | 确保核心工具排序稳定 |
| `src/dsxu/engine/tool-registry.ts` | 增加 `toolSchemaHash` |
| `src/services/api/dsxuTransport.ts` | 记录发送给 provider 的 tool schema hash |
| `src/dsxu/engine/prompt-prefix-cache-evidence.ts` | 关联 tool schema hash 与 stablePrefixHash |
| MCP bridge 相关文件 | MCP 新工具只 append，不 reorder |

新增：

| 文件 | 作用 |
|---|---|
| `src/dsxu/engine/tool-schema-freeze.ts` | canonicalize tool schema |
| `src/dsxu/engine/__tests__/tool-schema-freeze.test.ts` | 工具顺序、描述、参数 hash 测试 |

Canonical 规则：

1. 核心工具固定顺序。
2. MCP 工具按 `serverName/toolName` 排序，但 session 内不重排。
3. 新 MCP 工具 append 到末尾。
4. 工具描述不能包含 cwd、时间、session id、trace path。
5. 参数 schema key 排序稳定。
6. 删除、重排、编辑工具 schema 必须开启 cache epoch。

### 8.3 验收命令

```bash
bun test src/dsxu/engine/__tests__/tool-schema-freeze.test.ts src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts
```

### 8.4 通过标准

| 标准 | 要求 |
|---|---|
| 同一工具集合 canonical hash 稳定 | PASS |
| 同一工具集合不同注册顺序输出一致 | PASS |
| append 工具只改变 suffix hash | PASS |
| reorder/remove/edit 被分类为 cache epoch reset | PASS |
| 工具可用性不下降 | PASS |

---

## 9. P4：Cache Epoch 机制

### 9.1 目的

不是所有 miss 都是坏事。V3 要把必要 miss 解释清楚，把无理由 miss 打出来。

### 9.2 操作明细

新增：

| 文件 | 作用 |
|---|---|
| `src/dsxu/engine/cache-epoch.ts` | 管理 epoch id 和 reset reason |
| `src/dsxu/engine/__tests__/cache-epoch.test.ts` | 测试 epoch 行为 |

Epoch reset 触发：

| 事件 | 是否 reset | 原因 |
|---|---|---|
| /new | 是 | system/log 重建 |
| /clear | 是 | log 清空 |
| /compact | 是 | 历史摘要替换 |
| workspace switch | 是 | cwd 和项目上下文变 |
| MCP append tool | 轻量 epoch 或 suffix drift | 只追加，允许高 hit |
| MCP remove/reorder/edit | 是 | prefix 形态破坏 |
| route Flash -> Pro | 模型维度单独统计 | cache 可能不共享 |
| verification state 变化 | 否 | 应在 dynamic tail |
| route evidence 变化 | 否 | 应在 dynamic tail |

### 9.3 验收命令

```bash
bun test src/dsxu/engine/__tests__/cache-epoch.test.ts src/dsxu/engine/__tests__/prompt-prefix-cache-evidence.test.ts
```

### 9.4 通过标准

| 标准 | 要求 |
|---|---|
| 每次 stable hash 改变都有 epoch 或 drift reason | PASS |
| dynamic runtime 变化不 reset epoch | PASS |
| compact 后新 epoch 可见 | PASS |
| MCP reorder/remove/edit 可见 | PASS |
| unknown drift 为 0 | PASS |

---

## 10. P5：Append-only Ledger Discipline

### 10.1 目的

Reasonix 高命中的关键是 append-only log。DSXU 不需要照抄，但要减少无必要历史重写。

### 10.2 操作明细

审核并分类所有修改历史消息的路径：

| 路径 | 动作 |
|---|---|
| auto-compact | 允许，但必须 cache epoch |
| tool result truncation | 尽量 artifact 化，不直接重写旧消息 |
| recovery nudge | append 新 nudge，不重写历史 |
| final gate cursor | append tail cursor，保持短 |
| tool result storage | 大结果进 artifact，message 保留摘要和引用 |
| session resume heal | 允许，但必须记录 epoch reason |

新增：

| 文件 | 作用 |
|---|---|
| `src/dsxu/engine/message-ledger-discipline.ts` | 判断消息变化是否 append-only |
| `src/dsxu/engine/__tests__/message-ledger-discipline.test.ts` | 覆盖 append-only / compact / rewrite |

### 10.3 验收命令

```bash
bun test src/dsxu/engine/__tests__/message-ledger-discipline.test.ts src/dsxu/engine/__tests__/direct-connect-and-query-contract-v1.test.ts
```

### 10.4 通过标准

| 标准 | 要求 |
|---|---|
| 普通工具循环只追加消息 | PASS |
| compact/rewrite 都有 epoch reason | PASS |
| 大工具结果不直接撑爆 dynamic tail | PASS |
| recovery 不造成无理由 prefix drift | PASS |

---

## 11. P6：Warm Prefix

### 11.1 目的

在不增加用户等待的前提下，让新 epoch 后的首轮 miss 尽快变成后续 hit。

### 11.2 操作明细

可复用或扩展现有 cache warmer 方向。

新增或修改：

| 文件 | 操作 |
|---|---|
| `src/services/cache-warmer.ts` | 支持 stable prefix warm plan |
| `scripts/dsxu-cache-warm.ts` | 增加 `--prefix-only`、`--dry-run` |
| `src/dsxu/engine/cache-epoch.ts` | epoch reset 后标记 `warmRequired` |

Warm 规则：

1. 只在 idle 或用户确认的后台窗口执行。
2. 不影响当前 turn latency。
3. 不发送用户私有大上下文，只 warm stable prefix。
4. 必须写入 evidence：warm 请求、模型、prefix hash、usage。

### 11.3 验收命令

```bash
bun run scripts/dsxu-cache-warm.ts --dry-run --prefix-only
bun test src/services/static-analysis/__tests__/bridge.test.ts
```

### 11.4 通过标准

| 标准 | 要求 |
|---|---|
| dry-run 不发 API | PASS |
| warm plan 不包含用户动态任务 | PASS |
| warmRequired 状态可见 | PASS |
| 不阻塞当前 query-loop | PASS |

---

## 12. P7：Cache Dashboard + Benchmark

### 12.1 目的

让 90% 不是口号，而是每天可见、可复算、可回归。

### 12.2 操作明细

修改：

| 文件 | 操作 |
|---|---|
| `scripts/dsxu-evidence-dashboard.ts` | 加 cache section |
| `src/components/PromptInput/PromptInputFooter.tsx` | 只显示 session aggregate 或 compact cache 状态，不刷屏 |
| `docs/BENCHMARK.md` | 增加 cache hit 口径说明 |

新增：

| 文件 | 作用 |
|---|---|
| `scripts/dsxu-cache-first-ablation.ts` | DSXU 自己的 Reasonix 风格 A/B |
| `docs/generated/DSXU_V3_CACHE_FIRST_ABLATION_20260518.json` | A/B 原始结果 |
| `docs/generated/DSXU_V3_CACHE_FIRST_ABLATION_20260518.md` | 可读报告 |

A/B 设计：

| 模式 | 描述 |
|---|---|
| baseline | 当前 DSXU prompt 组包 |
| cache-first | V3 stable prefix + dynamic tail + tool freeze |

要求：

1. 同任务。
2. 同工具集合。
3. 同模型。
4. 同 temperature / reasoning effort。
5. 同成功判定。
6. 输出 raw trace。

### 12.3 验收命令

```bash
bun run scripts/dsxu-cache-first-ablation.ts --tasks 5 --repeats 3 --out docs/generated/DSXU_V3_CACHE_FIRST_ABLATION_20260518.json
bun run scripts/dsxu-evidence-dashboard.ts
```

### 12.4 通过标准

| 标准 | 最低要求 | 理想要求 |
|---|---:|---:|
| score floor | 不下降 | 上升 |
| pass rate | 不下降 | 上升 |
| warm-session cache hit | 80%+ | 88-92% |
| public challenge cache hit | 80%+ | 85%+ |
| latency p95 | 不超过 +5% | 下降或持平 |
| mean cost | 下降 | 下降 25%+ |
| tool result chars | 不增加 | 下降 |
| unknown stable drift | 0 | 0 |

---

## 13. 最终验收矩阵

### 13.1 单元与主链测试

```bash
bun test src/dsxu/engine/__tests__/prompt-prefix-cache-builder.test.ts
bun test src/dsxu/engine/__tests__/prompt-prefix-cache-evidence.test.ts
bun test src/dsxu/engine/__tests__/tool-schema-freeze.test.ts
bun test src/dsxu/engine/__tests__/cache-epoch.test.ts
bun test src/dsxu/engine/__tests__/runtime-tail-capsule.test.ts
bun test src/dsxu/engine/__tests__/message-ledger-discipline.test.ts
```

### 13.2 集成测试

```bash
bun test src/dsxu/engine/__tests__/direct-connect-and-query-contract-v1.test.ts
bun test src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts
bun test src/components/PromptInput/__tests__/PromptInputFooter-trust.test.ts
```

### 13.3 质量回归

```bash
bun test
bun run test:six-stage-final
```

如果 `bun test` 当前主链仍有已知大范围回归，则 V3 不允许宣称完成，只能宣称 cache-first 子链通过。

### 13.4 真实或准真实 cache 验收

```bash
bun run scripts/dsxu-cache-hit-baseline-report.ts --from docs/generated --from .dsxu/trace --out docs/generated/DSXU_V3_CACHE_BASELINE_20260518.json
bun run scripts/dsxu-cache-first-ablation.ts --tasks 5 --repeats 3 --out docs/generated/DSXU_V3_CACHE_FIRST_ABLATION_20260518.json
bun run scripts/dsxu-evidence-dashboard.ts
```

### 13.5 最终通过条件

| 条件 | 通过线 |
|---|---|
| stable hash 无理由漂移 | 0 |
| volatile stable finding | 0 |
| tool schema unknown churn | 0 |
| warm-session cache hit | >= 85%，目标 90% |
| public challenge cache hit | >= 80%，后续目标 85%+ |
| score floor | 不低于 V2 |
| pass rate | 不低于 V2 |
| p95 latency | 不超过 V2 +5% |
| mean cost | 低于 V2 |
| final claim | 不允许写“已稳定 90%”，除非 raw trace 支撑 |

---

## 14. 风险与回退

| 风险 | 触发 | 回退 |
|---|---|---|
| 模型质量下降 | pass rate 下降 | 关闭 dynamic tail 迁移，只保留 evidence |
| 工具不可用 | tool adapter 测试失败 | 回退 tool schema freeze 改动 |
| latency 上升 | p95 > +5% | 禁用 warm prefix，只保留 lock/evidence |
| cache hit 未提升 | miss 来源仍是 dynamic tail | 输出 top miss section，继续 P2 |
| compact 后表现差 | epoch 过多 | 增加 compact 后 warmRequired 和 warm prefix |
| Agent/MCP 体验变差 | handoff 或 MCP 测试失败 | 保留 append-only，不启用 reorder/remove 限制 |

---

## 15. V3 排序建议

如果只做 5 件事：

1. P0 Cache Baseline 固化
2. P1 Stable Prefix Lock
3. P2 Dynamic Runtime Tail 后置
4. P3 Tool Schema Freeze
5. P4 Cache Epoch

这 5 件事做完，DSXU 才从“有 cache evidence”变成“cache-first 主链”。

P5-P7 是把 90% 变成长期稳定产品指标，而不是一次性测试成绩。

---

## 16. 最终判断

DSXU 要到 90% 左右 cache hit，不应该靠继续压缩 prompt 文案，也不应该削弱工具和验证。

正确方向是：

```text
StablePrefixLock
+ DynamicRuntimeTail
+ ToolSchemaFreeze
+ CacheEpoch
+ AppendOnlyLedger
+ WarmPrefix
+ Dashboard/Ablation
```

这条路线和 DSXU 目标一致：

- 保留高级程序员需要的验证、证据、工具和恢复。
- 不牺牲 long-task 执行能力。
- 把 DeepSeek 的价格和 KV cache 优势真正转成产品优势。
- 让 90% cache hit 成为可复算指标，而不是宣传数字。

