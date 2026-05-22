# DSXU V10 Composer / Claude 机制信号吸收与测试方案 - 2026-05-20

## 0. V10 定位

V10 不是新增一套产品主线，也不是把 Cursor Composer、Claude Code 或任何参考产品复制进 DSXU。

V10 的目标是把两轮 Composer 2.5 分析、`D:\源代码claude\src` 1902 个源码文件的高级程序员体验信号、以及 DSXU 当前 DeepSeek-first runtime 现状，收束成一组 DSXU-owned 的工程能力：

1. 用轨迹治理提升长任务与复杂任务持续性。
2. 用局部反馈闭环修复工具、权限、测试、schema、恢复路径中的具体错误。
3. 用 reward hacking 防线防止 benchmark、测试、缓存、旧 artifact 被模型投机利用。
4. 用 feature deletion 任务包构造更接近真实高级编程能力的测试。
5. 用 DeepSeek Flash-first、Pro admission、cache/cost attribution 证明低成本 verified completion。
6. 用 TUI / final report / evidence dashboard 把能力变成用户可见、可复核、可继续操作的体验。

V10 只允许折叠进现有 owner：

| 能力 | 归属 owner | 禁止事项 |
|---|---|---|
| 局部反馈 | VerificationKernel / Recovery / GearBox | 不新增第二 recovery runtime |
| 防 reward hacking | Evidence / Benchmark / Release Claim Binder | 不把内部 smoke 写成公开榜单 |
| feature deletion benchmark | Existing eval / benchmark owner | 不新增 standalone benchmark runtime |
| 轨迹治理 | Progress Ledger / Work-State Timeline | 不新增第二任务账本 |
| cache / cost 归因 | DeepSeek route/cost/cache owner | 不新增 provider 层 |
| Agent 证据 | AgentTool evidence envelope | 不新增 swarm runtime |
| TUI 信任展示 | DSXU-owned Trust Surface | 不新增第二 TUI |

## 1. 输入来源与边界

### 1.1 Composer 2.5 机制信号

本方案吸收的不是 Composer 品牌、模型、训练代码或商业声明，只吸收公开文章中可泛化的机制思想：

| 信号 | 可吸收机制 | DSXU 转换方式 |
|---|---|---|
| 长任务持续性提升 | 任务轨迹治理 | Long Task Ledger + Work-State Timeline + recovery decision |
| 复杂指令遵循 | 目标/约束/验收拆解 | Task Contract + Active Frame + final gate |
| targeted textual feedback | 错误发生点局部反馈 | Localized Feedback Envelope |
| feature deletion 合成任务 | 删除可测功能再恢复 | Feature Deletion Benchmark Pack |
| reward hacking 案例 | 防缓存/字节码/残留投机 | Reward Hacking Guard |
| 低成本高效率 | cost-to-verified-completion | Flash-first + cache + Pro admission evidence |

### 1.2 Claude 1902 源码信号

对 `D:\源代码claude\src` 的结构观察：

| 目录/文件信号 | 机制含义 | DSXU 对照 |
|---|---|---|
| `bootstrap/state.ts` | session cost、cache latch、prompt cache eligibility、post-compaction 标记、strict tool result pairing | DSXU 需要更硬的 runtime config snapshot、cache latch、tool result pairing |
| `cost-tracker.ts` | cost、cache read/write、tool duration、session restore | DSXU 已有 cost/cache evidence，但需要 per-task verified completion board |
| `utils/toolResultStorage.ts` | 大工具结果 preview/artifact 化 | DSXU 已有 toolResultStorage，需纳入 anti-gaming 和 final evidence |
| `FileReadTool` / `BashTool` / `GrepTool` | 先定位、范围读取、输出折叠、命令安全 | DSXU 已有 source capsule / tool gate，需继续默认化 |
| `toolPermission` / `TrustDialog` | 权限是结构化状态 | DSXU PermissionGate 需在 TUI/CLI 更清晰展示 |
| `AgentTool` / tool summary | 子任务回传 summary/evidence，不回灌全 transcript | DSXU Agent evidence envelope 已有，需要 benchmark 化 |
| prompt cache break detection | cache 断裂原因归因 | DSXU 有 `promptCacheBreakDetection`，需进入 final report |

### 1.3 DSXU 当前已有基础

当前 DSXU 已有基础，不应重复造：

| 已有文件/能力 | 当前作用 | V10 动作 |
|---|---|---|
| `src/dsxu/engine/progress-ledger.ts` | Long Task Ledger / Runtime Event | 扩展事件，不新建账本 |
| `src/dsxu/engine/work-state-timeline.ts` | 可见工作状态 | 接入 Composer-style feedback / anti-gaming 摘要 |
| `src/services/api/deepseek-trajectory-store.ts` | DeepSeek route/cost/cache trajectory | 接入 cache break attribution |
| `src/dsxu/engine/reasonix-cache-hardening.ts` | context/cache/tool-result 压力治理 | 作为 cache/tool-result 治理实现基础 |
| `src/services/api/promptCacheBreakDetection.ts` | prompt cache break 诊断 | 收敛到 DSXU DeepSeek cache owner |
| `scripts/dsxu-claim-boundary-gate.ts` | claim 分层 | 扩展 reward hacking blocker |
| `scripts/dsxu-evidence-dashboard.ts` | evidence workbench | 增加 V10 workbench 指标 |

## 2. V10 总裁决

当前 DSXU 已经有 60%-75% 的相关部件，但还不是完整的 Composer-style / Claude-style 高级程序员体验闭环。

核心缺口不是“缺更多工具”，而是以下机制没有全部默认进入主链：

1. 失败点局部反馈没有统一 envelope。
2. reward hacking 还停留在 claim 防夸大，没有覆盖执行级投机检测。
3. feature deletion 类高难任务包没有进入 benchmark 主线。
4. cache break 原因还没有变成用户可见和 final report 可复核的证据。
5. cost 仍偏“总账”，还需要按 verified completion 粒度呈现。
6. Agent / tool result / recovery / claim gate 之间的因果链还可以更紧。

## 3. V10 执行原则

1. 不新增第二 query-loop。
2. 不新增第二 provider runtime。
3. 不新增第二 ToolBus。
4. 不新增第二 PermissionGate。
5. 不新增第二 Agent orchestrator。
6. 不新增第二 TUI。
7. 所有功能必须 owner-folded。
8. 所有 claim 必须绑定 source/test/live/raw/cost/cache evidence。
9. benchmark 不允许使用目标答案、旧 artifact、残留编译产物或历史报告投机。
10. 测试分层执行：先单测/合同测试，再 focused chain，再 live smoke，再六阶段最终测试。

## 4. P0 - Localized Feedback Envelope

### 4.1 目标

把 Composer 2.5 的 targeted textual feedback 转成 DSXU runtime 机制：每个失败点都产生局部反馈，进入 recovery 和 ledger。

### 4.2 数据结构

建议在 `src/dsxu/engine/progress-ledger.ts` 或同 owner 文件中增加：

```ts
export type LocalizedFeedbackEnvelope = {
  schemaVersion: 'dsxu.localized-feedback.v10'
  owner: 'VerificationKernel / Recovery / GearBox'
  stepId: string
  source: 'tool' | 'permission' | 'verification' | 'schema' | 'provider' | 'agent' | 'claim'
  failureType: string
  badDecision: string
  expectedCorrection: string
  nextAction: string
  evidence: string[]
  finalClaimAllowed: false
}
```

### 4.3 接入点

| 接入点 | 动作 |
|---|---|
| Tool result error | 生成 tool feedback |
| Permission denied | 生成 permission feedback |
| Verification fail | 生成 verification feedback |
| JSON / strict schema fail | 生成 schema feedback |
| Provider error / empty response | 生成 provider feedback |
| Agent evidence missing | 生成 agent feedback |
| Claim blocked | 生成 claim feedback |

### 4.4 验收

| 验收项 | 命令 |
|---|---|
| feedback envelope schema | `bun test src/dsxu/engine/__tests__/localized-feedback-envelope.test.ts` |
| verification fail 进入 recovery | `bun test src/dsxu/engine/__tests__/recovery-decision-table.test.ts` |
| final claim 被阻断 | `bun test src/dsxu/engine/__tests__/work-package-i/progress-ledger.test.ts` |

硬失败条件：

- 失败后仍输出 verified final。
- feedback 只写自然语言，不进入 ledger。
- Agent 子任务失败被 parent 忽略。

## 5. P0 - Reward Hacking Guard

### 5.1 目标

把 Composer 2.5 文章中的 reward hacking 教训转成 DSXU 的 benchmark 防作弊机制。

### 5.2 检测对象

| 风险 | 示例 | DSXU 决策 |
|---|---|---|
| Python 缓存投机 | `.pyc`、`__pycache__` | benchmark 默认禁用或标 blocker |
| Java 字节码投机 | `.class`、jar 反编译 | 必须声明是否允许 |
| 旧 artifact 投机 | 历史 stdout、旧 report、旧 trace | 不得作为 source truth |
| 目标答案泄漏 | expected patch、solution file | 直接 blocker |
| 隐藏 fixture 读取 | benchmark hidden answer | 直接 blocker |
| 只改测试 | 修改测试绕过功能 | blocker 或 requires-review |
| 只改文档 claim | 没有代码/测试证据 | claim blocked |
| 工具结果回灌过大 | 把旧大 transcript 当上下文 | artifact + preview |

### 5.3 落点

| owner | 文件建议 |
|---|---|
| Evidence / Benchmark | `src/dsxu/engine/reward-hacking-guard.ts` |
| Claim Boundary | `scripts/dsxu-claim-boundary-gate.ts` |
| Benchmark runner | `scripts/dsxu-hard-engineering-benchmark.ts` |
| Public comparable manifest | `scripts/dsxu-public-comparable-benchmark-manifest.ts` |

### 5.4 验收

| 验收项 | 命令 |
|---|---|
| 缓存/字节码/旧 artifact blocker | `bun test src/dsxu/engine/__tests__/reward-hacking-guard.test.ts` |
| claim gate 识别 anti-gaming blocker | `bun test scripts/__tests__/dsxu-claim-boundary-gate.test.ts` |
| benchmark 产出 anti-gaming 字段 | `bun run scripts/dsxu-hard-engineering-benchmark.ts --mode smoke` |

硬失败条件：

- benchmark 用了旧 artifact 还 PASS。
- 使用 `.pyc` / `.class` / solution 文件后仍允许 public claim。
- internal smoke 被写成 external benchmark。

## 6. P0 - Feature Deletion Benchmark Pack

### 6.1 目标

把 Composer 2.5 的 feature deletion 合成任务思想转成 DSXU 可复跑 benchmark：

1. 选择真实小型 repo 或 fixture。
2. 删除一个可测试功能。
3. 保留原测试或隐藏测试。
4. DSXU 需要恢复功能。
5. 记录 patch、tests、cost、cache、toolResultChars、recovery events。

### 6.2 任务类型

| 类型 | 示例 | 验收 |
|---|---|---|
| 单文件功能恢复 | 删除 parser branch | 原测试 PASS |
| 多文件边界恢复 | 删除 service + route glue | 单测 + integration PASS |
| API contract 恢复 | 删除 schema / validator | contract tests PASS |
| UI/TUI 行为恢复 | 删除 resize/scroll 状态 | PTY/snapshot PASS |
| 安全修复恢复 | 删除 redaction | secret scan PASS |
| provider/tool 恢复 | 删除 strict schema handling | provider contract PASS |

### 6.3 落点

| owner | 文件建议 |
|---|---|
| Existing eval owner | `src/services/eval/feature-deletion/` 或并入现有 eval owner |
| Benchmark script | `scripts/dsxu-feature-deletion-benchmark.ts` |
| Evidence | `docs/generated/DSXU_V10_FEATURE_DELETION_BENCHMARK_*.json` |

如果现有 eval owner 已有同类 runner，必须合并，不允许新增 standalone runtime。

### 6.4 验收

| 阶段 | 命令 |
|---|---|
| fixture 生成 | `bun test src/services/eval/__tests__/feature-deletion.test.ts` |
| 5 case smoke | `bun run scripts/dsxu-feature-deletion-benchmark.ts --cases 5 --mode internal-smoke` |
| 30 case product pack | `bun run scripts/dsxu-feature-deletion-benchmark.ts --cases 30 --mode product-evidence` |

公开 claim 边界：

- internal-smoke 不能写外部榜单。
- 30 case product pack 可以写 “DSXU internal feature-deletion benchmark”，不能写 “超过某闭源产品”。

## 7. P1 - Cache Latch and Cache Break Attribution

### 7.1 目标

从 Claude cache latch / prompt cache break 信号吸收：

1. session 开始冻结 runtime config snapshot。
2. 稳定 prefix、tool schema、model、thinking、headers、cache strategy 不随意漂移。
3. cache miss 时解释原因。
4. final report 显示 cache hit rate 只是 observed metric，不是能力 claim。

### 7.2 当前 DSXU 事实

本轮 fresh 证据：

| 证据 | 结果 |
|---|---|
| live tool-call replay | cache hit `73.3%`，384 hit / 140 miss |
| cost/cache 综合板 | cache hit `75.3%` |
| source cache acceptance | stablePrefixHashUnchanged=true，避免 21809 chars 回灌 |
| live provider smoke | provider/usage/cost 合同通过，但不输出 hit/miss 明细 |

### 7.3 新增归因字段

| 字段 | 含义 |
|---|---|
| `cacheBreakReason` | system prompt / tool schema / model / thinking / compact / TTL / dynamic tail |
| `stablePrefixHash` | 稳定前缀 hash |
| `dynamicTailHash` | 动态尾部 hash |
| `toolSchemaHash` | 工具 schema hash |
| `runtimeConfigHash` | runtime config snapshot hash |
| `cacheHitRatePct` | hit / (hit + miss) |
| `cacheClaimBoundary` | observed / trend / high-roi-allowed / blocked |

### 7.4 验收

| 验收项 | 命令 |
|---|---|
| prompt cache break 检测 | `bun test src/services/api/__tests__/promptCacheBreakDetection.test.ts` |
| DeepSeek cache prefix 合同 | `bun test src/services/api/deepseek-adapter-cache-prefix-v1.test.ts` |
| source cache acceptance | `bun run scripts/dsxu-source-cache-acceptance.ts` |
| live cache replay | `bun --env-file=.env run scripts/dsxu-v6-live-tool-call-replay.ts` |
| cost/cache board | `bun run scripts/dsxu-deepseek-cost-quality-acceptance.ts` |

硬失败条件：

- cache hit rate 没有 hit/miss token 仍被写成百分比。
- dynamic MCP/tool list 进入 stable prefix。
- thinking/model/headers 中途漂移但没有 attribution。

## 8. P1 - Cost to Verified Completion Board

### 8.1 目标

把“省钱”从营销语转成 DSXU 可复核指标。

### 8.2 指标

| 指标 | 解释 |
|---|---|
| `finalPass` | 是否最终通过 |
| `firstAttemptPass` | 是否首次通过 |
| `recoverySuccess` | 失败后是否修复 |
| `totalCostUsd` | 真实或可归因成本 |
| `costPerVerifiedTask` | totalCost / verified pass |
| `flashTurnRatioPct` | Flash 占比 |
| `proAdmissionCount` | Pro 准入次数 |
| `proAdmissionJustifiedPct` | Pro 是否有失败/高风险/审查原因 |
| `cacheHitRatePct` | cache hit 趋势 |
| `toolResultChars` | 工具结果压力 |
| `wallClockMs` | 执行时间 |

### 8.3 验收

| 验收项 | 命令 |
|---|---|
| cost-quality board | `bun run scripts/dsxu-deepseek-cost-quality-acceptance.ts` |
| evidence dashboard | `bun run scripts/dsxu-evidence-dashboard.ts` |
| public docs claim boundary | `bun run release:github-launch-pack` |

公开写法：

- 允许：`Flash-first routing with per-task cost/cache evidence`
- 允许：`live replay observed 73.3% cache hit in a small two-request tool-call smoke`
- 不允许：`90% cache hit guaranteed`
- 不允许：`beats GPT/Claude/Cursor`

## 9. P1 - Trajectory Governance Hardening

### 9.1 目标

长任务不能靠模型记忆硬撑，必须靠轨迹治理。

### 9.2 必须写入 ledger 的事件

| 事件 | 必填字段 |
|---|---|
| task_contract | goal、non-goal、acceptance、risk |
| route | model、thinking、reason、Pro admission |
| tool | toolName、reason、permission、result preview |
| source_evidence | file、hash、range、freshness |
| edit_proof | file、intent、diff summary |
| verification | command、exit、pass/fail、artifact |
| recovery | failure、decision、next action |
| cache | hit/miss、stable/dynamic hash、break reason |
| evidence | artifact、raw trace、claim boundary |
| final_claim | allowed/blocked、why |

### 9.3 验收

| 验收项 | 命令 |
|---|---|
| ledger event schema | `bun test src/dsxu/engine/__tests__/active-frame-ledger.test.ts` |
| resume smoke | `bun run scripts/dsxu-v6-ledger-resume-smoke.ts` |
| V8 long task replay | `bun run scripts/dsxu-v8-long-task-ledger-replay.ts` |
| work-state timeline | `bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts` |

硬失败条件：

- final report 声称完成但 ledger 无 verification event。
- recovery 后未记录 recovery decision。
- Pro admission 没有原因。

## 10. P1 - Agent Evidence and Tool Result Pairing

### 10.1 目标

把 Claude strict tool result pairing / Agent summary 信号收成 DSXU 主链。

### 10.2 规则

1. 每个 tool_call 必须有 matching tool_result。
2. orphan tool_result 不得进入模型上下文。
3. Agent 只回 evidence envelope，不回完整 transcript。
4. parent final 只能引用 worker evidence。
5. worker 失败必须显示在 parent synthesis。

### 10.3 验收

| 验收项 | 命令 |
|---|---|
| tool result pairing | `bun test src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts` |
| Agent evidence handoff | `bun test src/tools/AgentTool/__tests__/agent-evidence-handoff.test.ts` |
| parent final gate | `bun test src/dsxu/engine/__tests__/agent-parent-final-gate-replay-v1.test.ts` |

硬失败条件：

- Agent 无 evidence 但 parent 写 PASS。
- tool call/result 配对错误后继续 verified final。

## 11. P2 - TUI Trust Surface Update

### 11.1 目标

把局部反馈、anti-gaming、cost/cache、claim boundary 短显示到用户可见状态，不重复、不刷屏。

### 11.2 短显示格式

```text
DSXU · Flash · verify=pass · claim=blocked:benchmark · cache=73% · cost=$0.00004 · risk=anti-gaming:clean
```

### 11.3 详情面板

详情不进主输入区，进入 trust/evidence panel：

| 面板 | 内容 |
|---|---|
| Feedback | 最近 3 条 localized feedback |
| Anti-Gaming | artifact/cache/bytecode/test投机检查 |
| Cost/Cache | hit/miss、cache break reason、cost |
| Ledger | 当前 task phase、open obligations |
| Claim | allowed/blocked 原因 |

### 11.4 验收

| 验收项 | 命令 |
|---|---|
| trust surface unit | `bun test src/components/__tests__/tui-trust-surface.test.tsx` |
| resize/scroll PTY | `bun test src/ink/__tests__/render-node-scroll-resize.test.ts` |
| snapshot | `bun run scripts/dsxu-v6-tui-snapshot.ts` |
| real window | `bun run acceptance:interactive-tui` |

硬失败条件：

- trust line 超过 80 列仍不折叠。
- 未验证状态显示成 PASS。
- anti-gaming blocker 被隐藏。

## 12. P2 - Public Benchmark and Claim Boundary

### 12.1 目标

把 Composer 类 benchmark 思想转成 DSXU 可公开复核证据，而不是写口号。

### 12.2 公开 claim 分层

| 层级 | 可写吗 | 条件 |
|---|---|---|
| Internal smoke | 可以写内部验证 | 不可写外部胜出 |
| Product benchmark | 可以写 DSXU 自有数据 | 必须提供 raw、cost、cache、trace |
| Public comparable | 谨慎 | 必须同题 paired raw target |
| External victory / 90%+ | 当前不允许 | 需要固定 manifest、target raw、rubric、复跑脚本 |

### 12.3 验收

| 验收项 | 命令 |
|---|---|
| claim boundary gate | `bun test scripts/__tests__/dsxu-claim-boundary-gate.test.ts` |
| public comparable manifest | `bun run scripts/dsxu-public-comparable-benchmark-manifest.ts` |
| dashboard | `bun run scripts/dsxu-evidence-dashboard.ts` |
| launch pack | `bun run release:github-launch-pack` |

## 13. V10 分层测试计划

### 13.1 开发期 focused tests

每个 P0/P1 完成后只跑对应测试：

```bash
bun test src/dsxu/engine/__tests__/localized-feedback-envelope.test.ts
bun test src/dsxu/engine/__tests__/reward-hacking-guard.test.ts
bun test src/services/eval/__tests__/feature-deletion.test.ts
bun test src/services/api/deepseek-adapter-cache-prefix-v1.test.ts
bun test src/dsxu/engine/__tests__/active-frame-ledger.test.ts
bun test src/tools/AgentTool/__tests__/agent-evidence-handoff.test.ts
```

### 13.2 大块 focused chain

```bash
bun run scripts/dsxu-source-cache-acceptance.ts
bun run scripts/dsxu-deepseek-cost-quality-acceptance.ts
bun run scripts/dsxu-v8-long-task-ledger-replay.ts
bun run scripts/dsxu-v8-default-chain-reachability.ts
bun run scripts/dsxu-v8-cn-scenario-replay.ts
```

### 13.3 Live smoke

只在 `.env` 有 key 且用户允许消耗 API 时跑：

```bash
bun --env-file=.env run scripts/dsxu-v6-live-provider-probe.ts --live
bun --env-file=.env run scripts/dsxu-v6-live-tool-call-replay.ts
bun --env-file=.env run scripts/dsxu-v8-live-provider-smoke.ts --live
```

### 13.4 Benchmark pack

```bash
bun run scripts/dsxu-feature-deletion-benchmark.ts --cases 5 --mode internal-smoke
bun run scripts/dsxu-feature-deletion-benchmark.ts --cases 30 --mode product-evidence
```

### 13.5 Final release tests

只在 P0/P1/P2 focused 全过后跑：

```bash
bun test
bun run test:six-stage-final
bun run acceptance:senior-coding-window
bun run clean-export:preflight
bun run release:clean-export-artifact
bun run release:fresh-install-smoke
```

## 14. V10 完成标准

| 标准 | 要求 |
|---|---|
| 结构 | 无第二主链、无第二 provider、无第二 ToolBus、无第二 TUI |
| 局部反馈 | P0 feedback envelope 全部进入 ledger/recovery |
| 防作弊 | benchmark/claim gate 能阻断残留缓存、字节码、旧 artifact、solution 泄漏 |
| feature deletion | 至少 5 case internal smoke PASS，30 case pack 可复跑 |
| cache/cost | live/tool replay、cost-quality board、source-cache acceptance 均有 fresh evidence |
| 长任务 | ledger/recovery/final claim 因果链完整 |
| TUI | 短显示、不重复、resize/scroll 不破坏交互 |
| public claim | 内部和公开边界清楚，未达外部 paired raw 时不写 90/95 |

## 15. 建议执行顺序

1. P0 Localized Feedback Envelope。
2. P0 Reward Hacking Guard。
3. P0 Feature Deletion Benchmark Pack。
4. P1 Cache Latch and Cache Break Attribution。
5. P1 Cost to Verified Completion Board。
6. P1 Trajectory Governance Hardening。
7. P1 Agent Evidence and Tool Result Pairing。
8. P2 TUI Trust Surface Update。
9. P2 Public Benchmark and Claim Boundary。
10. 分层测试、live smoke、六阶段最终测试、clean export。

## 16. 最终结论

Composer 2.5 给 DSXU 的启发不是“换模型”或“复制训练栈”，而是：

- 长轨迹要被治理。
- 局部错误要局部反馈。
- benchmark 必须防投机。
- 任务要从真实代码库构造。
- 成本优势必须绑定 verified completion。

Claude 1902 源码给 DSXU 的启发不是“文件多”，而是：

- cache latch 很细。
- tool result pairing 很硬。
- cost/token/session restore 是产品级状态。
- permission/trust 是 UI 和 runtime 的同一件事。
- Agent 只回 evidence，不回长 transcript。

V10 的正确方向是把这些信号折叠进 DSXU 现有主线，使 DSXU 以 DeepSeek Flash-first、强 runtime、强证据、低成本 verified completion 的方式，形成自己的高级 AI 编程体验。

---

## 17. V10 三文档同步核心纪律 - 2026-05-20

本文件是 Composer / Claude 机制信号吸收子文档，必须与总控文档 `DSXU_V10_FINAL_REALITY_MERGED_RELEASE_PLAN_20260520_CN.md` 和 Reality Run 子文档 `DSXU_FINAL_REALITY_RUN_PLAN_20260520_CN.md` 同步执行。这里记录的是机制吸收，不是品牌、商业代码、训练方法或外部产品复制。

### 17.1 信号吸收执行纪律

1. 不能偷懒测试：每个吸收机制必须绑定 DSXU owner、focused verification、失败路径、claim boundary。
2. 不能伪造 PASS：mock、dry-run、internal replay、旧 artifact、历史报告必须分级；internal replay 不等于公开 benchmark。
3. 以点带面：发现一个 cache、tool result、Agent envelope、localized feedback、TUI trust、permission state 问题时，要扩展检查同类 owner，不能只修表面。
4. 不能新增第二主链：Composer/Claude 信号必须折叠进 DSXU Progress Ledger、Tool Gate、DeepSeek route-cost-cache、Evidence Release Claim Binder、TUI Trust Surface。
5. paired raw DSXU + target 是公开对比硬边界；没有同题 raw transcript、tool trace、final report、cost、risk 前，只能写内部证据和工程机制，不能写 90%+ 或外部胜出。

### 17.2 当前吸收执行状态

| 机制 | 当前状态 | 说明 |
|---|---|---|
| Localized Feedback Envelope | 已有 focused pass | 失败验证会形成短反馈 envelope 并进入 recovery ledger，不再靠长 prompt 淹没问题。 |
| Reward Hacking Guard | 已有 seeded guard pass | 阻断 bytecode、solution 泄漏、mock/public 夸大、test-only product fix。 |
| Feature Deletion Task Pack | 已有 5 case internal pack | 是 product-evidence task pack，不是 SWE-bench 或公开 benchmark。 |
| Cache / Cost / Trajectory | 已有 `PASS_V10_FINAL_CACHE_COST_TRAJECTORY` | 能解释 stable prefix 与 deliberate cache break；cache hit 只做优化指标。 |
| Agent Evidence / Tool Result Pairing | 已有 `PASS_V10_FINAL_AGENT_TOOL_PAIRING` | 子 agent 只回 evidence envelope，Tool Gate result 能进入 final projection。 |
| Dashboard / Claim Boundary | 已接入 final dashboard | public 90 claim 仍保持 blocked。 |
| TUI Trust Surface | 已有 `PASS_V10_FINAL_TUI_TRUST_SURFACE` | 把参考产品“状态可信、错误可见、证据短显示”的体验信号折叠进 DSXU TUI owner。 |
| Public Claim Boundary | 已有 `PASS_DSXU_CLAIM_BOUNDARY_GATE` + blocked corpus | 机制吸收只能写 DSXU-owned evidence，不写参考产品超越或 90%+。 |

### 17.3 后续吸收边界

```text
允许：描述 DSXU-owned 的轨迹治理、局部反馈、防 reward hacking、成本到验证完成、Agent evidence envelope。
禁止：使用参考品牌作为能力声明、复制商业代码/文案、把 internal replay 写成公开 benchmark、把 dry-run 写成 live benchmark。
```

### 17.4 TUI 信任体验吸收裁决

Composer / Claude 信号里最值得吸收的不是某个 UI 样式，而是高级程序员能随时判断“现在在做什么、为什么做、是否卡住、证据在哪里”。本轮 DSXU 不复制参考产品 UI，只把机制折叠到 DSXU 自有 TUI trust surface：

- 状态短显示，避免重复刷屏。
- EvidenceLine 从普通聊天行移到 trust state，避免用户以为模型又在回复。
- resize / scroll 维持用户阅读意图，不在窗口放大时强行跳顶。
- 权限 review 在长内容和 resize 后仍可见。
- streaming health 区分 progress、auth block、hidden stall、mojibake。

当前裁决：focused TUI trust evidence 已通过；最终开源发布前仍需 six-stage / senior-coding / clean-export 阶段复验。

### 17.5 机制吸收的公开声明边界

Composer / Claude 信号吸收只能作为 DSXU 自有机制证据：轨迹治理、局部反馈、防 reward hacking、feature deletion task pack、cache/cost attribution、Agent evidence envelope、TUI trust surface。它不能自动升级成参考产品对比胜出。

本轮复跑 claim boundary 后，public90Allowed=false、externalBenchmarkReady=false。结论是：可以写“吸收并重构了通用高级工程机制”，不能写“超过 GPT/Claude/Composer”或“公开 90%+ 已达成”。

### 17.6 信号吸收的 release-surface 风险修复

本轮发现的 blocker 说明：即使 anti-gaming/claim boundary 机制本身是正确的，如果脚本或 active source 直接携带参考品牌/公开胜出 claim 字面量，也会变成开源发布风险。处理方式不是删除机制，而是把风险词从可发布源码字面量中收束为 DSXU-owned 安全构造，保持检测能力不变。

| 吸收机制 | 复验结果 |
|---|---|
| reward-hacking guard | focused tests 5 pass / 0 fail，仍能拦截 90%/胜出/公开 benchmark 夸大 claim |
| final ablation / reachability / dashboard | 证据刷新 PASS，不再向 release surface 泄漏品牌字面量 |
| release-surface gate | focused tests 10 pass / 0 fail |
| release gate 主入口 | 514 pass / 0 fail |

裁决：这次不是“少写品牌词”这么简单，而是把参考产品信号吸收后的公开源码风险纳入 claim boundary owner。后续所有 Composer/Claude 信号吸收都必须走同一规则：机制可以吸收，品牌/商业表达/公开胜出 claim 必须被 release-surface gate 约束。

### 17.7 真实窗口信号吸收复验结果

本轮把高级工程体验里的“长内容窗口、权限可见、滚动位置、证据短显示、卡住可诊断”作为同一类 TUI trust signal 处理。最终不是减少测试，而是把 TUI owner 从单个超时大包拆为三个可归因的真实测试入口：

| 信号 | 验收 |
|---|---|
| streaming / model-driven health | 17 pass / 0 fail |
| real TUI lifecycle / permission / stall / compact resume | 9 pass / 0 fail |
| real PTY resize / permission visible / middle scrollback | 4 pass / 0 fail |
| six-stage final | 22/22 commands pass |

裁决：V10 已把参考体验里的 TUI trust signal 折叠到 DSXU 自有 owner，并通过 fresh six-stage final。后续仍不能把机制吸收写成参考产品复制或外部 benchmark 胜出。

### 17.8 信号吸收后的 GitHub 卖点口径 - 2026-05-20

本节只记录机制吸收后的 DSXU-owned 公开表达，不记录任何品牌复制或外部胜出声明。

| 吸收信号 | DSXU 当前证据 | 可公开表达 |
|---|---|---|
| 长任务真实工程体验 | senior coding window 30.48 分钟、33 次 DSXU product-entry run、32 轮结构化 review、最终测试通过 | DSXU 能在真实窗口中持续执行、修复、复验并保留证据。 |
| 成本纪律 | senior window 全程 Flash-only，约 `$0.3617`，Pro 未使用 | DSXU 默认 Flash-first，Pro 必须有 admission evidence。 |
| 证据优先 | evidence dashboard pass=111、fail=0、blocked=1、notRun=108、scoreFloor=72、releaseClaimAllowed=false | DSXU 会阻断未达证据门槛的公开 90/95 claim。 |
| 反作弊/claim 边界 | release gate 514 pass / 0 fail，blocked claim corpus 与 claim boundary gate 已通过 | DSXU 把 benchmark、卖点、README 文案都绑定到证据链。 |
| TUI trust signal | streaming/model-driven 17 pass、real TUI lifecycle 9 pass、real PTY resize/scroll 4 pass，six-stage 22/22 | DSXU TUI 不是装饰，而是工作状态、权限、证据、恢复的可见投影。 |
| 内部 eval plumbing | SWE internal smoke 5/5 PASS | 只能写内部 smoke 管道健康，不能写公开 SWE benchmark 成绩。 |

当前吸收结论：机制可以学习和重构为 DSXU-owned runtime；公开文案只能写 DSXU 自有 evidence-first、Flash-first、trust-surface、claim-boundary 能力，不能写参考产品品牌、商业行为、外部胜出或公开榜单达成。
