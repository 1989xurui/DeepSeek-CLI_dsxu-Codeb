# DSXU V8 开发文档：Adaptive Engineering Runtime

日期：2026-05-19  
状态：执行方案 / 需真实验收  
目标：在 DeepSeek V4 Flash / Flash-MAX / Pro 混合模型基础上，把 DSXU 从“能力很多”收敛成“高级程序员 90%+ 编程与复杂任务体验”的默认工程运行时。  

---

## 1. V8 核心修正

V8 不再把“工具越少越好”当结论。  
V8 的正确判断是：

> 工具总库要足够大，当前工具视野要按任务动态变化；工具数量必须通过 AB 数据确定，不能靠感觉。

当前真实代码数据：

| 项 | 当前值 | 审核方式 |
|---|---:|---|
| `DSXU_DEFAULT_MAINLINE_TOOLS` 集合大小 | 34 | `src/tools.ts` |
| `DSXU_CODE_MODE=1` 实际默认可见工具 | 27 | 本地运行 `getTools()` |
| `DSXU_CODE_MODE=1 + LSP + semantic` 可见工具 | 29 | 本地运行 `getTools()` |
| `DSXU_CODE_SIMPLE=1` 可见工具 | 3 | 本地运行 `getTools()` |
| `tool-view-compiler` 测试 | PASS | `bun test src/dsxu/engine/__tests__/tool-view-compiler.test.ts` |
| `prompt-section-router` 测试 | PASS | `bun test src/dsxu/engine/__tests__/prompt-section-router.test.ts` |

这说明两个极端都不合适：

| 极端 | 问题 |
|---|---|
| 3 个工具 | 太少，不像高级程序员工具，容易缺工具、绕 Bash、无法长任务 |
| 27 个默认工具 | 不是一定错，但对 Flash 类模型可能增加工具选择噪声、schema token、误选率 |

所以 V8 的策略不是“固定 5-8 个工具”，而是：

```text
总工具能力：40+ 保留
默认可见工具：按任务 8-27 动态调整
工具窗口：通过 AB 数据确定
专家工具：可激活，不默认塞满普通任务 prompt
Runtime 工具：系统自动调用，不要求模型直接选择
```

### 1.1 高级程序员 90%+ 能力覆盖审核

V8 的目标不是“工具更少”，而是“高级程序员式完成任务”。因此先按高级程序员的真实能力拆分，而不是按工具数量拆分。

| 高级程序员能力 | DSXU 当前覆盖 | V8 判断 | 不能过度减少的原因 |
|---|---|---|---|
| 仓库结构理解 | Read / Grep / Glob / LSP | 覆盖基本够 | 低于 Search/Inspect 基础能力会导致源事实不足 |
| Bug 根因定位 | Read / Grep / Bash / PowerShell / Failure Ledger | 覆盖够，但需进入 failure frame | 不能只给 Read/Edit，否则会靠猜 |
| 小步代码修改 | Edit / Write / NotebookEdit | 覆盖够，且已接 post-mutation verification | Patch 能力不能被压缩成单一 Edit |
| 验证与测试 | Bash / PowerShell / RunNativeTest / TDD Gate / SAST | 能力够，但 RunNativeTest/CollectEvidence 不一定默认可见 | 高级体验必须能测，不能为了少工具牺牲验证 |
| Diff 与变更意图 | git diff / ledger / edit proof | 有基础，需结构化 Change Ledger | 没有 diff/intent 会导致长任务乱改 |
| 多文件重构 | Grep / Glob / Edit / Todo / Agent / LSP | 覆盖够，关键是 owner/scope | 多文件场景不能低工具窗口 |
| 长任务管理 | TaskCreate/Get/Update/List / Ledger / Agent | 工具够，需 durable 主链化 | 长任务不能靠上下文硬记 |
| 失败恢复 | Recovery / GearBox / verify-gate / Failure Taxonomy | 能力有，需统一进入默认链 | 失败不能靠模型自由发挥 |
| 外部知识与专家上下文 | Web / MCP / Skill / ToolSearch | 工具够，但必须按需激活 | 默认全开会污染，默认全关会能力不足 |
| 完成可信声明 | Evidence / VerificationEnvelope / Claim Gate / TUI | 方向正确，需强绑定 final | 高级用户最不能接受假完成 |

审核结论：

```text
工具覆盖面：够，甚至偏多。
主要瓶颈：不是加工具，而是工具分层、工作台切换、验证绑定、长任务账本和 final claim gate。
V8 风险：如果为了性能过度减少工具，会牺牲 90%+ 高级体验目标。
```

### 1.2 V8 工具充分性结论

V8 不允许把“工具瘦身”理解成“工具能力缩水”。  
正确目标是：

```text
工具总能力完整
+ 当前任务工作台清晰
+ 失败时自动加宽
+ 长任务保持高级工具链
+ 验证工具不可被饿死
```

必须保留的工具能力：

| 能力组 | 必保留工具/能力 | 说明 |
|---|---|---|
| Source Truth | Read / Grep / Glob / LSP | 所有声明必须回到源码事实 |
| Patch | Edit / Write / NotebookEdit | 支撑真实代码修改 |
| Verify | Bash / PowerShell / RunNativeTest / TDD / SAST | 防止“改了但没跑” |
| Change Review | diff / edit proof / Change Ledger | 高级程序员需要知道改了什么 |
| Long Task | Task tools / Progress Ledger / Resume | 长任务不靠模型记忆 |
| Worker | Agent / SendMessage / TaskOutput | 复杂任务需要 researcher/verifier |
| Expert Context | Skill / MCP / ToolSearch / Web | 专家场景按需启用 |
| Evidence | CollectEvidence / dashboard / Claim Gate | 防假完成和发布夸大 |
| Permission/Config | permission / config / workspace policy | 高风险工程任务必须受控 |

因此 V8 的工具策略是“动态工作台”，不是“减少能力”。

---

## 2. V8 不可假设的内容

以下内容在没有 AB 数据前不能当作结论：

1. 不能说“8 个工具一定最好”。
2. 不能说“Claude 20+，所以 DSXU 也必须 20+”。
3. 不能说“工具越多命中率越高”。
4. 不能说“工具越少性能越好”。
5. 不能把 mock/smoke 结果当真实 benchmark。

V8 只能先定义候选窗口和硬验收。

---

## 3. DeepSeek 原生能力前提

以 DeepSeek 官网当前文档为准：

| 能力 | V8 采用方式 |
|---|---|
| 1M context | 不把它当长期记忆，只当大窗口；长任务仍靠 ledger |
| 384K max output | 不鼓励大输出，仍做 artifact + preview |
| thinking mode | 用 DeepSeek 原生 thinking，不再模拟厚 CoT |
| reasoning_effort high/max | 用失败证据和任务风险驱动 |
| tool calls | 默认使用原生 function calling |
| JSON output / strict schema | 用于工具参数和证据结构 |
| FIM | 用于补全/局部代码修复，不替代验证 |
| cache | 稳定 prompt prefix + 小动态尾巴 |

V8 的推理策略：

```text
DeepSeek 原生 thinking
+ DSXU 短执行帧
+ Runtime gate
+ Ledger
+ Verification envelope
```

不是：

```text
长篇 reasoning prefix
+ 大量规则堆叠
+ 全工具默认曝光
```

---

## 4. V8 工具窗口策略

### 4.1 候选窗口，不是最终定值

V8 使用候选工具窗口进行 AB：

| Profile | 候选工具数 | 初始建议 | 说明 |
|---|---:|---:|---|
| `explain` | 0 / 4 / 8 | 4 | 解释类不需要写工具 |
| `search` | 4 / 8 / 12 | 8 | 搜索、定位、引用查询 |
| `single_file_edit` | 8 / 12 / 16 | 12 | 单文件小改不能少于基础编码工具 |
| `normal_coding` | 12 / 16 / 20 | 16 | 常规编码默认窗口 |
| `debug` | 12 / 16 / 20 / 24 | 16 | 需要验证、日志、搜索 |
| `multi_file_refactor` | 16 / 20 / 24 | 20 | 多文件需要 Todo/Agent/LSP/Verify |
| `long_task` | 16 / 20 / 24 / 27 | 24 | 长任务不能工具饥饿 |
| `provider_security_release` | 18 / 22 / 27 | 22 | 高风险任务需要证据、配置、验证工具 |
| `pro_expert` | 20 / 24 / 27 | 24 | Pro 可承受更宽工具面 |

硬规则：

1. V8 不允许把全局默认压成 5-8。
2. 单文件编辑低于 8 个工具视为 `tool_starvation` 风险。
3. 常规编码低于 12 个工具视为 `senior_experience_loss` 风险。
4. 长任务低于 16 个工具视为 `long_task_capability_loss` 风险。
5. 默认超过 27 个工具必须有专家任务证据或用户显式请求。

### 4.2 三层工具模型

| 层 | 模型是否直接可见 | 说明 |
|---|---|---|
| Active Tools | 是 | 当前任务主动作工具，提交完整 schema |
| Standby Tools | 间接可见 | 通过 ToolSearch / ToolView / task contract 激活 |
| Runtime Tools | 否 | TDD / SAST / ledger / cache / verification envelope，由系统调用 |

这解决两个问题：

1. 高级程序员体验需要丰富工具。
2. DeepSeek Flash 不应每轮承担 40+ 工具选择负担。

### 4.3 推荐 Facade

V8 不删除真实工具，而是给模型一个更高级的工作台。

| Facade | 背后工具 |
|---|---|
| `Inspect` | Read / LSP / symbol lookup |
| `Search` | Grep / Glob |
| `Patch` | Edit / Write / NotebookEdit |
| `Verify` | Bash / PowerShell / RunNativeTest |
| `TaskLedger` | TaskCreate / TaskGet / TaskUpdate / TaskList |
| `Worker` | Agent / SendMessage / TaskOutput |
| `ExpertContext` | Skill / MCP / ToolSearch / WebFetch |
| `Evidence` | CollectEvidence / dashboard / ledger projection |

注意：Facade 是语义层，不是马上删除底层工具。

---

## 5. V8 数据驱动工具窗口 AB

### 5.1 必须新增或扩展的测试脚本

建议新增：

```text
scripts/dsxu-v8-tool-window-ab.ts
```

输入：

```bash
bun run scripts/dsxu-v8-tool-window-ab.ts --profiles "single_file_edit,debug,long_task" --windows "8,12,16,20,24,27" --suite "v8-core-50"
```

输出：

```text
docs/generated/DSXU_V8_TOOL_WINDOW_AB_20260519.json
docs/generated/DSXU_V8_TOOL_WINDOW_AB_20260519.csv
docs/DSXU_V8_TOOL_WINDOW_AB_20260519.md
```

### 5.2 指标

| 指标 | 定义 | 目标 |
|---|---|---|
| `pass@1` | 第一次完成并通过验证 | 越高越好 |
| `verified_completion_rate` | 有验证证据的完成率 | 越高越好 |
| `cost_to_verified_completion` | 完成且验证的总成本 | 越低越好 |
| `median_latency_ms` | 中位耗时 | 越低越好 |
| `tool_misuse_rate` | 选错工具、绕路、重复工具 | 越低越好 |
| `invalid_tool_call_rate` | 参数错误、schema 错误 | 越低越好 |
| `tool_starvation_rate` | 因工具不可见导致 PARTIAL/绕 Bash | 越低越好 |
| `recovery_activation_rate` | 进入恢复路径比例 | 越低越好 |
| `false_pass_rate` | 无证据却声称完成 | 必须接近 0 |
| `context_growth_tokens` | 上下文增长速度 | 越低越好 |

### 5.3 选择规则

V8 不用“最少工具数”作为唯一目标。  
工具窗口选择规则：

```text
在 false_pass_rate 接近 0 的前提下：
1. 选择 pass@1 最高的窗口；
2. 如果多个窗口 pass@1 差距 <= 2%，选择成本/耗时更低的窗口；
3. 如果更宽窗口 pass@1 提升 >= 3%，即使成本增加也选择更宽窗口；
4. 如果更窄窗口 tool_starvation_rate > 5%，不得选；
5. 如果更宽窗口 tool_misuse_rate 比窄窗口高 > 8%，不得默认选，只能专家模式启用。
```

---

## 6. V8 主链开发项

### V8-01：Tool Window Shadow Mode

目标：先观测，不改变行为。

修改位置：

| 文件 | 动作 |
|---|---|
| `src/tools.ts` | 保持当前 `getTools()` 输出，同时记录当前实际工具数 |
| `src/query.ts` | 每轮生成 shadow tool window，不影响真实调用 |
| `src/dsxu/engine/tool-catalog-v1.ts` | 支持 profile-specific cap，不再固定 clamp 到 12 |
| `src/dsxu/engine/action-contract.ts` | `visibleTools > 12` 不再直接违规，改为按 profile 检查 |

验收命令：

```bash
bun test src/dsxu/engine/__tests__/tool-view-compiler.test.ts
bun test src/dsxu/engine/__tests__/execution-contract-compiler.test.ts
```

硬验收：

| 条件 | 标准 |
|---|---|
| shadow 不改行为 | 默认工具仍与当前一致 |
| 每轮记录 | 有 `actualVisibleTools` 和 `shadowVisibleTools` |
| 无假优化 | 不允许只改文档不输出 shadow evidence |

---

### V8-02：Tool Window AB Runner

目标：用数据决定工具窗口。

新增：

```text
scripts/dsxu-v8-tool-window-ab.ts
src/dsxu/engine/__tests__/tool-window-ab-contract.test.ts
```

验收命令：

```bash
bun run scripts/dsxu-v8-tool-window-ab.ts --profiles "single_file_edit,debug,long_task" --windows "8,12,16,20,24,27" --suite "mock-v8-smoke"
bun test src/dsxu/engine/__tests__/tool-window-ab-contract.test.ts
```

硬验收：

1. 输出 JSON/CSV/MD 三种结果。
2. 每个 profile 至少比较 3 个窗口。
3. 报告必须包含 `tool_starvation_rate` 和 `tool_misuse_rate`。
4. 报告必须标记结果等级：`mock` / `internal_replay` / `live_provider` / `real_benchmark`。
5. mock 结果不得作为发布 claim。

---

### V8-03：Profile Tool Window Policy

目标：AB 后启用真实动态工具窗口。

新增：

```text
src/dsxu/engine/tool-window-policy-v8.ts
```

策略结构：

```ts
type ToolWindowPolicy = {
  profile: string
  minTools: number
  defaultTools: number
  maxTools: number
  modelClass: 'flash' | 'flash_max' | 'pro'
  expansionRules: string[]
}
```

默认初始值：

| Profile | min | default | max |
|---|---:|---:|---:|
| explain | 0 | 4 | 8 |
| search | 4 | 8 | 12 |
| single_file_edit | 8 | 12 | 16 |
| normal_coding | 12 | 16 | 20 |
| debug | 12 | 16 | 24 |
| multi_file_refactor | 16 | 20 | 24 |
| long_task | 16 | 24 | 27 |
| provider_security_release | 18 | 22 | 27 |
| pro_expert | 20 | 24 | 27 |

验收命令：

```bash
bun test src/dsxu/engine/__tests__/tool-window-policy-v8.test.ts
```

硬验收：

1. 不允许所有任务共用同一个 cap。
2. 不允许单文件编辑低于 8。
3. 不允许长任务低于 16。
4. 不允许普通 Flash 默认超过 24，除非 AB 证明收益。

---

### V8-04：Prompt Frame Router 主链化

目标：工具窗口变化后，Prompt 也必须同步变化。

修改位置：

| 文件 | 动作 |
|---|---|
| `src/constants/prompts.ts` | 接入 prompt-section-router |
| `src/dsxu/engine/prompt-section-router.ts` | 支持 V8 tool window policy |
| `src/query.ts` | 把 task profile / visible tools / risk 注入 dynamic tail |

Prompt frame：

```text
Frame:
- Goal:
- Task profile:
- Risk:
- Active tools:
- Standby expansion:
- Current evidence:
- Required verification:
- Stop condition:
```

验收命令：

```bash
bun test src/dsxu/engine/__tests__/prompt-section-router.test.ts
bun run scripts/dsxu-v6-prompt-diet-report.ts
```

硬验收：

1. 单文件编辑不得包含 Agent/MCP/Skill 长说明。
2. 长任务必须包含 ledger frame。
3. debug 必须包含 failure frame。
4. Prompt 动态尾巴默认不超过 1500 tokens。

---

### V8-05：Long Task Work Memory

目标：长任务不靠上下文硬记。

必须维护 5 个账本：

| 账本 | 字段 |
|---|---|
| Task Ledger | goal / phase / owner / nextAction |
| Source Truth Map | file / line / fact / lastReadAt |
| Change Ledger | file / intent / diffState / verifyState |
| Failure Ledger | command / error / category / recoveryDecision |
| Claim Ledger | allowedClaim / evidence / blocker |

修改位置：

| 文件 | 动作 |
|---|---|
| `src/dsxu/engine/progress-ledger.ts` | 扩展 ledger event |
| `src/dsxu/engine/work-state-timeline.ts` | 投影到 TUI / final |
| `src/query.ts` | 每轮更新 task memory frame |

验收命令：

```bash
bun run scripts/dsxu-v6-ledger-resume-smoke.ts
bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts
```

硬验收：

1. compact/resume 后必须重读关键文件才能编辑。
2. ledger 不能把 memory 当 source truth。
3. kill/resume 后不得重复危险写操作。
4. final PASS 必须引用 Claim Ledger。

---

### V8-06：Failure-Driven Model Upgrade

目标：Pro 不按感觉使用，只按失败证据准入。

修改位置：

| 文件 | 动作 |
|---|---|
| `src/utils/model/deepseekV4Control.ts` | 增加 outcome-based admission |
| `src/query.ts` | 将失败 ledger 投影到 route input |
| `src/dsxu/engine/progress-ledger.ts` | 记录 model-route event |

升级规则：

| 条件 | 动作 |
|---|---|
| 首次普通任务 | Flash high |
| 第一次验证失败 | Flash max |
| 同类失败 2 次 | Pro high |
| provider/security/release | Pro max |
| Pro 仍失败 | rollback / ask user / partial |

验收命令：

```bash
bun test src/dsxu/engine/__tests__/model-router-cost-policy.test.ts
bun test src/dsxu/engine/__tests__/recovery-decision-table.test.ts
```

硬验收：

1. Pro 不得绕过 permission。
2. Pro 不得绕过 verification。
3. Pro 使用必须写入 cost/cache/route evidence。
4. Flash 失败没有证据时不得盲目升级 Pro。

---

### V8-07：Tool Output Artifact Budget

目标：性能不被大输出拖垮。

规则：

| 输出类型 | 默认处理 |
|---|---|
| 小输出 | 原样进入上下文 |
| 中输出 | 摘要 + 关键行 |
| 大输出 | artifact path + preview |
| 测试日志 | 失败摘要 + artifact |
| benchmark 输出 | artifact + dashboard |

验收命令：

```bash
bun test src/dsxu/engine/__tests__/context-pressure-matrix.test.ts
bun run scripts/dsxu-v6-context-pressure.ts
```

硬验收：

1. 超阈值输出不得直接进入下一轮完整 prompt。
2. artifact path 必须写入 ledger。
3. final 引用 artifact 时必须说明是否已验证。

---

### V8-08：TUI Trust Surface

目标：高级程序员一眼知道当前状态。

当前可参考文件：

```text
src/components/PromptInput/PromptInputFooter.tsx
src/screens/REPL.tsx
src/state/AppStateStore.ts
```

推荐显示：

```text
DSXU · Flash Max · profile=debug · tools=16/34 · verify=required · cache=93% · cost=$0.0003
Ledger: patch_applied → focused_test_required
Next: run affected test
```

验收命令：

```bash
bun test src/components/PromptInput/__tests__
bun run scripts/dsxu-v6-tui-snapshot.ts
```

硬验收：

1. 默认状态栏不超过 2-3 行。
2. 中文不乱码。
3. 不显示长 evidence line。
4. 必须显示 profile、tools、verify、route、next。
5. 详细证据可展开，不常驻刷屏。

---

### V8-09：高级能力覆盖 Gate

目标：防止 V8 为了性能把工具窗口压得过窄，导致高级程序员能力退化。

新增或扩展：

```text
scripts/dsxu-v8-capability-coverage-audit.ts
src/dsxu/engine/__tests__/v8-senior-capability-coverage.test.ts
```

覆盖检查：

| 能力 | 必须至少有一个可用入口 |
|---|---|
| source truth | Read / Grep / Glob / LSP |
| patch | Edit / Write / NotebookEdit |
| verify | Bash / PowerShell / RunNativeTest / TDD/SAST runtime gate |
| change review | diff / edit proof / Change Ledger |
| long task | Task tools / Progress Ledger / Resume |
| recovery | Recovery Decision / Failure Ledger / rollback path |
| worker/verifier | Agent / SendMessage / TaskOutput |
| expert context | Skill / MCP / ToolSearch / Web activation path |
| evidence | CollectEvidence / dashboard / final claim gate |
| permission/config | Permission Gate / Config / workspace policy |

验收命令：

```bash
bun run scripts/dsxu-v8-capability-coverage-audit.ts
bun test src/dsxu/engine/__tests__/v8-senior-capability-coverage.test.ts
```

硬验收：

1. 任何 profile 的工具窗口不得让 `verify` 能力完全不可达。
2. `long_task` profile 必须包含 ledger/resume/worker 入口或明确 standby expansion。
3. `multi_file_refactor` profile 必须保留 search + patch + verify + change review。
4. `provider_security_release` profile 必须保留 evidence + permission/config + verify。
5. 如果某个能力从 Active 降为 Standby，报告必须说明激活条件。
6. 不允许为了降低工具数让高级能力永久不可达。

---

## 7. V8 总体验收

### 7.1 必跑测试

```bash
bun test src/dsxu/engine/__tests__/tool-view-compiler.test.ts
bun test src/dsxu/engine/__tests__/prompt-section-router.test.ts
bun test src/dsxu/engine/__tests__/execution-contract-compiler.test.ts
bun test src/dsxu/engine/__tests__/model-router-cost-policy.test.ts
bun test src/dsxu/engine/__tests__/recovery-decision-table.test.ts
bun run scripts/dsxu-v8-tool-window-ab.ts --profiles "single_file_edit,debug,long_task" --windows "8,12,16,20,24,27" --suite "mock-v8-smoke"
bun run scripts/dsxu-v8-capability-coverage-audit.ts
bun run scripts/dsxu-v6-ledger-resume-smoke.ts
bun run scripts/dsxu-v6-context-pressure.ts
bun run scripts/dsxu-v6-tui-snapshot.ts
```

### 7.2 真实验收标准

| 指标 | 最低标准 |
|---|---:|
| 单文件编辑 pass@1 | ≥ 90% |
| 普通编码 verified completion | ≥ 88% |
| Debug verified completion | ≥ 85% |
| 长任务 checkpoint success | ≥ 90% |
| false PASS | 0 或接近 0 |
| tool_starvation_rate | < 5% |
| invalid_tool_call_rate | < 3% |
| tool_misuse_rate | 不高于当前默认 27 工具基线 |
| cost_to_verified_completion | 不高于当前基线 +10%，除非 pass@1 提升 ≥3% |
| median_latency | 不高于当前基线 +15%，长任务除外 |

### 7.3 AB 通过标准

V8 工具窗口可以启用的条件：

1. `single_file_edit` 的候选窗口不能比当前 27 工具基线 pass@1 低超过 2%。
2. `debug` 的候选窗口必须降低 recovery loop 或提高 verified completion。
3. `long_task` 的候选窗口不得出现工具饥饿。
4. 如果 20/24 工具窗口显著优于 12/16，必须选择宽窗口。
5. 如果 27 工具基线仍然最好，则 V8 不强行瘦身，只保留 prompt frame 和 ledger 优化。

---

## 8. V8 发布声明边界

V8 完成前不能声明：

1. “已超过 Claude/GPT”。
2. “90%+ 已达成”。
3. “工具瘦身一定提升命中率”。
4. “mock benchmark 代表真实成绩”。
5. “3 个工具 simple 模式适合作为高级默认体验”。

V8 完成后允许声明：

1. “DSXU 具备数据驱动工具窗口策略”。
2. “不同任务 profile 使用不同工具窗口”。
3. “长任务使用 ledger 而不是仅依赖上下文记忆”。
4. “Final claim 受 verification 和 evidence gate 约束”。
5. “DeepSeek Flash / Pro 路由由失败证据和风险驱动”。

---

## 9. V8 不做事项

| 不做 | 原因 |
|---|---|
| 不删除 40+ 工具 | 高级能力需要工具总库 |
| 不把默认压到 5-8 | 证据不足，且会损害复杂任务 |
| 不继续堆新模块 | 当前瓶颈是主链收敛 |
| 不默认全量 Pro | 成本高，且不能替代验证 |
| 不把 1M context 当记忆 | 长任务必须 ledger 化 |
| 不把 Agent swarm 默认化 | 容易放大混乱 |
| 不把文档证据当运行时事实 | 必须有测试/主链证据 |

---

## 10. V8 最终判断

V8 的最佳方案不是“少工具”，而是：

```text
丰富工具库
+ 数据驱动工具窗口
+ 任务 profile
+ Prompt 短执行帧
+ 长任务 ledger
+ failure-driven model upgrade
+ verification claim gate
+ artifact budget
+ TUI trust surface
```

如果 AB 证明 20+ 工具窗口效果最好，V8 必须接受 20+。  
如果 AB 证明 12/16 工具窗口更快且命中不下降，V8 才启用较窄窗口。  

因此，V8 的工程标准是：

> 不凭主观减少工具；用真实任务数据找到 DeepSeek + DSXU 的最优工具窗口。

---

## 11. V8 全面审核结论

### 11.1 目标一致性审核

| 审核项 | 结论 | 说明 |
|---|---|---|
| 是否仍以高级程序员 90%+ 为目标 | PASS | V8 明确以 verified completion、长任务 checkpoint、false PASS 为核心指标 |
| 是否过度减少工具 | BLOCKED_BY_DESIGN | V8 不允许固定压到 5-8，必须用 AB 证明 |
| 是否保留高级工具能力 | PASS_WITH_GATE | V8-09 增加高级能力覆盖 Gate |
| 是否保留性能目标 | PASS | 使用 cost、latency、context growth、artifact budget 控制性能 |
| 是否保留长任务稳定性 | PASS_WITH_WORK | V8-05 要求 Task/Source/Change/Failure/Claim 五账本 |
| 是否避免假完成 | PASS_WITH_WORK | V8-04 / V8-05 / V8-09 都要求 claim 受证据约束 |
| 是否避免继续堆功能 | PASS | V8 主体是主链收敛、shadow、AB、gate，不是新增大模块 |

### 11.2 工具数量审核

V8 不使用单一工具数量标准。  
最终工具窗口必须由以下结果决定：

```text
pass@1
verified_completion_rate
cost_to_verified_completion
median_latency_ms
tool_misuse_rate
invalid_tool_call_rate
tool_starvation_rate
false_pass_rate
long_task_checkpoint_success
```

审核后的工具数量底线：

| Profile | 不可低于 | 原因 |
|---|---:|---|
| `single_file_edit` | 8 | 否则容易缺少 search/verify/ask 能力 |
| `normal_coding` | 12 | 高级编码需要 patch/search/verify/change review |
| `debug` | 12 | 失败定位需要日志、搜索、验证 |
| `multi_file_refactor` | 16 | 多文件需要 owner/scope、search、verify |
| `long_task` | 16 | 长任务需要 ledger/worker/verify/resume |
| `provider_security_release` | 18 | 高风险任务需要 evidence/permission/config |

如果 AB 证明 20/24/27 更好，V8 必须接受宽窗口。  
如果 AB 证明 12/16 不降命中且更快，才允许窄窗口成为默认。

### 11.3 防返工审核

| 潜在返工点 | V8 防护 |
|---|---|
| 工具砍太少，复杂任务能力下降 | V8-09 能力覆盖 Gate + tool_starvation_rate |
| Prompt 继续变厚，性能下降 | V8-04 短 frame + 1500 token 动态尾巴限制 |
| 长任务仍靠上下文记忆 | V8-05 五账本 |
| Pro 滥用导致成本爆 | V8-06 failure-driven admission |
| 工具输出撑爆上下文 | V8-07 artifact budget |
| TUI 继续显示工程日志 | V8-08 trust surface |
| mock 被当真实成绩 | V8-02 结果等级分层 |

### 11.4 最终审核判断

V8 当前方向合适，但必须坚持两个边界：

1. **不能为了性能过度减少工具。**  
   高级程序员体验需要完整工具能力，尤其是 verify、change review、long task、worker、expert context。

2. **不能为了能力默认暴露全部工具。**  
   DeepSeek Flash 的最优点需要数据验证，不能把 27/40+ 工具当永远默认。

最终标准：

> V8 的成功不是“工具变少”，而是“每类任务拥有刚好足够的工具，并用真实任务数据证明命中率、性能和高级体验同时成立”。

---

## 12. 反过度限制真实审计补充

本节来自当前代码只读审计，目的不是继续加功能，而是防止 V8 被 V5/V6 时代的“工具硬瘦身”锁死，导致达不到高级程序员 90%+ 体验目标。

### 12.1 审计结论

当前 DSXU 并不是“默认工具太少”。真实问题是：

```text
产品 REPL 默认工具池：不窄，约 27 个工具。
DSXU engine / ToolView / ExecutionContract 合约路径：仍存在 12 工具硬帽和低工具模板。
```

因此，V8 的修正重点不是继续减少工具，而是把工具窗口从固定硬帽改为 profile-aware 动态窗口。

### 12.2 当前真实代码证据

| 审计项 | 当前真实结果 | 判断 | 影响 |
|---|---:|---|---|
| `DSXU_CODE_MODE=1` 默认 `getTools()` | 27 个工具 | 不算过度限制 | 产品 REPL 默认能力面足够宽 |
| `DSXU_SEMANTIC_TOOLS_ENABLED=1` + `ENABLE_LSP_TOOL=1` | 30 个工具 | 不算过度限制 | 更接近高级编程工作台 |
| `DSXU_CODE_SIMPLE=1` | 3 个工具 | 只适合 bare/simple | 不得作为高级默认体验 |
| `compileDSXUToolView(... maxVisibleTools: 27)` | 实际只输出 12 个 | 过度限制 | V8 的 16/20/24/27 AB 会被静默压扁 |
| `compileDSXUExecutionContract(long_task)` | 5 个 visible tools | 过度限制 | 长任务无法呈现高级程序员工具链 |
| `compileDSXUExecutionContract(single_file_edit/debug/review/benchmark)` | 多数 4 个工具 | 偏限制 | 复杂场景会被低工具模板低估 |
| `RunNativeTest` / `CollectEvidence` | env-gated | 偏限制 | 验证和证据能力可能只在 runtime 存在，不在语义工具面存在 |
| `LSP` | formal entrypoint 默认启用，但普通 env 需 `ENABLE_LSP_TOOL=1` | 中风险 | 多文件重构和符号级理解依赖入口正确性 |
| focused tests | 当前通过 | 不是 V8 完成证据 | 测试正在证明旧限制仍被执行 |

### 12.3 关键文件与限制点

| 文件 | 当前限制 | V8 处理要求 |
|---|---|---|
| `src/dsxu/engine/tool-catalog-v1.ts` | `maxVisibleTools` 被强制夹到 12；guard 文案仍是 `V5 hard cap` | 改成 profile-aware 上限，不再固定 12 |
| `src/dsxu/engine/action-contract.ts` | `DEFAULT_TOOL_VIEW_BY_TASK` 对复杂任务过窄；`visibleTools.length > 12` 直接违规 | 重写任务工具模板，按任务风险定义 min/default/max |
| `src/dsxu/engine/query-loop.ts` | `DEFAULT_TOOL_SUBSET_MAX = 12` | 进入 shadow/AB 后由 policy 决定，不再写死 |
| `src/query.ts` | execution contract 投影里仍有 `Math.min(..., 12)` 和 `maxToolCalls: 12` | 区分 tool window 与 max tool calls；不要把工具窗口硬压到 12 |
| `src/tools.ts` | semantic tools 与 LSP 受 env 影响 | coding/debug/review/benchmark profile 必须保证 verify/evidence/LSP 可达 |
| `src/tools/__tests__/tool-registry-simple-mode.test.ts` | simple mode 3 工具测试通过 | 保留 bare 行为，但增加高级默认不得进入 simple 的测试 |
| `src/dsxu/engine/__tests__/tool-view-compiler.test.ts` | 当前测试要求 <=12 | V8 后必须新增/替换反过度瘦身测试 |
| `src/dsxu/engine/__tests__/execution-contract-compiler.test.ts` | 当前低工具 contract 合法 | V8 后必须验证 long_task/multi_file/debug 不被工具饥饿 |

### 12.4 V8 必须新增的反过度限制验收

V8 不只测试“工具有没有被压住”，还必须测试“是否压得过头”。

| 验收项 | 硬标准 |
|---|---|
| long task 工具窗口 | 不得低于 16；AB 候选必须包含 20/24/27 |
| multi-file refactor 工具窗口 | 不得低于 16，且必须覆盖 search + patch + verify + change review |
| debug/recovery 工具窗口 | 不得低于 12，且必须能访问 failure evidence 和验证路径 |
| single file edit 工具窗口 | 不得低于 8，且必须有 verify 可达路径 |
| semantic verification | coding/debug/review/benchmark profile 中 `RunNativeTest` 或等效 verify facade 必须可达 |
| evidence capability | benchmark/release/public-claim 场景必须有 `CollectEvidence` 或等效 evidence envelope 可达 |
| LSP capability | multi-file/refactor/debug profile 必须有 LSP 可达路径，至少 standby 激活 |
| simple mode 隔离 | `DSXU_CODE_SIMPLE=1` 不得被高级任务自动选中 |
| no silent cap | 请求 20/24/27 工具窗口时，不得静默变成 12 |
| tests not locking old policy | 测试不能继续把 `<=12` 当唯一正确结果 |

### 12.5 新增验收命令

```bash
bun test src/dsxu/engine/__tests__/tool-view-compiler.test.ts
bun test src/dsxu/engine/__tests__/execution-contract-compiler.test.ts
bun test src/tools/__tests__/tool-registry-simple-mode.test.ts
bun run scripts/dsxu-v8-tool-window-ab.ts --profiles "single_file_edit,debug,multi_file_refactor,long_task,provider_security_release" --windows "8,12,16,20,24,27" --suite "v8-real-or-replay"
bun run scripts/dsxu-v8-capability-coverage-audit.ts
```

新增测试必须覆盖以下断言：

```text
compileDSXUToolView(maxVisibleTools=27, taskType=long_task) 不得固定返回 12。
compileDSXUExecutionContract(long_task) 不得只有 5 个工具。
multi_file_refactor 必须覆盖 search/patch/verify/change review。
debug 必须覆盖 inspect/failure/verify/recovery。
benchmark/release claim 必须覆盖 evidence/verify/claim gate。
DSXU_CODE_SIMPLE=1 只能作为 explicit bare mode，不得被 long_task/profile router 自动选择。
```

### 12.6 V8 修正后的工具窗口原则

| Profile | V8 下限 | V8 推荐候选 | 说明 |
|---|---:|---|---|
| `explain/search` | 4 | 4 / 8 / 12 | 可窄，但不能失去 source truth |
| `single_file_edit` | 8 | 8 / 12 / 16 | 小改也要能查、改、验 |
| `debug` | 12 | 12 / 16 / 20 | 失败定位需要日志、搜索、验证和恢复 |
| `review` | 12 | 12 / 16 / 20 | 审查需要 diff、source、grep、verify |
| `multi_file_refactor` | 16 | 16 / 20 / 24 | 多文件任务不能工具饥饿 |
| `long_task` | 16 | 16 / 20 / 24 / 27 | 长任务需要 ledger、worker、verify、resume |
| `provider_security_release` | 18 | 18 / 22 / 27 | 高风险任务必须保留 evidence/permission/config |
| `pro_expert` | 20 | 20 / 24 / 27 | Pro 可承受更宽工具面，以减少返工 |

### 12.7 最终判断

V8 必须明确：

```text
默认工具池不是主要瓶颈。
主要瓶颈是旧的 12 工具硬帽和低工具 ExecutionContract 模板。
```

如果不修这个问题，V8 即使写了 AB 和高级能力覆盖 Gate，真实运行时仍可能被旧 hard cap 锁住，最终表现为：

1. 长任务像简单任务一样工作。
2. 多文件重构缺少符号、验证、变更审查入口。
3. 模型绕 Bash 猜测，因为语义 verify/evidence 工具不可见。
4. 测试全绿但只是证明旧限制还在。
5. 高级程序员体验无法稳定接近 90%+。

所以 V8 的第一条工程底线应改为：

> 不再以固定 `visibleToolCount <= 12` 作为成功标准；改为以 profile-aware 工具窗口、工具饥饿率、验证完成率、成本到完成和长任务 checkpoint 成功率共同验收。

---

## 13. 多维限制平衡审计：哪些要松绑，哪些要收紧

本节从另一个维度审计 V8：不是只看工具数量，而是同时看主工具池、Agent 子任务、语义验证、LSP/MCP/Skill、Web 外部工具、模型路由、上下文压力、权限安全和测试是否锁死旧策略。

### 13.1 审计命令与当前结果

已执行的只读验证：

```bash
bun test src/dsxu/engine/__tests__/model-router-cost-policy.test.ts \
  src/dsxu/engine/__tests__/prompt-section-router.test.ts \
  src/dsxu/engine/__tests__/skill-mcp-expert-layer.test.ts \
  src/dsxu/engine/__tests__/context-pressure-matrix.test.ts
```

结果：11 pass / 0 fail。  

补充脚本审计结果：

| 维度 | 当前结果 | 判断 |
|---|---:|---|
| 默认 `DSXU_CODE_MODE=1` 工具 | 约 26-27 个，随 feature/env 浮动 | 默认主工具池不窄 |
| `semantic+lsp` 工具 | 约 29-30 个 | 高级工作台能力更完整 |
| simple mode | 3 个 | 只能作为 bare，不得作为高级默认 |
| async Agent 工具 | 约 14 个 | 对普通 worker 可用，对 verifier/refactor worker 偏窄 |
| ToolView 请求 27 | 仍输出 12 | 必须松绑 |
| ExecutionContract long_task | 5 个工具 | 必须松绑 |
| ToolSearch beta disabled | `mode=standard` 但 ToolSearch 仍可见 | 需要收紧显示/可用一致性 |
| autoCompact threshold | 约 98.7% effective window | 对弱模型长任务偏晚，应增加早期压力策略 |
| route inference long task / benchmark | 可落到 generic non-thinking | 必须修正 route-contract 一致性 |

### 13.2 需要松绑的限制

| 位置/能力 | 当前限制 | 为什么会挡住 90%+ | V8 要求 |
|---|---|---|---|
| ToolView hard cap | 固定最大 12 | 复杂任务、长任务、专家任务被压成普通小任务 | 改为 profile-aware 8-27 |
| ExecutionContract 默认工具模板 | `long_task=5`，`debug/review/benchmark≈4` | 合约层低估真实工作台能力 | 重写为任务能力组模板 |
| async Agent 工具 | 默认无 LSP / RunNativeTest / CollectEvidence | verifier/refactor worker 无法结构化验证和符号定位 | 按 agent role 开放 verification/refactor 工具 |
| Semantic verification | `RunNativeTest` / `CollectEvidence` env-gated | 模型只能靠 Bash/PowerShell 表达验证，证据结构弱 | coding/debug/review/benchmark profile 必须有 verify/evidence facade |
| LSP | 依赖 `ENABLE_LSP_TOOL` 或 formal entrypoint | 绕过 formal entrypoint 时多文件理解变弱 | refactor/debug/repo_understanding profile 至少 standby 可达 |
| Model route for long task | 可能 generic non-thinking | 长任务不会自动进入 thinking/max 或 Pro admission | route 必须消费 ExecutionContract taskType/risk |
| Benchmark / release route | 可 generic non-thinking | 证据任务不应被当普通聊天 | benchmark/release/public-claim 必须 verifier/reviewer route |
| Context pressure | autoCompact 接近 99% 才触发 | DeepSeek 长上下文有效注意力可能早于硬窗口退化 | 70/85/95/99 pressure policy 进入默认 long task |

### 13.3 需要收紧的限制

| 位置/能力 | 当前风险 | 为什么不能松 | V8 要求 |
|---|---|---|---|
| WebFetch / WebSearch | 普通 coding 默认可见 | 增加工具噪声、网络安全和上下文污染 | normal coding 降为 standby；外部资料任务再 active |
| ToolSearch beta kill switch | `DSXU_CODE_DISABLE_EXPERIMENTAL_BETAS=1` 时 ToolSearch 仍出现在工具池 | wire mode 和可见工具状态不一致 | beta disabled 时 ToolSearch 应 hidden 或明确 disabled |
| Critical / public claim | 高风险任务容易被模型写成“已完成/已超过” | 发布和商业声明必须证据先行 | `no_claim` / claim gate 必须保留 |
| Destructive shell | git reset/rm/remove-item/force push 等 | 高级工具不能牺牲安全 | permission gate 必须保留或更严格 |
| MCP / Skill 默认全开 | 专家能力很多，默认全塞会污染 prompt | 弱模型容易误选专家工具 | ordinary coding 继续 hidden，专家任务显式激活 |
| Agent recursion / swarm | 多 Agent 容易放大混乱和成本 | 复杂度爆炸，难验收 | coordinator/worker 权限继续分层，不默认 swarm |
| Pro admission | 全量 Pro 成本高，也可能掩盖 runtime 问题 | 不能用贵模型替代验证 | failure/evidence driven，不全量默认 |
| huge output | DeepSeek 支持大输出但不代表该输出 | 会撑爆 TUI、上下文、review | artifact + preview budget 必须保留 |

### 13.4 Route 与 Contract 一致性问题

当前发现一个隐蔽风险：`ExecutionContract` 和 `DeepSeekV4Route` 可能对同一任务得出不同结论。

示例审计结果：

| 输入类型 | Contract 判断 | Route 可能判断 | 风险 |
|---|---|---|---|
| long task / continue ledger | `long_task` | `generic_chat / non_thinking` | 长任务被轻量模型路径处理 |
| benchmark eval evidence | `benchmark` | `generic_chat / non_thinking` | 证据任务被当普通聊天 |
| security/release evidence | `critical/review` | `planning_flash_thinking_max` | critical 没有进入 Pro/approval 语义 |
| multi-file refactor | `multi_file_refactor/high` | `planning_flash_thinking_max` | 工具模板太窄，route 与工具不匹配 |

V8 必须增加一致性规则：

```text
if executionContract.taskType == long_task:
  route.workflowKind must be planning/recovery/workflow or thinking max

if executionContract.taskType == benchmark:
  route.role must be verifier

if executionContract.risk == critical:
  route must not be generic_chat or lightweight non-thinking

if executionContract.requiresAgentEvidence:
  route must not be lightweight non-thinking
```

硬验收：

```bash
bun test src/dsxu/engine/__tests__/v8-route-contract-consistency.test.ts
```

### 13.5 Agent 子任务限制审计

当前 async Agent 约 14 个工具，包含 Read/Grep/Glob/Edit/Write/Bash/PowerShell/Web/Skill/ToolSearch，但没有默认 LSP、RunNativeTest、CollectEvidence、Task 管理工具。

V8 不应把所有 Agent 都放宽，而应按角色放宽：

| Agent 角色 | 应该松绑 | 仍要限制 |
|---|---|---|
| explorer/research | Read/Grep/Glob/LSP/ToolSearch/Skill | Edit/Write 默认禁用，除非明确 worker |
| worker/coder | Read/Grep/Glob/Edit/Write/Bash/PowerShell/LSP | Agent recursion 默认禁用 |
| verifier | Read/Grep/Bash/PowerShell/RunNativeTest/CollectEvidence | Edit/Write 默认禁用 |
| refactor worker | Read/Grep/Glob/LSP/Edit/Write/Bash/RunNativeTest | Web 默认 standby |
| release/security reviewer | Read/Grep/Bash/CollectEvidence/Permission/Config | destructive shell 禁止 |

硬验收：

```bash
bun test src/dsxu/engine/__tests__/v8-agent-role-tool-window.test.ts
```

断言：

```text
verifier agent 能访问结构化验证/证据能力。
refactor worker 能访问 LSP 或等效符号定位能力。
ordinary async agent 不得获得 Agent recursion / destructive / release mutation 能力。
```

### 13.6 Web / MCP / Skill 限制策略

V8 不能把 Web/MCP/Skill 简单归为“多余工具”。它们是专家上下文能力，但默认打开会伤害命中率。

| 能力 | V8 默认策略 | 激活条件 |
|---|---|---|
| WebSearch | standby | 用户问最新信息、外部 API、官网、价格、法律、文档版本 |
| WebFetch | standby | 已有 URL 或 WebSearch 返回可引用页面 |
| Skill | standby / tool-visible shell | 任务匹配 skill description 或用户显式要求 |
| MCP resources | hidden / ToolSearch | 连接 MCP 且任务需要外部资源 |
| ToolSearch | active only when tool_reference 可用 | beta disabled 或 provider 不支持时必须隐藏/降级 |

硬验收：

```bash
bun test src/dsxu/engine/__tests__/v8-expert-context-activation.test.ts
```

### 13.7 Context 限制策略

当前 `autoCompact` 对 1M 窗口的触发接近 98.7%，这对“硬 API 限制”合理，但对“弱模型有效注意力”偏晚。

V8 应区分两类压力：

| 压力类型 | 当前问题 | V8 策略 |
|---|---|---|
| API hard limit | 接近 99% 才 compact 可以理解 | 保留 hard-limit fallback |
| attention pressure | 70/85/95 已可能影响长任务 | 提前做 ledger snapshot / artifact budget / P2 压缩 |
| tool output pressure | 大输出进入上下文会伤害选择 | artifact preview budget |
| long task continuity | 不能靠 1M context 硬撑 | task ledger + checkpoint |

硬验收：

```bash
bun test src/dsxu/engine/__tests__/context-pressure-matrix.test.ts
bun run scripts/dsxu-v6-context-pressure.ts
```

新增 V8 断言：

```text
70% pressure: 开始记录 attention warning，不强制 compact。
85% pressure: long_task 必须产生 checkpoint/summary。
95% pressure: 工具输出必须 artifact 化。
99% pressure: API hard-limit recovery。
```

### 13.8 限制平衡总表

| 类别 | 要松绑 | 要收紧 |
|---|---|---|
| 工具窗口 | 12 hard cap、低工具 contract | 40+ 全量默认曝光 |
| 验证 | semantic verify/evidence 可达性 | 假 PASS / 无测试声明 |
| Agent | verifier/refactor role 工具 | recursion/swarm 默认放大 |
| LSP | refactor/debug 可达 | 普通解释任务不必 active |
| Web | 专家外部资料可激活 | 普通 coding 默认 active |
| MCP/Skill | 专家任务激活路径 | ordinary coding prompt 污染 |
| 模型路由 | long_task/benchmark 不得 non-thinking | Pro 不得全量默认 |
| 上下文 | 提前 attention pressure 策略 | 过早丢失 source truth |
| 权限 | 允许安全读/验/证据 | 破坏性命令、release claim |

### 13.9 V8 新增总验收

```bash
bun test src/dsxu/engine/__tests__/v8-restriction-balance.test.ts
bun test src/dsxu/engine/__tests__/v8-route-contract-consistency.test.ts
bun test src/dsxu/engine/__tests__/v8-agent-role-tool-window.test.ts
bun test src/dsxu/engine/__tests__/v8-expert-context-activation.test.ts
bun test src/dsxu/engine/__tests__/context-pressure-matrix.test.ts
bun run scripts/dsxu-v8-restriction-audit.ts --profiles "search,single_file_edit,debug,multi_file_refactor,long_task,benchmark,provider_security_release,pro_expert"
```

最终硬标准：

1. 任何高级 profile 不得因工具窗口过窄导致 verify/search/patch/ledger/evidence 全部不可达。
2. 任何普通 coding profile 不得默认暴露 Web/MCP/Skill 全量上下文。
3. critical / benchmark / release claim 不得落到 lightweight non-thinking。
4. long task 不得落到 generic chat non-thinking。
5. `DSXU_CODE_DISABLE_EXPERIMENTAL_BETAS=1` 时 ToolSearch 可见状态必须与实际 wire mode 一致。
6. Agent verifier 必须有结构化验证或证据能力；普通 async agent 不能获得递归 Agent/swarm 能力。
7. 70/85/95/99 context pressure 行为必须可测。
8. 旧的 `visibleToolCount <= 12` 不能继续作为唯一正确性测试。

### 13.10 V8 优化判断

这次多维审计把 V8 从“工具窗口优化”提升为“限制平衡优化”：

```text
该松绑的：高级任务工作台、语义验证、Agent verifier、LSP、route-contract 一致性。
该收紧的：普通任务 Web/MCP/Skill 噪声、ToolSearch beta 不一致、release claim、破坏性权限、Agent recursion。
```

V8 的目标不是“少限制”，也不是“多限制”，而是：

> 让限制跟任务风险和任务复杂度一致；简单任务少工具，复杂任务不饥饿，高风险任务强证据，长任务强记忆。

---

## 14. Fresh Code Audit 追加结论：中文意图、默认链、DeepSeek 原生能力

本节为 2026-05-19 追加的 fresh audit。审核要求是：不依赖旧报告，只以当前源码、当前局部测试、DeepSeek 官方文档为准。  
本节优先级高于前文中与其冲突的旧判断。

### 14.1 已重新验证通过的能力

已执行：

```bash
bun test src/services/api/__tests__/deepseek-provider-contract.test.ts \
  src/services/api/__tests__/deepseek-strict-tool-gateway.test.ts \
  src/services/api/deepseek-adapter-cache-prefix-v1.test.ts

bun test src/tools/__tests__/tool-registry-simple-mode.test.ts \
  src/dsxu/engine/__tests__/tool-view-compiler.test.ts \
  src/dsxu/engine/__tests__/execution-contract-compiler.test.ts
```

结果：

| 测试组 | 结果 | 说明 |
|---|---:|---|
| DeepSeek provider contract | 7 pass / 0 fail | thinking、`reasoning_content`、tool calls、tool results、strict schema gateway 已有合同测试 |
| Tool registry / Tool view / Execution contract | 10 pass / 0 fail | simple mode、tool view、execution contract 局部合同已绿 |

已验证代码事实：

| 能力 | 当前真实状态 | 文件证据 |
|---|---|---|
| DeepSeek thinking tool-call round trip | 已有合同测试 | `src/services/api/__tests__/deepseek-provider-contract.test.ts` |
| strict tool gateway | 已有合同测试 | `src/services/api/__tests__/deepseek-strict-tool-gateway.test.ts` |
| prompt-prefix cache payload | 已有合同测试 | `src/services/api/deepseek-adapter-cache-prefix-v1.test.ts` |
| LSP 默认入口 | DSXU 入口默认设置 `ENABLE_LSP_TOOL=1` | `src/entrypoints/dsxu-code.tsx` |
| post-edit final gate | 已存在 | `src/query.ts` |
| parent Agent evidence gate | 已存在 | `src/query.ts` |
| promise-to-act blocking gate | 已存在 | `src/query.ts` |

结论：V8 不需要继续新增一堆外层模块。当前更重要的是把已存在能力真正接入默认链。

### 14.2 DeepSeek 官方能力边界

以 DeepSeek 官方文档为准：

| 能力 | 官方边界 | V8 使用原则 |
|---|---|---|
| V4 Flash / V4 Pro | 官方模型页标注 1M context、384K max output | 不把 1M 当永久记忆，仍必须用 ledger/checkpoint |
| thinking mode | 支持 thinking，支持 `reasoning_effort=high/max` | 用 DeepSeek 原生 thinking，不堆厚重 CoT prompt |
| thinking + tool call | 必须正确回传 `reasoning_content` | provider 合同必须继续锁住 |
| JSON Output | 可用于结构化输出 | 用于 tool args、evidence envelope、judge result |
| Tool Calls | 支持原生 tool calling 和 strict mode | runtime gate 优先于 prompt 约束 |
| FIM | 官方标注只支持 non-thinking | 只用于补全/局部修补，不替代验证链 |

官方参考：

- DeepSeek 模型与价格：`https://api-docs.deepseek.com/zh-cn/quick_start/pricing`
- DeepSeek 思考模式：`https://api-docs.deepseek.com/zh-cn/guides/thinking_mode`
- DeepSeek Tool Calls：`https://api-docs.deepseek.com/zh-cn/guides/tool_calls`
- DeepSeek JSON Output：`https://api-docs.deepseek.com/zh-cn/guides/json_mode`

V8 最新判断：

```text
DeepSeek 不是只能靠 prompt 补的弱模型。
更准确的定位是：强模型能力存在，但需要 DSXU 用路由、工具窗、验证、账本、证据来校准。
```

### 14.3 当前最危险缺口：中文 intent 分类错误

本轮 fresh audit 发现：当前 `compileDSXUExecutionContract` 对中文复杂任务存在错分类风险。  
这会直接导致模型路由、工具窗口、验证等级、claim policy 全部错位。

已验证示例：

| 中文输入 | 当前可能分类 | 应分类 | 风险 |
|---|---|---|---|
| 继续上一个长期任务，按账本恢复，修改代码并运行测试验证 | `debug` | `long_task` | 长任务被当恢复小任务处理 |
| 运行基准评估，输出证据仪表盘和通过失败证明 | `debug` | `benchmark` | benchmark 证据任务被当 bugfix |
| 多文件重构，使用 LSP 查引用并跑测试 | `search` | `multi_file_refactor` | 只查不改，或不给验证工具 |
| 解释一下这个文件的逻辑，不要修改代码 | `single_file_edit` | `explain` | 否定词被忽略，可能错误进入编辑链 |
| 安全审计权限和发布声明，不能虚报成绩 | `review/critical` | `review/critical` | 这一类当前较好，必须锁住 |

V8 必须把中文 intent classifier 作为 P0，而不是辅助优化。

硬验收测试：

```bash
bun test src/dsxu/engine/__tests__/v8-cn-intent-classifier.test.ts
```

测试必须包含：

```text
中文 long_task 不得落到 debug/explain。
中文 benchmark/evidence 不得落到 debug/generic_chat。
中文 multi_file_refactor + LSP + 测试 不得落到 search。
中文解释 + 不要修改 不得落到 edit workflow。
中文安全/权限/发布声明必须保持 critical/no_claim/full verification。
中英混合 prompt 必须正确识别 LSP/test/refactor/benchmark 等意图。
```

未通过该测试前，不允许声明 V8 达到高级程序员 90%+ 体验。

### 14.4 最新松绑清单

| 限制点 | 当前代码事实 | 必须松绑到什么程度 | 硬验收 |
|---|---|---|---|
| ToolView 12 hard cap | `tool-catalog-v1.ts` 把 `maxVisibleTools` 夹到 12 | 改为 profile-aware：quick 6-8，normal 12-16，complex 18-24，expert 24-27 | `compileDSXUToolView(long_task, maxVisibleTools=27)` 不得固定返回 12 |
| ExecutionContract 工具模板 | `long_task=5`、`benchmark=4` 等偏薄 | 改为能力组模板，不是低工具模板 | long_task 必须含 inspect/patch/verify/ledger/worker/evidence |
| Semantic verify 可见性 | `RunNativeTest/CollectEvidence` 受 env gate | coding/debug/benchmark/release 默认通过 Verify/Evidence facade 可达 | Edit 后无 verify evidence 不得 verified final |
| Agent role 工具 | async Agent 缺 LSP/RunNativeTest/CollectEvidence | verifier/refactor/reviewer 分角色放宽 | verifier agent 可结构化验证，refactor agent 可符号定位 |
| 长上下文策略 | hard autocompact 接近 99% | 70/85/95/99 压力分级 | 85% long_task 必须产生 checkpoint 或 summary |
| DeepSeek Pro 准入 | 目前 route 有能力，但需 outcome 驱动 | critical、失败复盘、多文件高风险、真实 benchmark 才准入 | Pro admission 必须写入 ledger evidence |

### 14.5 最新收紧清单

| 风险点 | 当前问题 | 必须收紧 | 硬验收 |
|---|---|---|---|
| WebSearch/WebFetch | 普通 DSXU 默认工具池可见 | normal coding 降为 standby，只有外部实时资料任务激活 | 普通 single_file_edit tool view 不得 active 暴露 Web |
| ToolSearch beta disabled | `mode=standard` 时 ToolSearch 仍可能在工具池出现 | disabled 必须和可见状态一致 | `DSXU_CODE_DISABLE_EXPERIMENTAL_BETAS=1` 时 ToolSearch 不可 active |
| public claim / benchmark | 容易把 internal smoke 当真实成绩 | mock/unit/integration/live/real benchmark 分层 | mock 结果不得进入 public claim |
| destructive shell | 高风险命令必须受控 | permission gate 保持强制 | destructive 命令无 permission evidence 必须 block |
| Agent recursion / swarm | 会放大成本和混乱 | 不默认开启递归/多层 swarm | ordinary agent 不得再调 Agent |
| huge output | 1M context 不等于无限吞工具输出 | artifact + preview budget | 超预算输出必须 artifact 化 |

### 14.6 V8 最新开发顺序

V8 后续必须按下面顺序执行。不要先做 TUI 或外观，不要先做发布声明。

| 顺序 | 工作项 | 原因 | 完成定义 |
|---:|---|---|---|
| 1 | 中文 intent classifier 修正 | 当前中文复杂任务会错路由，是命中率核心风险 | `v8-cn-intent-classifier.test.ts` 全绿 |
| 2 | Route-Contract Consistency Gate | 分类正确后，路由必须消费 contract 结果 | long_task/benchmark/critical 不得落到 lightweight non-thinking |
| 3 | Profile-aware Tool Window | 解决 12 hard cap 和工具饥饿 | 复杂 profile 可见工具 18-24，且必备能力不缺 |
| 4 | Verification/Evidence Facade 默认链 | 防止假完成 | 写入后无 verify/evidence 不得 verified final |
| 5 | Agent Role Tool Window | 让子代理像高级程序员分工 | verifier/refactor/reviewer 工具窗分别通过测试 |
| 6 | Context Pressure + Durable Ledger | 长任务不靠上下文硬记 | 70/85/95/99 压力测试通过 |
| 7 | Expert Context Activation | Web/MCP/Skill 按需激活，不污染普通编码 | expert activation 测试通过 |
| 8 | AB Runner + Real Replay | 用数据确定工具窗口 | 输出 JSON/CSV/Markdown，含 pass@1、false pass、tool starvation |
| 9 | TUI Trust Surface | 只展示对高级用户有用状态 | 中文/英文无乱码，状态不刷屏、不遮挡 |

### 14.7 V8 最新硬验收测试矩阵

不得只跑单元测试。每个能力必须有反作弊验收。

#### A. 单元合同层

```bash
bun test src/dsxu/engine/__tests__/v8-cn-intent-classifier.test.ts
bun test src/dsxu/engine/__tests__/v8-route-contract-consistency.test.ts
bun test src/dsxu/engine/__tests__/v8-profile-tool-window-policy.test.ts
bun test src/dsxu/engine/__tests__/v8-agent-role-tool-window.test.ts
bun test src/dsxu/engine/__tests__/v8-expert-context-activation.test.ts
bun test src/dsxu/engine/__tests__/context-pressure-matrix.test.ts
```

#### B. Provider 合同层

```bash
bun test src/services/api/__tests__/deepseek-provider-contract.test.ts
bun test src/services/api/__tests__/deepseek-strict-tool-gateway.test.ts
bun test src/services/api/deepseek-adapter-cache-prefix-v1.test.ts
```

必须继续断言：

```text
thinking tool-call round 必须保留 reasoning_content。
non-thinking 请求不得携带 reasoning_content。
strict tool schema fallback 必须可观测。
provider usage/cache evidence 必须进入 route trace。
```

#### C. 默认链 reachability

```bash
bun run scripts/dsxu-v8-default-chain-reachability.ts --profiles "explain,search,single_file_edit,debug,multi_file_refactor,long_task,benchmark,review"
```

必须输出：

```text
每个 profile 的 active/standby/runtime tools。
每个 profile 的 routeDecision。
每个 profile 的 verificationLevel。
每个 profile 的 claimPolicy。
每个 profile 是否存在 tool starvation。
```

失败条件：

```text
long_task 无 ledger/Agent/verify/evidence 路径。
benchmark 无 verifier/evidence/claim gate。
multi_file_refactor 无 LSP 或等效 symbol/references 能力。
single_file_edit 无 verify facade。
普通 explain 进入 edit workflow。
```

#### D. 工具窗口 AB

```bash
bun run scripts/dsxu-v8-tool-window-ab.ts \
  --profiles "single_file_edit,debug,multi_file_refactor,long_task,benchmark,review" \
  --windows "8,12,16,20,24,27" \
  --suite "v8-real-or-replay"
```

必须生成：

```text
docs/generated/DSXU_V8_TOOL_WINDOW_AB_20260519.json
docs/generated/DSXU_V8_TOOL_WINDOW_AB_20260519.csv
docs/DSXU_V8_TOOL_WINDOW_AB_20260519.md
```

通过条件：

```text
false_pass_rate = 0。
tool_starvation_rate <= 3%。
复杂任务 verified_completion 不得低于 12 工具旧基线。
若宽窗口 pass@1 提升 >= 3%，必须选择宽窗口，即使 token 成本略升。
若宽窗口 tool_misuse_rate 比窄窗口高 > 8%，只能进入 expert/pro profile。
```

#### E. 中文场景 replay

```bash
bun run scripts/dsxu-v8-cn-scenario-replay.ts --suite "cn-core-30"
```

必须覆盖：

```text
中文解释不要修改。
中文多文件重构。
中文长任务继续。
中文运行测试和证据。
中文安全审计/权限/发布声明。
中文 debug + 修复 + 验证。
中文 benchmark/evidence dashboard。
中英混合 LSP/refactor/test prompt。
```

通过条件：

```text
intent_accuracy >= 95%。
route_contract_consistency = 100%。
false_edit_on_explain = 0。
false_claim_on_benchmark = 0。
critical_no_claim = 100%。
```

#### F. 长任务耐久性

```bash
bun run scripts/dsxu-v8-long-task-ledger-replay.ts --cases 20 --resume-after "30%,60%,85%"
```

通过条件：

```text
resume_goal_match >= 95%。
next_action_match >= 90%。
verification_state_preserved >= 95%。
checkpoint_missing = 0。
after_resume_tool_starvation <= 3%。
```

#### G. 真实 provider smoke

```bash
bun run scripts/dsxu-v8-live-provider-smoke.ts --model deepseek-v4-flash --cases 5
bun run scripts/dsxu-v8-live-provider-smoke.ts --model deepseek-v4-pro --cases 3 --critical-only
```

通过条件：

```text
不允许把 live smoke 当 benchmark 成绩。
必须只验证 API 合同、tool-call round-trip、usage/cache evidence、reasoning_content 行为。
```

### 14.8 V8 最新评分口径

V8 不允许用 mock/smoke 宣称 90%+。评分必须分层：

| 证据等级 | 可说明什么 | 不可说明什么 |
|---|---|---|
| unit | 合同逻辑正确 | 不能说明真实任务命中率 |
| integration | 默认链可达 | 不能说明模型能力 |
| internal replay | 回归任务表现 | 不能作为公开 benchmark |
| live provider smoke | API 合同真实可用 | 不能代表 SWE-bench 成绩 |
| real benchmark | 可对外声明能力 | 需要公开任务、可复现、模型版本固定 |

V8 可接受阶段目标：

| 阶段 | 目标 |
|---|---|
| V8 内部可用 | 中文 intent 正确，默认链不饿死，高风险不虚报 |
| V8 强体验 | verified completion 85%+，长任务 checkpoint 90%+ |
| V8 90%+ 声明 | 必须经过 real replay + live provider + benchmark 分层证据 |

### 14.9 最新最终判断

V8 的最终方向保持不变，但必须补上两个 P0：

```text
P0-1: 中文 intent classifier。
P0-2: route-contract-tool-window 三者一致性。
```

没有这两个，工具窗口 AB、Agent role、长任务账本都会建立在错误入口上。  
完成这两个后，再做工具松绑和验证收紧，才有机会把 DSXU 从“功能强”推进到“高级程序员 90%+ 体验”。

---

## 15. V8 执行记录 - 2026-05-19 第一批

本批执行遵守“先实现主链收束，后做全量测试”的顺序，只跑 V8 P0/P1 相关 focused 合同测试，不提前跑全量回归。

### 15.1 已完成代码收束

| 项 | 状态 | 代码/产物 |
|---|---|---|
| P0-1 中文 intent classifier | DONE | `src/dsxu/engine/action-contract.ts` 增加中文 benchmark、long_task、multi_file_refactor、explain-no-edit、critical risk 的优先判断 |
| P0-2 route-contract-tool-window 一致性 | DONE | `src/utils/model/deepseekV4Control.ts` 增加中文 benchmark/long-task/no-edit-explain/multi-file-refactor route 判断 |
| V8 profile-aware tool window policy | DONE | `src/dsxu/engine/tool-window-policy-v8.ts`，不再把 `>12` 当全局违规 |
| Tool Gate tool view 接入 V8 policy | DONE | `src/dsxu/engine/tool-catalog-v1.ts` 按 profile 采用 min/default/max，而非固定 12 |
| Query shadow evidence | DONE | `src/query.ts` 记录 `actualVisibleTools` 与 `shadowVisibleTools`，不改变真实 tool 调用行为 |
| Query-loop 默认工具上限收束 | DONE | `src/dsxu/engine/query-loop.ts` 默认从固定 12 改为基于 V8 policy 的 profile-aware cap |
| Tool Window AB contract/runner | DONE | `src/dsxu/engine/tool-window-ab-v8.ts`、`scripts/dsxu-v8-tool-window-ab.ts`；mock/internal replay 明确阻止 public claim |

### 15.2 已完成 focused 验收

| 命令 | 结果 |
|---|---|
| `bun test src/dsxu/engine/__tests__/tool-window-ab-contract.test.ts src/dsxu/engine/__tests__/v8-cn-intent-classifier.test.ts src/dsxu/engine/__tests__/v8-route-contract-consistency.test.ts src/dsxu/engine/__tests__/v8-profile-tool-window-policy.test.ts src/dsxu/engine/__tests__/execution-contract-compiler.test.ts src/dsxu/engine/__tests__/tool-view-compiler.test.ts` | PASS, 21 pass / 0 fail |
| `bun run scripts/dsxu-v8-tool-window-ab.ts --profiles "single_file_edit,debug,long_task" --windows "8,12,16,20,24,27" --suite "mock-v8-smoke"` | PASS, 18 result rows, `publicClaimAllowed=false` |

### 15.3 新增/更新证据文件

| 文件 | 用途 |
|---|---|
| `docs/generated/DSXU_V8_TOOL_WINDOW_AB_20260519.json` | V8 tool-window AB mock 证据，禁止公开 benchmark claim |
| `docs/generated/DSXU_V8_TOOL_WINDOW_AB_20260519.csv` | V8 tool-window AB 可筛选表 |
| `docs/DSXU_V8_TOOL_WINDOW_AB_20260519.md` | 人读版 AB 报告 |

### 15.4 仍未做完

| 顺序 | 剩余项 | 说明 |
|---:|---|---|
| 1 | V8 Prompt Frame Router default tail | 需要把 Goal / Task profile / Risk / Active tools / Standby expansion / Evidence / Verification / Stop condition 投影到默认 prompt frame |
| 2 | V8 Long Task Work Memory | Task / Source Truth / Change / Failure / Claim ledger 需要继续接默认 query/TUI/final report |
| 3 | Failure-driven model upgrade | 需要把 failure ledger 与 `deepseekV4Control` admission evidence 进一步绑定 |
| 4 | Tool Output Artifact Budget | 需要把长输出 preview/artifact 预算和 V8 profile 串起来 |
| 5 | TUI Trust Surface | 需要真实窗口测试前先把短显示、避免重复、避免顶屏回归继续收束 |
| 6 | V8 live/replay/benchmark | 只能在实现收束后分层跑，mock/internal replay 不能写公开卖点 |

### 15.5 追加执行记录 - Prompt Frame default tail

| 项 | 状态 | 说明 |
|---|---|---|
| V8 Prompt Frame Router default tail | DONE | `src/dsxu/engine/prompt-section-router.ts` 已输出 Goal / Task profile / Risk / Active tools / Standby expansion / Evidence / Required verification / Stop condition |
| 默认 query 接入 | DONE | `src/query.ts` 已把 `DSXU V8 Active Frame` 注入 system context dynamic tail，并记录 prompt frame chars |
| focused 验收更新 | PASS | prompt-section-router + V8 P0/P1 focused suite：23 pass / 0 fail |
| query import smoke | PASS | `bun -e "await import('./src/query.ts'); console.log('PASS_QUERY_IMPORT')"` |

后续剩余顺序调整为：Long Task Work Memory → Failure-driven model upgrade → Tool Output Artifact Budget → TUI Trust Surface → live/replay/benchmark 分层验收。

### 15.6 追加执行记录 - Long Task Work Memory

| 项 | 状态 | 说明 |
|---|---|---|
| V8 Long Task Work Memory | DONE | `src/dsxu/engine/progress-ledger.ts` 的 `buildLongTaskLedgerProjection()` 已投影 Task / Source Truth / Change / Failure / Claim 五类 work memory |
| TUI/final report 投影 | DONE | `tuiLines` 增加 compact memory counts，`finalReportSection.summary` 增加 workMemory 汇总 |
| focused 验收 | PASS | `bun test src/dsxu/engine/__tests__/v8-long-task-work-memory.test.ts ...`：16 pass / 0 fail |

后续剩余顺序调整为：Failure-driven model upgrade → Tool Output Artifact Budget → TUI Trust Surface → live/replay/benchmark 分层验收。
### 15.7 追加执行记录 - Failure-driven model upgrade / Tool Output Artifact Budget / TUI Trust Surface

| 项 | 状态 | 说明 |
|---|---|---|
| Failure-driven model upgrade | DONE | `src/utils/model/deepseekV4Control.ts` 已改为第一次失败留在 Flash-MAX，只有 repeated failure + prior Flash + saved evidence + admission 才进入 Pro |
| Route admission ledger evidence | DONE | `src/dsxu/engine/progress-ledger.ts` 新增 `projectDeepSeekRouteAdmissionToLedgerEvent()`，把 Pro admission state 写入 `model-route` ledger event |
| Query route evidence | DONE | `src/query.ts` 使用真实 failedVerificationStreak/sourceEvidenceCount 驱动 route input，并记录 `deepseek_route_admission_v8` lifecycle trace |
| Tool Output Artifact Budget | DONE | `src/utils/toolResultStorage.ts` 新增 V8 profile-aware budget；普通/解释/搜索/长任务/benchmark 按 profile 收紧，85/95 context pressure 下进一步收紧 |
| Tool budget default path | DONE | `provisionContentReplacementState()` 默认启用 aggregate tool-result budget，query 主链按 execution contract taskType 传入 profile |
| TUI Trust Surface short display | DONE | `PromptInputFooter` 新增 `limitDsxuTrustFooterLines()`，窄屏/短屏/Fullscreen 自动压缩到 1-3 行；Pro admission 状态只显示短 token |

Focused 验收：

```text
bun test src/dsxu/engine/__tests__/v8-failure-driven-model-upgrade.test.ts src/dsxu/engine/__tests__/v8-tool-output-artifact-budget.test.ts src/dsxu/engine/__tests__/v8-route-contract-consistency.test.ts src/components/PromptInput/__tests__/PromptInputFooter-trust.test.ts
PASS, 14 pass / 0 fail

bun test src/components/PromptInput/__tests__/PromptInputFooter-trust.test.ts src/components/messages/__tests__/SystemTextMessage-evidence-line.test.ts
PASS, 12 pass / 0 fail

bun -e "await import('./src/query.ts'); console.log('PASS_QUERY_IMPORT')"
PASS_QUERY_IMPORT

bun -e "await import('./src/components/PromptInput/PromptInputFooter.tsx'); console.log('PASS_FOOTER_IMPORT')"
PASS_FOOTER_IMPORT
```

剩余不提前伪完成：live/replay/benchmark 分层验收、真实 DSXU 窗口长内容 resize/交互回归、最终全量回归。

### 15.8 当前真实收口状态复核 - 2026-05-19

本节用于修正 15.4 的历史剩余口径。15.4 是第一批执行后的剩余清单；15.5、15.6、15.7 已继续完成其中大部分代码收束。因此 V8 当前状态以本节为准。

| 验收项 | 当前裁决 | 说明 |
|---|---|---|
| 中文 intent classifier | DONE | 已进入 `action-contract`，用于中文 benchmark、长任务、多文件、解释类、关键风险识别。 |
| route-contract-tool-window 一致性 | DONE | 已进入 `deepseekV4Control`、`action-contract`、`tool-window-policy-v8` 和默认 query/tool view。 |
| Prompt Frame default tail | DONE | 默认 query 已注入 V8 active frame，保留 Goal / profile / risk / tools / evidence / verification / stop condition。 |
| Long Task Work Memory | DONE | 已投影 Task / Source Truth / Change / Failure / Claim 五类 compact memory，并进入 TUI/final report 摘要。 |
| Failure-driven model upgrade | DONE | 第一次失败不直接 Pro；只有 repeated failure + prior Flash + saved evidence + admission 才能进入 Pro。 |
| Tool Output Artifact Budget | DONE | `toolResultStorage` 已按 V8 profile 和 context pressure 做 preview/artifact 预算收束。 |
| TUI Trust Surface short display | DONE_WITH_FOCUSED_TEST | 已压缩底栏/证据线显示；仍需真实 PTY resize/permission/trust proof 场景复测。 |
| Type/import audit | DONE_WITH_FOCUSED_TEST | `DeepSeekRouteAdmissionProjection` 的 Pro admission 类型已收紧，避免 optional route 类型在后续 typecheck 中误报。 |
| V8 live/replay/benchmark | NOT_DONE | mock/internal replay 不允许写公开 claim；还缺真实 provider 或真实 replay/benchmark 分层证据。 |
| 最终全量回归 | NOT_DONE | 仍放在 V8 focused/PTY/live/replay 通过后执行，不能提前作为完成声明。 |

当前允许声明：V8 核心代码主链收束和 focused 合同验收已完成。  
当前不允许声明：V8 release-ready、90%+ 公开能力、真实 benchmark 成绩或 live provider 全链路已完成。

### 15.9 最终 focused + 真实 PTY 复测记录 - 2026-05-19

本轮继续执行 V8，不以“文档写完”当完成。复测角度换成真实可交互体验：长内容、窗口 resize、permission 审核弹窗、scrollback 中间阅读位置、短证据 proof 行是否会被隐藏。

| 验收项 | 命令 | 结果 |
|---|---|---|
| V8 focused 合同总套件 | `bun test src/dsxu/engine/__tests__/v8-failure-driven-model-upgrade.test.ts src/dsxu/engine/__tests__/v8-tool-output-artifact-budget.test.ts src/dsxu/engine/__tests__/v8-long-task-work-memory.test.ts src/dsxu/engine/__tests__/prompt-section-router.test.ts src/dsxu/engine/__tests__/tool-window-ab-contract.test.ts src/dsxu/engine/__tests__/v8-cn-intent-classifier.test.ts src/dsxu/engine/__tests__/v8-route-contract-consistency.test.ts src/dsxu/engine/__tests__/v8-profile-tool-window-policy.test.ts src/dsxu/engine/__tests__/execution-contract-compiler.test.ts src/dsxu/engine/__tests__/tool-view-compiler.test.ts src/components/PromptInput/__tests__/PromptInputFooter-trust.test.ts src/components/messages/__tests__/SystemTextMessage-evidence-line.test.ts` | PASS, 40 pass / 0 fail / 191 expect |
| V8 import audit | `bun -e "await import('./src/dsxu/engine/progress-ledger.ts'); await import('./src/utils/toolResultStorage.ts'); await import('./src/query.ts'); await import('./src/components/PromptInput/PromptInputFooter.tsx'); console.log('PASS_V8_IMPORT_AUDIT')"` | PASS |
| resize / scroll / trust 快速合同 | `bun test src/ink/__tests__/render-node-scroll-resize.test.ts src/hooks/__tests__/useVirtualScroll-resize.test.ts src/components/__tests__/tui-trust-surface.test.tsx` | PASS, 13 pass / 0 fail |
| 真实 PTY resize/permission/trust/scrollback | `bun test src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts -t "resize|trust proof|permission review"` | PASS, 4 pass / 0 fail / 77 expect |
| V8 tool-window AB mock | `bun run scripts/dsxu-v8-tool-window-ab.ts --profiles "single_file_edit,debug,long_task" --windows "8,12,16,20,24,27" --suite "mock-v8-smoke"` | PASS, 18 rows, `publicClaimAllowed=false` |
| provider readiness gate | `bun run scripts/dsxu-live-provider-gate.ts` | READY_FOR_SCOPED_LIVE_REPLAY, `didCallProvider=false` |
| live cache prefix evidence ingest | `bun run scripts/dsxu-live-cache-prefix-smoke.ts` | DONE_EVIDENCED, `didCallProvider=false` |

真实 PTY 复测先发现一个回归：宽屏 resize 后底栏只显示 status / ledger / agent，proof 行被 3 行上限裁掉，导致审核证据不见。修复为：短屏/窄屏仍保持 1-2 行；只有 fullscreen 且宽高足够时允许 4 行 compact trust lines，确保 proof 行可见且不会 flood。

新增证据文件：

| 文件 | 用途 |
|---|---|
| `docs/generated/DSXU_V8_COMPLETION_AUDIT_20260519.json` | V8 当前完成度、focused/PTY 验收结果、claim boundary 和剩余 release gate |

当前 V8 裁决（历史阶段记录，后续 15.13/15.14 已继续复验；最终口径以后文为准）：

| 层级 | 裁决 |
|---|---|
| 代码主链收束 | PASS |
| focused 合同验收 | PASS |
| 真实 PTY 交互风险复测 | PASS |
| provider live readiness | READY |
| 新 live model replay | PASS_FLASH_FIRST_EVIDENCED |
| public benchmark / 90% claim | BLOCKED |
| 最终全量回归 | NOT_RUN |

因此，V8 可以标记为：`PASS_V8_IMPLEMENTATION_AND_FOCUSED_ACCEPTANCE`。  
V8 仍不能标记为：`release-ready`、`public benchmark pass`、`90%+ public claim ready`。

### 15.10 Scoped live replay 追加记录 - 2026-05-19

继续执行 V8 发布级 gate，先跑 Flash-first scoped live replay，不打开默认 Pro。执行时显式设置 `DSXU_V24_ALLOW_PRO_RESCUE=0`，确保只有在后续明确准入时才允许 Pro。

| 验收项 | 命令 | 结果 |
|---|---|---|
| Flash-first scoped live replay | `$env:DSXU_V24_ALLOW_PRO_RESCUE='0'; bun run scripts/dsxu-v24-live-acceptance-router.ts` | PASS_FLASH_FIRST_EVIDENCED |

关键结果：

| 字段 | 值 |
|---|---|
| finalMatchesSourceTruth | `true` |
| proWasRun | `false` |
| flash cost | `$0.0021480256000000002` |
| outputJson | `docs/generated/DSXU_V24_LIVE_ACCEPTANCE_ROUTER_20260515.json` |
| tracePath | `.dsxu/trace/v24-live-dsxu/v24-flash-first-pbt-source-truth-2026-05-19T15-10-33-329Z.jsonl` |

该结果可以作为 V8 scoped live replay 证据，但仍不是公开 benchmark 或 90% claim 证据。下一步只能进入 benchmark evidence 或最终分层回归，不能把这条单题 live replay 夸大成发布榜单成绩。

### 15.11 V8 hard engineering benchmark 子集 - 2026-05-19

继续执行 V8 benchmark evidence。为了覆盖 V8 最核心的三条产品价值链，本轮选择三个任务：

| 任务 | 覆盖能力 |
|---|---|
| `deepseek-route-cost-cache` | DeepSeek route/cost/cache/admission 真值表 |
| `visible-product-timeline` | 可见工作状态、TUI/CLI/final report 投影 |
| `release-claim-evidence-binder` | 发布 claim 证据绑定和防夸大 |

执行命令：

```powershell
$env:DSXU_HARD_BENCHMARK_TASK='deepseek-route-cost-cache,visible-product-timeline,release-claim-evidence-binder'
bun run scripts/dsxu-hard-engineering-benchmark.ts
```

结果：

| 字段 | 值 |
|---|---|
| status | `PASS_DSXU_HARD_ENGINEERING_LIFT` |
| totalTasks | `3` |
| rawPassRatePct | `0` |
| dsxuPassRatePct | `100` |
| rawAverageScore | `60` |
| dsxuAverageScore | `100` |
| rawTotalCostUSD | `$0.0008274` |
| dsxuTotalCostUSD | `$0.03608887520000001` |
| outputJson | `docs/generated/DSXU_HARD_ENGINEERING_BENCHMARK_20260517_deepseek-route-cost-cache-visible-product-timeline-release-claim-evidence-binder.json` |
| report | `docs/DSXU_HARD_ENGINEERING_BENCHMARK_20260517_deepseek-route-cost-cache-visible-product-timeline-release-claim-evidence-binder.md` |
| chart | `docs/assets/dsxu-hard-engineering-benchmark.svg` |

边界：

- 这证明 DSXU 在内部 hard engineering fixture 上的工作流提升：可读代码、改代码、跑测试、修隐藏失败、生成证据。
- 这不是 SWE-bench / Terminal-Bench / OSWorld / tau-bench 等外部正式成绩。
- 仍不能写公开 `90%+` 或外部模型胜出 claim。

### 15.12 Release owner focused gate 修复记录 - 2026-05-19

继续执行 V8 发布收口时，上一轮 `test:six-stage-final` 的两个失败项被拆开处理：

| 失败项 | 真实原因 | 处理结果 |
|---|---|---|
| `release-surface-tests` | 三个 release surface 断言失败；根因是治理脚本里仍有公开面对标品牌/模型族直写文本。 | 已改为中性 reference-product / external proprietary assistant 口径，保留风险识别能力，不再把品牌名暴露为 public surface blocker。 |
| `release-gate` | 同时受 DeepSeek route 旧断言和 release surface blocker 影响。 | route contract 已收紧；release owner gate 已通过。 |

新增/复跑验收：

| 验收项 | 命令 | 结果 |
|---|---|---|
| release surface gate harness | `runV18PublicSurfaceCleanGateHarness()` + `runV18ProprietaryCodeRiskGateHarness()` | 两者均 `DONE_EVIDENCED`，`blockerCount=0` |
| release surface owner tests | `bun test ./src/dsxu/engine/__tests__/release-test-gate-v1.test.ts ./src/dsxu/engine/__tests__/release-surface-v1.test.ts ./src/dsxu/engine/__tests__/release-surface-source-policy-review-v1.test.ts` | PASS, 13 pass / 0 fail / 88 expect |
| release owner focused gate | `bun run test:dsxu:release` | PASS, 514 pass / 0 fail / 3835 expect |

代码口径：

- 没有新增 runtime、provider、permission、ToolBus 或 TUI 主链。
- 没有删除历史证据文档；历史 reference/source truth 仍按 release export rewrite-or-exclude 处理。
- 没有把内部 benchmark 或 smoke 夸大成公开成绩。

当前 V8 裁决更新为：`PASS_V8_FOCUSED_LIVE_INTERNAL_BENCHMARK_RELEASE_OWNER_ACCEPTANCE`。

仍未完成：

- `test:six-stage-final` 尚未在本轮修复后完整重跑。
- public/external benchmark target manifest/raw transcript 仍缺，不能写外部 90%+ 或模型胜出 claim。
- clean export 仍需最终 release closure gate 全绿后再进入。

### 15.13 六阶段最终验收闭环 - 2026-05-20

继续按 V8/V4 的硬验收标准执行，不用单测替代最终阶段。本轮先完整重跑 `test:six-stage-final`，发现失败已经收窄成同一个真实 TUI harness 场景：

| 失败项 | 现象 | 根因判断 |
|---|---|---|
| `experience-visible-tui-core` | `real TUI harness V1 > replays a live background task pill...` 偶发看不到 background task pill。 | 长套件中 harness replay effect 可能错过 `queryGuard.isActive` 从 active 到 idle 的变化，因为 dependency list 使用 `queryGuard` 对象而不是 `queryGuard.isActive` 布尔值。 |
| `release-gate` | 同一 real TUI harness 场景在 release owner gate 中失败。 | 同一根因，非 release surface / route / claim blocker。 |

修复：

- `src/screens/REPL.tsx` 中 no-progress、long-content resize、trust proof、auto-continue、resume、background-task replay 这 6 个 harness effect 均改为依赖 `queryGuard.isActive`。
- 这是 TUI 真实交互稳定性修复，不是新增 runtime，也不是测试放水。

复测：

| 验收项 | 命令 | 结果 |
|---|---|---|
| 高风险真实 PTY 子集 | `bun test src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts -t "no-progress\|auto-continue\|compact resume\|live background task\|resize\|trust proof\|permission review"` | PASS, 8 pass / 0 fail / 156 expect |
| experience-visible-tui-core | `bun test ./src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts ./src/dsxu/engine/__tests__/model-driven-tui-long-task-v1.test.ts ./src/dsxu/engine/__tests__/streaming-ui-visibility-v1.test.ts` | PASS, 30 pass / 0 fail / 273 expect |
| release owner gate | `bun run test:dsxu:release` | PASS, 514 pass / 0 fail / 3835 expect |
| six-stage final | `bun run test:six-stage-final` | PASS, 20/20 commands passed |

最终裁决：

| 项 | 裁决 |
|---|---|
| V8 focused contracts | PASS |
| 真实 PTY resize / permission / trust / background task | PASS |
| Scoped Flash-first live replay | PASS |
| Internal hard engineering benchmark subset | PASS |
| Release surface / commercial IP hard blockers | PASS, blocker=0 |
| Release owner focused gate | PASS |
| Six-stage final | PASS |
| Public external benchmark / 90%+ superiority claim | BLOCKED，仍需 paired target manifest、raw transcripts、成本、失败恢复全链路证据 |
| Clean export artifact | NOT_CREATED，本轮只完成 preflight/final gates，没有创建发布包 |

当前 V8 可标记为：`PASS_V8_SIX_STAGE_FINAL_ACCEPTANCE`。  
当前仍不能标记为：公开外部 benchmark PASS、外部模型胜出、已生成 clean export artifact。

### 15.14 V8 反作弊脚本与 fresh 六阶段复验补齐 - 2026-05-20

本节修正“V8 核心通过但反作弊脚本缺失、六阶段 fresh run 10 分钟未自然结束”的复审结论。处理原则仍是不新增主链、不新增 runtime、不新增 provider 层，只把缺口归入现有 owner。

| 项 | 命令 | 结果 |
|---|---|---|
| V8 agent/tool-window/expert focused tests | `bun test src/dsxu/engine/__tests__/v8-cn-intent-classifier.test.ts src/dsxu/engine/__tests__/v8-route-contract-consistency.test.ts src/dsxu/engine/__tests__/v8-profile-tool-window-policy.test.ts src/dsxu/engine/__tests__/v8-agent-role-tool-window.test.ts src/dsxu/engine/__tests__/v8-expert-context-activation.test.ts src/dsxu/engine/__tests__/v8-long-task-work-memory.test.ts` | PASS, 17 pass / 0 fail / 92 expect |
| 默认链 reachability | `bun run scripts/dsxu-v8-default-chain-reachability.ts` | PASS, 4 rows / 0 blockers |
| 中文场景 replay | `bun run scripts/dsxu-v8-cn-scenario-replay.ts` | PASS, 5 scenarios / 0 blockers |
| 长任务账本 replay | `bun run scripts/dsxu-v8-long-task-ledger-replay.ts` | PASS, recoverable ledger / durable recovery / runtime event proof |
| provider contract smoke | `bun run scripts/dsxu-v8-live-provider-smoke.ts --dry-run` | PASS, 6 checks / 0 blockers；当前 shell 没有 DeepSeek key，未做 live one-call |
| 六阶段 fresh run | `bun run test:six-stage-final` | PASS, 20/20 commands；本轮自然结束，耗时约 14m49s |

同时修正一个真实工具窗口风险：`WebSearch` / `WebFetch` 已归入 `Tool Gate / Network Tool Policy` 的 searchable 能力，默认 V8 tool view 会隐藏它们；只有显式 allow / domain match / task contract 才能进入模型可见工具窗口。这避免默认工具池把网络工具暴露给普通长任务或普通编码任务。

最新裁决：

| 项 | 裁决 |
|---|---|
| V8 核心代码能力 | PASS |
| V8 反作弊脚本 | PASS |
| V8 中文 intent / route / tool-window 黑盒合同 | PASS |
| V8 长任务 ledger/recovery 投影 | PASS |
| V8 provider dry-run API contract | PASS |
| V8 六阶段 fresh run | PASS |
| 当前环境 live one-call provider smoke | NOT_RUN，原因是当前 shell 未提供 DeepSeek key |
| public external benchmark / 90%+ superiority claim | BLOCKED，仍需 paired target manifest、raw transcripts、成本、失败恢复全链路证据 |
| clean export artifact | NOT_CREATED，需要显式 release action 重新生成 |

当前 V8 可以标记为：`PASS_V8_DEFAULT_CHAIN_AND_SIX_STAGE_CLOSED`。  
当前仍不能标记为：`release-ready`、公开外部 benchmark PASS、外部模型胜出、已生成 clean export artifact。
