# DSXU Code V2 执行方案

生成时间：2026-05-18  
工作区：`D:\DSXU-code`  
目标：在 DeepSeek V4 Flash / Flash-MAX / Pro 混合模型基础上，通过强编排、工具、权限、上下文、恢复、Agent、成本和证据系统，做出接近或超过 Claude Code 4.7 体验的 AI 编程与复杂任务执行工具，重点服务高级程序员。

本文原始用途是代码审核与执行规划。当前按 2026-05-18 最新决策进入 V2 owner-folded 执行：只在现有 owner 内收束主链，不新增第二套 runtime / provider / permission / DAG / benchmark 入口。

---

## 0. 总结结论

V1 不是“没做”，而是“模块层大多做了，产品主链还没有收敛”。

审核后的判断：

| 维度 | 结论 |
|---|---|
| V1 单项模块 | 大多数已存在，且单项 smoke/单元测试可跑通 |
| V1 默认体验 | 未完成，关键 gate 默认仍由环境变量控制，非默认强制 |
| V1 最终验收 | 不通过“可确认完成”标准：最终入口 5 分钟超时，未得到 PASS |
| 当前分数 | evidence dashboard 仍为 `scoreFloor=72` |
| 最大真实瓶颈 | 不是继续加模块，而是把已有模块接入默认主链、统一 Provider、统一证据与最终验收 |

V2 的核心原则：

1. 不继续堆新模块。
2. 不重写架构。
3. 不硬删 Claude 原工具层。
4. 把已有 V1/V24/V26 能力收敛到默认高级程序员体验。
5. 弱模型能力不靠 prompt 许愿，必须靠 runtime gate、工具视窗、证据链和可恢复 ledger。

### 0.1 最新执行口径 - 2026-05-18

V2 先完成，不再把新增能力继续堆到 V26。执行方式不是“新增 8 个模块”，而是把已有 V1/V24/V26 模块折回现有 owner，修成默认可信体验。

执行顺序修正如下：

| 顺序 | 工作 | owner-folded 口径 | 当前动作 |
|---|---|---|---|
| P0-A | 模型事实单源 | `src/utils/model/deepseekV4Control.ts` 是唯一事实源；`model-capability-v1.ts` 只能投影，不得保留 128K / thinking=false / 伪模型。 | 先执行 |
| P0-B | ProviderGateway 单一边界 | DeepSeek thinking/tool replay/cost evidence 只允许从现有 provider owner 出口收束，不新增 provider 层。 | P0-A 后执行 |
| P0-C | 默认编辑生命周期 | FileWrite/FileEdit、TDD、SAST、verification envelope、work-state timeline 形成默认证据链。 | P0-B 后执行 |
| P0-D | 命令目录与 owner 验证分组 | 四个 owner-reviewed alias 已用于既有脚本可执行性；后续不能再新增泛化入口，只能在 command catalog / final runner 中标明 owner-focused 验证分组，避免 package scripts 膨胀成第二产品表面。 | P0-C 后执行 |
| P0-E | 最终验收可归因 | final test 不再只看是否超时，要能按 owner 输出失败命令、根因和下一步。 | P0-D 后执行 |

当前禁止项：

- 不因为 V2 执行而新增主链、通用 facade、独立 benchmark runtime、独立 provider gateway。
- 不把 internal smoke、dry-run、mock runner 写成 GitHub 公共成绩。
- 不每改一个小点就跑全量测试；P0-A 只跑模型事实相关 focused 验证。

---

## 1. 本次真实审核依据

本次审核读取/扫描的关键文件与命令：

| 类别 | 证据 |
|---|---|
| V1 原始方案 | `docs/DSXU_OPTIMIZATION_FOR_CODEX_20260517.md` |
| V1 中文方案 | `docs/DSXU_V1_CORE_EXECUTION_PLAN_20260518_CN.md` |
| TDD Gate | `src/coordinator/tdd-gate/post-write-hook.ts`、`src/tools/FileEditTool/FileEditTool.ts`、`src/tools/FileWriteTool/FileWriteTool.ts` |
| SAST Gate | `src/services/static-analysis/tool-gate.ts`、`src/services/static-analysis/__tests__/bridge.test.ts` |
| PEV DAG | `src/coordinator/dag/templates.ts` |
| SWE Runner | `src/services/eval/swe-bench/runner.ts`、`src/services/eval/swe-bench/judge.ts`、`scripts/dsxu-swe-bench-runner.ts` |
| Evidence Dashboard | `scripts/dsxu-evidence-dashboard.ts` |
| Cache Warmer | `src/services/cache-warmer.ts`、`scripts/dsxu-cache-warm.ts` |
| Runtime Health | `src/services/health/*`、`scripts/dsxu-runtime-health.ts` |
| Package scripts | `package.json` |
| Model facts | `src/utils/model/deepseekV4Control.ts`、`src/dsxu/engine/model-capability-v1.ts`、`src/dsxu/engine/model-config.ts` |
| Provider path | `src/services/api/deepseek-adapter.ts`、`src/dsxu/engine/llm-adapter.ts`、`src/dsxu/engine/model-gateway-client.ts`、`src/dsxu/engine/api-service.ts` |
| Tool window | `src/dsxu/engine/query-loop.ts`、`src/dsxu/engine/index.ts`、`src/tools.ts` |
| Agent / Skill | `src/tools/AgentTool/*`、`src/tools/SkillTool/prompt.ts`、`src/dsxu/engine/skill-governance-v1.ts` |
| Work state / ledger | `src/dsxu/engine/work-state-timeline.ts`、`src/dsxu/engine/progress-ledger.ts` |

本次实际运行的 V1 验证命令：

| 命令 | 结果 | 说明 |
|---|---:|---|
| `bun test src/coordinator/tdd-gate/__tests__/gate.test.ts` | PASS | 5 pass |
| `bun test src/coordinator/dag/__tests__/dag.test.ts` | PASS | 13 pass |
| `bun test src/services/static-analysis/__tests__/bridge.test.ts` | PASS | 9 pass |
| `bun run scripts/dsxu-swe-bench-runner.ts --instances "mock-001,mock-002" --timeout 60000` | PASS | internal smoke 2/2，非公开 SWE-bench |
| `bun run scripts/dsxu-cache-warm.ts --dry-run` | PASS | dry-run，仅规划，不证明真实 cache hit |
| `bun run scripts/dsxu-runtime-health.ts` | PASS | health dry path，live ping intentionally skipped |
| `bun run scripts/dsxu-evidence-dashboard.ts` | PASS | dashboard 生成成功，但 scoreFloor 仍为 72 |
| `bun run test:six-stage-final` | TIMEOUT | 5 分钟未完成 |
| `bun run acceptance:senior-coding-window` | TIMEOUT | 5 分钟未完成 |
| `bun test --bail=1 --timeout 20000` | TIMEOUT | 5 分钟未完成 |

注意：最终入口超时后，已清理本次启动的 `bun` 子进程，避免留下悬挂执行。

---

## 2. V1 八个模块真实完成度审核

| V1 模块 | 文件是否存在 | 单项验证 | 默认主链状态 | 真实结论 | V2 合并动作 |
|---|---:|---:|---|---|---|
| 1. Verification Pipeline | 是 | PASS | 部分接入 | Edit/Write 已调用 TDD gate，但默认 `DSXU_TDD_POST_WRITE_GATE` 未开时返回 `SKIPPED`；非默认强制 | V2 P0-3：默认编辑生命周期 |
| 2. SWE-Bench Runner + Judge | 是 | PASS | 内部 smoke | 当前是 internal smoke，不是正式 SWE-bench 成绩，也不能对外宣称 | V2 P2-2：正式 public comparable 分层 |
| 3. Coordinator DAG PEV Template | 是 | PASS | 模板存在 | `planExecuteVerifyDag()` 已存在；但模板存在不等于所有代码修改任务默认进入 PEV 生命周期 | V2 P0-3/P1-1：接入默认编辑链与 tool window |
| 4. Evidence Dashboard | 是 | PASS | 可运行 | dashboard 能聚合证据，但仍是 release-claim binder input；`scoreFloor=72`，public comparable 30/30 缺失 | V2 P1-3：信任界面产品化 |
| 5. Cache Warmer | 是 | PASS | dry-run | cache warmer 只有 dry-run 证据，不证明真实 provider cache 命中率提升 | V2 P2-3：只保留为成本证据辅助，不作为核心能力 |
| 6. Static Analysis Gate | 是 | PASS | 部分接入 | Edit/Write 已调用 SAST gate，但默认 `DSXU_STATIC_ANALYSIS_TOOL_GATE` 未开时返回 `SKIPPED` | V2 P0-3：风险文件默认阻断策略 |
| 7. Runtime Health Check | 是 | PASS | 可运行 | 能检查环境和模块加载；DeepSeek live ping 被故意跳过，不能证明模型质量 | V2 P1-3：接入 dashboard，但区分 dry/live |
| 8. Package.json Scripts | 否 | FAIL | 缺失 | V1 要求的四个别名缺失：`evidence:dashboard`、`benchmark:swe-bench`、`cache:warm`、`health:runtime` | V2 P0-0：先补脚本入口 |

V1 真实完成度：

| 层级 | 完成度 |
|---|---:|
| 文件与单项模块 | 约 75% |
| 默认产品体验 | 约 60% |
| 可对外声称达到 90+ | 否 |

---

## 3. V1 未完成与不稳定项

### 3.1 Package 入口缺失

`package.json` 缺少 V1 文档要求的四个脚本：

```json
{
  "benchmark:swe-bench": "bun run scripts/dsxu-swe-bench-runner.ts",
  "evidence:dashboard": "bun run scripts/dsxu-evidence-dashboard.ts",
  "health:runtime": "bun run scripts/dsxu-runtime-health.ts",
  "cache:warm": "bun run scripts/dsxu-cache-warm.ts"
}
```

影响：最终验收命令无法按 V1 文档直接执行。

### 3.2 TDD/SAST 仍是环境变量开关

`src/coordinator/tdd-gate/post-write-hook.ts`：

- 默认读取 `DSXU_TDD_POST_WRITE_GATE`
- 未开启时直接 `SKIPPED`
- 非 `full-test` 模式时为 `PARTIAL`

`src/services/static-analysis/tool-gate.ts`：

- 默认读取 `DSXU_STATIC_ANALYSIS_TOOL_GATE`
- 未开启时直接 `SKIPPED`

影响：高级程序员体验里，模型完成声明仍可能早于真实验证。弱模型场景下，这不是小问题，是主链信任问题。

### 3.3 模型事实表冲突

`src/utils/model/deepseekV4Control.ts` 已经有较新的 DeepSeek V4 事实：

- `deepseek-v4-flash`
- `deepseek-v4-pro`
- `DEEPSEEK_V4_CONTEXT_WINDOW = 1_048_576`
- `flash-max` / `deepseek-flash-max` 映射到 Flash

但 `src/dsxu/engine/model-capability-v1.ts` 仍保留旧信息：

- `deepseek-v4-flash.contextWindow = 128_000`
- `deepseek-v4-flash.supportsThinking = false`
- 虚构或旧式 `deepseek-v4-flash-thinking`

影响：不同链路可能给出不同 context、thinking、路由结论，长任务/成本/压缩策略会被污染。

### 3.4 ProviderGateway 尚未完全单一

`src/services/api/deepseek-adapter.ts` 是当前最完整的 DeepSeek provider 适配层，已处理：

- thinking enabled/disabled
- `reasoning_effort`
- streaming `reasoning_content`
- thinking tool-call round 的 `reasoning_content` replay

但仍存在旁路风险：

- `src/dsxu/engine/llm-adapter.ts`
- `src/dsxu/engine/model-gateway-client.ts`
- `src/dsxu/engine/api-service.ts`

影响：DeepSeek thinking + tool call 场景中，如果某条链漏传 assistant `reasoning_content`，API 会拒绝后续 tool replay，或造成上下文不一致。

### 3.5 Evidence Dashboard 仍是证据聚合，不是日常信任界面

当前 dashboard 输出：

- `scoreFloor=72`
- `publicBenchmarkClaimAllowed=false`
- public comparable readiness：30 个 case，ready 0，missing 30

影响：它能证明“不能乱宣称”，但还不能成为高级程序员每天看的信任界面。V2 要把它做成真实状态板：哪些 gate 开了、哪些没跑、哪条链是 smoke、哪条链是真实任务。

### 3.6 最终验收入口不可控

以下命令本次 5 分钟超时：

- `bun run test:six-stage-final`
- `bun run acceptance:senior-coding-window`
- `bun test --bail=1 --timeout 20000`

影响：不能宣称 V1 完成。V2 必须把最终验收拆成 owner 分组、加超时预算和失败归因。

### 3.7 SWE 仍是 internal smoke

SWE runner 当前可跑：

- `INTERNAL_SMOKE_OK`
- 2/2 pass
- `publicBenchmarkClaimAllowed=false`

影响：这对内部主链有价值，但不能作为“接近/超过 Claude Code 4.7”的公开成绩。

### 3.8 工具很多，但已有软瘦身基础

代码里已经有工具视窗基础：

- `src/dsxu/engine/index.ts` 默认 `toolSubset: { enabled: true, maxTools: 12, minTools: 6 }`
- `src/dsxu/engine/query-loop.ts` 有 `selectToolSubsetForTurn`
- `src/tools.ts` 仍保留完整工具注册

结论：不要硬删工具，不要做危险 facade 重构。V2 应做“模型可见工具窗口”，执行层保持完整。

---

## 4. V2 执行原则

V2 不是 V1 后继续加 10 个新模块，而是收敛主链。

### 必须坚持

1. Provider 事实单源。
2. 默认编辑生命周期强制化。
3. 工具只瘦可见面，不瘦执行能力。
4. Agent/Skill 必须提交 evidence，不允许父 Agent 直接信子 Agent 文本。
5. Dashboard 必须显示 claim boundary。
6. Long task 不靠上下文记忆，靠 ledger 恢复。
7. 所有公开对比必须区分 mock / smoke / internal / public comparable。

### 明确不要做

| 不做 | 原因 |
|---|---|
| 不继续加新编排模块 | 当前瓶颈是主链接入，不是模块数量 |
| 不删除 Claude 原工具层 | 风险太大，容易破坏成熟权限、工具、UI、MCP 逻辑 |
| 不把 Flash-MAX 当真实独立模型 | 当前应视为 Flash + max effort 路由别名 |
| 不把 internal smoke 当 SWE-bench 成绩 | 会造成商业/开源信任风险 |
| 不让 prompt 替代 runtime gate | 弱模型场景 prompt 纪律不稳定 |

---

## 5. V2 执行顺序

### P0-0：补齐 V1 owner-reviewed 脚本 alias

目标：让 V1 文档中的最终命令可执行。

修改文件：

- `package.json`

需要做：

1. 添加 `evidence:dashboard`
2. 添加 `benchmark:swe-bench`
3. 添加 `cache:warm`
4. 添加 `health:runtime`

验收：

```bash
bun run evidence:dashboard
bun run benchmark:swe-bench --instances "mock-001,mock-002" --timeout 60000
bun run cache:warm --dry-run
bun run health:runtime
```

通过标准：

- 四个命令都能从 owner-reviewed package alias 执行；后续 mainline 验证只做分组/目录，不新增泛化入口。
- 输出必须保留 claim boundary，不得把 smoke 宣称为公开 benchmark。

---

### P0-1：ProviderGateway 单一入口

目标：所有 DeepSeek 调用都经过一个能正确处理 thinking/tool replay/cost evidence 的 provider 边界。

修改文件：

- `src/services/api/deepseek-adapter.ts`
- `src/dsxu/engine/llm-adapter.ts`
- `src/dsxu/engine/model-gateway-client.ts`
- `src/dsxu/engine/api-service.ts`
- `src/dsxu/engine/__tests__/provider-contract-v1.test.ts`

需要做：

1. 规定 `deepseek-adapter.ts` 为 DeepSeek 原生 ProviderGateway。
2. `llm-adapter.ts`、`model-gateway-client.ts`、`api-service.ts` 不得各自拼 DeepSeek thinking/tool body。
3. thinking + tool call 时必须保存并回放 assistant `reasoning_content`。
4. non-thinking 请求不得污染 `reasoning_content`。
5. strict tool、FIM、Anthropic-compatible API lane 必须是明确 lane，不混入普通 chat lane。

验收：

```bash
bun test src/services/api/deepseek-adapter-cache-prefix-v1.test.ts src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/reasonix-cache-hardening.test.ts
```

通过标准：

- thinking tool-call replay 保留 `reasoning_content`。
- non-thinking 路径无 `reasoning_content`。
- 没有第二套 DeepSeek request body 拼装逻辑绕开 ProviderGateway。

---

### P0-2：模型事实单源

目标：消除 128K / thinking false / flash-thinking 伪模型等冲突。

修改文件：

- `src/utils/model/deepseekV4Control.ts`
- `src/dsxu/engine/model-capability-v1.ts`
- `src/dsxu/engine/model-config.ts`
- `src/dsxu/engine/model-limits.ts`

需要做：

1. `model-capability-v1.ts` 改为复用 `deepseekV4Control.ts` 的 spec。
2. `deepseek-v4-flash.supportsThinking = true`。
3. context window 统一到 V4 spec。
4. 删除或兼容降级 `deepseek-v4-flash-thinking`，不要作为真实模型 ID。
5. `flash-max` 保留为 public route alias，映射到 Flash + max reasoning effort。

验收：

```bash
bun test src/dsxu/engine/__tests__/deepseek-v4-control-v1.test.ts src/dsxu/engine/__tests__/model-config.test.ts
```

通过标准：

- 全仓同一个模型事实源。
- Flash / Pro / Flash-MAX 路由一致。
- 上下文预算与压缩策略不再读到旧 128K。

---

### P0-3：默认编辑生命周期

目标：把 PEV、TDD、SAST、Review、Rollback 串成默认代码修改生命周期。

修改文件：

- `src/tools/FileEditTool/FileEditTool.ts`
- `src/tools/FileWriteTool/FileWriteTool.ts`
- `src/coordinator/tdd-gate/post-write-hook.ts`
- `src/services/static-analysis/tool-gate.ts`
- `src/dsxu/engine/post-mutation-verification-envelope.ts`
- `src/dsxu/engine/work-state-timeline.ts`

需要做：

1. DSXU Code 模式下，TDD/SAST 不应默认 `SKIPPED`。
2. 默认策略建议分三档：
   - 普通文件：advisory gate
   - TS/TSX/测试/权限/安全相关文件：blocking gate
   - 用户显式关闭时：允许跳过，但 final answer 必须显示 skipped evidence
3. post-mutation envelope 写入 work-state timeline。
4. final claim 只有在 evidence 满足条件时才能 PASS。
5. 失败时不要立即全仓回滚，先给出 scoped rollback 建议。

验收：

```bash
bun test src/coordinator/tdd-gate/__tests__/gate.test.ts src/services/static-analysis/__tests__/bridge.test.ts src/dsxu/engine/__tests__/post-mutation-verification-envelope.test.ts src/dsxu/engine/__tests__/work-state-timeline.test.ts
```

通过标准：

- Edit/Write 后至少产生 verification envelope。
- 风险文件失败会阻断或明确降级。
- final answer 不能在验证未跑时声称完成。

---

### P0-4：最终验收入口可控化

目标：解决 `bun test`、`test:six-stage-final`、`acceptance:senior-coding-window` 超时不可归因问题。

修改文件：

- `scripts/dsxu-v24-six-stage-final-tests.ts`
- `scripts/dsxu-v24-senior-coding-window.ts`
- `src/dsxu/engine/release-test-gate.ts`
- `package.json`

需要做：

1. 把最终验收拆成 owner 分组。
2. 每组有单独 timeout。
3. 输出失败 owner、失败命令、耗时、是否 live/provider。
4. 超时必须视为 FAIL，不是 UNKNOWN。
5. 支持 `--group provider|tools|agent|evidence|benchmark|all`。

验收：

```bash
bun run test:six-stage-final -- --group evidence --timeout 60000
bun run acceptance:senior-coding-window -- --timeout 60000
```

通过标准：

- 60 秒内输出明确 PASS/FAIL/TIMEOUT。
- 失败可归因到 owner。

---

### P1-1：工具窗口软瘦身

目标：降低弱模型工具选择复杂度，但不破坏 Claude 原工具层成熟能力。

修改文件：

- `src/dsxu/engine/query-loop.ts`
- `src/dsxu/engine/index.ts`
- `src/tools.ts`
- `src/services/tools/dsxuToolBatchGate.ts`

需要做：

1. 保留完整工具注册。
2. 每轮只给模型展示 10-12 个高相关工具。
3. 通过 profile 控制可见工具：
   - read/research
   - edit
   - verify
   - recovery
   - agent
4. 不硬限制执行层，避免高级程序员场景能力断裂。
5. `dsxuToolBatchGate` 继续约束危险批量行为。

验收：

```bash
bun test src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts src/dsxu/engine/__tests__/query-message-shape-guard-v1.test.ts
```

通过标准：

- 模型可见工具减少。
- Read/Edit/Bash/Agent/Skill/MCP 等主能力不丢。
- 危险工具组合仍被 batch gate 拦截。

---

### P1-2：Agent / Skill 证据化

目标：让 Agent/Skill 像高级程序员团队协作，而不是“子代理说完成就完成”。

修改文件：

- `src/tools/AgentTool/prompt.ts`
- `src/tools/AgentTool/agentToolUtils.ts`
- `src/tools/AgentTool/runAgent.ts`
- `src/tools/SkillTool/prompt.ts`
- `src/dsxu/engine/skill-governance-v1.ts`
- `src/dsxu/engine/work-state-timeline.ts`

需要做：

1. Agent 可见模式保持两个：serial worker、parallel fanout。
2. foreground/background/worktree/remote/fork 只作为 placement，不作为模型心智模式。
3. 每个 Agent 必须有 writeScope、allowedTools、verification、evidence。
4. Skill 只有强匹配才可用。
5. Agent/Skill 结果必须进入 Runtime State Card。
6. 父 Agent 不能只凭子 Agent 文本宣布 PASS。

验收：

```bash
bun test src/dsxu/engine/__tests__/agent-runtime-mainline-v1.test.ts src/dsxu/engine/__tests__/agent-long-run.test.ts src/dsxu/engine/__tests__/skill-governance-contract-v1.test.ts
```

通过标准：

- Agent 输出包含 evidencePacket/runtimeEvidence。
- Skill 调用有治理合同。
- final claim 可以追溯到工具证据。

---

### P1-3：Evidence Dashboard 产品化

目标：把 dashboard 从报告脚本变成高级程序员每天看的信任界面。

修改文件：

- `scripts/dsxu-evidence-dashboard.ts`
- `docs/BENCHMARK.md`
- `docs/DSXU_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_20260518.md`
- `package.json`

需要做：

1. dashboard 明确分层：
   - mock
   - internal smoke
   - local real task
   - public comparable
2. public comparable 未满足时，强制显示 `publicBenchmarkClaimAllowed=false`。
3. 展示最近一次：
   - TDD gate
   - SAST gate
   - provider live gate
   - SWE smoke
   - senior coding window
   - six-stage final
4. scoreFloor 不靠 pass rate 自动推高，只靠 evidence manifest 解锁。

验收：

```bash
bun run evidence:dashboard
```

通过标准：

- dashboard 不能误导。
- 缺失项明确显示 next action。
- smoke 和 public benchmark 不混淆。

---

### P2-1：Long Task Ledger 主链化

目标：长时间复杂任务不靠上下文“记忆”，而靠可恢复任务账本。

修改文件：

- `src/dsxu/engine/progress-ledger.ts`
- `src/dsxu/engine/work-state-timeline.ts`
- `src/dsxu/engine/compact.ts`
- `src/dsxu/engine/query-loop.ts`

需要做：

1. 每次关键事件写入 ledger：
   - model route
   - tool call
   - permission
   - edit
   - verification
   - rollback
   - recovery
   - cost/cache
2. compact/resume 后，编辑前必须重新读取 source truth。
3. final claim 从 ledger + evidence 生成，不从模型自然语言生成。
4. stall recovery 基于 ledger 判断，而不是让模型自由猜。

验收：

```bash
bun test src/dsxu/engine/__tests__/work-package-i/query-loop-progress-ledger.test.ts src/dsxu/engine/__tests__/work-state-timeline.test.ts
```

通过标准：

- 长任务恢复能知道上一步真实状态。
- 压缩后不会丢失验证/编辑事实。
- final answer 有 ledger 依据。

---

### P2-2：正式 SWE / Public Comparable 分层

目标：把内部 smoke 和公开可比成绩彻底分开。

修改文件：

- `src/services/eval/swe-bench/*`
- `scripts/dsxu-swe-bench-runner.ts`
- `docs/BENCHMARK.md`
- `docs/DSXU_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_20260518.md`

需要做：

1. 保留 internal smoke。
2. 新增 public comparable mode，但默认不启用。
3. public comparable 必须要求：
   - 固定任务集
   - 原始日志
   - 模型版本
   - 参数
   - 时间
   - 机器信息
   - 失败样本
4. 没有 raw logs 时禁止 external comparison claim。

验收：

```bash
bun run benchmark:swe-bench --instances "mock-001,mock-002" --timeout 60000
bun run evidence:dashboard
```

通过标准：

- internal smoke 继续可用。
- public comparable 缺失时清楚显示 blocked。

---

### P2-3：Cache Warmer 降级为成本辅助证据

目标：防止把 cache warmer 当核心能力。

修改文件：

- `src/services/cache-warmer.ts`
- `scripts/dsxu-cache-warm.ts`
- `scripts/dsxu-evidence-dashboard.ts`

需要做：

1. dry-run 继续保留。
2. live 模式必须显式标记 provider call。
3. 未跑 live 时，不得声称 cache hit 提升。
4. dashboard 只显示 cache warmer 为 cost helper。

验收：

```bash
bun run cache:warm --dry-run
```

通过标准：

- 输出明确 `claimBoundary`。
- 不产生真实性能提升宣称。

---

## 6. V2 完成标准

V2 不以“新增多少文件”为完成标准，以默认体验与证据为完成标准。

必须全部满足：

| 验收项 | 标准 |
|---|---|
| Provider | DeepSeek thinking/tool replay 单一路径，无 reasoning_content 丢失 |
| Model facts | Flash/Pro/Flash-MAX 事实一致，无 128K 残留误导主链 |
| Edit lifecycle | Edit/Write 默认产生 verification envelope |
| Tool window | 每轮模型可见工具受控，但执行层不丢能力 |
| Agent/Skill | 子任务结果有 evidence，不允许文本即完成 |
| Dashboard | 明确 smoke/internal/public comparable 边界 |
| Final verification | 失败和超时可归因，不再 5 分钟无结果 |
| Benchmark | internal smoke 与 public comparable 不混淆 |

最终建议命令：

```bash
bun run evidence:dashboard
bun run benchmark:swe-bench --instances "mock-001,mock-002" --timeout 60000
bun run cache:warm --dry-run
bun run health:runtime
bun test src/services/api/deepseek-adapter-cache-prefix-v1.test.ts src/dsxu/engine/__tests__/deepseek-v4-control-v1.test.ts src/dsxu/engine/__tests__/model-config.test.ts
bun test src/coordinator/tdd-gate/__tests__/gate.test.ts src/services/static-analysis/__tests__/bridge.test.ts src/dsxu/engine/__tests__/work-state-timeline.test.ts
```

公开比较前必须额外满足：

```bash
bun run benchmark:swe-bench --mode public-comparable --instances "<fixed-public-set>"
bun run evidence:dashboard
```

且 dashboard 必须显示：

- `publicBenchmarkClaimAllowed=true`
- `externalComparisonClaimAllowed=true`
- raw logs 完整存在

---

## 7. 优先级压缩版

如果 4-6 周只做最重要的 6 件事：

| 优先级 | 工作 | 为什么 |
---|---|---|
| P0 | 补 owner-reviewed package aliases | 让既有验收脚本可用，不扩展第二产品入口 |
| P0 | ProviderGateway 单一入口 | DeepSeek thinking/tool replay 是硬协议，不统一会真实失败 |
| P0 | 模型事实单源 | 128K/thinking false 残留会污染全链路 |
| P0 | 默认编辑生命周期 | 高级程序员体验的信任底座 |
| P1 | 工具窗口软瘦身 | 弱模型少看工具，但不牺牲能力 |
| P1 | Evidence Dashboard 产品化 | 把“能不能信”展示给用户 |

暂缓：

- 新 Agent 模式
- 大规模工具 facade 重构
- 商业/IP 发布清理
- 真正 public SWE 全量跑分
- 新记忆系统重写

---

## 8. 当前状态一句话

DSXU 现在已经有很多“强模块”，但还不是稳定的“强主链”。V2 应该做的是把 V1 已经做出来的验证、证据、工具选择、Provider、Agent/Skill、长任务 ledger 收束成默认体验；否则模块越多，弱模型越容易在厚重系统里迷路。

---

## 9. A+C 组合方案：8 周综合执行路线

本节用于把 V2 的技术修复项压成一条可执行路线。A 主线代表“主链收敛与工程稳定性”，C 主线代表“DeepSeek 原生能力与证据化差异化”。两条线并行推进，但每周必须有明确验收，不允许继续堆叠无验收模块。

### 9.1 核心原则

1. 不复制 Claude Code，而是利用 DeepSeek 原生优势打造差异化工具。
2. P0 是主链收敛，不是加新功能。
3. 证据先于声明。
4. Flash 默认、Pro 证据准入。

### 9.2 路线总览

| 周期 | A 主线：主链收敛 | C 主线：DeepSeek 原生能力与证据 | 对应 V2 项 |
|---|---|---|---|
| Week 1 | 修复 `bun test` 超时；切分 test 层级 | Provider 合同测试；thinking round-trip | P0-1、P0-4 |
| Week 2 | 统一工具结果协议；定义 `ToolCallResult` 标准 | cache chart GitHub 稳定性验证 | P1-1、P2-3 |
| Week 3 | Verification 默认；`onFailure=block` | 工具结果预览预算；artifact 存储 | P0-3、P1-1 |
| Week 4 | 持久化任务账本；durable ledger | 成本路由证据投影；ledger event | P2-1、P1-3 |
| Week 5 | 恢复决策表：GearBox + FailureTaxonomy + Event | 同 A 线合流 | P2-1、P0-3 |
| Week 6 | Agent 证据包 + handoff schema 校验 | worker → evidence envelope → parent PASS | P1-2 |
| Week 7 | 本地回归运行器 + 复杂度分类器 | 单文件低风险跳过重型规划 | P0-4、P1-1、P2-2 |
| Week 8 | 上下文压力策略 + 测试 + 证据包 | 70%/85%/95%/99% 压力测试 + CLI 证据包 | P2-1、P1-3 |

### 9.3 Week 1：测试主链与 Provider 合同

目标：先让最终验收可归因，再修 DeepSeek thinking/tool replay 的硬协议。

A 主线需要做：

- 把 `bun test` 拆成 owner 分组。
- 给 `test:six-stage-final` 和 `acceptance:senior-coding-window` 增加超时预算、分组执行、失败归因。
- 超时必须输出 `TIMEOUT` 与 owner，不允许无结果挂住。

C 主线需要做：

- 增强 Provider 合同测试。
- 覆盖 thinking round-trip。
- 覆盖 thinking + tool call 后续消息必须回传 `reasoning_content`。
- 确认 non-thinking 路径不注入 `reasoning_content`。

验收：

```bash
bun run test:six-stage-final -- --group evidence --timeout 60000
bun test src/services/api/deepseek-adapter-cache-prefix-v1.test.ts src/dsxu/engine/__tests__/provider-contract-v1.test.ts
```

### 9.4 Week 2：工具结果协议与 Cache 稳定性

目标：把工具输出统一成 runtime event schema，降低弱模型解析工具结果的负担。

A 主线需要做：

- 定义统一 `ToolCallResult` 标准。
- 所有主链工具输出必须含：
  - `toolName`
  - `status`
  - `summary`
  - `evidence`
  - `artifactRefs`
  - `nextSuggestedState`
  - `claimBoundary`
- Edit/Write/Bash/Agent/Skill/MCP 输出先接入。

C 主线需要做：

- cache chart / cache warmer 只作为成本证据。
- 不把 dry-run 当性能提升。
- 在 dashboard 里明确 cache evidence 的来源、是否 live provider、是否真实命中。

验收：

```bash
bun test src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts
bun run cache:warm --dry-run
bun run evidence:dashboard
```

### 9.5 Week 3：Verification 默认化与 Artifact 预算

目标：把验证从“可选功能”变成“编辑生命周期默认动作”。

A 主线需要做：

- DSXU Code 模式下，post-write TDD gate 默认至少 advisory。
- TS/TSX/测试/权限/安全相关文件默认 blocking。
- `onFailure=block` 不代表立刻全仓回滚，而是阻断完成声明，并给出 scoped recovery。

C 主线需要做：

- 工具结果预览有预算限制。
- 大输出进入 artifact 存储。
- 模型只看到摘要 + artifact reference，避免长输出污染上下文。

验收：

```bash
bun test src/coordinator/tdd-gate/__tests__/gate.test.ts src/services/static-analysis/__tests__/bridge.test.ts src/dsxu/engine/__tests__/post-mutation-verification-envelope.test.ts
```

### 9.6 Week 4：Durable Ledger 与成本路由证据

目标：长任务不靠上下文记忆，而靠任务账本恢复。

A 主线需要做：

- 将 `progress-ledger` 从测试/辅助能力推进为主链事件账本。
- 每个关键动作写入 ledger：
  - plan
  - read
  - edit
  - verify
  - review
  - rollback
  - recovery
  - agent handoff

C 主线需要做：

- 每次模型路由写入 ledger event。
- 明确：
  - Flash non-thinking
  - Flash thinking high
  - Flash-MAX
  - Pro thinking high/max
- Pro 必须有 admission reason。

验收：

```bash
bun test src/dsxu/engine/__tests__/work-package-i/query-loop-progress-ledger.test.ts src/dsxu/engine/__tests__/work-state-timeline.test.ts
```

### 9.7 Week 5：恢复决策表

目标：把 GearBox、FailureTaxonomy、Runtime Event 合成统一恢复决策。

需要做：

- 建立失败分类：
  - provider protocol failure
  - tool schema failure
  - permission failure
  - edit conflict
  - test failure
  - static analysis failure
  - context pressure
  - agent stall
- 每类失败映射统一动作：
  - retry
  - replan
  - rollback
  - ask user
  - escalate to Pro
  - abort
- 弱模型不自由选择恢复方式，只能在 runtime 决策表给出的动作内执行。

验收：

```bash
bun test src/dsxu/engine/__tests__/gearbox*.test.ts src/dsxu/engine/__tests__/*recovery*.test.ts
```

### 9.8 Week 6：Agent 证据包与 Handoff Schema

目标：让子 Agent 像高级程序员团队协作，有工作边界、有交付包、有证据。

需要做：

- worker 必须声明：
  - write scope
  - allowed tools
  - files read
  - files changed
  - commands run
  - tests passed/failed
  - unresolved risks
- parent 只能从 evidence envelope 判断能否 PASS。
- 没有 evidence envelope 时，子 Agent 文本只能当建议，不能当完成。

验收：

```bash
bun test src/dsxu/engine/__tests__/agent-runtime-mainline-v1.test.ts src/dsxu/engine/__tests__/agent-long-run.test.ts src/dsxu/engine/__tests__/skill-governance-contract-v1.test.ts
```

### 9.9 Week 7：本地回归运行器与复杂度分类器

目标：减少厚重流程对简单任务的伤害。

需要做：

- 建立本地 10 场景回归运行器。
- 复杂度分类器控制是否进入重型 PEV：
  - 单文件低风险：轻流程
  - 多文件/类型/测试/权限：完整 PEV
  - 失败恢复/安全相关：PEV + blocking gate
- 防止弱模型在小任务里被过度流程拖慢。

验收：

```bash
bun run benchmark:swe-bench --instances "mock-001,mock-002" --timeout 60000
bun run evidence:dashboard
```

### 9.10 Week 8：上下文压力策略与证据包

目标：把 1M 窗口能力变成稳定长任务能力，而不是无限塞上下文。

需要做：

- 做 70% / 85% / 95% / 99% 上下文压力测试。
- 每档测试必须记录：
  - context usage
  - cache usage
  - compaction trigger
  - retrieval accuracy
  - final verification status
- 压缩后编辑前必须重新读取 source truth。
- CLI 输出证据包，dashboard 可读取。

验收：

```bash
bun run evidence:dashboard
bun test src/dsxu/engine/__tests__/*context*.test.ts src/dsxu/engine/__tests__/work-state-timeline.test.ts
```

### 9.11 A+C 合流后的 V2 通过标准

8 周结束后，不能只看模块是否存在，必须看以下结果：

| 标准 | 通过条件 |
|---|---|
| 主链测试 | `bun test` 可分组执行，失败可归因 |
| Provider 协议 | thinking/tool replay 不丢 `reasoning_content` |
| 工具结果 | 主工具输出统一 `ToolCallResult` / runtime event |
| Verification | 编辑后默认产生 evidence，风险文件默认 blocking |
| Ledger | 长任务可从 durable ledger 恢复 |
| Recovery | stall/test fail/schema fail 有统一决策表 |
| Agent | worker evidence envelope 决定 parent PASS |
| Complexity | 简单任务不进入重型流程，复杂任务强制 PEV |
| Context | 70%/85%/95%/99% 压力测试有证据 |
| Dashboard | mock/internal/public comparable 清晰分层 |

最终结论：A+C 组合路线是当前 V2 的最佳执行排期。A 线负责把 DSXU 从“模块强”变成“主链稳”，C 线负责把 DeepSeek 的 thinking、cache、成本路由、长上下文优势变成可证明的差异化体验。

---

## 10. V2 收敛后预期分数

注意：这里不是当前 V1 已完成状态，而是按本文件 V2 / A+C 路线完成后的预期状态。当前真实状态仍以第 2、3 节审核结论为准。

| 维度 | 当前 | V2 收敛后预期 |
|---|---|---|
| 验证命令可复现 | `bun test` / final acceptance 入口本次 5 分钟超时 | mainline 分组 < 60s，失败可归因 |
| 工具结果协议统一 | 多形态共存 | 单一路径：`ToolCallResult` / runtime event schema |
| Verification 默认 | env-gated，未开时 `SKIPPED` | 默认 advisory；风险文件 `onFailure=block` |
| 任务账本 | 分散在 timeline / ledger / evidence 中 | 统一 durable ledger |
| 恢复决策 | GearBox、failure、recovery 分散 | 统一 decision table |
| Agent 证据包 | 已有 evidencePacket/runtimeEvidence，但默认 PASS 约束还需强化 | handoff schema + evidence envelope 决定 parent PASS |
| 成本路由证据 | 有路由与成本证据，但未全量 ledger event 化 | 全量 ledger event |
| Score floor | 72 | 72+，先不下降，再由真实证据逐步提升 |

V2 不以直接喊到 90/95 分为目标。V2 的目标是让 72 分的证据底座可复现、可归因、可持续增长。90+ 必须等 public comparable、主链全绿、长任务压力测试和真实用户任务证据齐备后再声明。

---

## 11. 不应做的事

以下事项在 V2 阶段明确不做：

1. 不继续加新模块。
2. 不声明 90/95 分。
3. 不声明外部 benchmark 胜利。
4. 不复制 Claude API/SDK 兼容性作为产品核心。
5. 不搭建 swarm / 多层 Agent 团队模式。
6. 不把 internal smoke 当公开成绩。
7. 不把 prompt 规则当 runtime 安全保证。

解释：

- DSXU 当前最大问题不是“缺模块”，而是“已有模块没有形成默认主链”。
- 弱模型场景下，越复杂的 Agent 拓扑越容易放大错误；V2 应优先让单主链稳，再谈多 Agent 扩展。
- Claude 的 prompt/product discipline 值得学习，但不能照搬成软提示。DeepSeek 场景要变成 runtime gate、event schema、ledger、evidence。

---

## 12. 关键判断：能否接近或超过 Claude Code 4.7

| 维度 | 评估 | 判断依据 |
|---|---|---|
| 成本效率 | 可以超过 | 现有 DSXU 成本/缓存证据显示有明显成本优化空间；但 86.2% 降低、65.4% cache hit 这类数字必须继续保留来源证据，不可脱离 evidence dashboard 独立宣传 |
| 上下文能力 | 可以超过 | DeepSeek V4 路线以 1M context 为差异化基础，DSXU 也已有上下文预算/压缩/ledger 设计；但必须做 70%/85%/95%/99% 压力测试证明稳定性 |
| 可审计性 | 可以超过 | DSXU 已有大量 evidence 文件、claim boundary、dashboard、work-state timeline；Claude Code 没有同等公开证据系统 |
| 工具编排 | 接近 | Tool Gate、Permission Gate、Tool Batch Gate、MCP/Skill/Agent 边界已较成熟，但工具结果协议尚未统一投影 |
| 验证和恢复 | 接近 | GearBox、verify-gate、TDD/SAST、rollback/recovery 组件存在，但尚未形成统一默认生命周期和 decision table |
| 沉浸式体验 | 需要追赶 | Ink TUI 与交互状态已经存在，但 Claude REPL 的流畅性、默认纪律和用户信任感仍更成熟 |
| 生态 | 需要追赶 | MCP/Skill 边界已定义，Agent 两种模式已支持；但生态体验还需要文档、模板、默认安全策略和真实任务沉淀 |
| 测试完整度 | 还有差距 | 本次 `bun test`、`test:six-stage-final`、`acceptance:senior-coding-window` 均 5 分钟超时，这是所有外部声明的硬阻塞 |

最终判断：可行，但路径不是“继续堆功能”，而是“主链收敛 + DeepSeek 原生协议 + 证据化默认体验”。

DSXU 在 DeepSeek V4 混合模型基础上，结合已有的编排、工具、权限、上下文、Agent、证据系统，在成本、上下文、可审计性上有机会超过 Claude Code 4.7；在沉浸式体验、生态成熟度和测试完整度上需要追赶。当前最优路线是 A+C：先把主链收敛到可复现、可验证、可恢复，再用 DeepSeek thinking/cache/context/cost routing 做差异化，而不是复制 Claude Code。

---

## 11. V2 执行记录 - 2026-05-18

### 11.1 P0-A 模型事实单源：完成

执行原因：

- `src/dsxu/engine/model-capability-v1.ts` 曾保留旧模型表，包含 `deepseek-v4-flash.contextWindow = 128_000`、`supportsThinking = false`、以及 `deepseek-v4-flash-thinking` 伪真实模型 ID。
- 这会污染上下文预算、压缩策略、成本路由、长任务恢复和公开证据口径，是 V2 必须先收束的地基问题。

实际处理：

- `src/dsxu/engine/model-capability-v1.ts` 已改为只从 `src/utils/model/deepseekV4Control.ts` 投影事实。
- `deepseek-chat`、`deepseek-coder`、`deepseek-reasoner`、`deepseek-v4-flash-thinking` 这类历史/兼容输入不再形成第二套模型事实，统一降级到 canonical DeepSeek V4 Flash 能力。
- `deepseek-v4-flash-thinking` 只保留为输入兼容 alias，不作为真实模型 ID。
- `routeModel()` 不再因为 `budgetConstraint=high` 直接切 Pro；Pro 仍由统一 route policy 的高风险、失败恢复或显式 admission 触发。
- `src/dsxu/engine/model-gateway-v1.ts` 修正了旧行为：当 routed model 与当前模型只是 alias/canonical 差异时，高水位上下文不再建议 `switch_model`，而是建议 `compact`。

新增验证：

- `src/dsxu/engine/__tests__/model-capability-v1.test.ts`

Focused 验证：

```bash
bun test src/dsxu/engine/__tests__/model-capability-v1.test.ts src/dsxu/engine/__tests__/model-config.test.ts src/dsxu/engine/__tests__/deepseek-v4-control-v1.test.ts
```

结果：

- 38 pass
- 0 fail
- 230 expect

剩余注意：

- `src/utils/model/providerMigration/*` 中的 `128_000` 属于历史 provider migration 上限，不是 DeepSeek V4 主链事实源，暂不在 P0-A 改动。
- 下一步进入 P0-B：ProviderGateway 单一边界，重点审 `api-service.ts`、`llm-adapter.ts`、`model-gateway-client.ts` 是否还各自拼 DeepSeek 请求体或 thinking/tool replay。

### 11.2 P0-B ProviderGateway 单一边界：完成

执行原因：

- `src/services/api/deepseek-adapter.ts` 已经是最完整的 DeepSeek 原生 provider owner，负责 request plan、thinking 开关、`reasoning_effort`、tool schema flatten、thinking tool-call replay、usage/cost/cache trajectory。
- `src/dsxu/engine/llm-adapter.ts` 的 `createDirectLLMCall()` 仍自己拼 chat-completions body，存在绕开 `DeepSeekAdapter` 的风险。

第一批实际处理：

- `src/services/api/deepseek-adapter.ts` 的 request executor 支持从调用方传入 `apiKey` 与 `baseUrl`，这样 direct engine path 可以复用同一个 DeepSeek request planner。
- `src/dsxu/engine/llm-adapter.ts` 的 `createDirectLLMCall()` 已折回 `DeepSeekAdapter.transformRequest()`。
- direct path 的 assistant reasoning/tool call history 会先转为 adapter 可识别的 content blocks，再由 adapter 按 thinking mode 生成 `reasoning_content` 和 `tool_calls`。
- 没有新增 provider 层，没有新增第二请求 planner。

第二批实际处理：

- `src/dsxu/engine/model-gateway-client.ts` 的 LiteLLM gateway lane 已补齐 thinking replay 规则：只有 policy 为 thinking 时才写 `reasoning_content`，non-thinking verification 路径不污染请求前缀。
- `src/dsxu/engine/__tests__/llm-adapter-owner-v1.test.ts` 增加 owner proof：
  - 有 DeepSeek direct config 时，`createPreferredDSXULLMCall()` 先走 direct `DeepSeekAdapter`，不会掉入 `APIService` fallback。
  - LiteLLM lane 明确写 `metadata.dsxu_gateway = litellm`，证明它是显式 gateway boundary，不是第二 direct provider 主链。
  - LiteLLM thinking/non-thinking 对 `reasoning_content` 的处理有负例测试。

新增/更新验证：

- `src/dsxu/engine/__tests__/llm-adapter-owner-v1.test.ts` 增加 direct DeepSeek request planner 验收，确认：
  - 请求 URL 走指定 DeepSeek baseUrl；
  - body 由 adapter 输出 `thinking: { type: 'enabled' }`；
  - thinking tool-call replay 保留 `assistant.reasoning_content`；
  - response usage 继续映射 cache hit evidence。

第一批 Focused 验证：

```bash
bun test src/dsxu/engine/__tests__/llm-adapter-owner-v1.test.ts src/services/api/deepseek-adapter-cache-prefix-v1.test.ts src/dsxu/engine/__tests__/reasonix-cache-hardening.test.ts src/dsxu/engine/__tests__/provider-contract-v1.test.ts
```

结果：

- 19 pass
- 0 fail

第二批 Focused 验证：

```bash
bun test src/dsxu/engine/__tests__/llm-adapter-owner-v1.test.ts src/services/api/deepseek-adapter-cache-prefix-v1.test.ts src/dsxu/engine/__tests__/reasonix-cache-hardening.test.ts src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/api-service.test.ts
```

结果：

- 41 pass
- 0 fail

收口结论：

- Direct DeepSeek 主链：`llm-adapter.ts` -> `DeepSeekAdapter.transformRequest()`。
- APIService：显式 fallback provider boundary，继续保留 OpenAI/Ollama/local 兼容请求体；不作为默认 DeepSeek 主链。
- LiteLLM：显式 gateway boundary，带 `dsxu_gateway=litellm` metadata；不混入 direct lane。
- 下一步进入 P0-C：默认编辑生命周期。

### 11.3 P0-C 默认编辑生命周期：完成第一收束

执行原因：

- V2 审计发现 FileWrite/FileEdit 虽已接入 TDD/SAST/envelope，但 TDD 与 SAST 默认都可能 `SKIPPED`，模型容易把“写入成功”误当成“功能完成”。
- 目标不是每次编辑都跑全量测试，而是默认产生可信 post-mutation evidence；高风险或显式配置再进入真实阻断。

实际处理：

- `src/coordinator/tdd-gate/post-write-hook.ts`
  - 默认不再静默 `SKIPPED`。
  - 无显式关闭时返回 `PARTIAL` + `post-mutation-verification` 语义，提醒 full red/green TDD 需要显式 pre-edit test contract。
  - `DSXU_TDD_POST_WRITE_GATE=0/false/no` 或 `enabled:false` 仍可明确跳过，并保留 skipped evidence。
- `src/services/static-analysis/tool-gate.ts`
  - 默认不再静默 `SKIPPED`。
  - 无显式开启真实 bridge 时返回 `PARTIAL` + `advisory-envelope`，不会冒充真正 SAST PASS。
  - `DSXU_STATIC_ANALYSIS_TOOL_GATE=1` 才运行真实 static analysis bridge。
  - `DSXU_STATIC_ANALYSIS_TOOL_GATE=0/false/no` 仍可明确跳过。
- `FileWriteTool` / `FileEditTool` 不需要新增入口；它们已有 post-mutation envelope 调用，本次改动让 envelope 默认拥有可见 gate 证据。

Focused 验证：

```bash
bun test src/coordinator/tdd-gate/__tests__/gate.test.ts src/services/static-analysis/__tests__/bridge.test.ts src/dsxu/engine/__tests__/post-mutation-verification-envelope.test.ts src/dsxu/engine/__tests__/work-state-timeline.test.ts
```

结果：

- 28 pass
- 0 fail

收口结论：

- 默认编辑生命周期现在至少会产生 advisory/partial evidence，不再无声跳过。
- 这不是最终 full TDD/SAST 证明，不能写成“每次编辑自动全量测试通过”；只能写成“默认有 post-mutation verification envelope，跳过/部分验收会进入 final claim boundary”。

### 11.4 P0-D 命令目录与 package 入口：完成

执行原因：

- V2/V1 要求的四个稳定入口缺失：`evidence:dashboard`、`benchmark:swe-bench`、`cache:warm`、`health:runtime`。
- 对应脚本已经存在，本次不新增执行逻辑，只补 package alias，避免文档验收命令不可执行。

实际处理：

- `package.json` 增加：
  - `evidence:dashboard` -> `bun run scripts/dsxu-evidence-dashboard.ts`
  - `benchmark:swe-bench` -> `bun run scripts/dsxu-swe-bench-runner.ts`
  - `cache:warm` -> `bun run scripts/dsxu-cache-warm.ts`
  - `health:runtime` -> `bun run scripts/dsxu-runtime-health.ts`

Focused 验证：

```bash
bun run evidence:dashboard
bun run benchmark:swe-bench --instances "mock-001,mock-002" --timeout 60000
bun run cache:warm --dry-run
bun run health:runtime
```

结果：

- `evidence:dashboard` PASS，`scoreFloor=72`，仍诚实保留 public comparable NOT_RUN。
- `benchmark:swe-bench` PASS，internal smoke 2/2，`publicBenchmarkClaimAllowed=false`。
- `cache:warm --dry-run` PASS，claim boundary 明确为 cache warm planning only，无 provider call。
- `health:runtime` PASS，DeepSeek key 存在但 live ping 仍按 dry-path intentionally skipped。

收口结论：

- 四个入口可执行。
- 它们没有新增主链，也没有把 smoke/dry-run 冒充公开成绩。
- 下一步进入 P0-E：最终验收可归因，重点是把 final acceptance 失败按 owner/命令/根因输出，而不是超时无结果。

### 11.5 P0-E 最终验收可归因：完成第一收束

执行原因：

- V2 的问题不是继续加测试入口，而是 final acceptance 一旦失败必须能回答：哪个 owner、哪条命令、根因是什么、下一步修什么。
- 之前 six-stage / senior-coding-window 已能跑证据，但失败时主要靠人工翻 stdout/stderr；超时尤其容易变成“只知道卡住”，不利于真实收口。

实际处理：

- `scripts/dsxu-v24-six-stage-final-tests.ts`
  - 每条 command result 增加 `owner` 和 `attribution`。
  - 失败会按模式归因到 `command-timeout`、`missing-target-reference-raw-input`、`provider-auth-or-quota`、`filesystem-or-permission-block`、`missing-command-or-file`、`release-compliance-block`、`owner-test-regression` 等。
  - JSON 报告新增 `failedCommandAttributions`，Markdown 新增 Failure Attribution 表。
  - 不改变原有 command list，不新增 final runner，不自动 stage/delete/export。
- `scripts/dsxu-v24-senior-coding-window.ts`
  - `runCommand()` 超时不再直接抛出导致无报告，而是返回 `exitCode=124` 并写 stdout/stderr artifact。
  - report 新增 `failureAttribution`，对 fixture、DSXU run、sustained review failure 做 owner/rootCause/nextAction 归因。
  - 仍保持真实 30-45 分钟窗口逻辑；本次不伪造真实窗口 PASS。
- `scripts/dsxu-evidence-dashboard.ts`
  - 聚合 `failedCommandAttributions` 与 `failureAttribution`，形成 dashboard 的 `failureAttributions` 字段。
  - 不改变 scoreFloor 计算；scoreFloor 仍只来自显式证据，当前保持诚实的 `72`。

Focused 验证：

```bash
bun build scripts/dsxu-v24-six-stage-final-tests.ts --target=bun --outfile tmp/v2-six-stage-final-tests-check.js
bun build scripts/dsxu-v24-senior-coding-window.ts --target=bun --outfile tmp/v2-senior-coding-window-check.js
bun run scripts/dsxu-v24-senior-coding-window.ts --help
bun build scripts/dsxu-evidence-dashboard.ts --target=bun --outfile tmp/v2-evidence-dashboard-check.js
bun run evidence:dashboard
```

结果：

- three script builds PASS。
- senior-coding-window help PASS，未误触发 30-45 分钟真实窗口。
- evidence dashboard PASS，`scoreFloor=72`、`Evidence files=125`、`Passing gates=38`、`Parse errors=0`。
- dashboard 已出现 `failureAttributions` 字段；当前既有 evidence 没有失败归因，所以数组为空，这是诚实状态。

收口结论：

- P0-E 已把最终验收从“失败/超时”升级为“owner 可归因失败”。
- 本次只做轻量验证，没有跑 `test:six-stage-final` 或 `acceptance:senior-coding-window` 全量入口；这些应在 V2 P0 收束后作为大块验收运行。
- V2 当前 P0-A/P0-B/P0-C/P0-D/P0-E 已完成第一轮 owner-folded 收束；下一步应进入 V2 剩余 P1：工具窗口可视面、Evidence Dashboard 产品化、Long Task Ledger/Stall Recovery 收束，最后再跑全量验收。

### 11.6 P1 第一批收束：工具窗口、Evidence Dashboard、Ledger/Stall 状态

执行原因：

- P1 不是新增 facade 或新 UI，而是确认已有工具窗口、证据看板、长任务账本真的在主链 owner 内可用。
- 本轮先做 owner 级验证与小幅 dashboard 产品化，不做大规模重写。

实际处理：

- 工具窗口软瘦身：
  - `src/dsxu/engine/query-loop.ts` 已在每轮通过 `selectToolSubsetForTurn()` 选择模型可见工具，并发出 `tool_subset_selected` 事件。
  - 执行层仍保留完整 `ToolRegistry`；这里只收缩模型可见面，不削掉高级场景能力。
  - profile 测试证明 plan/edit 自动 profile 会减少可见工具，同时不丢 Read/Edit/Bash 等核心工具。
- Evidence Dashboard 产品化第一步：
  - `scripts/dsxu-evidence-dashboard.ts` 新增 `gateSummary`，直接展示 total/pass/fail/notRun。
  - console 输出新增 failing gates、not-run gates、failure attribution count。
  - 单测新增 failure attribution 聚合，证明最终验收失败归因能进入 dashboard，且不会改变 `scoreFloor`。
- Long Task Ledger / Stall Recovery：
  - `src/dsxu/engine/progress-ledger.ts` 已有 `LongTaskLedgerEvent`、`StallSignal`、`StallRecoveryDecision`、`appendLedgerEvent()`、`decideStallRecovery()`、`recordStallDecision()`。
  - 本轮先跑现有 owner 测试确认 query-loop ledger 与 work-state timeline 仍能形成可见恢复证据，不新增第二套 ledger。

Focused 验证：

```bash
bun test scripts/__tests__/dsxu-evidence-dashboard.test.ts
bun test src/dsxu/engine/__tests__/work-package-e/query-loop-profile.test.ts
bun test src/dsxu/engine/__tests__/work-package-i/query-loop-progress-ledger.test.ts src/dsxu/engine/__tests__/work-state-timeline.test.ts
bun run evidence:dashboard
```

结果：

- dashboard tests：2 pass / 0 fail。
- query-loop profile：3 pass / 0 fail。
- progress-ledger + work-state timeline：10 pass / 0 fail。
- evidence dashboard：`scoreFloor=72`、`gateSummary={ total:125, pass:38, fail:1, notRun:86 }`、`failureAttributions=0`、`parseErrors=0`。

收口结论：

- P1-1 工具窗口软瘦身：当前代码已有主链实现和 focused 验证，通过。
- P1-3 Evidence Dashboard 产品化：完成第一步，已从单纯 evidence list 变成带 gate summary / failure attribution 的信任看板输入。
- P2-1 Long Task Ledger 主链化：已有 ledger/stall 决策基础和测试通过；下一步若继续 V2，应把 stall decision 更多投影到 final report / live TUI，而不是新增新 ledger。

### 11.7 P1-2 Agent / Skill 证据化：owner 验证通过

执行原因：

- V2 要求 Agent/Skill 不能变成第二套 runtime，也不能让父任务直接相信子任务自然语言 “Done/PASS”。
- 这块已有 DSXU owner：`AgentTool`、`tool-registry.ts`、`skills-registry-v1.ts`、`skill-governance-v1.ts`、`agent-mcp-skill-boundary-board.ts`，本轮只做 owner 验证和 evidence 刷新。

Focused 验证：

```bash
bun test src/dsxu/engine/__tests__/agent-mcp-skill-boundary-board.test.ts src/dsxu/engine/__tests__/agent-mcp-skill-ownership-v1.test.ts src/dsxu/engine/__tests__/agent-parent-final-gate-replay-v1.test.ts src/dsxu/engine/__tests__/skill-governance-contract-v1.test.ts
bun run agent-mcp-skill:acceptance
```

结果：

- Agent/MCP/Skill owner tests：14 pass / 0 fail。
- `agent-mcp-skill:acceptance` PASS，ready board 0 guards，blocked replay 8 guards，证明假 PASS、未引用 worker evidence、skill conflict、MCP standalone runtime 均会被拦。

收口结论：

- P1-2 当前符合 V2：Agent 是 serial/parallel worker + evidence envelope；Skill 是 registry/governance contract；MCP 是 Tool Gate adapter boundary。
- 不新增 Superpowers/生态二级技能入口，不新增 MCP runtime，不把 agent swarm 写成产品能力。

### 11.8 P2-2 SWE public-comparable 分层：完成边界加固

执行原因：

- V2 文档要求 `--mode public-comparable` 作为公开可比证据入口，但现有脚本只显式识别 `internal-smoke` / `real-benchmark`。
- 如果 `public-comparable` 被当成默认 internal smoke，会造成“看起来跑了公开测试，其实只是内部 smoke”的证据风险。

实际处理：

- `src/services/eval/swe-bench/runner.ts`
  - 增加 `SweBenchRequestedMode = internal-smoke | real-benchmark | public-comparable`。
  - `public-comparable` 只归一化到 `real-benchmark` 证据 lane，不会变成新的 benchmark runtime。
  - 输出新增 `requestedMode`、`evidenceClass`、`rawEvidenceRequired`、`externalComparisonClaimAllowed=false`。
  - `publicBenchmarkClaimAllowed` 仍固定为 `false`，直到 fixed manifest、raw transcript、tool trace、final report、artifact、cost/cache、scoring rubric、failure recovery notes 全部齐备。
- `scripts/dsxu-swe-bench-runner.ts`
  - CLI 识别 `--mode public-comparable`，输出里保留 requested/normalized mode 和 raw evidence requirement。
  - 不新增 package 入口，不新增第二套 runner。
- `src/services/eval/swe-bench/__tests__/runner.test.ts`
  - 增加 public-comparable 归一化测试，证明它进入 public comparable candidate lane，但公开 claim 仍被阻断。

Focused 验证：

```bash
bun test src/services/eval/swe-bench/__tests__/runner.test.ts src/services/eval/swe-bench/__tests__/contract.test.ts src/services/__tests__/swe-bench.test.ts
bun build scripts/dsxu-swe-bench-runner.ts --target=bun --outfile tmp/v2-swe-runner-check.js
bun run benchmark:swe-bench --instances "mock-001,mock-002" --timeout 60000
```

结果：

- SWE eval owner tests：12 pass / 0 fail。
- CLI build PASS。
- internal smoke 2/2 PASS，`publicBenchmarkClaimAllowed=false`，`externalComparisonClaimAllowed=false`。

收口结论：

- P2-2 已把 public-comparable 从“容易误触发的文案入口”收束成现有 eval owner 内的证据 lane。
- 这仍不是正式 SWE-bench / 公开榜单成绩。真正 public comparable 还必须导入真实固定任务 raw evidence 后再跑。

### 11.9 P2-3 Cache Warmer 成本证据边界：完成加固

执行原因：

- DeepSeek cache warmer 对 DSXU 有价值，但它只能是成本/缓存规划或执行证据，不能把 dry-run 写成 cache hit 改善。
- V2 要求默认 dry-run、不接 startup 背景集成、没有 trajectory 前不能写命中率提升 claim。

实际处理：

- `src/services/cache-warmer.ts`
  - 已保持默认 `dryRun=true`，默认输出 `mode=planning`。
  - `dryRun` 时不调用 provider probe，`estimatedSavingsUsd=0`。
  - execute 模式若无显式 probe，会失败并保留错误，不静默伪造 warmed result。
- `src/services/__tests__/cache-warmer.test.ts`
  - 新增默认 dry-run 不调用 provider probe 的测试。
  - 新增 execute 模式必须有显式 probe、且只能作为 execution evidence 的测试。

Focused 验证：

```bash
bun test src/services/__tests__/cache-warmer.test.ts
bun build scripts/dsxu-cache-warm.ts --target=bun --outfile tmp/v2-cache-warm-check.js
bun run cache:warm --dry-run
bun run evidence:dashboard
bun run health:runtime
```

结果：

- cache warmer tests：2 pass / 0 fail。
- CLI build PASS。
- `cache:warm --dry-run` PASS，claim boundary 明确为 no provider call / no cache-hit improvement claim。
- evidence dashboard PASS，`scoreFloor=72`、`gateSummary={ total:125, pass:38, fail:1, notRun:86 }`、`failureAttributions=0`、`parseErrors=0`。
- runtime health PASS，DeepSeek key 存在但 live ping 仍按 dry-path intentionally skipped。

收口结论：

- P2-3 已符合 V2：cache warmer 是 DeepSeek route/cost/cache owner 的规划工具，不是启动后台任务，也不是公开命中率改善证明。
- 后续如果要写 GitHub 成本卖点，只能引用真实 trajectory before/after，不引用 dry-run。

### 11.10 V2 聚焦验收：当前批次通过

本轮按 V2 原则只跑 owner 聚焦验收，不跑全量 `bun test`。

执行命令：

```bash
bun test src/services/api/deepseek-adapter-cache-prefix-v1.test.ts src/dsxu/engine/__tests__/deepseek-v4-control-v1.test.ts src/dsxu/engine/__tests__/model-config.test.ts src/dsxu/engine/__tests__/model-capability-v1.test.ts
bun test src/coordinator/tdd-gate/__tests__/gate.test.ts src/services/static-analysis/__tests__/bridge.test.ts src/dsxu/engine/__tests__/work-state-timeline.test.ts
bun test src/services/eval/swe-bench/__tests__/runner.test.ts src/services/eval/swe-bench/__tests__/contract.test.ts src/services/__tests__/swe-bench.test.ts src/services/__tests__/cache-warmer.test.ts scripts/__tests__/dsxu-evidence-dashboard.test.ts
bun run evidence:dashboard
```

结果：

- Provider/model/cost-cache owner：40 pass / 0 fail。
- TDD/SAST/work-state owner：25 pass / 0 fail。
- SWE/cache/dashboard owner：16 pass / 0 fail。
- Dashboard：`scoreFloor=72`、`gateSummary={ total:125, pass:38, fail:1, blocked:0, notRun:86 }`、`publicComparableReadiness=NOT_RUN`、`parseErrors=0`。

裁决：

- V2 当前已完成主要 owner-folded 收束：ProviderGateway、模型事实单源、默认编辑验证信封、脚本入口、最终验收失败归因、工具可见面、Agent/Skill evidence、SWE public-comparable 分层、cache warmer 成本边界。
- 当前不能把 `scoreFloor` 从 72 提高，因为 dashboard 仍诚实显示 public comparable raw evidence 未跑。
- 下一步如果继续 V2，应处理 dashboard 的唯一 blocked gate：`DSXU_V24_GITHUB_OPEN_SOURCE_LAUNCH_PACK_20260515`，并进入真实 public comparable raw evidence 采集或 release claim 文案收口。

### 11.11 Evidence Dashboard BLOCKED 状态：完成 claim gate 与 runtime fail 分离

执行原因：

- Dashboard 唯一红项来自 `DSXU_V24_GITHUB_OPEN_SOURCE_LAUNCH_PACK_20260515` 的 `BLOCKED_FOR_PUBLIC_95_RELEASE_CLAIM`。
- 这不是 runtime/test 崩坏，而是公开 95 分声明被正确拦住。把它归入 `FAIL` 会误导后续收口判断。

实际处理：

- `scripts/dsxu-evidence-dashboard.ts`
  - `GateStatus` 增加 `BLOCKED`。
  - `gateSummary` 增加 `blocked`。
  - `BLOCKED_*` 不再计入 `fail`，而是计入 `blocked`。
  - console 输出新增 `Blocked gates`。
- `scripts/__tests__/dsxu-evidence-dashboard.test.ts`
  - 增加 blocked release claim 与 failing runtime evidence 分离测试。
- `docs/BENCHMARK.md`
  - 增加 SWE internal smoke / public-comparable candidate 的公开边界说明。
  - 增加 dashboard `BLOCKED` 与 runtime `FAIL` 的区别。
- `docs/DSXU_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_20260518.md`
  - 增加 public-comparable runner 命令和 claim-blocked 边界。

Focused 验证：

```bash
bun test scripts/__tests__/dsxu-evidence-dashboard.test.ts
bun build scripts/dsxu-evidence-dashboard.ts --target=bun --outfile tmp/v2-evidence-dashboard-check.js
bun run evidence:dashboard
```

结果：

- dashboard tests：3 pass / 0 fail。
- dashboard build PASS。
- evidence dashboard PASS，`scoreFloor=72`、`gateSummary={ total:125, pass:38, fail:0, blocked:1, notRun:86 }`、`parseErrors=0`。

收口结论：

- V2 dashboard 现在能区分“代码/验收失败”和“公开声明被正确阻断”。
- 这不会提升 scoreFloor；它只是让 release claim gate 更诚实、更可操作。

### 11.12 P0-C/P0-D/P0-E 第二收束：风险阻断、命令目录、Workbench 状态 - 2026-05-18

执行原因：
- V2 第一轮已经把 TDD/SAST 从静默 `SKIPPED` 改成可见 verification envelope，但高风险文件仍需要默认更硬的策略。
- `package.json` 当前有 118 个 scripts。若没有 command catalog，历史证据、owner review、release-only、live-provider、internal benchmark 很容易被误读成产品主链能力。
- 最终验收已经能记录失败归因，但还需要按 owner 汇总，方便后续大块验收失败时直接进入对应 owner 修复。
- Evidence Dashboard 需要继续从“证据列表”升级成“信任工作台输入”，明确 release claim 是否允许、哪些证据未跑、哪些公开对比 raw evidence 仍缺。

实际处理：
- `src/services/static-analysis/tool-gate.ts`
  - 新增 `buildStaticAnalysisToolGatePolicy()`。
  - 普通源文件默认仍是 `PARTIAL` advisory envelope，避免把每次编辑都变成慢阻断。
  - provider route/cost/cache、tool/permission/runtime、agent/MCP/skill、release/benchmark/evidence、secret/env 等风险路径默认进入 `risk-blocking` 策略。
  - 用户显式 `DSXU_STATIC_ANALYSIS_TOOL_GATE=0/false/no` 时仍可跳过，但会留下 `SKIPPED` policy evidence，不能在 final report 中冒充完成验证。
- `scripts/dsxu-command-catalog.ts`
  - 新增 command catalog evidence script，读取 `package.json` 并按 owner/claim boundary 分类。
  - 不新增泛化产品入口；只生成 evidence 文档与 JSON。
  - 四个 owner-reviewed mainline aliases 明确为：
    - `evidence:dashboard`
    - `benchmark:swe-bench`
    - `health:runtime`
    - `cache:warm`
  - 其余脚本分为 `product-runtime`、`mainline-validation`、`release-only`、`owner-review`、`historical-evidence`、`internal-benchmark`、`live-provider`、`toolchain`、`supporting-utility`。
- `scripts/dsxu-v24-six-stage-final-tests.ts`
  - 新增 `ownerSummaries`，按 owner 汇总 total/pass/fail/timedOut/duration/failedCommands。
  - Markdown 报告新增 Owner Summary，后续 final acceptance 失败可直接定位 owner，而不是只看 stage。
- `scripts/dsxu-evidence-dashboard.ts`
  - 新增 `ownerFailureSummary`。
  - 新增 `workbench`：
    - `trustState`
    - `releaseClaimAllowed`
    - `blockingReasons`
    - `nextActions`
    - `failedOwnerCount`
    - `publicComparablePendingCount`
  - Dashboard 仍不从 pass rate 推导 score，不把 internal smoke 变成 public benchmark claim。
- 新增测试：
  - `scripts/__tests__/dsxu-command-catalog.test.ts`
  - 更新 `src/services/static-analysis/__tests__/bridge.test.ts`
  - 更新 `scripts/__tests__/dsxu-evidence-dashboard.test.ts`
- 生成产物：
  - `docs/generated/DSXU_COMMAND_CATALOG_20260518.json`
  - `docs/DSXU_COMMAND_CATALOG_20260518.md`
  - `docs/generated/DSXU_EVIDENCE_DASHBOARD_20260518.json`

Focused 验证：
```bash
bun test src/services/static-analysis/__tests__/bridge.test.ts
bun test scripts/__tests__/dsxu-command-catalog.test.ts
bun test scripts/__tests__/dsxu-evidence-dashboard.test.ts
bun run scripts/dsxu-command-catalog.ts
bun run scripts/dsxu-evidence-dashboard.ts
```

结果：
- Static Analysis owner：12 pass / 0 fail。
- Command Catalog：3 pass / 0 fail。
- Evidence Dashboard：3 pass / 0 fail。
- Command Catalog 生成成功：
  - `scriptCount=118`
  - `product-runtime=3`
  - `mainline-validation=12`
  - `release-only=9`
  - `owner-review=12`
  - `historical-evidence=55`
  - `internal-benchmark=4`
  - `live-provider=8`
  - `toolchain=4`
  - `supporting-utility=11`
- Evidence Dashboard 重新聚合成功：
  - `scoreFloor=72`
  - `gateSummary={ total:126, pass:39, fail:0, blocked:1, notRun:86 }`
  - `workbench.trustState=release-blocked`
  - `workbench.releaseClaimAllowed=false`
  - `publicComparablePendingCount=1`
  - `parseErrors=0`

收口结论：
- P0-C 已从“默认可见 envelope”推进到“风险路径默认 blocking policy”，但没有把所有普通编辑粗暴变成阻断。
- P0-D 已从“只有 4 个 alias”推进到“118 个 scripts 有 owner/claim boundary 目录”，避免多入口误读。
- P0-E 已从“命令失败归因”推进到“owner 汇总归因”。
- Evidence Dashboard 已具备 Workbench 输入形态：能说清楚当前为什么不能发布 release claim，而不是只显示一堆 JSON。
- 当前仍不能提升 scoreFloor，因为公开可比 raw evidence 与 release claim blocker 仍未完成；这是诚实阻断，不是代码回归。

### 11.13 P2-1 / Tool Contract / Workbench 第二收束：Ledger 投影、Runtime Event、Release Trust Panel - 2026-05-18

执行原因：
- 用户要求先完成 `P2-1 Long Task Ledger + Stall Recovery` 投影到 final report / TUI，再收 `Tool Result Contract + Runtime Event Schema`，最后把 Evidence Workbench 做成更可操作的 release/trust 面板。
- 当前已有 `progress-ledger.ts`、`work-state-timeline.ts`、`tool-protocol.ts` 与 dashboard；本次目标不是新增第二套 runtime/event bus，而是把这些 owner 串成同一条证据投影链。

实际处理：
- `src/dsxu/engine/progress-ledger.ts`
  - `LongTaskLedgerEvent` 增加 `schemaVersion='dsxu.runtime-event.v1'`，作为 DSXU 当前 runtime event schema。
  - `appendLedgerEvent()` 默认写入 `dsxu.runtime-event.v1`，不要求调用方自己拼 schema。
  - 新增 `projectToolCallResultToLedgerEvent()`：把 canonical `ToolCallResult` 投影成 ledger runtime event。
  - 新增 `buildLongTaskLedgerProjection()`：同一份 ledger/stall 决策可输出：
    - `tuiLines`
    - `finalReportSection`
    - `resumePoint`
    - `finalClaimAllowed`
    - `nextAction`
- `src/dsxu/engine/work-state-timeline.ts`
  - 新增 `projectDSXULongTaskLedgerToWorkStateEvents()`。
  - 新增 `buildDSXULongTaskWorkStateProjection()`。
  - ledger event 会投影进现有 work-state timeline / runtime state card / task evidence packet，不形成第二套可见状态系统。
  - stall 存在时，task evidence packet 不允许直接 `finalClaimAllowed=true`，避免“卡住了还说完成”。
- `src/dsxu/engine/tool-protocol.ts`
  - `ToolCallResult` 增加 canonical schema 标识 `dsxu.tool-call-result.v1`。
  - 新增 `ensureCanonicalToolCallResult()`。
  - 新增 `buildToolResultContractEvidence()`，明确：
    - canonical result schema 是 `dsxu.tool-call-result.v1`
    - runtime event schema 是 `dsxu.runtime-event.v1`
    - provider/MCP/legacy/bridge result 只能在 Tool Gate boundary 归一化，不能成为第二套工具 runtime。
  - provider/MCP/legacy normalizer 与 dispatcher 成功/失败路径都会写入 canonical schema。
- `scripts/dsxu-evidence-dashboard.ts`
  - 新增 `commandCatalog` 聚合。
  - 新增 `releaseTrustPanel`，包括：
    - `status`
    - `scoreFloor`
    - `mainlineAliasesReady`
    - `blockedGateNames`
    - `notRunGateSample`
    - `publicComparableMissingCases`
    - `recommendedCommands`
    - `dataStillNeeded`
  - 这让 dashboard 从“证据聚合器”进一步变成 release/trust 操作面板输入。

Focused 验证：
```bash
bun test src/dsxu/engine/__tests__/work-package-i/progress-ledger.test.ts src/dsxu/engine/__tests__/work-state-timeline.test.ts src/dsxu/engine/__tests__/tool-protocol/consistency.test.ts scripts/__tests__/dsxu-evidence-dashboard.test.ts
bun run scripts/dsxu-evidence-dashboard.ts
```

结果：
- Focused tests：46 pass / 0 fail / 262 expect。
- Evidence dashboard 生成成功：
  - `scoreFloor=72`
  - `gateSummary={ total:126, pass:39, fail:0, blocked:1, notRun:86 }`
  - `workbench.trustState=release-blocked`
  - `releaseTrustPanel.status=blocked`
  - `releaseTrustPanel.mainlineAliasesReady=true`
  - `releaseTrustPanel.blockedGateNames=[DSXU_V24_GITHUB_OPEN_SOURCE_LAUNCH_PACK_20260515]`
  - `releaseTrustPanel.publicComparableMissingCases=30`
  - `releaseTrustPanel.recommendedCommands=[bun run release:github-launch-pack, bun run benchmark:swe-bench -- --mode public-comparable]`
  - `parseErrors=0`

收口结论：
- P2-1 已从“ledger/stall 有基础模块”推进到“可投影到 TUI preview、final report section、work-state timeline、runtime state card、task evidence packet”。
- Tool Result Contract 已收成 `ToolCallResult` canonical contract，并和 `dsxu.runtime-event.v1` 绑定。
- Evidence Workbench 已有可操作 release/trust panel，不再只是 pass/fail 列表。
- 当前仍不提升 scoreFloor，因为公开可比 raw evidence 仍缺 30 个 case，GitHub launch pack 仍被 release claim gate 正确阻断。
## 11.14 V2-TUI 信任投影层补充：Claude TUI 底座复核与 DSXU 可见状态收口 - 2026-05-18

### 11.14.1 本节结论

本节不是新增第 9 个大模块，也不是重写 TUI。结论是：DSXU 已经保留并正在使用 Claude Code 的核心 TUI 底座，但 DSXU 自己新增的 verification、recovery、work-state timeline、long-task ledger、route/cost/cache evidence、Agent evidence 还没有形成默认可见的高级程序员信任界面。

V2 后续应补的是“信任投影层”，不是“复制 Claude TUI”。Claude TUI 负责终端交互成熟度；DSXU TUI 必须额外显示 runtime evidence，使用户不用看 debug log 或离线 dashboard，也能知道当前是否可声明完成。

### 11.14.2 实际代码复核范围

已复核路径：

| 范围 | 路径 | 结论 |
|---|---|---|
| DSXU TUI | `D:\DSXU-code\src\screens`、`D:\DSXU-code\src\components`、`D:\DSXU-code\src\query.ts`、`D:\DSXU-code\src\utils` | 主 REPL、消息流、权限、虚拟列表、PromptInput、StatusLine、ContextVisualization、Stats、toolResultStorage 均存在 |
| Claude 原 TUI | `D:\源代码claude\src\screens`、`D:\源代码claude\src\components`、`D:\源代码claude\src\query.ts`、`D:\源代码claude\src\utils` | 原版组件体系更大、更完整，DSXU 是裁剪/替换后的 fork |

组件数量复核：

| 项目 | 数量 | 判断 |
|---|---:|---|
| Claude `src/components` | 约 389 个 | 原版 TUI 组件体系完整 |
| DSXU `src/components` | 约 394 个 | 组件数量不低，且已有 DSXU 替代组件 |
| Claude 有而 DSXU 缺失 | 约 6 个 | 主要是 Claude 品牌/云侧相关组件，如 ClaudeInChrome、Clawd、Opus1m notice |
| DSXU 独有 | 约 11 个 | DSXU mascot、DSXU instruction includes、DSXU browser onboarding、PromptInput layout 等 |

关键文件大小复核：

| 文件 | DSXU | Claude 原版 | 审核判断 |
|---|---:|---:|---|
| `src/screens/REPL.tsx` | 约 284 KB | 约 896 KB | DSXU 保留主干，但明显裁剪 |
| `src/components/VirtualMessageList.tsx` | 约 45 KB | 约 148 KB | 虚拟消息列表在用，但比原版轻很多 |
| `src/components/Messages.tsx` | 约 43 KB | 约 147 KB | 消息流在用，但渲染细节被削减 |
| `src/components/permissions/PermissionRequest.tsx` | 约 10 KB | 约 33 KB | 权限 UI 在用，但是轻量版本 |
| `src/components/PromptInput/PromptInput.tsx` | 约 102 KB | 约 355 KB | 输入体验保留主干，复杂交互少于原版 |
| `src/utils/toolResultStorage.ts` | 约 39 KB | 约 38 KB | 大工具结果存储/preview 机制基本保留 |
| `src/utils/thinking.ts` | 约 5.5 KB | 约 5.5 KB | thinking 能力检测基本保留 |

### 11.14.3 已有并正在使用的 TUI 能力

| 能力 | DSXU 状态 | 证据位置 | 结论 |
|---|---|---|---|
| REPL 主界面 | 已使用 | `src/screens/REPL.tsx` | 保留主交互骨架 |
| FullscreenLayout | 已使用 | `REPL.tsx` import + render `FullscreenLayout` | 可继续作为主容器 |
| PermissionRequest | 已使用 | `REPL.tsx` 中 tool permission overlay | 权限弹窗链路存在 |
| VirtualMessageList | 已使用 | `Messages.tsx` 渲染 `VirtualMessageList` | 长 transcript 基础存在 |
| PromptInput / Footer | 已使用 | `PromptInput.tsx`、`PromptInputFooter.tsx` | 主输入和 footer 存在 |
| StatusLine | 条件使用 | `PromptInputFooter.tsx` 条件渲染 `StatusLine` | 依赖 settings.statusLine，不是 DSXU 默认信任行 |
| ContextVisualization | 已接入 slash command | `commands/context/context.tsx` | `/context` 能显示上下文使用 |
| Stats | 已接入 slash command | `commands/stats/stats.tsx` | `/stats` 能显示统计 |
| CostThresholdDialog | 已使用 | `REPL.tsx` focused dialog `cost` | 成本阈值弹窗存在 |
| MemoryUsageIndicator | 已使用 | `PromptInput/Notifications.tsx` | 内存/上下文提示存在 |
| toolResultStorage | 已使用 | `query.ts` import `applyToolResultBudget` | 大工具结果预算与 preview 基础存在 |

### 11.14.4 存在但没有用到位的 DSXU 状态

| 状态/能力 | 当前真实情况 | 不足 | V2-TUI 要求 |
|---|---|---|---|
| DSXU final usage evidence | `query.ts` 会生成 `DSXU final usage evidence` | 以 info system message 发出，非 verbose 下 `SystemTextMessage` 默认隐藏 info | 必须投影到默认可见 TrustStatusLine 或 EvidenceLine |
| Work-state timeline | `work-state-timeline.ts` 已有 timeline、operatorSummary、runtime state card | 主要在 engine/test/final report 中使用，TUI 没有消费 | 将 timeline 摘要接入 AppState/TUI |
| Runtime State Card | `buildDSXURuntimeStateCard()` 已存在 | 没有默认界面入口 | 作为 final claim allowed 的 UI 数据源 |
| Long Task Ledger Projection | `progress-ledger.ts` / `work-state-timeline.ts` 已有 projection 和 `tuiPreview` | 没有 live 面板 | 接入 compact long-task evidence panel |
| TUI Health Snapshot | `REPL.tsx` 构建 `buildDsxuTuiHealthSnapshot()` 并 log/trace | 用户不可见，只能查 debug/trace | stalled/waiting 变成可见 banner |
| CoordinatorTaskPanel | 组件存在 | `PromptInputFooter.tsx` 中 `{false && <CoordinatorTaskPanel />}`，等于默认关闭 | 不恢复重面板，改成 compact Agent evidence panel |
| Context 内部细分 | `ContextVisualization.tsx` 有 system tools、system prompt sections、message breakdown | 多处 `&& false` 默认隐藏 | 做 `/context --advanced`，不进入默认主界面 |
| Verification / Recovery | `query.ts` 有 recovery_state、verification nudge、final gate | 主要靠 prompt/system text，不是稳定 UI | 增加 Verification 状态和 RecoveryBanner |
| Agent evidence | query/engine 已有 parent-final evidence gate | 没有 worker evidence card | 增加 AgentHandoff compact card |

### 11.14.5 V2-TUI 优化范围

此范围归入 V2 后续优化，不作为新增大模块。

| 优先级 | 项目 | 目标 | 建议改动位置 |
|---|---|---|---|
| P0 | `dsxuTrustState` AppState 投影 | 统一承载模型路由、验证、恢复、上下文压力、final claim gate | `src/state/AppStateStore.ts`、`src/query.ts` |
| P0 | 默认 `TrustStatusLine` | 不依赖 settings.statusLine，默认显示当前可信状态 | `src/components/PromptInput/PromptInputFooter.tsx` 或新增轻组件 |
| P0 | Verification 状态可见化 | 显示 `not_run/running/pass/fail/blocked` 和最近验证命令 | `query.ts`、TDD/SAST/verify gate 输出、TUI footer |
| P0 | RecoveryBanner | 显示 `failed_verification_loop`、`permission_denied_replan`、`source_truth_required`、`agent_evidence_incomplete` | `query.ts` recovery state -> AppState -> TUI |
| P0 | EvidenceLine | 将 `DSXU final usage evidence` 从隐藏 info 变成可见 compact line | `query.ts`、`SystemTextMessage.tsx` 或新增 message subtype |
| P1 | Long Task Ledger compact panel | 显示 task state、resume point、stall decision、next action | `progress-ledger.ts` projection -> TUI |
| P1 | Agent Evidence compact panel | 显示 worker scope、状态、验证、未解决风险 | `CoordinatorAgentStatus.tsx`、`PromptInputFooter.tsx` |
| P1 | Tool Result compact card | 将 canonical `ToolCallResult` 渲染为统一工具结果摘要 | `AssistantToolUseMessage.tsx`、`UserToolResultMessage.tsx` |
| P1 | `/context --advanced` | 主动查看 system tools、message breakdown、tool-result tokens | `commands/context`、`ContextVisualization.tsx` |
| P2 | TUI Health visible banner | stalled/waiting 状态从 log 升级为用户可见 | `REPL.tsx`、`utils/dsxuHealthMonitor.ts` |

### 11.14.6 推荐执行顺序

1. 先增加 `dsxuTrustState` 数据投影，不改视觉布局。
2. 接入默认 `TrustStatusLine`，一行显示即可。
3. 将 verification / recovery / final-claim-allowed 变成默认可见状态。
4. 将 `DSXU final usage evidence` 改为 compact evidence line，避免 info message 被隐藏。
5. 接入 Long Task Ledger 与 Agent evidence compact panel。
6. 最后做 `/context --advanced`，把内部细分作为主动查看能力，不污染默认主界面。

### 11.14.7 不应做的事

| 不做 | 原因 |
|---|---|
| 不整包搬回 Claude 原版 TUI | DSXU 已接入 DeepSeek、证据、恢复、路由逻辑，整包回灌会提高回归风险 |
| 不新增复杂 TUI 大模块 | V2 目标是主链收敛，不是继续堆功能 |
| 不把所有 engine 状态默认刷屏 | 会让弱模型长任务和用户界面同时变乱 |
| 不依赖 prompt/info message 承载信任状态 | info message 非 verbose 默认隐藏，不能作为信任界面 |
| 不打开所有 `&& false` 内部面板 | 这些适合 advanced/debug，不适合默认体验 |
| 不把 internal smoke benchmark 显示成公开成绩 | 继续保持 internal smoke / internal ablation / public comparable 分层 |

### 11.14.8 验收标准

| 验收项 | PASS 条件 |
|---|---|
| 默认信任行 | 普通交互中无需配置 settings.statusLine，也能看到 DSXU 当前验证/恢复/模型状态 |
| 验证可见 | 写文件后 TUI 能显示最近验证状态，且未验证时 final claim 不显示为 allowed |
| 恢复可见 | 出现 verification failure、permission denied、source truth required、agent evidence incomplete 时，TUI 有明确 banner |
| 成本/路由可见 | Flash / Flash-MAX / Pro、route reason、cache/cost evidence 至少以 compact line 可见 |
| 长任务可恢复 | ledger projection 的 resume point 和 next action 能进入 TUI compact panel |
| Agent 证据可见 | 子 Agent 完成后，父界面可见 scope、验证、风险，不只显示“任务结束” |
| `/context --advanced` | 能看到当前被隐藏的 tool/system/message breakdown，但默认 `/context` 不噪音化 |

### 11.14.9 V2 总判断更新

DSXU 不是缺 Claude TUI。DSXU 已经有 Claude TUI 主干，也已经在使用。真正缺的是 DSXU 自己 runtime evidence 的默认可见投影。

因此，V2 后续 TUI 工作应定位为：

> 在现有 Claude-derived TUI 上增加 DSXU Trust Projection Layer，把 verification、recovery、work-state、ledger、agent evidence、route/cost/cache 投影到默认界面，使高级程序员不用读日志也能判断 DSXU 是否真的完成、是否可信、下一步该做什么。

### 11.14.10 V2-TUI 第一轮执行记录：Trust Projection 默认可见 + PTY resize 复核 - 2026-05-18

#### 11.14.10.1 执行范围

本轮按 11.14 执行，不新增 TUI runtime、不搬回原版 TUI、不新增第二套 UI 状态层。改动全部归入现有 owner：

| owner | 文件 | 动作 |
|---|---|---|
| AppState 主状态 | `src/state/AppStateStore.ts` | 增加 `dsxuTrustState`，作为 DSXU verification / recovery / route / cost / cache / final claim 的默认 TUI 投影数据源。 |
| Query loop / final gate | `src/query.ts` | 将 `query_loop_state_snapshot`、recovery gate、final gate、最终 DeepSeek route/cost/cache evidence 写入 `dsxuTrustState`。 |
| Prompt footer | `src/components/PromptInput/PromptInputFooter.tsx` | 增加默认 compact `DSXU trust` line，不依赖用户配置 `settings.statusLine`。 |
| TUI focused test | `src/components/PromptInput/__tests__/PromptInputFooter-trust.test.ts` | 覆盖 PASS / blocked / empty trust-state 三类显示。 |

#### 11.14.10.2 当前已完成

| V2-TUI 项 | 状态 | 证据 |
|---|---|---|
| `dsxuTrustState` AppState 投影 | DONE | `query.ts` 使用主 query-loop gate 和 final usage evidence 更新 AppState。 |
| 默认 TrustStatusLine | DONE | `PromptInputFooter.tsx` 默认渲染 `DSXU trust: ...` compact line。 |
| Verification 状态可见化 | DONE(first pass) | `verify=pass/fail/blocked/not_run` 进入 footer。 |
| Recovery / final gate 可见化 | DONE(first pass) | `claim=allowed/blocked`、`next=...`、`health=...` 进入 footer。 |
| 成本/路由可见化 | DONE(first pass) | `model/route/cost/cache` 进入 footer。 |
| 权限审核 resize 后可见 | VERIFIED | 真实 PTY resize 子测通过。 |
| 长内容 resize 不跳顶 | VERIFIED | 真实 PTY resize 子测通过。 |
| 中部 scrollback resize 不跳顶/不跳尾 | VERIFIED | 真实 PTY resize 子测通过。 |

#### 11.14.10.3 聚焦验证

| 命令 | 结果 |
|---|---|
| `bun test src/components/PromptInput/__tests__/PromptInputFooter-trust.test.ts` | PASS，3/3 |
| `bun test src/hooks/__tests__/useVirtualScroll-resize.test.ts src/ink/__tests__/render-node-scroll-resize.test.ts` | PASS，9/9 |
| `bun test src/dsxu/engine/__tests__/query-loop-gate-state-v1.test.ts src/dsxu/engine/__tests__/query-route-verification-v1.test.ts` | PASS，15/15 |
| `bun test src/dsxu/engine/__tests__/query-loop-visible-copy-v1.test.ts src/dsxu/engine/__tests__/tui-permission-fallback-health-v1.test.ts` | PASS，5/5 |
| `bun test src/dsxu/engine/__tests__/streaming-ui-visibility-v1.test.ts` | PASS，13/13 |
| `bun test src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts -t "keeps long-content TUI output pinned"` | PASS，真实 PTY resize |
| `bun test src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts -t "keeps permission review visible"` | PASS，真实 PTY resize + permission dialog |
| `bun test src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts -t "preserves a middle scrollback"` | PASS，真实 PTY scrollback resize |

说明：完整 `real-tui-harness-v1.test.ts` 全文件包含多组真实 WSL/PTY 场景，合跑超过当前工具超时；本轮只按用户暴露的问题跑 resize/权限关键场景，不把合跑超时写成失败或 PASS。

#### 11.14.10.4 仍未完成

| 项 | 状态 | 下一步 |
|---|---|---|
| Long Task Ledger compact panel | PARTIAL | 已有 projection，但还没有独立 live panel；下一步接入 `dsxuTrustState.ledger` 的实时来源。 |
| Agent Evidence compact panel | PARTIAL | `agent.activeCount/incompleteEvidence` 已进入 trust line；还缺 worker scope / verification / risk 摘要。 |
| Tool Result compact card | NOT YET | 下一步把 canonical `ToolCallResult` 渲染收口到 `AssistantToolUseMessage` / `UserToolResultMessage`。 |
| `/context --advanced` | NOT YET | 仍需把隐藏的 tool/system/message breakdown 改成主动查看能力。 |
| EvidenceLine message subtype | PARTIAL | 最终 usage evidence 已进入 footer；隐藏 info message 是否升级成可见 compact message 仍待 owner 决策。 |

---

## 11.15 V2 追加审核：工具编排与验证恢复收敛项

本节补充最近一次代码审核结论，只作为 V2 后续收敛项，不新增大模块，不扩大 V2 主目标。结论是：原先两条判断方向基本真实，但表述偏乐观。V2 应把它们改写为“已有能力需要主链收敛和可见投影”，而不是“能力已经完整成熟”。

### 11.15.1 工具编排：审核结论与优化方案

| 项目 | 审核结论 |
|---|---|
| 原判断 | 工具编排：接近；Tool Gate / Permission Gate 已成熟，但未全量投影 |
| 审核后判断 | 部分真实，但需要拆开。Permission Gate 主链成熟；DSXU Tool Gate / Tool Protocol 具备合同、风险评估、规范化结果和投影函数，但仍与 legacy toolExecution 并行，尚未成为全主链唯一入口，也未全量投影到 TUI / evidence / ledger。 |
| V2 定位 | 不新增工具系统，不重写 Claude-derived toolExecution。只做边界收敛：把已有 Permission Gate、Tool Gate、ToolCallResult、WorkState、Ledger、TUI 连接成一条可信链。 |

#### 已确认存在的能力

| 能力 | 真实状态 | 代码证据 |
|---|---|---|
| Tool Gate 风险评估 | 已存在 | `src/dsxu/engine/tool-gate-v1.ts`：`evaluateToolGate()` |
| Permission context 评估 | 已存在 | `src/dsxu/engine/tool-gate-v1.ts`：`evaluateToolPermissionContext()` |
| 标准工具结果合同 | 已存在 | `src/dsxu/engine/tool-protocol.ts`：`ToolCallResult` / `dsxu.tool-call-result.v1` |
| ToolResult 规范化证据 | 已存在 | `src/dsxu/engine/tool-protocol.ts`：`ToolResultContractEvidence` / `ensureCanonicalToolCallResult()` |
| legacy Permission 主链 | 已存在且在用 | `src/services/tools/toolExecution.ts`：`resolveHookPermissionDecision()` / `permissionDecision.behavior` |
| TUI 权限弹窗 | 已存在且在用 | `src/components/permissions/PermissionRequest.tsx`、`src/screens/REPL.tsx` |
| ToolResult 到 WorkState 投影 | 已存在 | `src/dsxu/engine/work-state-timeline.ts`：`projectDSXUToolCallResultToWorkStateEvent()` |

#### 当前不稳点

| 不稳点 | 影响 |
|---|---|
| Tool Gate v1 与 legacy toolExecution 并行 | 高级程序员无法确认“到底哪条规则决定了工具能不能执行” |
| ToolCallResult 合同没有成为唯一主链边界 | 工具输出仍可能出现多形态共存，后续 recovery / ledger / TUI 消费成本高 |
| WorkState / Ledger 投影存在但默认 TUI 消费不足 | 证据在 engine 层有，用户界面看不到，形成“有证据但不可信”的体验落差 |
| final usage evidence 以 info system message 形式发出 | 非 verbose 下 `SystemTextMessage` 默认隐藏 info，无法承担默认信任界面 |

#### V2 追加优化方案：Tool Runtime Event Boundary

目标：不重写工具系统，只加一层轻量边界适配，把所有工具结果在进入 recovery / ledger / TUI 前统一成同一种事件。

执行要求：

1. 保留现有 `toolExecution.ts` 和 TUI `PermissionRequest`，不做大规模 facade 瘦身。
2. 在 legacy 工具执行完成后，调用现有 `ensureCanonicalToolCallResult()` 或等效 adapter，把结果规范化为 `ToolCallResult`。
3. 将 canonical `ToolCallResult` 同步投影为：
   - `DSXUWorkStateEvent`
   - `ProgressLedgerEvent`
   - TUI compact tool result state
4. 将 Permission decision、Tool Gate decision、Tool result summary 放入同一个 runtime event envelope。
5. TUI 默认只显示 compact 信任摘要，不展开所有内部字段。

建议验收标准：

| 验收项 | PASS 条件 |
|---|---|
| 工具结果唯一边界 | Edit / Write / Bash / PowerShell / MCP 至少 5 类工具结果均可生成 canonical `ToolCallResult` |
| 权限决策可追踪 | 每个需要权限的工具结果能追踪 permission source、decision、risk level |
| Ledger 可消费 | 工具结果能进入 progress ledger，而不是只留在 message transcript |
| TUI 可见 | 用户能在默认界面看到工具是否 blocked / allowed / failed / verified，而不是只靠日志 |
| 不破坏原链 | 原 Claude-derived permission UI 和 toolExecution 行为不被整体替换 |

### 11.15.2 验证和恢复：审核结论与优化方案

| 项目 | 审核结论 |
|---|---|
| 原判断 | 验证和恢复：接近；GearBox / verify-gate 存在但未统一 |
| 审核后判断 | 真实，但需要降级表述。GearBox、query recovery、TDD/SAST post-write gate、verify-gate 都存在；但 `verify-gate.ts` 本体偏弱，默认 `onFailure=warn`，且分数偏启发式，不是真实测试执行核心。当前最大问题不是缺模块，而是恢复决策分散。 |
| V2 定位 | 不继续新增验证模块。把已有 GearBox、TDD Gate、SAST Gate、post-mutation envelope、query recovery、ledger、TUI 收敛成统一 Verification / Recovery decision table。 |

#### 已确认存在的能力

| 能力 | 真实状态 | 代码证据 |
|---|---|---|
| GearBox | 已存在 | `src/dsxu/engine/gear-box.ts`：`createGearBox()` |
| Flash / Pro 切换 | 已存在 | `gear-box.ts`：gear 1 使用 Flash，gear 2/3 使用 Pro |
| 工具失败反馈 GearBox | 已存在 | `src/dsxu/engine/query-loop.ts`：`gearBox.reportToolResult()` |
| Recovery decision 接口 | 已存在 | `gear-box.ts`：`applyRecoveryDecision()` |
| verify-gate | 已存在 | `src/dsxu/engine/verify-gate.ts`：`runVerifyGate()` |
| post-write TDD Gate | 已接入 Edit / Write | `src/tools/FileEditTool/FileEditTool.ts`、`src/tools/FileWriteTool/FileWriteTool.ts` |
| Static Analysis Gate | 已接入 Edit / Write | `invokeStaticAnalysisToolGate()` |
| query recovery state | 已存在且丰富 | `src/query.ts`：`classifyDsxuRecoveryState()` / recovery cursor |
| post-mutation verification envelope | 已存在 | `FileEditTool.ts` / `FileWriteTool.ts` 构建 verification envelope |

#### 当前不稳点

| 不稳点 | 影响 |
|---|---|
| `verify-gate.ts` 默认 `onFailure=warn` | 不能作为强验证门控来宣传 |
| `verify-gate.ts` 的 score 不是实际测试执行结果 | 不能代表真实 `bun test` / `tsc` / lint 通过 |
| TDD/SAST、query recovery、GearBox 各自判断 | 模型失败后可能出现 retry、replan、verify、final claim 等多套信号不一致 |
| GearBox 不消费全部 recovery 状态 | `query.ts` 的 recovery cursor 很强，但不一定统一驱动 GearBox 模型切换 |
| TUI 对 verification / recovery 缺默认状态投影 | 高级程序员不能一眼看到“现在是否可声明完成” |

#### V2 追加优化方案：Verification / Recovery Decision Table

目标：不新增验证系统，而是把现有验证和恢复能力变成一张统一决策表。

建议统一数据结构：

```ts
type VerificationRecoveryDecision = {
  state:
    | 'clean'
    | 'edit_applied_needs_verification'
    | 'verification_running'
    | 'verification_passed'
    | 'verification_failed_needs_repair'
    | 'failed_verification_loop'
    | 'permission_denied_replan'
    | 'source_truth_required'
    | 'agent_evidence_incomplete'
    | 'blocked'
  action:
    | 'continue'
    | 'verify'
    | 'repair'
    | 'replan'
    | 'rollback'
    | 'escalate_model'
    | 'ask_user'
    | 'final_answer'
    | 'partial'
  finalClaimAllowed: boolean
  modelGearHint: 1 | 2 | 3
  evidence: string[]
}
```

执行要求：

1. 以 `query.ts` 现有 `classifyDsxuRecoveryState()` 为主，不重做一套 recovery 分类。
2. 将 TDD Gate、SAST Gate、post-mutation envelope、verify-gate 结果统一转换为 `VerificationRecoveryDecision`。
3. GearBox 只消费统一 decision，不直接从零散文本/测试输出推断全部状态。
4. Ledger 记录同一个 decision，TUI 也消费同一个 decision。
5. 默认界面显示：verification state、required action、final claim allowed、last verification command/result。
6. 对弱模型场景，失败后优先给明确动作：repair / replan / verify / partial，不给开放式提示。

建议验收标准：

| 验收项 | PASS 条件 |
|---|---|
| post-edit 状态一致 | Edit / Write 后，query cursor、GearBox、ledger、TUI 都显示需要 verification |
| verification failed 一致 | 失败后不能重复原命令无策略重跑；decision 必须是 repair / replan / partial 之一 |
| verification passed 一致 | 通过后 `finalClaimAllowed=true`，GearBox 回落到 Flash / gear 1 |
| permission denied 一致 | 权限拒绝后进入 safe replan，不静默等待或重复同一工具 |
| agent evidence incomplete 一致 | 子 Agent 缺证据时父 Agent 不能直接 final PASS |
| TUI 可见 | 默认界面能看到 `finalClaimAllowed` 与 `requiredAction` |

### 11.15.3 V2 结论更新

这两项不应作为新的 V2 大模块加入，而应作为 V2 后半段的主链收敛要求：

1. 工具编排不是“再造工具系统”，而是把已有 Permission Gate、Tool Gate、ToolCallResult、WorkState、Ledger、TUI 串成唯一可信链。
2. 验证和恢复不是“再加 verify-gate”，而是把已有 TDD/SAST、query recovery、GearBox、post-mutation envelope、ledger、TUI 统一到同一张 decision table。
3. 对 DeepSeek V4 Flash / Flash-MAX / Pro 混合模型，最重要的是减少并行信号和开放式恢复，让弱模型每一步只看到一个明确状态、一个下一步动作、一个是否允许 final 的判断。

V2 后续执行口径：

| 优先级 | 收敛项 | 是否新增大模块 |
|---|---|---|
| P0 | Tool Runtime Event Boundary | 否，只接已有工具链 |
| P0 | Verification / Recovery Decision Table | 否，只统一已有验证恢复链 |
| P0 | TUI Trust Projection 消费上述两个结果 | 否，接入 11.14 的 TrustStatusLine / RecoveryBanner |
| P1 | Ledger / Evidence Dashboard 使用同一事件 | 否，避免 dashboard 与 runtime 各说各话 |

一句话结论：

> 这两条判断是真的，但不能宣传为“已经成熟完成”。V2 应把它们定义为“已有底座，缺主链统一和默认可见投影”。这正好符合当前原则：不要继续加模块，先让已有强模块进入默认体验。

### 11.15.4 V2-TUI 第二轮执行记录：剩余五项收束 - 2026-05-18

本轮只处理 V2-TUI 剩余五项：`Long Task Ledger live panel`、`Agent evidence compact panel`、`Tool Result compact card`、`/context --advanced`、`EvidenceLine message subtype`。执行原则仍是 owner-folded：不新增第二套 TUI runtime、不新增 context 命令入口、不新增 tool-result runtime，只把现有主链证据投影到默认可见体验。

| 项目 | 归属 owner | 执行结果 | 代码证据 |
|---|---|---|---|
| Long Task Ledger live panel | Query loop / PlanGraph / work-state projection | 已接入 `dsxuTrustState.ledger`，从 query-loop snapshot 推出 state、eventCount、resumePoint、stall、nextAction，并在 footer compact panel 中显示。 | `src/query.ts`、`src/state/AppStateStore.ts`、`src/components/PromptInput/PromptInputFooter.tsx` |
| Agent evidence compact panel | Agent / work-state projection | 已接入 active/running/completed/failed、scope、verification、risk；不把 worker transcript 回灌到 UI，只显示 evidence envelope。 | `src/query.ts`、`src/components/PromptInput/PromptInputFooter.tsx` |
| Tool Result compact card | Tool Result Contract / message renderer | 已在 `UserToolResultMessage` 增加 DSXU compact card，显示 tool、status、chars、tool state、canonical/artifact 标记，不替换原工具渲染。 | `src/components/messages/UserToolResultMessage/UserToolResultMessage.tsx`、`src/components/messages/UserToolResultMessage/utils.tsx` |
| `/context --advanced` | Context command owner | 已在原 `/context` 命令增加 `--advanced` / `-a` 参数；默认仍不显示内部噪声，高级模式主动展开 system tools、deferred tools、system prompt sections、message breakdown。 | `src/commands/context/context.tsx`、`src/commands/context/context-noninteractive.ts`、`src/components/ContextVisualization.tsx` |
| EvidenceLine message subtype | System message / evidence projection | 未新增 message runtime；通过 `EvidenceLine` compact renderer 让 `DSXU final usage evidence` 在非 verbose 默认界面可见，避免 final usage evidence 被 info message 隐藏。 | `src/components/messages/SystemTextMessage.tsx` |

聚焦验证：

| 命令 | 结果 |
|---|---|
| `bun test src/components/PromptInput/__tests__/PromptInputFooter-trust.test.ts` | PASS，4/4 |
| `bun test src/components/messages/UserToolResultMessage/__tests__/utils.test.ts` | PASS，2/2 |
| `bun test src/components/messages/__tests__/SystemTextMessage-evidence-line.test.ts` | PASS，2/2 |
| `bun test src/commands/context/__tests__/context-advanced.test.ts` | PASS，2/2 |
| `bun test src/dsxu/engine/__tests__/direct-connect-and-query-contract-v1.test.ts -t "query loop state"` | PASS，1/1 |
| `bun test src/dsxu/engine/__tests__/prompt-governance-contract.test.ts -t "Agent"` | PASS，8/8 |
| `bun test src/dsxu/engine/__tests__/streaming-ui-visibility-v1.test.ts` | PASS，13/13 |
| `bun test src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts -t "preserves a middle scrollback"` | PASS，真实 PTY resize，1/1 |
| `bun -e "await import('./src/components/ContextVisualization.tsx')"` | PASS |
| `bun -e "await import('./src/components/messages/UserToolResultMessage/UserToolResultMessage.tsx')"` | PASS |
| `bun -e "await import('./src/commands/context/context.tsx')"` | PASS |
| `bun -e "await import('./src/query.ts')"` | PASS |

边界说明：本轮没有跑全量 `bun test`，因为用户要求减少全量测试频率；本轮变更属于 TUI projection / compact rendering / context command 参数，已用对应 owner 的聚焦测试覆盖。下一轮若继续 V2，优先处理 `Tool Result Contract + Runtime Event Schema` 的更深收束，以及 Evidence Workbench 的 release/trust 操作面板。

### 11.16 V2 全面真实代码审核更新：完成度、缺口与收口排序 - 2026-05-18

本节是对 V2 当前代码态的重新排板审核。审核范围覆盖 V2 文档中的 P0/P1/P2、A+C 路线、TUI 追加项、Tool Runtime Event Boundary、Verification / Recovery Decision Table，以及最近讨论中的 Prompt 产品纪律。  

本轮审核只做静态代码与脚本入口复核，没有修改运行时代码，也没有运行全量 `bun test`。因此本节区分三种状态：

| 状态 | 含义 |
|---|---|
| DONE | 源码、脚本或测试入口已经存在，且与 V2 目标一致 |
| PARTIAL | 关键模块存在，但默认主链、全量投影、live 证据或最终验收还不完整 |
| NOT_DONE | 代码中未看到对应实现，或仍缺明确入口 |
| NOT_VERIFIED_LIVE | 代码/单元测试存在，但没有本轮真实长任务、live API 或全量回归证明 |

#### 11.16.1 当前 V2 总体判断

| 维度 | 当前判断 | 真实结论 |
|---|---|---|
| V2 方向 | 正确 | 不应再加大模块，应该继续 owner-folded 收敛 |
| V1/V24/V26 模块吸收 | 大体完成 | 多数能力已经落在源码中，但仍有部分是投影/证据层，不等于默认主链全部完成 |
| 高级程序员体验 | PARTIAL | TUI Trust line 已开始可见，但 ledger、Agent、tool result、recovery 的 live 体验还需继续收口 |
| DeepSeek 适配 | DONE/PARTIAL | 模型事实单源和 thinking/tool replay 已收束；live API 稳定性和 public comparable 仍未完成 |
| 主链验证 | PARTIAL | focused tests 多项存在；全量 `bun test`、six-stage、senior window 本轮未重新证明 |
| Prompt 产品纪律 | PARTIAL | 已有大量 prompt governance 测试，但 prompt 仍偏厚，下一步要瘦身并下沉到 runtime gate |
| 发布/外部 claim | NOT_DONE | scoreFloor 仍不能手工上调，public comparable raw evidence 仍是阻塞项 |

#### 11.16.2 P0 / P1 / P2 逐项真实完成度

| 项 | V2 目标 | 当前代码证据 | 真实状态 | 还差什么 |
|---|---|---|---|---|
| P0-A 模型事实单源 | DeepSeek V4 facts 只从 canonical owner 投影 | `src/utils/model/deepseekV4Control.ts` 定义 `DEEPSEEK_V4_CONTEXT_WINDOW = 1_048_576`；`model-capability-v1.ts` 从 canonical owner 投影；测试覆盖旧 128K / thinking=false archived facts | DONE | live provider 返回的真实 context/window 仍需按官方/API 结果定期复核 |
| P0-B ProviderGateway 单一边界 | thinking/tool replay/cost evidence 从现有 provider owner 收束 | `deepseek-adapter.ts` 统一 `thinking`、`reasoning_effort`、`reasoning_content`；`llm-adapter-owner-v1.test.ts`、`deepseek-adapter-cache-prefix-v1.test.ts` 覆盖 round-trip | DONE / NOT_VERIFIED_LIVE | 本轮没有 live API round-trip；只可声明代码与测试 owner 收束 |
| P0-C 默认编辑生命周期 | Edit/Write 后进入 TDD/SAST/verification envelope/work-state | `FileEditTool.ts`、`FileWriteTool.ts` 调用 `invokeStaticAnalysisToolGate()`、`invokePostWriteTddGate()`、`buildPostMutationVerificationEnvelope()`；风险路径 SAST 默认 blocking | PARTIAL | `verify-gate.ts` 默认仍是 `onFailure='warn'`，不能宣传为全局默认 block；普通编辑是 visible/advisory，不是全部硬阻断 |
| P0-D 命令目录与 owner 验证分组 | 四个 owner-reviewed alias 存在，并通过 command catalog 管理边界 | `package.json` 已有 `evidence:dashboard`、`benchmark:swe-bench`、`health:runtime`、`cache:warm`；`scripts/dsxu-command-catalog.ts` 生成 owner/claim boundary 和 owner-focused verification groups | DONE / focused-tested | 不新增 `test:mainline` / `regression-check` 泛化入口；mainline 验证通过 command catalog 的 owner-focused groups 表达 |
| P0-E 最终验收可归因 | final acceptance 输出 owner / root cause / next action | `scripts/dsxu-v24-six-stage-final-tests.ts` 有 owner attribution、timedOut、failedCommands、ownerSummaries | DONE / NOT_VERIFIED_LIVE | 机制存在，但本轮没有跑完整 six-stage / senior window 证明结果全绿 |
| P1-1 工具窗口软瘦身 | 弱模型看到较少工具，执行层不删能力 | `src/tools.ts` 有 `DSXU_DEFAULT_MAINLINE_TOOLS` 与 explicit sidecar env；`query-loop.ts` 有 tool subset 上限 | DONE / PARTIAL | 工具暴露已瘦身，但 ToolCallResult 仍需成为所有消费链的唯一事实边界 |
| P1-2 Agent / Skill 证据化 | 子 Agent 交 evidence envelope，父任务不能只信文本 | `agentEvidencePacketSchema()`、`buildAgentEvidencePacket()`、`renderAgentEvidencePacket()`、`classifyHandoffIfNeeded()` 已存在；TUI trust state 有 agent risk 投影 | DONE / PARTIAL | worker scope / verification / unresolved risk 已开始可见；还需真实多 Agent 长任务回放证明 parent PASS 全链硬约束 |
| P1-3 Evidence Dashboard 产品化 | 从证据列表升级成 release/trust workbench | `scripts/dsxu-evidence-dashboard.ts` 有 `workbench`、`releaseTrustPanel`、`mainlineAliasesReady`、blocked gate 区分 | DONE | scoreFloor 不自动提升；public comparable raw evidence 仍缺 |
| P2-1 Long Task Ledger 主链化 | ledger 可投影到 TUI/final/work-state/task evidence | `progress-ledger.ts` 有 `dsxu.runtime-event.v1`、`projectToolCallResultToLedgerEvent()`、`buildLongTaskLedgerProjection()`；`work-state-timeline.ts` 有 ledger projection；TUI trust state 有 ledger line | PARTIAL | ledger 投影强，但是否成为所有长任务默认持久恢复源仍未全量证明 |
| P2-2 SWE / Public Comparable 分层 | internal smoke 与 public comparable 严格分开 | `swe-bench/runner.ts` 有 `internal-smoke` / `real-benchmark` / `public-comparable`；`publicBenchmarkClaimAllowed=false` | DONE / NOT_VERIFIED_LIVE | 正式 public comparable raw evidence 未跑，不能当公开 benchmark 成绩 |
| P2-3 Cache Warmer 降级为成本辅助证据 | dry-run 不声明 cache hit 改善 | `cache-warmer.ts` 默认 `dryRun=true`，无 probe execute 会失败；claim boundary 明确 no provider call | DONE | 若要成本卖点，需要 trajectory before/after live 证据 |

#### 11.16.3 A+C 八周路线真实状态

| 周期 | 原目标 | 当前真实状态 | 结论 |
|---|---|---|---|
| Week 1A | 修复 `bun test` 超时、切分 test 层级 | final runner 有 owner attribution；但还需要明确 fast/slow owner 验证分组，而不是新增 package 入口 | PARTIAL |
| Week 1C | provider 合同、thinking round-trip | provider contract、DeepSeek thinking round-trip 测试已存在 | DONE / NOT_VERIFIED_LIVE |
| Week 2A | 统一工具结果协议 | `ToolCallResult` / `dsxu.tool-call-result.v1` / ledger projection 已存在 | PARTIAL |
| Week 2C | cache chart / GitHub 稳定性 | cache warmer 与 dashboard 存在；GitHub chart/live 稳定性不是本轮核心证据 | PARTIAL |
| Week 3A | Verification 默认 `onFailure=block` | 风险路径默认 blocking，普通编辑 advisory；`verify-gate.ts` 仍默认 warn | PARTIAL |
| Week 3C | 工具结果预览预算、artifact 存储 | `toolResultStorage`、compact card、budget 基础存在 | DONE |
| Week 4A | durable ledger | ledger projection 存在，DAG persist 也存在；默认持久恢复源未完全证明 | PARTIAL |
| Week 4C | 成本路由证据 ledger event | ledger 支持 `model-route` / `cost-cache`，成本证据 owner 存在 | PARTIAL |
| Week 5 | 恢复决策表统一 | GearBox、query recovery、ledger stall、failure taxonomy 都存在，但仍是多入口 | PARTIAL |
| Week 6 | Agent evidence / handoff schema | evidence packet 与 handoff warning 存在，TUI trust 有 agent risk | DONE / PARTIAL |
| Week 7 | 本地回归运行器 + 复杂度分类器 | task analyzer / task control plane 存在；不新增 `scripts/regression-check.ts`，缺的是现有 runner/catalog 对 mainline owner-focused 验证分组的明确声明 | PARTIAL |
| Week 8 | 上下文压力策略 + 证据包 | context pressure matrix 和 70/85/95/99 测试存在；TUI/ledger 已有投影 | PARTIAL |

#### 11.16.4 仍未完成或不能宣传完成的点

| 缺口 | 严重度 | 原因 | 建议处理 |
|---|---:|---|---|
| 全量 `bun test` / final acceptance 当前未重新证明 | P0 | 没有本轮全量运行结果，不能声称全绿 | 最后收口时跑 `bun test`、`test:six-stage-final`、`acceptance:senior-coding-window` |
| mainline owner-focused 验证分组 | P0 | V2 目标要求 mainline 可复现；不能再新增泛化 package 入口 | 已在 command catalog 中落 owner-focused verification groups；后续 final runner 可消费这些分组，不新增 benchmark/runtime/product surface |
| `verify-gate.ts` 默认 `warn` | P0 | 不能把它宣传成默认硬阻断 | 保持普通编辑 advisory，但统一命名；风险路径由 SAST/TDD/envelope block |
| ToolCallResult 还需成为所有链路唯一事实 | P0 | schema 已有，但 legacy `toolExecution` 仍在，容易多形态共存 | 增加轻量 Tool Runtime Event Boundary，不重写工具系统 |
| Recovery decision table 尚未落成单一消费源 | P0 | query recovery、GearBox、ledger stall 各自存在 | 以 `query.ts` 的 recovery state 为主源，生成统一 decision 给 GearBox/ledger/TUI |
| ledger 默认持久恢复仍未完全证明 | P1 | projection 已强，但不是所有长任务的 durable task source of truth | 继续把 ledger 写入/恢复接入长任务默认路径 |
| Agent parent PASS 全链证明仍需长任务回放 | P1 | schema/envelope 有，focused tests 有；缺真实复杂 Agent 任务闭环 | 用 senior coding / multi-agent focused scenario 验证 |
| Prompt 仍偏厚 | P1 | prompt governance 很强，但大量纪律仍在 prompt 层，弱模型容易稀释注意力 | 做 Prompt 瘦身第一轮：稳定纪律保留，runtime gate 动态注入，任务 prompt 微型化 |
| public comparable / SWE 正式成绩未完成 | P2 | 当前 runner 明确 claim blocked | 后续用固定 manifest + raw transcript + rubric + artifact 跑 public comparable |
| cache 成本优势不能从 dry-run 宣传 | P2 | cache warmer 默认 planning | 只有 live trajectory before/after 可进入公开卖点 |

#### 11.16.5 Prompt 产品纪律补充：不要继续加厚

基于当前代码和 DeepSeek V4 Flash / Flash-MAX / Pro 混合模型定位，Prompt 优化不应是继续堆 Claude 风格长 prompt，而应拆成三层：

| 层 | 保留内容 | 下沉或删除内容 |
|---|---|---|
| Stable System Prompt | 不虚报、不乱改、不覆盖用户改动、失败说 PARTIAL、工具优先、验证纪律 | 具体 PEV/TDD/SAST/ledger/recovery 细节不长期常驻 |
| Runtime Gate Prompt | 当前 verification / recovery / context pressure / Agent handoff / tool state | 由代码动态注入，状态结束后退出上下文 |
| Task Micro Prompt | 当前任务 3-5 条短指令、明确下一步、明确验证 | 长篇开放式推理、自问自答、重复规则 |

执行口径：

1. 先完成测试分层、工具事件边界、验证语义统一，再做 prompt 瘦身，避免无法归因。
2. Prompt 瘦身不删除纪律，只把可由 runtime 决定的内容移出长期 system prompt。
3. 对 DeepSeek Flash 默认使用短、明确、填空式指令；复杂任务由 runtime ledger / decision table 承担连续性。
4. Prompt 只负责“纪律和意图”，不承担“安全保证”。安全保证必须来自 gate、event schema、ledger、TUI evidence。

#### 11.16.6 推荐后续执行排序

| 顺序 | 工作 | 类型 | 验证方式 |
|---:|---|---|---|
| 1 | 明确 mainline / owner-focused 验证分组 | 功能收口 | focused command catalog + owner grouped smoke；不新增 package/runtime 入口 |
| 2 | Tool Runtime Event Boundary：所有工具结果进 canonical event | 功能收口 | tool-protocol / mainline-tool-adapter / ledger projection tests |
| 3 | Verification 默认语义统一：普通 advisory，高风险 blocking | 功能收口 | tdd-gate / static-analysis / post-mutation envelope tests |
| 4 | Prompt 瘦身第一轮：system 稳定、runtime 动态、task 微型 | 产品纪律 | prompt-governance / query-message-shape tests |
| 5 | Recovery Decision Table：query/GearBox/ledger/TUI 同源 | 功能收口 | recovery / gearbox / work-state tests |
| 6 | Durable Ledger 主链恢复证明 | 长任务能力 | progress-ledger + query-loop recovery replay |
| 7 | Agent evidence parent PASS 闭环 | Agent 能力 | agent handoff + parent-final gate + focused multi-agent scenario |
| 8 | TUI Trust Projection 消费上述事件 | 体验收口 | PromptInputFooter / SystemTextMessage / real-tui-harness focused tests |
| 9 | 小测试批量收口 | 小测试 | owner focused tests 全部 PASS |
| 10 | 大测试最终收口 | 大测试 | `bun test`、`test:six-stage-final`、`acceptance:senior-coding-window`、SWE internal smoke |

最终判断：V2 当前不是“没做”，而是“底座很强，收口还没完全闭环”。下一阶段的正确路线不是继续加模块，而是把工具事件、验证恢复、ledger、Agent evidence、TUI trust、prompt 纪律收成同一条默认主链。只有这条链大测试通过后，才可以考虑重新评估 scoreFloor 或进入 public comparable / 发布 claim 阶段。

### 11.17 V2 未完成 P0 执行记录：入口措辞、Tool Runtime Event Boundary、Verification/Recovery 同源 - 2026-05-18

执行原因：
- 用户明确指出“轻量主链入口”不能被理解为新增入口。V2 只能使用现有 owner、command catalog 和 final runner 分组，不再添加 `test:mainline` / `regression-check` 这类泛化 package 入口。
- 11.16 已确认 `ToolCallResult`、ledger、work-state projection 存在，但 legacy `toolExecution` 仍只把结果当 provider `tool_result` block 处理，尚未在主工具路径同步形成 canonical runtime event boundary。
- Verification / Recovery 已有 `verify-gate`、`decideStallRecovery()`、ledger projection，但缺一个把 verification result、failure policy、recovery decision、final claim boundary 合成同源证据的 owner 函数。

实际处理：
- `docs/DSXU_V2_EXECUTION_PLAN_20260518_CN.md`
  - 将 “package 入口 / 轻量主链入口” 改为 “owner-reviewed alias / owner-focused 验证分组”。
  - 明确后续不新增泛化 package/runtime/product 入口；只在 command catalog / final runner 内标识 mainline owner-focused 验证分组。
- `src/services/tools/toolLifecycle.ts`
  - 增加 `buildDsxuToolRuntimeEventBoundary()`：把 legacy provider `tool_result` block 归一为 canonical `ToolCallResult`，并同步生成 `ToolResultContractEvidence`、ledger event、work-state event。
  - 增加 `traceDsxuToolRuntimeEventBoundary()`：只记录 schema、boundary、ok、duration/output size、ledger/work-state 状态，不回灌大输出。
- `src/services/tools/toolExecution.ts`
  - 在现有 `mapDsxuToolResultForLifecycle()` 后接入 runtime event boundary trace。
  - 未改工具执行路径，未新增 tool runtime，未改变 provider message 结构。
- `scripts/dsxu-command-catalog.ts`
  - 增加 `ownerFocusedVerificationGroups`，列出 Tool Runtime Event Boundary、Verification/Recovery Ledger、mainline Tool/Permission/Agent/Skill、TUI Trust Projection、Release Trust Evidence 五个 owner-focused 验证组。
  - 分组内只列真实命令，不新增 package script，不新增 runner。
- `src/dsxu/engine/progress-ledger.ts`
  - 增加 `projectVerificationRecoveryDecision()`：以 `VerifySummary + onFailure policy + failedAttemptsSinceProgress` 为同源输入，输出 verification ledger event、可选 `StallRecoveryDecision`、final claim boundary 和 nextAction。
  - 增加 `recordVerificationRecoveryDecision()`：把 verification event、verifySummary、stall decision 写回同一 long-task ledger。
- `src/dsxu/engine/__tests__/tool-lifecycle-contract-v1.test.ts`
  - 增加 legacy tool result -> canonical runtime event boundary 测试。
- `src/dsxu/engine/__tests__/work-package-i/progress-ledger.test.ts`
  - 增加 verification/recovery/ledger/final claim 同源投影测试。

Focused 验证：
```bash
bun test src/dsxu/engine/__tests__/tool-lifecycle-contract-v1.test.ts
bun test src/dsxu/engine/__tests__/tool-protocol/consistency.test.ts -t "provider"
bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts -t "canonical ToolCallResult"
bun test src/dsxu/engine/__tests__/work-package-i/progress-ledger.test.ts
bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts -t "long-task ledger"
bun test src/dsxu/engine/__tests__/verify-gate.test.ts
bun test src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts
bun test src/dsxu/engine/__tests__/query-loop-gate-state-v1.test.ts
bun test scripts/__tests__/dsxu-command-catalog.test.ts
bun run scripts/dsxu-command-catalog.ts
bun test scripts/__tests__/dsxu-evidence-dashboard.test.ts
bun run evidence:dashboard
```

结果：
- `tool-lifecycle-contract-v1.test.ts`：3/3 PASS。
- `tool-protocol/consistency.test.ts -t "provider"`：1/1 PASS。
- `work-state-timeline.test.ts -t "canonical ToolCallResult"`：1/1 PASS。
- `progress-ledger.test.ts`：23/23 PASS。
- `work-state-timeline.test.ts -t "long-task ledger"`：1/1 PASS。
- `verify-gate.test.ts`：9/9 PASS。
- `mainline-tool-adapter-v1.test.ts`：82/82 PASS。
- `query-loop-gate-state-v1.test.ts`：7/7 PASS。
- `dsxu-command-catalog.test.ts`：3/3 PASS。
- `bun run scripts/dsxu-command-catalog.ts`：PASS，`scriptCount=118`，`mainline-validation=12`，输出 `docs/generated/DSXU_COMMAND_CATALOG_20260518.json` 与 `docs/DSXU_COMMAND_CATALOG_20260518.md`。
- `dsxu-evidence-dashboard.test.ts`：4/4 PASS。
- `bun run evidence:dashboard`：PASS，`scoreFloor=72`，`blocked=1`，`notRun=86`，`parseErrors=0`；分数仍保持 72，未把 focused tests 冒充 public comparable 成绩。

边界说明：
- 本轮没有跑全量 `bun test`、`test:six-stage-final` 或 `acceptance:senior-coding-window`，因为当前阶段按用户要求先收功能与 owner P0，不做每次全量回归。
- `verify-gate.ts` 默认仍是普通 advisory 语义；本轮没有把所有普通编辑粗暴改成 hard block。风险路径继续由 SAST/TDD/envelope blocking policy 处理。
- Tool Runtime Event Boundary 是现有工具主链的证据边界，不是第二套工具执行引擎。
- Verification/Recovery projection 是 ledger owner 的同源投影，不替代 query-loop / GearBox，只给它们提供统一证据口径。

更新后的剩余工作：
| 顺序 | 工作 | 当前状态 | 下一步 |
|---:|---|---|---|
| 1 | mainline owner-focused 验证分组 | DONE / focused-tested | command catalog 已列出 5 个 owner-focused verification groups；不新增 package 入口。 |
| 2 | Tool Runtime Event Boundary | DONE / focused-tested | 后续继续观察真实 TUI/CLI 中 tool compact card、ledger、final report 是否消费同源事件。 |
| 3 | Verification/Recovery Decision 同源 | DONE / focused-tested | 后续接 query-loop live state，证明复杂失败恢复默认写入 ledger。 |
| 4 | Prompt 瘦身第一轮 | NOT_DONE | 先保持纪律，不把 runtime gate 长文继续塞进 stable prompt。 |
| 5 | Durable Ledger 默认恢复证明 | PARTIAL | 用长任务中断/恢复 replay 验证 ledger 是默认恢复源。 |
| 6 | Agent parent PASS 长任务闭环 | PARTIAL | 用多 Agent focused scenario 证明 parent 只根据 evidence envelope 放行。 |
| 7 | TUI trust 真实窗口回测 | PARTIAL | 继续覆盖 resize、长输出、弹窗、EvidenceLine、tool card、ledger/agent compact panel。 |
| 8 | 最终全量验收 | NOT_DONE | P0/P1 owner 收口后跑 `bun test`、six-stage、senior window、SWE internal smoke。 |

### 11.18 V2 继续执行记录：Prompt 瘦身、Durable Ledger 恢复证明、Agent/MCP/Skill compact evidence - 2026-05-18

本轮继续按 owner-folded 原则执行，不新增主链、不新增 runtime、不新增权限层、不新增 package 入口。处理目标是 11.17 剩余的三项：Prompt 瘦身第一轮、Durable Ledger 默认恢复证明、Agent parent PASS 证据闭环。

| 项目 | 归属 owner | 执行结果 | 代码证据 |
|---|---|---|---|
| Prompt 瘦身第一轮 | DeepSeek Prompt Prefix / System Prompt | 已把 system/runtime/task 三层拆分变成 `prompt-prefix-cache-builder` 的可测决策：stable prefix 如果混入 runtime gate / task micro section 或 volatile evidence，会输出 `NEEDS_PROMPT_SLIMMING_OWNER_REVIEW`；dynamic tail 超过 workflow cache miss budget 也会被标记。 | `src/dsxu/engine/prompt-prefix-cache-builder.ts`、`src/dsxu/engine/__tests__/prompt-prefix-cache-builder.test.ts` |
| Durable Ledger 默认恢复证明 | PlanGraph / Work-State / Recovery | 已新增 `buildDurableLedgerRecoveryProof()`，从同一份 progress ledger 检查 verification event、stall/recovery event、resume source、finalClaimAllowed 和 nextAction，证明失败恢复来自 ledger，不是 side channel。 | `src/dsxu/engine/progress-ledger.ts`、`src/dsxu/engine/__tests__/work-package-i/progress-ledger.test.ts` |
| Agent parent PASS 证据闭环 | Agent / MCP / Skill boundary owner | 已让现有 `Agent/MCP/Skill boundary board` 直接输出 `compactPanelLines` 和 `finalReportSection`，父任务只能基于 bounded evidence envelope、output path/hash、worker citation、skill priority/conflict、MCP schema/redaction/Tool Gate boundary 做 PASS。 | `src/dsxu/engine/agent-mcp-skill-boundary-board.ts`、`src/dsxu/engine/__tests__/agent-mcp-skill-boundary-board.test.ts` |

Focused 验证：

```bash
bun test src/dsxu/engine/__tests__/prompt-prefix-cache-builder.test.ts
bun test src/dsxu/engine/__tests__/work-package-i/progress-ledger.test.ts
bun test src/dsxu/engine/__tests__/agent-mcp-skill-boundary-board.test.ts
```

结果：

| 命令 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/prompt-prefix-cache-builder.test.ts` | PASS，4/4 |
| `bun test src/dsxu/engine/__tests__/work-package-i/progress-ledger.test.ts` | PASS，24/24 |
| `bun test src/dsxu/engine/__tests__/agent-mcp-skill-boundary-board.test.ts` | PASS，4/4 |

边界说明：

1. 本轮没有跑全量 `bun test`，因为当前阶段继续按用户要求减少全量回归频率，只跑 owner-focused 验证。
2. Prompt 瘦身不是删除纪律，而是把运行态 verification/recovery/context/tool/agent 状态移出 stable prefix，降低 DeepSeek 前缀缓存破坏风险。
3. Durable Ledger proof 是现有 ledger 的恢复证据投影，不是第二套任务状态系统。
4. Agent/MCP/Skill compact evidence 是现有 boundary board 的 TUI/final-report 消费形态，不是新增 Agent runtime。

更新后的剩余工作：

| 顺序 | 工作 | 当前状态 | 下一步 |
|---:|---|---|---|
| 1 | Tool Result Contract 全链唯一消费 | PARTIAL | 继续查 legacy tool result / SDK block / runtime result 是否还有未投到 canonical `ToolCallResult` 的路径。 |
| 2 | Runtime Event Schema 全链消费 | PARTIAL | 把 verification、permission、model route/cost/cache、agent、MCP 继续投到同一 runtime event / ledger / work-state projection。 |
| 3 | Evidence Workbench 产品化 | PARTIAL | 把 dashboard 从报告脚本继续升级为 release/trust 面板，但不提高 scoreFloor、不冒充 public benchmark。 |
| 4 | TUI trust 真实窗口回测 | PARTIAL | 覆盖 resize、长输出、弹窗、EvidenceLine、tool card、ledger/agent compact panel。 |
| 5 | 最终全量验收 | NOT_DONE | owner 收束稳定后再跑 `bun test`、`test:six-stage-final`、`acceptance:senior-coding-window`、SWE internal smoke。 |

### 11.19 V2 继续执行记录：Tool Result 全链消费、Runtime Event 消费证明、Evidence Workbench action items - 2026-05-18

本轮继续处理 11.18 的剩余项，仍遵守“不新增主链、不新增 runtime、不新增权限层、不新增泛化入口”的约束。实现重点是把已有强模块的消费边界做成可验收证据，而不是再加一层执行系统。

| 项目 | 归属 owner | 执行结果 | 代码证据 |
|---|---|---|---|
| Tool Result Contract 全链唯一消费 | Tool Gate / Tool Protocol | 已新增 `buildToolResultContractConsumptionBoard()`，要求 work-state、ledger、recovery、TUI、final report、release evidence 等消费方都声明 `dsxu.tool-call-result.v1` + `dsxu.runtime-event.v1`，任何 legacy shape 进入 release evidence 都会被标为 `NEEDS_TOOL_RESULT_CONTRACT_CONSUMPTION_REVIEW`。 | `src/dsxu/engine/tool-protocol.ts`、`src/dsxu/engine/__tests__/tool-protocol/consistency.test.ts` |
| Runtime Event Schema 全链消费 | PlanGraph / Work-State / Runtime Event | 已新增 `buildRuntimeEventSchemaConsumptionProof()`，检查同一 ledger stream 是否包含 goal、plan、tool、verification、recovery、evidence 等必要事件，并暴露 missing kind / invalid event，防止只有 final evidence 没有过程链路。 | `src/dsxu/engine/progress-ledger.ts`、`src/dsxu/engine/__tests__/work-package-i/progress-ledger.test.ts` |
| Evidence Workbench 产品化 | Evidence / Release Claim Binder | 已给 `workbench` 增加 `actionItems`，每条包含 priority、owner、reason、nextAction、command、evidenceFiles；dashboard 仍诚实保持 `scoreFloor=72`，不会用 pass rate 或内部 smoke 自动提分。 | `scripts/dsxu-evidence-dashboard.ts`、`scripts/__tests__/dsxu-evidence-dashboard.test.ts`、`docs/generated/DSXU_EVIDENCE_DASHBOARD_20260518.json` |

Focused 验证：

```bash
bun test src/dsxu/engine/__tests__/tool-protocol/consistency.test.ts -t "canonical ToolCallResult boundary normalization"
bun test src/dsxu/engine/__tests__/work-package-i/progress-ledger.test.ts
bun test scripts/__tests__/dsxu-evidence-dashboard.test.ts
bun run evidence:dashboard
```

结果：

| 命令 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/tool-protocol/consistency.test.ts -t "canonical ToolCallResult boundary normalization"` | PASS，4/4 |
| `bun test src/dsxu/engine/__tests__/work-package-i/progress-ledger.test.ts` | PASS，26/26 |
| `bun test scripts/__tests__/dsxu-evidence-dashboard.test.ts` | PASS，4/4 |
| `bun run evidence:dashboard` | PASS，`scoreFloor=72`、`Evidence files=126`、`Passing gates=39`、`Failing gates=0`、`Blocked gates=1`、`Not-run gates=86`、`Parse errors=0` |

Evidence Workbench 当前 action items：

| priority | owner | reason | command |
|---|---|---|---|
| P0 | Evidence / Release Claim Binder | release claim or external evidence gate is blocked | `bun run release:github-launch-pack` |
| P1 | Evidence / Benchmark / Public Comparable | 1 public-comparable manifest still lacks paired raw evidence / 30 cases missing | `bun run benchmark:swe-bench -- --mode public-comparable` |
| P2 | Evidence / Release Claim Binder | 86 NOT_RUN gates cannot be used as GitHub claims | rerun owner commands only when those claims are needed |

边界说明：

1. 本轮没有改变工具执行、provider、MCP、Agent、permission 的真实 runtime，只增加消费验收证据。
2. `scoreFloor` 继续保持 72；dashboard 只变得更可操作，不替代 public comparable raw evidence。
3. `release:github-launch-pack` 和 public comparable benchmark 仍是后续 release/benchmark 阶段，不是本轮默认执行项。
4. 全量 `bun test`、真实 TUI 回测、six-stage、senior window 仍放在 owner 收束稳定之后执行。

更新后的剩余工作：

| 顺序 | 工作 | 当前状态 | 下一步 |
|---:|---|---|---|
| 1 | TUI trust 真实窗口回测 | PARTIAL | 覆盖 resize、长输出、弹窗、EvidenceLine、tool card、ledger/agent compact panel，验证本轮 compact panel 是否真实可见。 |
| 2 | Query-loop live state 消费 RuntimeEvent/Ledger proof | PARTIAL | 在真实 query-loop/TUI 路径证明 verification/recovery/tool/result evidence 都进入同一 ledger/work-state，而不只是在单元测试里成立。 |
| 3 | Release claim blocker | BLOCKED | 需要处理 `DSXU_V24_GITHUB_OPEN_SOURCE_LAUNCH_PACK_20260515` 的 release claim 阻断，不能用 dashboard PASS 冒充。 |
| 4 | Public comparable raw evidence | NOT_DONE | 30 个 public comparable case 仍缺 paired raw evidence，不能写公开对标成绩。 |
| 5 | 最终全量验收 | NOT_DONE | owner 收束和真实窗口回测后再跑 `bun test`、`test:six-stage-final`、`acceptance:senior-coding-window`、SWE internal smoke。 |

### 11.20 V2 继续执行记录：Tool/Runtime Proof 投影到 Work-State Timeline - 2026-05-18

本轮把 11.19 新增的 `Tool Result Contract consumption board` 和 `Runtime Event Schema consumption proof` 接到现有 `work-state-timeline` owner。目标不是新增 TUI runtime，而是让 TUI/final report 的可见状态能消费同一份 proof。

| 项目 | 归属 owner | 执行结果 | 代码证据 |
|---|---|---|---|
| Tool Result Contract proof -> Work-State | Work-State Timeline / Tool Gate | 新增 `projectDSXUToolResultContractBoardToWorkStateEvents()`，把 ready/missing consumers、legacy shape guard、final report evidence 投成 `evidence` work-state event。 | `src/dsxu/engine/work-state-timeline.ts`、`src/dsxu/engine/__tests__/work-state-timeline.test.ts` |
| Runtime Event Schema proof -> Work-State | Work-State Timeline / Runtime Event | 新增 `projectDSXURuntimeEventConsumptionProofToWorkStateEvents()`，把 present/missing event kinds、invalid event guard、final report evidence 投成 `evidence` work-state event。 | `src/dsxu/engine/work-state-timeline.ts`、`src/dsxu/engine/__tests__/work-state-timeline.test.ts` |

Focused 验证：

```bash
bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts -t "consumption proofs"
bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts
```

结果：

| 命令 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts -t "consumption proofs"` | 初次失败：timeline 缺 model/cost/cache state；补齐成本可见项后 PASS，1/1 |
| `bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts` | PASS，10/10 |

真实修正记录：

1. 第一次 focused test 没通过，原因是 proof event + tool event + source truth 不足以让 work-state timeline PASS；当前 gate 还要求 model/cost/cache 可见状态。
2. 没有放松 gate，也没有改成最小验收；测试场景补充 `DeepSeek Model Router / Cost Evidence` cost/cache event 后通过。
3. 这说明 V2 的可见状态规则仍在工作：即使 proof 正确，也不能绕过 source/tool/cost/evidence/next action 的完整可见链。

更新后的剩余工作：

| 顺序 | 工作 | 当前状态 | 下一步 |
|---:|---|---|---|
| 1 | TUI trust 真实窗口回测 | PARTIAL | 用真实 DSXU 窗口验证 trust line、ledger/agent/tool/evidence compact panel、resize/长输出/弹窗是否仍稳定。 |
| 2 | Query-loop live state 消费 proof | PARTIAL | 在真实 query-loop 运行中证明 proof event 能进 `dsxuTrustState` / footer，而不是只在 work-state 单元测试里成立。 |
| 3 | Release claim blocker | BLOCKED | `DSXU_V24_GITHUB_OPEN_SOURCE_LAUNCH_PACK_20260515` 仍 blocked；需要后续 release claim 文案/证据处理。 |
| 4 | Public comparable raw evidence | NOT_DONE | 30 个 public comparable case 缺 paired raw evidence；不能公开写对标成绩。 |
| 5 | 最终全量验收 | NOT_DONE | owner 收束和真实窗口回测后再跑全量。 |

### 11.21 V2 继续执行记录：Query-loop live proof 消费与短显示去重 - 2026-05-18

本轮处理 11.20 的真实漏项：`Tool/Runtime proof` 不能只停在 `work-state-timeline` 单测里，必须进入 query-loop live state 和默认 TUI trust 投影。执行仍遵守 owner-folded：不新增主链、不新增 runtime、不新增 package 入口。

| 项目 | 归属 owner | 执行结果 | 代码证据 |
|---|---|---|---|
| EvidenceLine 默认可见 | System message / TUI evidence projection | `DSXU final usage evidence` 不再被非 verbose info-message 规则隐藏，而是渲染为一行 compact EvidenceLine。 | `src/components/messages/SystemTextMessage.tsx` |
| Query-loop live proof 消费 | Query loop / TUI trust projection | 新增 `buildDsxuToolRuntimeTrustProof()`，从最新 provider `tool_result` 归一为 canonical `ToolCallResult`，生成 live `tool` + `runtime event` proof，并写入 `dsxuTrustState.proof`。 | `src/query.ts`、`src/state/AppStateStore.ts` |
| Footer 短显示与去重 | Prompt footer / visible state | footer 只显示一行 proof 摘要，例如 `proof:tool ok 3/3 | event ok 2/2`；异常只列前 2 个 missing，再用 `+N`，避免长 evidence 重复刷屏。 | `src/components/PromptInput/PromptInputFooter.tsx` |

Focused 验证：

```bash
bun test src/components/PromptInput/__tests__/PromptInputFooter-trust.test.ts
bun test src/components/messages/__tests__/SystemTextMessage-evidence-line.test.ts
bun test src/dsxu/engine/__tests__/direct-connect-and-query-contract-v1.test.ts -t "live trust proof"
```

结果：

| 命令 | 结果 |
|---|---|
| `bun test src/components/PromptInput/__tests__/PromptInputFooter-trust.test.ts` | PASS，6/6 |
| `bun test src/components/messages/__tests__/SystemTextMessage-evidence-line.test.ts` | PASS，2/2 |
| `bun test src/dsxu/engine/__tests__/direct-connect-and-query-contract-v1.test.ts -t "live trust proof"` | 初次失败：runtime proof event 缺 `schemaVersion/eventId/timestamp`；补成完整 `dsxu.runtime-event.v1` 后 PASS，1/1 |

真实修正记录：

1. 没有把 proof 长内容塞进 TUI；长证据仍留在 evidence/final report，footer 只显示短状态。
2. 没有重复 route/cost/cache；这些仍由主 trust line 负责，proof line 只显示 tool/runtime contract 状态。
3. 没有放松测试；第一次失败暴露 runtime event 不完整，已按 schema 补齐。

更新后的剩余工作：

| 顺序 | 工作 | 当前状态 | 下一步 |
|---:|---|---|---|
| 1 | TUI trust 真实窗口回测 | PARTIAL | 用真实 DSXU 窗口覆盖 resize、长输出、弹窗、EvidenceLine、tool card、ledger/agent/proof compact panel。 |
| 2 | Tool boundary 写入 durable ledger | PARTIAL | 当前 live proof 进入 `dsxuTrustState`；后续验证是否需要把同一事件持久写入默认 long-task ledger。 |
| 3 | Release claim blocker | BLOCKED | `DSXU_V24_GITHUB_OPEN_SOURCE_LAUNCH_PACK_20260515` 仍 blocked；不能用 focused tests 解除。 |
| 4 | Public comparable raw evidence | NOT_DONE | 30 个 public comparable case 缺 paired raw evidence；不能公开写对标成绩。 |
| 5 | 最终全量验收 | NOT_DONE | owner 收束和真实窗口回测后再跑全量。 |

### 11.22 V2 继续执行记录：TUI trust 真实窗口 PTY resize 回测 - 2026-05-18

本轮处理 11.21 的真实窗口漏项：`EvidenceLine`、ledger/agent/proof compact panel 不能只在组件单测里通过，必须放进真实 DSXU TUI PTY 场景，覆盖长输出、窗口 resize、scrollback 和 permission dialog。实现仍只折叠到现有 owner：`REPL` harness、`AppState` trust projection、`PromptInputFooter`、`SystemTextMessage`、`real-tui-harness`。

| 项目 | 归属 owner | 执行结果 | 代码证据 |
|---|---|---|---|
| Trust proof replay 场景 | Real TUI harness / REPL harness | 新增 `trustProofReplay` harness option，只在 `DSXU_CODE_TUI_HARNESS_TRUST_PROOF_REPLAY=1` 时注入一条 EvidenceLine 和一组 `dsxuTrustState`，不影响真实默认用户流程。 | `src/dsxu/integration/harness/real-tui-harness.ts`、`src/screens/REPL.tsx` |
| EvidenceLine + compact panel 真实可见 | TUI visible-state projection | 真实 PTY transcript 会检测 `Evidence: deepseek-v4-flash`、`DSXU: Flash`、`task:verify`、`agent:1`、`proof:tool ok 3/3 | event ok 2/2`，并确认 resize 后 proof line 仍可见。 | `src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts` |
| 防重复刷屏与体验回归 | Real TUI harness scanner | scanner 记录 `dsxuTrustProofLineCount` 和 `sawDsxuTrustProofFlood`，避免 compact proof 因重绘变成长内容洪泛；同时复跑 permission dialog 和 middle scrollback resize。 | `src/dsxu/integration/harness/real-tui-harness.ts` |

Focused 真实窗口验证：

```bash
bun test src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts -t "keeps DSXU trust proof"
bun test src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts -t "keeps permission review"
bun test src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts -t "preserves a middle scrollback"
```

结果：

| 命令 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts -t "keeps DSXU trust proof"` | PASS，真实 PTY 21.3s，21 个断言 |
| `bun test src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts -t "keeps permission review"` | PASS，真实 PTY 21.9s，20 个断言 |
| `bun test src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts -t "preserves a middle scrollback"` | PASS，真实 PTY 22.5s，17 个断言 |

真实修正记录：

1. 没有新增主链、runtime、权限层或 package 入口；新增内容只是现有真实窗口 harness 的验收场景。
2. 本轮专门覆盖用户反馈的体验问题：长内容后 resize 不应跳顶；permission review 弹窗 resize 后边框和确认问题不能丢；EvidenceLine/proof/ledger/agent 状态不能长刷屏。
3. `trustProofReplay` 是 harness-only，不会让普通用户启动 DSXU 时出现测试 marker。

更新后的剩余工作：

| 顺序 | 工作 | 当前状态 | 下一步 |
|---:|---|---|---|
| 1 | Tool boundary 写入 durable ledger | PARTIAL | 当前 proof 已进入 live TUI trust state；下一步审计是否需要把同一 canonical tool/runtime event 持久写入默认 long-task ledger。 |
| 2 | Evidence Workbench release/trust 面板 | PARTIAL | 当前 dashboard 有 action items；后续继续把 release blocker、public comparable raw evidence、live window evidence 做成更可操作的 trust 面板。 |
| 3 | Release claim blocker | BLOCKED | `DSXU_V24_GITHUB_OPEN_SOURCE_LAUNCH_PACK_20260515` 仍 blocked；不能用 focused tests 解除。 |
| 4 | Public comparable raw evidence | NOT_DONE | 30 个 public comparable case 缺 paired raw evidence；不能公开写对标成绩。 |
| 5 | 最终全量验收 | NOT_DONE | owner 收束稳定后再跑 `bun test`、`test:six-stage-final`、`acceptance:senior-coding-window`。 |

### 11.23 V2 继续执行记录：Query-loop Tool Boundary 写入 durable progress ledger - 2026-05-18

本轮处理 11.22 后的下一项：`Tool boundary` 不能只进入 live TUI trust state，还要在 query-loop 主链的 `tool_result` 事件里带同一份 durable progress ledger 证据。实现仍归入现有 owner：`Query Loop`、`Progress Ledger`、`Tool Gate / Query Loop`，没有新增 ledger runtime。

| 项目 | 归属 owner | 执行结果 | 代码证据 |
|---|---|---|---|
| Query-loop progress ledger 升级 | Query Loop / Progress Ledger | query-loop 启动时创建真实 `ProgressLedger`，并先写入 `goal` runtime event；state transition 继续更新同一个 ledger，而不是每次创建临时 skeleton。 | `src/dsxu/engine/query-loop.ts` |
| Model/cost/cache 写入同一 ledger | DeepSeek Model Router / Cost Evidence | 每轮 `model_called` 前写入 `model-route` event；收到 usage 后写入 `cost-cache` event，保留 input/output/cache 证据。 | `src/dsxu/engine/query-loop.ts` |
| Tool result 写入 durable ledger | Tool Gate / Query Loop | `tool_result` metadata 现在携带 `progressLedger`；每个 tool result 先归一为 canonical `dsxu.tool-call-result.v1`，再投成 `dsxu.runtime-event.v1` 的 `tool` event。 | `src/dsxu/engine/query-loop.ts`、`src/dsxu/engine/types.ts` |

Focused 验证：

```bash
bun test src/dsxu/engine/__tests__/work-package-i/query-loop-progress-ledger.test.ts -t "canonical tool/runtime"
bun test src/dsxu/engine/__tests__/work-package-i/query-loop-progress-ledger.test.ts
```

结果：

| 命令 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/work-package-i/query-loop-progress-ledger.test.ts -t "canonical tool/runtime"` | PASS，1/1，13 个断言 |
| `bun test src/dsxu/engine/__tests__/work-package-i/query-loop-progress-ledger.test.ts` | PASS，3/3，31 个断言 |

真实修正记录：

1. 没有新增第二套 ledger；复用 `createProgressLedger()`、`appendLedgerEvent()`、`projectToolCallResultToLedgerEvent()`。
2. 没有把完整 tool output 持久塞进 ledger；ledger 只保存 schema、tool、ok、executor、duration、outputChars 等可审计摘要。
3. 现有测试暴露了旧 memory extraction mock 的控制台错误日志，但测试仍 PASS；这不是本轮改动引入的失败，后续若要清理应归到 Memory / Compact / Session Pipeline owner。

更新后的剩余工作：

| 顺序 | 工作 | 当前状态 | 下一步 |
|---:|---|---|---|
| 1 | Evidence Workbench release/trust 面板 | PARTIAL | 把 live TUI evidence、ledger evidence、release blocker、public comparable raw evidence 汇入更可操作的 trust 面板。 |
| 2 | Release claim blocker | BLOCKED | `DSXU_V24_GITHUB_OPEN_SOURCE_LAUNCH_PACK_20260515` 仍 blocked；不能用 focused tests 解除。 |
| 3 | Public comparable raw evidence | NOT_DONE | 30 个 public comparable case 缺 paired raw evidence；不能公开写对标成绩。 |
| 4 | Memory extraction test noise | REVIEW | `query-loop-progress-ledger.test.ts` 仍有旧 memory extraction mock 日志，当前不阻断 PASS，但后续可按 owner 收口。 |
| 5 | 最终全量验收 | NOT_DONE | owner 收束稳定后再跑 `bun test`、`test:six-stage-final`、`acceptance:senior-coding-window`。 |

### 11.24 V2 继续执行记录：Evidence Workbench 消费 V2 runtime trust evidence - 2026-05-18

本轮处理 11.23 后的 Evidence Workbench 漏项：真实 TUI / durable ledger focused evidence 不能只写在 V2 文档里，必须进入 `docs/generated`，让 dashboard/release trust panel 能统一消费。实现没有提高 scoreFloor，也没有把内部 smoke 写成公开 benchmark。

| 项目 | 归属 owner | 执行结果 | 代码证据 |
|---|---|---|---|
| V2 runtime trust evidence pack | Evidence / Release Claim Binder | 新增 `DSXU_V2_RUNTIME_TRUST_EVIDENCE_20260518.json`，记录真实 PTY trust proof、permission resize、scrollback resize、query-loop durable ledger 四组 focused 证据。 | `docs/generated/DSXU_V2_RUNTIME_TRUST_EVIDENCE_20260518.json` |
| Dashboard 聚合 | Evidence Workbench | 重新运行 `evidence:dashboard` 后，dashboard 读取 127 个 evidence 文件，PASS 从 39 变 40，FAIL 仍 0，BLOCKED 仍 1，NOT_RUN 仍 86，scoreFloor 仍 72。 | `docs/generated/DSXU_EVIDENCE_DASHBOARD_20260518.json` |
| 公开 claim 边界 | Release Claim Binder | dashboard 仍显示 `releaseTrustPanel.status=blocked`，`publicComparableMissingCases=30`，没有把 V2 focused evidence 升格为公开对标数据。 | `scripts/dsxu-evidence-dashboard.ts` |

Focused 验证：

```bash
bun run evidence:dashboard
bun test scripts/__tests__/dsxu-evidence-dashboard.test.ts
```

结果：

| 命令 | 结果 |
|---|---|
| `bun run evidence:dashboard` | PASS；scoreFloor=72，evidenceFiles=127，pass=40，fail=0，blocked=1，notRun=86，parseErrors=0 |
| `bun test scripts/__tests__/dsxu-evidence-dashboard.test.ts` | PASS，4/4，22 个断言 |

真实修正记录：

1. V2 runtime trust evidence 是 focused owner evidence，不是 public comparable benchmark evidence。
2. Workbench 仍保留硬阻断：GitHub launch pack blocked、30 个 public comparable raw cases missing、86 个 NOT_RUN 不能写进 README claim。
3. 本轮没有新增 dashboard 入口；继续使用既有 `evidence:dashboard` owner script。

更新后的剩余工作：

| 顺序 | 工作 | 当前状态 | 下一步 |
|---:|---|---|---|
| 1 | Release claim blocker | BLOCKED | `DSXU_V24_GITHUB_OPEN_SOURCE_LAUNCH_PACK_20260515` 仍 blocked；需要处理 release claim 文案/证据边界，不能靠 focused tests 解除。 |
| 2 | Public comparable raw evidence | NOT_DONE | 30 个 public comparable case 缺 paired raw evidence；要补真实 paired raw evidence 才能写公开对标数据。 |
| 3 | Memory extraction test noise | REVIEW | `query-loop-progress-ledger.test.ts` 有旧 memory extraction mock 日志；当前不阻断 PASS，后续按 Memory / Compact / Session owner 收口。 |
| 4 | 最终全量验收 | NOT_DONE | 上述 owner 收束稳定后再跑 `bun test`、`test:six-stage-final`、`acceptance:senior-coding-window`。 |

### 11.25 V2 继续执行记录：Progress-ledger focused test 噪声收口 - 2026-05-18

本轮处理 11.24 剩余 REVIEW 项：`query-loop-progress-ledger.test.ts` 的目标是验证 query-loop progress ledger，不应触发 session memory / memory extraction 旁路日志。实现只改测试配置，不改产品主链。

| 项目 | 归属 owner | 执行结果 | 代码证据 |
|---|---|---|---|
| 非目标 memory 旁路关闭 | Memory / Compact / Session Pipeline test boundary | 在 progress-ledger focused test 的 `minimalConfig` 中关闭 `sessionSummary`、`sessionMemory`、`memoryExtraction`，让测试只覆盖 progress ledger 主目标。 | `src/dsxu/engine/__tests__/work-package-i/query-loop-progress-ledger.test.ts` |

Focused 验证：

```bash
bun test src/dsxu/engine/__tests__/work-package-i/query-loop-progress-ledger.test.ts
```

结果：

| 命令 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/work-package-i/query-loop-progress-ledger.test.ts` | PASS，3/3，31 个断言；旧 memory extraction split error 日志已消失 |

更新后的剩余工作：

| 顺序 | 工作 | 当前状态 | 下一步 |
|---:|---|---|---|
| 1 | Release claim blocker | BLOCKED | `DSXU_V24_GITHUB_OPEN_SOURCE_LAUNCH_PACK_20260515` 仍 blocked；需要处理 release claim 文案/证据边界，不能靠 focused tests 解除。 |
| 2 | Public comparable raw evidence | NOT_DONE | 30 个 public comparable case 缺 paired raw evidence；要补真实 paired raw evidence 才能写公开对标数据。 |
| 3 | 最终全量验收 | NOT_DONE | release/public comparable owner 收束稳定后再跑 `bun test`、`test:six-stage-final`、`acceptance:senior-coding-window`。 |

### 11.26 V2 继续执行记录：Release Claim Pack 文案收口与 Workbench 短输出 - 2026-05-18

本轮处理 11.25 后的第一硬项：`DSXU_V24_GITHUB_OPEN_SOURCE_LAUNCH_PACK_20260515` 不能因为 focused owner evidence 通过就解除 blocked，但它的 release 文案必须真实、短、无矛盾。实现仍归入 `Evidence / Release Claim Binder` owner，没有新增 release runtime、benchmark runtime 或 package 入口。

| 项目 | 归属 owner | 执行结果 | 代码证据 |
|---|---|---|---|
| Launch pack 接入 V2 runtime trust evidence | Evidence / Release Claim Binder | `release:github-launch-pack` 现在读取 `DSXU_V2_RUNTIME_TRUST_EVIDENCE_20260518.json`，把真实 PTY resize、permission dialog、scrollback、query-loop durable ledger 作为 focused 产品证据写入 metrics/allowed claims。 | `scripts/dsxu-v24-github-open-source-launch-pack.ts`、`docs/generated/DSXU_V24_GITHUB_OPEN_SOURCE_LAUNCH_PACK_20260515.json` |
| Public comparable raw evidence 边界显式化 | Evidence / Benchmark / Public Comparable | launch pack 读取 `DSXU_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_20260518.json`，输出 `0/30` paired raw evidence ready、`30` missing，继续禁止 public-comparable / external win-loss claim。 | `scripts/dsxu-v24-github-open-source-launch-pack.ts`、`docs/DSXU_V24_GITHUB_OPEN_SOURCE_LAUNCH_PACK_20260515.md` |
| Release blocked 文案修正 | Release Claim Binder | 移除旧的矛盾文案：final preflight 已 PASS 时不再写“因为 final preflight PASS 所以不能 release-ready”。当前 blocker 只保留真实阻断：scoreFloor 72、public comparable raw 缺失、高缓存 ROI 与外部胜出 claim 禁止。 | `docs/DSXU_V24_GITHUB_OPEN_SOURCE_LAUNCH_PACK_20260515.md` |
| Evidence Workbench 短输出 | Evidence Workbench | `bun run evidence:dashboard` 默认只打印短摘要：scoreFloor、trust、gate summary、actionItems、dataStillNeeded；完整 JSON 仍写入 `docs/generated`，需要时用 `--json` 输出。 | `scripts/dsxu-evidence-dashboard.ts` |

Focused 验证：

```bash
bun build scripts/dsxu-v24-github-open-source-launch-pack.ts --target=bun --outdir .dsxu/trace/v2-launch-pack-build-check
bun build scripts/dsxu-evidence-dashboard.ts --target=bun --outdir .dsxu/trace/v2-dashboard-build-check
bun run release:github-launch-pack
bun run evidence:dashboard
bun test scripts/__tests__/dsxu-evidence-dashboard.test.ts
```

结果：

| 命令 | 结果 |
|---|---|
| `bun build scripts/dsxu-v24-github-open-source-launch-pack.ts --target=bun --outdir .dsxu/trace/v2-launch-pack-build-check` | PASS |
| `bun build scripts/dsxu-evidence-dashboard.ts --target=bun --outdir .dsxu/trace/v2-dashboard-build-check` | PASS |
| `bun run release:github-launch-pack` | `BLOCKED_FOR_PUBLIC_95_RELEASE_CLAIM`，`githubOpenSourcePackReady=true`，`public95ClaimAllowed=false`，`scoreFloor=72` |
| `bun run evidence:dashboard` | PASS，短输出；`pass=40`、`fail=0`、`blocked=1`、`notRun=86`、`publicComparableMissingCases=30` |
| `bun test scripts/__tests__/dsxu-evidence-dashboard.test.ts` | PASS，4/4，22 个断言 |

真实修正记录：

1. 没有把 release blocker 改成 PASS；当前 GitHub launch pack 仍被 95/public-comparable claim gate 正确阻断。
2. 没有把 30 个 public comparable manifest-ready case 冒充 raw benchmark；launch pack 和 dashboard 都明确显示 `0/30 ready`。
3. 没有重复长显示；dashboard 默认输出压成短 Workbench 摘要，完整证据继续落 JSON。

更新后的剩余工作：

| 顺序 | 工作 | 当前状态 | 下一步 |
|---:|---|---|---|
| 1 | Public comparable raw evidence | NOT_DONE | 30 个 public comparable case 缺真实 paired raw evidence；只有导入/生成同题 raw transcript、tool trace、final report、artifact、cost/cache 后，才能解除 public-comparable claim blocker。 |
| 2 | Release claim blocker | PARTIAL-BLOCKED | 文案和证据边界已收口；状态仍 blocked，因为 scoreFloor=72 且 public comparable raw evidence 缺失。 |
| 3 | 最终全量验收 | NOT_DONE | public comparable / release owner 稳定后，再跑 `bun test`、`test:six-stage-final`、`acceptance:senior-coding-window`。 |

### 11.27 V2 继续执行记录：Public Comparable Raw Evidence Intake 接入 - 2026-05-18

本轮继续处理 11.26 后的第一阻断：public comparable 不是缺固定任务 manifest，而是缺真实 raw evidence。实现只做 intake 归并，不生成、不模拟、不伪造 raw transcript。这样后续一旦导入真实 `DSXU_PUBLIC_COMPARABLE_RAW_EVIDENCE_20260518.json`，dashboard 和 launch pack 会自动重新计算 ready/missing。

| 项目 | 归属 owner | 执行结果 | 代码证据 |
|---|---|---|---|
| Dashboard 读取 raw evidence manifest | Evidence Workbench / Public Comparable | `aggregateEvidence()` 会查找 `dsxu.public-comparable-raw-evidence.v1` manifest，并在 public-comparable readiness 计算时传入；没有 raw manifest 时继续显示 30 missing。 | `scripts/dsxu-evidence-dashboard.ts` |
| Launch pack 读取 raw evidence manifest | Release Claim Binder | `release:github-launch-pack` 会读取同一 raw evidence manifest，并把 ready/missing、publicBenchmarkClaimAllowed、externalComparisonClaimAllowed 写进 metrics / Data Still Needed。 | `scripts/dsxu-v24-github-open-source-launch-pack.ts` |
| Raw intake 单测 | Evidence Workbench test | 新增测试证明：当 1 条 DSXU raw evidence 字段齐全但没有 external target transcript 时，public benchmark claim 可进入 DSXU raw ready，external comparison 仍 false。 | `scripts/__tests__/dsxu-evidence-dashboard.test.ts` |

Focused 验证：

```bash
bun test scripts/__tests__/dsxu-evidence-dashboard.test.ts
bun build scripts/dsxu-v24-github-open-source-launch-pack.ts --target=bun --outdir .dsxu/trace/v2-launch-pack-build-check-raw-intake
bun build scripts/dsxu-evidence-dashboard.ts --target=bun --outdir .dsxu/trace/v2-dashboard-build-check-raw-intake
bun run release:github-launch-pack
bun run evidence:dashboard
```

结果：

| 命令 | 结果 |
|---|---|
| `bun test scripts/__tests__/dsxu-evidence-dashboard.test.ts` | PASS，5/5，25 个断言 |
| `bun build scripts/dsxu-v24-github-open-source-launch-pack.ts --target=bun --outdir .dsxu/trace/v2-launch-pack-build-check-raw-intake` | PASS |
| `bun build scripts/dsxu-evidence-dashboard.ts --target=bun --outdir .dsxu/trace/v2-dashboard-build-check-raw-intake` | PASS |
| `bun run release:github-launch-pack` | `BLOCKED_FOR_PUBLIC_95_RELEASE_CLAIM`，`public95ClaimAllowed=false`，`scoreFloor=72` |
| `bun run evidence:dashboard` | PASS，短输出；`publicComparableMissingCases=30` |

真实修正记录：

1. 当前没有真实 `DSXU_PUBLIC_COMPARABLE_RAW_EVIDENCE_20260518.json`，所以本轮没有把 missing 改成 ready。
2. public-comparable manifest-ready 仍不算 benchmark PASS；raw intake 只是让真实证据进来以后能被消费。
3. external comparison 仍要求同题 target/reference raw transcript；只有 DSXU raw evidence 不足以写外部胜出。

更新后的剩余工作：

| 顺序 | 工作 | 当前状态 | 下一步 |
|---:|---|---|---|
| 1 | 真实 public comparable raw evidence 采集/导入 | BLOCKED-ON-REAL-RUN | 需要生成或导入 30 个 case 的 raw transcript、tool trace、raw API response、final report、artifact、first/second/final pass、cost、wall-clock、cache、Pro admission、failure recovery、toolResultChars、artifact/log size。 |
| 2 | 外部/目标对比 raw evidence | OPTIONAL-BLOCKED | 只有要写 external win/loss 或对标 claim 时，才需要同题 target/reference transcript；当前仍禁止外部胜出文案。 |
| 3 | 最终全量验收 | NOT_DONE | raw evidence / release owner 稳定后，再跑 `bun test`、`test:six-stage-final`、`acceptance:senior-coding-window`。 |

### 11.28 V2 最新收口排期：VerifyGate / ToolResult / Flash-Pro Admission / Recovery Ledger - 2026-05-18

本节记录最近两轮讨论后的最新执行排序。结论：当前不要继续新增主链、入口、runner 或 UI 大组件；先把已有 owner 的硬缺口收紧，完成后再进入最终全量测试。最近两轮涉及两类问题：

1. P0/P1/P2 清单复核：`bun test` 超时分层、`ToolCallResult` 标准化、`VerifyGate` 默认策略、DeepSeek thinking/tool-call 合同、GearBox/ledger/TUI 投影。
2. Flash -> Pro 误触发/误显示问题：代码已经接入 Flash-first 路由，但 Pro admission、失败状态消费、用户 pinned Pro 与自动升级的可见区分还不够硬。

#### 11.28.1 最新事实裁决

| 项目 | 真实裁决 | 证据/原因 | V2 处理方式 |
|---|---|---|---|
| `evidence:dashboard` / `benchmark:swe-bench` scripts | 已存在，不是 P0 缺口 | `package.json` 已有对应脚本；旧“缺脚本”结论已过期 | 不再新增 package 入口，只做 command catalog / README 真值同步 |
| `ToolCallResult` 标准 | 已有基础，但还需全链唯一消费 | `tool-protocol.ts` 已有 canonical normalize；仍要防 legacy/provider/MCP shape 泄漏到消费者 | 继续用 `ToolCallResult` 作为唯一 canonical boundary，不新增协议 |
| `VerifyGate` 默认策略 | 仍是 P0 缺口 | `verify-gate.ts` 默认 `onFailure: warn`，且存在模拟分数路径 | 改成真实验证命令/证据；风险路径默认 block，普通 advisory 需明确显示不能当 PASS |
| `bun test` 长尾 | 仍是 P0 缺口 | 全量测试不应每个小改都跑，但 mainline/slow/acceptance 必须可归因 | 用现有 command catalog / final runner 分层，不新增泛化 runner |
| DeepSeek thinking + tool-call replay | 基础存在，需强化合同 | `deepseek-adapter.ts` 已保留 `reasoning_content` / `tool_calls`，但需要完整 round-trip 合同测试 | 补 focused provider contract，不新增 provider gateway |
| Flash -> Pro 路由 | 已接入，但 admission 闭环不够硬 | `query.ts` 调 `decideDeepSeekV4Route()` / `decideDeepSeekV4RuntimeModelOverride()`；`deepseek-trajectory-store.ts` 记录 request plan | 增加 Pro admission ledger / visible-state 区分，防误触发和误显示 |

#### 11.28.2 当前执行排序

| 顺序 | 优先级 | 工作 | owner | 执行要求 | 验收口径 |
|---:|---|---|---|---|---|
| 1 | P0 | VerifyGate 真实验证与失败阻断 | VerificationKernel / Tool Gate | `onFailure=block` 用于风险路径；模拟分数改为真实 command/evidence summary；无命令时输出 `needs-verification` 而不是 PASS | focused verify-gate tests；不能用 mock score 当功能通过 |
| 2 | P0 | 测试层级切分与长尾归因 | Command Catalog / Final Runner | mainline < 60s、slow、acceptance/live 分层；减少全量重复跑；失败输出 owner/命令/耗时/live-provider 状态 | 先跑 owner-focused 分组；最后才跑全量 |
| 3 | P0 | Tool Result Contract 全链唯一消费 | Tool Gate / Tool Protocol | 宣布 `ToolCallResult` 为唯一 canonical result；legacy/provider/MCP 只在边界 normalize；消费方不得直接吃旧 shape | tool-protocol consistency tests；release evidence 出现 legacy shape 必须 blocked |
| 4 | P0 | DeepSeek thinking + tool-call round-trip 合同 | DeepSeek ProviderGateway | 覆盖 assistant `reasoning_content + tool_calls` -> tool result -> next assistant；non-thinking 必须剥离 reasoning | provider focused tests；不新增 provider 层 |
| 5 | P0 | Flash -> Pro admission 硬化 | DeepSeek route/cost/cache owner | 每次 Pro 必须记录 `priorFlashAttempted`、`proAdmissionReason`、`savedTaskEvidence`；高风险/失败恢复路径同一规则 | route tests + trajectory/ledger evidence；无证据 Pro 不能写成合理升级 |
| 6 | P0 | Pro 用后回落与失败状态消费 | Query Loop / Model Route | 普通新指令默认回 Flash；`verification_passed` 必须清掉失败状态；区分 `userPinnedPro` 与 `autoUpgradeToPro` | query route focused tests；避免每次用户新指令都继承 Pro |
| 7 | P1 | GearBox + VerifySummary + FailureTaxonomy 同源 | Recovery / GearBox | `reportToolResult` 可接收 verification summary；新增/收束 failure -> gearbox decision bridge；不新建 recovery runtime | recovery/gearbox focused tests |
| 8 | P1 | Recovery decision table 投影到 ledger/TUI | Progress Ledger / Work-State | `retry/replan/rollback/ask-human/abort/escalate-model` 来自同一 decision；写入 ledger 和 compact TUI state | progress-ledger + work-state tests |
| 9 | P1 | State projection 消费路由/验证/恢复状态 | AppStateStore / operatorStateProjection | 不新建第二事件总线；折进现有 AppState / operator projection，为 Ink/TUI compact 行提供 subscribe/消费面 | Prompt footer / real TUI focused tests |
| 10 | P1 | Agent handoff schema runtime 校验 | Agent / MCP / Skill evidence | worker evidence envelope 做 runtime schema 校验；父任务不能只信自然语言 PASS | Agent/MCP/Skill focused tests |
| 11 | P2 | Ink/沉浸式组件 | TUI visible-state | 只有 StateProjection 稳定后再做 VerificationProgress / GearBoxIndicator / CostRouteIndicator / RecoveryDialog | 真实 PTY resize/permission/long-output 测试 |
| 12 | P2 | Context pressure 与 cost route 公开证据 | Context / DeepSeek cost-cache | 70/85/95/99 压力策略、Flash->Pro 成本证据、cache before/after 只能用真实 trajectory | public evidence 采集后再进入 GitHub 卖点 |

#### 11.28.3 Flash -> Pro 误触发的专门处理规则

| 场景 | 应显示 | 不允许 |
|---|---|---|
| 用户显式 `/model pro` 或配置固定 Pro | `model: Pro (user pinned)` | 显示成自动路由升级 |
| 高风险 bash / 权限敏感 / 删除 / force push | `Pro admission: approval required` | 无 approval/admission 直接切 Pro |
| Flash 验证失败后恢复 | `Pro rescue candidate`，必须有 prior Flash + admission reason + saved-task evidence | 因历史失败状态残留导致每个新指令都 Pro |
| 普通 coding / feature / bugfix | `Flash thinking high` | 被 prompt 中的“失败/恢复/验证”纪律文字误判为 recovery Pro |
| 普通 verification | `Flash non-thinking` | 从上一次 Pro 泄漏，持续 Pro |
| 路由评估为 Pro 但实际请求被 disabled/pinned 到 Flash | `route considered Pro; actual model Flash` | 把 routeDecision 当真实模型使用 |

#### 11.28.4 暂不做与最终测试规则

| 项目 | 裁决 |
|---|---|
| 新增 `scripts/regression-check.ts` | 暂不做；容易变成泛化入口。先用 command catalog / final runner 分组。 |
| 新增第二套 StateProjectionService runtime | 暂不做；只能折进 `AppStateStore` / `operatorStateProjection`。 |
| 新增 package scripts | 暂不做；除非 owner review 证明不是第二产品表面。 |
| 每个小改后跑全量 `bun test` | 暂不做；先 focused tests，大块收口后再全量。 |
| 把 focused evidence 写成 public benchmark 成绩 | 禁止；必须等真实 public comparable raw evidence。 |

最终测试放在上述 P0/P1 收口后执行，顺序为：

```bash
bun test
bun run test:six-stage-final
bun run acceptance:senior-coding-window
bun run benchmark:swe-bench -- --mode public-comparable
bun run release:github-launch-pack
bun run evidence:dashboard
```

通过口径：

1. `bun test` 全量绿，或所有剩余失败都有 owner、根因、下一步，且不能被写成 PASS。
2. `test:six-stage-final` 和 `acceptance:senior-coding-window` 真实运行，不用 focused test 冒充。
3. public comparable 只有在 raw transcript / tool trace / final report / cost / cache / Pro admission / failure recovery 字段齐全时，才允许进入公开卖点。
4. Flash-first 是默认产品纪律；Pro 只能作为有证据的 admission/rescue，不允许“每次用户发指令都切 Pro”。

### 11.29 V2 P0 执行记录：VerifyGate / Flash-Pro / ToolResult - 2026-05-18

本轮按 11.28 的 P0 顺序执行，仍坚持 owner-folded：不新增主链、不新增验证 runtime、不新增 provider 层、不新增 package 入口。

| 项目 | 本轮状态 | 代码/证据 |
|---|---|---|
| VerifyGate 真实验证 | DONE | `src/dsxu/engine/verify-gate.ts` 默认 `onFailure=block`；去掉 deterministic pseudo score；FileEdit/FileWrite 后必须有真实 verification command 或后置 Bash/PowerShell 测试证据；无证据返回 `Verification evidence is missing`，不能 PASS。 |
| VerifyGate 命令证据 | DONE | `VerifyGateConfig.verificationCommands` 支持显式原生命令；命令 stdout/stderr、exitCode、timeout 会进入 rule evidence。 |
| Flash -> Pro admission | DONE / 更硬口径 | `src/utils/model/deepseekV4Control.ts` 增加 `priorFlashAttempted`、`savedTaskEvidence`、`allowProAdmission`；失败验证 + retry 不再无条件 Pro，缺证据时保持 Flash-MAX；证据齐时才 `failed_verification_pro_thinking_max`，并写 `proAdmission` 状态。 |
| ToolResult canonical boundary | VERIFIED | 沿用现有 `ToolCallResult` / `dsxu.runtime-event.v1`；本轮没有新增协议，focused 验证证明 provider/MCP/legacy 结果只在 Tool Gate 边界 normalize，并投影到 ledger/work-state/release evidence guard。 |

本轮 focused 验证：

| 命令 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/verify-gate.test.ts` | PASS，11/11 |
| `bun test src/dsxu/engine/__tests__/quality-gate-mainline-v1.test.ts` | PASS，6/6 |
| `bun test src/dsxu/engine/__tests__/gate-integration.test.ts` | PASS，2/2 |
| `bun test src/dsxu/engine/__tests__/deepseek-v4-control-v1.test.ts` | PASS，26/26 |
| `bun test src/dsxu/engine/__tests__/route-cache-roi-smoke.test.ts` | PASS，2/2 |
| `bun test src/dsxu/engine/__tests__/route-cache-dynamic-tail.test.ts` | PASS，2/2 |
| `bun test src/dsxu/engine/__tests__/deepseek-cost-quality-board.test.ts` | PASS，4/4 |
| `bun test src/dsxu/engine/__tests__/tool-lifecycle-contract-v1.test.ts` | PASS，3/3 |
| `bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts -t "canonical ToolCallResult\|tool-result and runtime-event"` | PASS，2/2 |
| `bun test src/dsxu/engine/__tests__/tool-protocol/consistency.test.ts -t "canonical ToolCallResult"` | PASS，4/4 |

剩余 P0/P1：

| 顺序 | 工作 | 状态 |
|---:|---|---|
| 1 | DeepSeek thinking + tool-call round-trip 合同：assistant `reasoning_content + tool_calls` -> tool result -> next assistant，non-thinking 不携带 reasoning。 | TODO |
| 2 | 测试层级 / 长尾归因：mainline、slow、acceptance/live 分层，失败输出 owner/命令/耗时/live-provider 状态。 | TODO |
| 3 | Recovery decision table：GearBox + VerifySummary + FailureTaxonomy + ledger/TUI 同源。 | TODO |
| 4 | State projection：只折进现有 `AppStateStore` / operator projection，不新增第二套 StateProjectionService runtime。 | TODO |
| 5 | Brand/public surface + release export：README/help/TUI/package/release artifact 不带参考品牌、不带 key，V* 内部证据不直接当 GitHub 首页材料。 | TODO |
| 6 | 真实 TUI resize/长内容/弹窗回归：PTY rows/cols 专测 + 真实窗口体验测试。 | TODO |

### 11.30 V2 P0 执行记录：VerifyGate 调用面 / DeepSeek provider 合同 - 2026-05-18

本轮继续按 11.28/11.29 的顺序推进，重点不是加新模块，而是让旧集成面接受“编辑后必须有真实验证证据”的新默认规则。

| 项目 | 本轮状态 | 代码/证据 |
|---|---|---|
| VerifyGate 调用面收束 | DONE | `coding-pack-integration.test.ts`、`abc-end-to-end.test.ts` 从旧的乱码/模拟 PASS 用例改为清晰的 A/B/C 与 Coding Pack 集成验收；FileEdit 后必须出现 post-edit Bash verification evidence，缺证据路径只允许作为 warn/continue 场景。 |
| Checks-as-Rules 调用面 | DONE | `work-package-9a-c/verify-review-chain-integration.test.ts` 增加真实 verification event，`syntax-check-001` / `verification-001` 只在有 post-edit evidence 时出现。 |
| VerifyGate 命令防御 | DONE | `verify-gate.ts` 对空命令数组增加失败 evidence，避免空 command 走 spawn 异常路径。 |
| DeepSeek thinking/tool-call provider 合同 | DONE / focused | `deepseek-adapter-cache-prefix-v1.test.ts` 强化合同：thinking enabled 时保留 `reasoning_content + tool_calls + tool result`；non-thinking 仍保留 tool-call replay，但不得携带 reasoning 文本，避免污染 DeepSeek prefix/cache。 |

本轮 focused 验证：

| 命令 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/verify-gate.test.ts src/dsxu/engine/__tests__/quality-gate-mainline-v1.test.ts src/dsxu/engine/__tests__/gate-integration.test.ts src/dsxu/engine/__tests__/coding-pack-integration.test.ts src/dsxu/engine/__tests__/abc-end-to-end.test.ts src/services/api/deepseek-adapter-cache-prefix-v1.test.ts` | PASS，31/31 |
| `bun test src/dsxu/engine/__tests__/work-package-9a-c/verify-review-chain-integration.test.ts` | PASS，7/7 |

11.30 后剩余 P0/P1：

| 顺序 | 工作 | 状态 |
|---:|---|---|
| 1 | 测试层级 / 长尾归因：mainline、slow、acceptance/live 分层，失败输出 owner/命令/耗时/live-provider 状态。 | TODO |
| 2 | Recovery decision table：GearBox + VerifySummary + FailureTaxonomy + ledger/TUI 同源。 | TODO |
| 3 | State projection：只折进现有 `AppStateStore` / operator projection，不新增第二套 StateProjectionService runtime。 | TODO |
| 4 | Brand/public surface + release export：README/help/TUI/package/release artifact 不带参考品牌、不带 key，V* 内部证据不直接当 GitHub 首页材料。 | TODO |
| 5 | 真实 TUI resize/长内容/弹窗回归：PTY rows/cols 专测 + 真实窗口体验测试。 | TODO |

### 11.31 V2 P0 执行记录：测试分层 / 长尾归因 / live-provider 状态 - 2026-05-18

本轮继续处理“减少全量测试、先按 owner 聚焦”的执行要求。没有新增 `test:mainline`、`regression-check` 或其它泛化入口，只在现有 command catalog 和 six-stage runner 里补归因字段。

| 项目 | 本轮状态 | 代码/证据 |
|---|---|---|
| Command Catalog 测试分层 | DONE | `scripts/dsxu-command-catalog.ts` 的 owner-focused groups 增加 `testTier`、`timeoutBudgetMs`、`liveProvider`；mainline group 明确 `<60s` 预算，TUI 是 acceptance，release 是 release-only。 |
| Six-stage 长尾归因 | DONE / compile verified | `scripts/dsxu-v24-six-stage-final-tests.ts` 的 command result、owner summary、failure attribution 增加 `testTier`、`liveProvider`、`durationMs`；失败表直接显示 owner/命令/耗时/live-provider 状态。 |
| Command catalog evidence refresh | DONE | 运行 `bun run scripts/dsxu-command-catalog.ts`，生成 `docs/generated/DSXU_COMMAND_CATALOG_20260518.json` 与 `docs/DSXU_COMMAND_CATALOG_20260518.md`，scriptCount=118。 |

本轮 focused 验证：

| 命令 | 结果 |
|---|---|
| `bun test scripts/__tests__/dsxu-command-catalog.test.ts` | PASS，3/3 |
| `bun build scripts/dsxu-v24-six-stage-final-tests.ts --target=bun --outfile=tmp/dsxu-v24-six-stage-final-tests-check.js` | PASS，compile-only；临时产物已移除 |
| `bun run scripts/dsxu-command-catalog.ts` | PASS，`PASS_DSXU_COMMAND_CATALOG_READY` |

11.31 后剩余 P0/P1：

| 顺序 | 工作 | 状态 |
|---:|---|---|
| 1 | Recovery decision table：GearBox + VerifySummary + FailureTaxonomy + ledger/TUI 同源。 | TODO |
| 2 | State projection：只折进现有 `AppStateStore` / operator projection，不新增第二套 StateProjectionService runtime。 | TODO |
| 3 | Brand/public surface + release export：README/help/TUI/package/release artifact 不带参考品牌、不带 key，V* 内部证据不直接当 GitHub 首页材料。 | TODO |
| 4 | 真实 TUI resize/长内容/弹窗回归：PTY rows/cols 专测 + 真实窗口体验测试。 | TODO |

### 11.32 V2 P0 执行记录：Recovery / GearBox 主链收束 - 2026-05-18

本轮按用户要求修正方向：不做 `failure-taxonomy -> gear-box` 这种桥接/映射函数，不新增恢复 runtime。改为把 VerifyGate 失败摘要直接纳入现有 `Recovery / GearBox` owner，GearBox 自己消费验证摘要、产出 canonical `RecoveryDecision`，并继续由 ProgressLedger/TUI/final report 消费同一条主链结果。

| 项目 | 本轮状态 | 代码/证据 |
|---|---|---|
| GearBox 消费 VerifyGate 摘要 | DONE | `src/dsxu/engine/gear-box.ts` 新增 `reportVerificationSummary()`；通过 `passed/score/findings/policy/failedAttemptsSinceProgress/command` 直接决定 `retry/replan/rollback`，并写入 `lastRecoveryDecision`。 |
| StepGearBox 主接口补齐 | DONE | `src/dsxu/engine/types.ts` 增加 `GearVerificationSummary`、`GearVerificationContext`、`lastRecoveryDecision`，并把 `reportVerificationSummary()` / `applyRecoveryDecision()` 纳入 `StepGearBox`。 |
| 非桥接原则 | DONE | 本轮没有新增 `applyNormalizedFailureToGearBox()`，没有新建 StateProjectionService，没有新增恢复入口；旧 taxonomy 仍只是失败分类素材，恢复决策以 GearBox 为唯一 owner。 |
| Ledger/TUI 现有能力复核 | VERIFIED | `progress-ledger.ts` 既有 `recordVerificationRecoveryDecision()`、`buildLongTaskLedgerProjection()`、`buildDurableLedgerRecoveryProof()`、`buildRuntimeEventSchemaConsumptionProof()` 聚焦测试通过；本轮未新增第二套 ledger。 |

本轮 focused 验证：

| 命令 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/gear-box.test.ts` | PASS，11/11 |
| `bun test src/dsxu/engine/__tests__/gear-box-recovery-link-v1.test.ts src/dsxu/engine/__tests__/query-loop-gear-box-recovery-v1.test.ts` | PASS，9/9 |
| `bun test src/dsxu/engine/__tests__/work-package-i/progress-ledger.test.ts` | PASS，26/26 |

11.32 后剩余 P0/P1：

| 顺序 | 工作 | 状态 |
|---:|---|---|
| 1 | State projection：只折进现有 `AppStateStore` / operator projection，不新增第二套 StateProjectionService runtime。 | TODO |
| 2 | Brand/public surface + release export：README/help/TUI/package/release artifact 不带参考品牌、不带 key，V* 内部证据不直接当 GitHub 首页材料。 | TODO |
| 3 | 真实 TUI resize/长内容/弹窗回归：PTY rows/cols 专测 + 真实窗口体验测试。 | TODO |

### 11.33 V2 新增优先 P0：DSXU Interaction Shell 交互壳收束 - 2026-05-18

本节纳入最近真实窗口问题后的最新裁决：DSXU 当前不应再新增第二套 UI、第二套交互 runtime 或新的 bridge/facade。真实问题不是“缺 UI”，而是主 TUI 交互权威分散：`REPL.tsx`、`FullscreenLayout`、`PromptInput`、`promptOverlayContext`、`overlayContext`、权限弹窗、`toolJSX`、remote/structured IO 都在消费交互状态，但 slot、scroll、dialog priority、tool result display 还没有形成一条不可绕过的产品交互契约。

#### 11.33.1 裁决

| 方向 | 裁决 |
|---|---|
| 是否做第二套 UI | 禁止。只保留 `REPL / FullscreenLayout / AppState / PromptInput` 作为唯一主产品 UI owner。 |
| 是否新增 StateProjectionService / UI runtime | 禁止。只能折进现有 `AppStateStore`、`REPL`、`FullscreenLayout`、`PromptInputFooter`、tool UI owner。 |
| remote / bridge / structured IO | 只能做同源投影，不能渲染本地 JSX、不能自成权限弹窗、不能解释第二套 UI 状态。 |
| 测试顺序 | 先修 Interaction Shell，再做真实 TUI PTY resize/long-output/dialog focused tests，最后才跑全量测试。 |

#### 11.33.2 Interaction Shell 固定契约

| 契约 | owner | 要求 |
|---|---|---|
| 主 UI owner | `src/screens/REPL.tsx`、`src/components/FullscreenLayout.tsx`、`src/state/AppStateStore.ts`、`src/components/PromptInput/*` | 所有可交互 UI 必须进入主 TUI 定义的槽位。 |
| 固定槽位 | `REPL` / `FullscreenLayout` | 只允许 `transcript`、`blockingDialog`、`nonBlockingOverlay`、`bottomStatus`、`centerModal` 五类；禁止 local-jsx 随意选择位置。 |
| Scroll policy | `REPL` / `ScrollBox` | 区分 `live-bottom`、`reading-history`、`blocking-dialog`、`resize-preserve-anchor`。用户在中间阅读或放大窗口时不得跳顶/强制贴底；只有处于 live-bottom 才 auto-follow。 |
| Dialog priority | `REPL` / permission components / overlay contexts | 权限与安全确认最高优先级；恢复/审核其次；普通提示和 suggestion 不能遮挡 blocking dialog。 |
| Tool result compact card | tool UI owner / message renderer | 工具结果默认短显示：purpose/status/key output/artifact/risk；长 stdout/stderr 必须 artifact 化或折叠，不能挤爆 TUI。 |
| Remote projection | `structuredIO` / `remoteIO` / bridge services | 只消费同一份 runtime event、tool result、permission decision、`dsxuTrustState`；不做第二交互面。 |

#### 11.33.3 新的 V2 剩余执行排序

| 顺序 | 优先级 | 工作 | 当前状态 | 下一步 |
|---:|---|---|---|---|
| 1 | P0 | Interaction Shell 主 TUI 交互壳收束 | TODO | 先审 `REPL.tsx` 的 scroll、dialog、toolJSX slot、permission fallback；做 owner-folded 修复，不新建 UI runtime。 |
| 2 | P0 | 真实窗口 resize / 长内容 / 弹窗 focused 回归 | TODO | PTY rows/cols ioctl 专测，覆盖用户在中间阅读时 resize 不跳顶、blocking dialog 可见、tool card 不洪泛。 |
| 3 | P1 | Brand/public surface + release export | TODO | README/help/TUI/package/release artifact 不带参考品牌、不带 key；V* 内部证据不直接当 GitHub 首页材料。 |
| 4 | P1 | Evidence Workbench / release trust 面板短显示 | PARTIAL | 只消费真实 source/test/live/raw/cost/cache evidence；不能把 smoke/mock 写成 public claim。 |
| 5 | P2 | 最终全量测试 | NOT_DONE | 上述 owner 收束后再跑 `bun test`、`test:six-stage-final`、`acceptance:senior-coding-window`、SWE internal/public comparable 分层。 |

#### 11.33.4 验收规则

1. 本项不是新增功能卖点，而是发布前主体验稳定性修复。
2. 每个修复只跑 focused owner tests；不每个小点跑全量。
3. 真实 TUI focused tests 必须覆盖：窗口放大/缩小、长内容、scrollback 中间阅读、permission dialog、EvidenceLine、ledger/agent/proof compact panel。
4. 如果修复 scroll 导致 dialog 不见，或修复 dialog 导致 scroll 跳顶，视为 Interaction Shell 未完成，不能进入最终全量测试。
5. remote/bridge 只可投影同源状态，不能成为第二 UI 结论来源。

### 11.34 V2 P0 执行记录：Interaction Shell 第一收束 - 2026-05-18

本轮按 11.33 优先执行 Interaction Shell，不新增第二套 UI、不新增 StateProjectionService、不新增 bridge/facade。改动只归入现有主 TUI owner：`REPL.tsx`。

| 项目 | 本轮状态 | 代码/证据 |
|---|---|---|
| Blocking dialog 优先级 | DONE | `src/screens/REPL.tsx` 增加 `blockingInteractionDialogActive`，权限/审核/安全/恢复类 blocking dialog 出现时，fullscreen local-jsx center modal 不再覆盖它。 |
| Scroll policy 第一收束 | DONE | 弹窗出现/关闭不再无条件 `repinScroll()`；当用户正在 fullscreen 中间 scrollback 阅读时，记录 `scrollTop` 并在 blocking dialog 关闭后恢复，避免 resize/审核弹窗导致跳顶或强制贴底。 |
| 主 UI owner 原则 | KEPT | 没有新增 UI runtime；没有把 remote/bridge 做成第二交互面；没有新增 package 入口。 |

本轮 focused 真实 TUI 验证：

| 命令 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts -t "keeps permission review visible after long-content PTY resize\|preserves a middle scrollback reading position through real PTY resize"` | PASS：2/2，覆盖 permission review after resize 与 middle scrollback resize anchor。 |

11.34 后剩余工作：

| 顺序 | 工作 | 当前状态 | 下一步 |
|---:|---|---|---|
| 1 | Interaction Shell 第二收束：slot catalog / tool result compact card | TODO | 继续审 `toolJSX`、tool UI、message renderer，确保长输出只进 compact card/artifact，不挤爆 TUI。 |
| 2 | Brand/public surface + release export | TODO | README/help/TUI/package/release artifact 不带参考品牌、不带 key；V* 内部证据不直接当 GitHub 首页材料。 |
| 3 | Evidence Workbench / release trust 面板短显示 | PARTIAL | 只消费真实 source/test/live/raw/cost/cache evidence；不能把 smoke/mock 写成 public claim。 |
| 4 | 最终全量测试 | NOT_DONE | 上述 owner 收束后再跑 `bun test`、`test:six-stage-final`、`acceptance:senior-coding-window`、SWE internal/public comparable 分层。 |
### 11.35 V2 P0 执行记录：Interaction Shell 第二收束 - Tool Result Compact Card - 2026-05-18

本轮继续执行 11.34 后的 Interaction Shell 第二收束。原则仍然是不新增第二套 UI、不新增 tool facade、不新增 bridge/runtime；只在现有 TUI message owner 和 shell output owner 内收束。

| 项目 | 本轮状态 | 代码/证据 |
|---|---|---|
| Tool result compact card 去重 | DONE | `src/components/messages/UserToolResultMessage/utils.tsx` 改为只在 error、canonical/artifact/state 或大输出时显示 compact card；普通短结果不再额外加一行，避免 TUI 重复显示。 |
| Tool result compact card 可追溯 | DONE | compact card 输出 `tool/status/chars/lines/compact/state/canonical/artifact` 等短字段；artifact 只显示短标签，不把长 stdout/stderr 或长路径塞进状态行。 |
| 最新 shell 输出自动展开治理 | DONE | `src/components/shell/ExpandShellOutputContext.tsx` 增加 `shouldAutoExpandShellOutput()`；`src/components/Messages.tsx` 只允许短输出自动全文展开，长输出保持 compact + Ctrl-O 展开，不再把真实窗口顶乱。 |
| 单一 UI owner 原则 | KEPT | 本轮未新增 UI runtime、未新增 package 入口、未新增独立投影层；仍由 `Messages/UserToolResultMessage/OutputLine/ExpandShellOutputContext` 这些现有 owner 消费。 |

本轮 focused 验证：

| 命令 | 结果 |
|---|---|
| `bun test src/components/messages/UserToolResultMessage/__tests__/utils.test.ts` | PASS，4/4；覆盖 canonical/artifact、error state、小结果不重复、大结果 compact 且不复制长输出。 |
| `bun test src/components/shell/__tests__/ExpandShellOutputContext.test.ts` | PASS，3/3；覆盖短输出可自动展开、长字符/长行数输出保持 compact。 |
| `bun test src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts -t "keeps long-content TUI output pinned to the tail through real PTY resize\|keeps DSXU trust proof and evidence compact through real PTY resize"` | PASS，2/2；真实 PTY 覆盖长内容 resize sticky-bottom 与 trust/evidence compact。 |

11.35 后剩余工作：

| 顺序 | 工作 | 当前状态 | 下一步 |
|---:|---|---|---|
| 1 | Brand/public surface + release export | TODO | README/help/TUI/package/release artifact 查品牌、key、内部 V* 证据泄露；公开卖点只绑定真实 evidence。 |
| 2 | Evidence Workbench / release trust 面板短显示 | PARTIAL | 继续把 dashboard 从报告脚本收成可操作 trust panel：source/test/live/raw/cost/cache，不能把 smoke/mock 写成 public claim。 |
| 3 | 最终全量测试 | NOT_DONE | 上述 owner 收束后再跑 `bun test`、`test:six-stage-final`、`acceptance:senior-coding-window`、SWE internal/public comparable 分层。 |
### 11.36 V2 P1 执行记录：Brand / Public Surface / Release Hygiene - 2026-05-18

本轮继续处理 11.35 后的公开面与发布卫生。原则是不做导出、不创建 release artifact、不把内部 smoke/mock/V* 证据写成 GitHub 卖点；只跑现有 brand/public/release owner 的扫描与 focused tests。

| 项目 | 本轮状态 | 代码/证据 |
|---|---|---|
| Brand/compat risk board | PASS | `bun run evidence:brand-compat-risk` 生成最新 brand risk board：`status=DONE_EVIDENCED`，`scannedFileCount=3059`，`occurrenceCount=5748`，`publicSurfaceBlockerCount=0`，`runtimeCleanupCandidateCount=1`。 |
| Blocked claim corpus | PASS | `bun run evidence:blocked-claim-corpus` 重新生成 blocked claim corpus：`rows=958`，其中 `c2Rows=914`、`capabilityRows=44`、`hardBenchmarkRows=0`；继续阻断 reference-product parity、public 90/95、外部胜出等无 raw evidence 口径。 |
| Release/public surface tests | PASS | `brand-compat-risk-board`、`release-surface-v1`、`release-surface-source-policy-review-v1`、`open-source-package-gate`、`public-doc-truth` focused batch 全部通过，22/22。 |
| Commercial/IP release preflight | PASS_WITH_NOTICE_PENDING | `bun run commercial-ip:preflight` 输出 `ADJUDICATED_ACTIVE_BLOCKERS_0_RELEASE_NOTICE_PENDING`，`activeReviewRequiredRows=0`，`publicReleaseThirdPartyRows=0`，`didRewriteSource=false`；最终 release notice/license review 仍在最终发布前做。 |

本轮 focused 验证：

| 命令 | 结果 |
|---|---|
| `bun run evidence:brand-compat-risk` | PASS，public surface blockers = 0。 |
| `bun test src/dsxu/engine/__tests__/brand-compat-risk-board.test.ts src/dsxu/engine/__tests__/release-surface-v1.test.ts src/dsxu/engine/__tests__/release-surface-source-policy-review-v1.test.ts src/dsxu/engine/__tests__/open-source-package-gate.test.ts src/dsxu/engine/__tests__/public-doc-truth.test.ts` | PASS，22/22。 |
| `bun run evidence:blocked-claim-corpus` | PASS，blocked claim rows = 958。 |
| `bun run commercial-ip:preflight` | PASS_WITH_NOTICE_PENDING，active/public third-party blockers = 0。 |

11.36 后剩余工作：

| 顺序 | 工作 | 当前状态 | 下一步 |
|---:|---|---|---|
| 1 | Evidence Workbench / release trust 面板短显示 | PARTIAL | 继续把 dashboard 从报告脚本收成可操作 trust panel：source/test/live/raw/cost/cache，不能把 smoke/mock 写成 public claim。 |
| 2 | 最终全量测试 | NOT_DONE | Evidence Workbench 收束后再跑 `bun test`、`test:six-stage-final`、`acceptance:senior-coding-window`、SWE internal/public comparable 分层。 |
### 11.37 V2 P1 执行记录：Evidence Workbench 覆盖面收束 - 2026-05-18

本轮处理 11.36 后的 Evidence Workbench。原则是不新增第二套证据系统，不把 dashboard 变成新 runtime，只在现有 `scripts/dsxu-evidence-dashboard.ts` owner 内补强 release/trust 面板。

| 项目 | 本轮状态 | 代码/证据 |
|---|---|---|
| Evidence coverage 显式化 | DONE | `scripts/dsxu-evidence-dashboard.ts` 增加 `evidenceCoverage`，按 `sourceTest/live/raw/cost/cache` 五类显示 ready、fileCount、sampleFiles、missingAreas。 |
| Release trust panel 短显示 | DONE | CLI summary 新增一行 `coverage: sourceTest=... live=... raw=... cost=... cache=...`，保持短显示，不把完整 JSON 或长证据塞进 TUI/终端。 |
| Coverage 缺口进入 actionItems | DONE | 当五类 coverage 缺项时，Workbench 生成 `release-evidence-coverage` action item；不把缺项隐藏成 PASS，也不把 smoke/mock 升级为 public claim。 |
| 嵌套 raw/cost/cache 识别 | DONE | raw evidence manifest 的 `cases[].costUsd`、`cases[].cacheHitRatePct` 会被识别为 cost/cache coverage，避免只看顶层字段造成假缺口。 |

本轮 focused 验证：

| 命令 | 结果 |
|---|---|
| `bun test scripts/__tests__/dsxu-evidence-dashboard.test.ts` | PASS，6/6；覆盖 public comparable 不冒充 benchmark PASS、failure attribution、blocked release claim、command catalog、source/test/live/raw/cost/cache coverage。 |
| `bun run evidence:dashboard` | PASS；当前真实输出 `scoreFloor=72`、`trust=release-blocked`、`releaseClaimAllowed=false`、`coverage: sourceTest=true live=true raw=true cost=true cache=true`、`publicComparableMissingCases=30`、`parseErrors=0`。 |

当前 V2 剩余硬事实：

| 顺序 | 工作 | 当前状态 | 下一步 |
|---:|---|---|---|
| 1 | Release claim blocker | BLOCKED | Evidence Workbench 仍显示 release claim blocked；不能在 README/GitHub 写 public 90/95 或外部胜出口径。 |
| 2 | Public comparable raw evidence | BLOCKED | `publicComparableMissingCases=30`；需要真实同题 raw evidence 才能进入公开对比 claim。 |
| 3 | Not-run evidence | BLOCKED_AS_CLAIM | `notRun=86`；这些不能当 GitHub 卖点，只能保留为待复跑或内部证据。 |
| 4 | 最终全量测试 | READY_TO_RUN_AFTER_DECISION | 如果当前目标是“发布前技术回归”，可跑 `bun test`、`test:six-stage-final`、`acceptance:senior-coding-window`；如果目标是“公开对标/外部胜出 claim”，必须先补 30 个 public comparable raw cases。 |
### 11.38 V2 P1 执行记录：Release Launch Pack 诚实阻断复核 - 2026-05-18

本轮在 Evidence Workbench 收束后复跑 release launch pack owner，确认 release blocker 是真实证据不足，不是脚本坏或 dashboard 误判。

| 项目 | 本轮状态 | 代码/证据 |
|---|---|---|
| GitHub launch pack | BLOCKED_BY_PUBLIC_CLAIM_EVIDENCE | `bun run release:github-launch-pack` 成功生成 GitHub/open-source pack，但状态为 `BLOCKED_FOR_PUBLIC_95_RELEASE_CLAIM`；`githubEvidencePackReady=true`、`githubOpenSourcePackReady=true`、`public95ClaimAllowed=false`、`scoreFloor=72`。 |
| Evidence dashboard after launch pack | VERIFIED | 复跑 `bun run evidence:dashboard` 后仍为 `trust=release-blocked`、`releaseClaimAllowed=false`、`coverage: sourceTest=true live=true raw=true cost=true cache=true`、`publicComparableMissingCases=30`。 |

裁决：当前可以继续做技术回归和开源包材料，但不能写 public 90/95、外部胜出、参考产品同等/超过之类公开 claim。若要升级公开 claim，必须补真实 30 个 public comparable raw cases 和对应评分协议。

### 11.39 V2 TUI 执行记录：普通回复去除多余 Evidence 聊天行 - 2026-05-18

本轮处理真实 TUI 体验问题：普通问候或普通回复后不应额外显示 `Evidence: deepseek-v4-flash | cost=... | cache=...`。裁决是保留 route/cost/cache 证据在 trust state、timeline、report/evidence JSON 中，但不把 `DSXU final usage evidence:` 当成普通聊天消息渲染，避免回答区噪声和重复状态。

| 项目 | 本轮状态 | 代码/证据 |
|---|---|---|
| Evidence 聊天行移除 | DONE | `src/components/messages/SystemTextMessage.tsx` 中 `shouldSuppressDsxuFinalUsageEvidence()` 会拦截 `DSXU final usage evidence:`，普通聊天流不再渲染额外 Evidence 行。 |
| 证据不丢失 | KEPT | route/cost/cache 仍由 DSXU trust proof、timeline、final report、evidence dashboard 消费；本轮只改显示层，不改 provider/cost/cache 主链。 |
| 短显示原则 | KEPT | 普通回复只保留回复内容；信任状态只在 compact trust/proof 面板或 evidence/report 中展示，避免 TUI 被重复信息挤爆。 |

本轮 focused 验证：

| 命令 | 结果 |
|---|---|
| `bun test src/components/messages/__tests__/SystemTextMessage-evidence-line.test.ts` | PASS，2/2；`DSXU final usage evidence:` 不再生成聊天行。 |
| `bun test src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts -t "keeps DSXU trust proof and evidence compact through real PTY resize"` | PASS，真实 PTY 场景确认 `sawDsxuEvidenceLine=false`，同时 trust/proof 行仍可见。 |
