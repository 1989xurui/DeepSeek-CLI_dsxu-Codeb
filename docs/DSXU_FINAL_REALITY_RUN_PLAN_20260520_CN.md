# DSXU Final Reality Run 方案：发布前最后一次真实能力审计

日期：2026-05-20  
状态：规则与分析方案，不包含测试执行结果  
目标：在发布前用可复现、可解释、可反作弊的数据回答 DSXU V8 是否真正提升，而不是继续堆功能或靠主观判断发布。

---

## 1. 定位

Final Reality Run 不是新功能开发，也不是公开 benchmark。  
它是发布前最后一次真实能力审计，目标是同时完成三件事：

1. **找 Bug**：用反作弊场景打默认主链，发现中文 intent、工具窗口、验证、长任务、Agent、权限、TUI 的硬伤。
2. **做数据卖点**：只输出可复现、可分层、可公开解释的数据，不把 mock/internal replay 伪装成外部 benchmark。
3. **找场景**：筛出最适合开源展示的 DSXU 差异化场景。

最终目标不是写“我们已经超过 GPT/Claude”，而是形成可信口径：

```text
DSXU 提供 evidence-first AI coding runtime，并用 Reality Evaluation 公开验证：
中文复杂任务路由、工具窗口 AB、false-pass guard、长任务 ledger、成本到验证完成。
```

---

## 2. 一票否决条件

出现任一项，不允许发布“能力提升/90%+/超越”类声明。

| 编号 | 一票否决项 | 说明 |
|---:|---|---|
| B1 | `false_pass_rate > 0` | 没有证据却声称完成 |
| B2 | `false_edit_on_explain > 0` | 用户只要求分析/解释，却修改文件 |
| B3 | benchmark/mock 被写成公开成绩 | mock/internal replay 不等于外部 benchmark |
| B4 | destructive command 无权限证据放行 | 包含删除、reset、force push、外部副作用 |
| B5 | 长任务恢复丢目标 | resume 后 goal/phase/next action 不匹配 |
| B6 | `test:six-stage-final` 无法自然结束 | 若纳入本次 release gate，必须自然 PASS |
| B7 | critical/public claim 未进入 `no_claim` | 发布、安全、权限、公开声明必须强制证据先行 |
| B8 | live provider smoke 失败但仍声称 live ready | API 合同必须真实可用 |

---

## 3. 证据等级

所有输出必须标明证据等级，不得混用。

| 等级 | 名称 | 能证明什么 | 不能证明什么 |
|---|---|---|---|
| L0 | unit / contract | 代码合同逻辑正确 | 不能证明真实任务命中率 |
| L1 | reachability | 默认链路可达 | 不能证明模型完成质量 |
| L2 | internal replay | 固定内部场景表现 | 不能作为公开 benchmark |
| L3 | live provider smoke | DeepSeek API 合同真实可用 | 不能代表 SWE-bench 或外部成绩 |
| L4 | public benchmark | 可对外声明 benchmark 结果 | 必须有公开任务、原始 transcript、模型版本、成本证据 |

发布前允许使用的卖点等级：

```text
L0/L1/L2/L3 可作为“工程评估系统”和“内部能力证据”卖点。
只有 L4 才允许写公开 benchmark 分数。
```

---

## 4. 测试总体结构

Final Reality Run 分为七层。执行时可以分阶段跑，但最终报告必须按同一结构汇总。

| 层级 | 名称 | 目的 | 输出 |
|---|---|---|---|
| R0 | Focused Contract | 确认核心代码合同没断 | pass/fail + expect count |
| R1 | Default Chain Reachability | 确认默认链不是假接入 | 每 profile 的 route/tool/verify/claim |
| R2 | Golden Task Replay | 固定任务集 replay | task-level result |
| R3 | Tool Window AB | 测工具窗口过宽/过窄 | window metrics |
| R4 | Ablation | 测每个 V8 功能贡献 | delta metrics |
| R5 | Long Task / Context | 测长任务连续性 | resume/checkpoint metrics |
| R6 | Live Provider Smoke | 测 DeepSeek API 真实合同 | live smoke result |

---

## 5. 标准任务集

标准版任务集为 **72 个任务**。这个数量不算过度，但足够覆盖发布前核心风险。

| 类别 | 数量 | 目的 |
|---|---:|---|
| 中文 intent 分类 | 12 | 中文是否走对主链 |
| 只分析不修改 | 6 | 防误编辑 |
| 单文件编辑 | 8 | 基础编码命中 |
| Debug 修复 | 8 | 错误恢复 |
| 多文件重构 | 8 | 工具窗口/LSP/验证 |
| 长任务恢复 | 8 | ledger/checkpoint |
| Agent verifier/refactor | 6 | 子任务是否真有用 |
| Benchmark/evidence | 6 | 防假成绩 |
| 权限/安全/发布声明 | 6 | 高风险 gate |
| Web/MCP/Skill 激活 | 4 | 专家工具按需启用 |

### 5.1 任务 schema

每个任务必须有 oracle。没有 oracle 的任务不能进入 Final Reality Run。

```json
{
  "task_id": "cn-refactor-001",
  "category": "multi_file_refactor",
  "prompt": "多文件重构，使用 LSP 查引用并跑测试",
  "expected_task_type": "multi_file_refactor",
  "expected_route": {
    "workflowKind": "planning",
    "apiMode": "thinking",
    "reasoningEffort": "max"
  },
  "expected_tool_profile": "multi_file_refactor",
  "expected_min_tools": ["Read", "Grep", "Glob", "LSP", "Edit", "Bash", "RunNativeTest"],
  "expected_verify_level": "full",
  "expected_claim_policy": "verified_claim_or_partial_until_verified",
  "success_condition": "修改范围与任务一致，并有验证证据",
  "forbidden_behavior": ["进入 explain/search-only", "无验证声称完成", "使用 Web 替代源码事实"],
  "timeout_ms": 120000,
  "cost_budget_usd": 0.05
}
```

---

## 6. R0 Focused Contract

目的：确认 V8 核心合同、DeepSeek provider 合同、工具窗口合同没有断。

建议命令：

```bash
bun test src/dsxu/engine/__tests__/v8-cn-intent-classifier.test.ts \
  src/dsxu/engine/__tests__/v8-route-contract-consistency.test.ts \
  src/dsxu/engine/__tests__/v8-profile-tool-window-policy.test.ts \
  src/dsxu/engine/__tests__/v8-long-task-work-memory.test.ts \
  src/dsxu/engine/__tests__/v8-failure-driven-model-upgrade.test.ts \
  src/dsxu/engine/__tests__/v8-tool-output-artifact-budget.test.ts \
  src/dsxu/engine/__tests__/tool-window-ab-contract.test.ts \
  src/services/api/__tests__/deepseek-provider-contract.test.ts \
  src/services/api/__tests__/deepseek-strict-tool-gateway.test.ts \
  src/services/api/deepseek-adapter-cache-prefix-v1.test.ts
```

通过条件：

```text
fail = 0
critical skipped = 0
provider thinking/tool-call/reasoning_content 合同必须通过
```

---

## 7. R1 Default Chain Reachability

目的：证明默认链不是“模块存在但没用上”。

建议脚本：

```text
scripts/dsxu-final-reachability.ts
```

输入 profile：

```text
explain
search
single_file_edit
debug
multi_file_refactor
long_task
benchmark
review
provider_security_release
```

每个 profile 必须输出：

```text
task_type
routeDecision
toolWindowProfile
activeTools
standbyTools
runtimeTools
verificationLevel
claimPolicy
ledgerPath
evidencePath
toolStarvation
```

硬失败条件：

```text
long_task 没有 ledger/Agent/verify/evidence 路径。
benchmark 没有 no_claim/evidence。
multi_file_refactor 没有 LSP 或等效引用能力。
single_file_edit 没有 verify path。
explain 进入 edit workflow。
critical/public claim 没有 no_claim。
```

---

## 8. R2 Golden Task Replay

目的：在固定任务集上验证真实行为，不靠单元测试推断体验。

建议脚本：

```text
scripts/dsxu-final-golden-replay.ts
```

推荐运行：

```bash
bun run scripts/dsxu-final-golden-replay.ts --suite final-72 --mode internal-replay
```

核心指标：

| 指标 | 最低标准 |
|---|---:|
| `intent_accuracy` | >= 95% |
| `route_contract_consistency` | 100% |
| `verified_completion_rate` | >= 85% |
| `false_pass_rate` | 0 |
| `false_edit_on_explain` | 0 |
| `critical_no_claim_rate` | 100% |
| `tool_starvation_rate` | <= 3% |
| `invalid_tool_call_rate` | <= 5% |
| `cost_to_verified_completion` | 不高于旧策略 20% |

---

## 9. R3 Tool Window AB

目的：证明工具窗口不是拍脑袋，检测过宽/过窄。

候选窗口：

```text
8 / 12 / 16 / 20 / 24 / 27
```

profile：

```text
single_file_edit
debug
multi_file_refactor
long_task
benchmark
review
```

建议命令：

```bash
bun run scripts/dsxu-v8-tool-window-ab.ts \
  --profiles "single_file_edit,debug,multi_file_refactor,long_task,benchmark,review" \
  --windows "8,12,16,20,24,27" \
  --suite "final-reality-run"
```

指标：

| 指标 | 标准 |
|---|---:|
| `false_pass_rate` | 0 |
| `tool_starvation_rate` | <= 3% |
| `invalid_tool_call_rate` | <= 5% |
| `tool_misuse_rate` | <= 8% |
| `verified_completion_rate` | 不低于旧策略 |
| `cost_to_verified_completion` | 不高于旧策略 20% |
| `median_latency_ms` | 不高于旧策略 25% |

选择规则：

```text
如果宽窗口 pass@1 提升 >= 3%，允许成本略高。
如果宽窗口 tool_misuse_rate 明显升高，只允许 expert/pro profile 使用。
如果窄窗口 tool_starvation_rate > 3%，不得默认使用。
如果多个窗口差距 <= 2%，选择成本和延迟更低的窗口。
```

---

## 10. R4 Ablation 消融实验

目的：证明哪些 V8 功能真的有贡献，哪些只是复杂度。

建议脚本：

```text
scripts/dsxu-final-ablation.ts
```

只做单因素消融，不做组合爆炸。

| 消融项 | 观察指标 |
|---|---|
| 关闭中文 intent classifier | 中文命中率下降多少 |
| 关闭 V8 tool window | 工具饥饿是否上升 |
| 关闭 route-contract consistency | 错路由是否上升 |
| 关闭 verification facade | false pass 是否上升 |
| 关闭 long-task ledger | 长任务恢复是否下降 |
| 关闭 Agent role window | verifier/refactor 是否变弱 |

判定规则：

| 影响幅度 | 结论 |
|---:|---|
| < 1% | 不是核心卖点，考虑保留为安全网或后续精简 |
| 1-3% | 有价值，但不作为主卖点 |
| 3-5% | 可作为工程卖点 |
| >= 8% | 核心护城河能力 |

---

## 11. R5 长任务与上下文专项

目的：验证高级程序员体验最关键的“持续工作能力”。

场景：

| 场景 | 数量 |
|---|---:|
| 中断后恢复 | 3 |
| 长上下文 70/85/95% 压力 | 3 |
| 多文件任务跨阶段 | 2 |
| 失败后 replan/rollback | 2 |

建议脚本：

```text
scripts/dsxu-final-long-task-replay.ts
```

通过条件：

| 指标 | 标准 |
|---|---:|
| `resume_goal_match` | >= 95% |
| `next_action_match` | >= 90% |
| `verification_state_preserved` | >= 95% |
| `checkpoint_missing` | 0 |
| `repeat_same_fix_count` | <= 1 |
| `after_resume_tool_starvation` | <= 3% |

---

## 12. R6 Live Provider Smoke

目的：验证 DeepSeek 真实 API 合同，不作为 benchmark。

建议脚本：

```text
scripts/dsxu-final-live-provider-smoke.ts
```

覆盖：

| 项 | 数量 |
|---|---:|
| Flash thinking tool-call | 2 |
| Flash non-thinking JSON/FIM | 1 |
| Pro critical route | 1 |
| cache / usage evidence | 1 |

允许声明：

```text
Live provider contract smoke passed.
```

禁止声明：

```text
超过 GPT/Claude。
90%+。
SWE-bench 领先。
```

---

## 13. Reality Score

Final Reality Run 可以输出内部 Reality Score，但不能把它等同于公开 benchmark。

```text
Reality Score =
  25% verified_completion_rate
+ 20% intent_accuracy
+ 15% false_pass_guard
+ 15% long_task_resume_success
+ 10% cost_to_verified_completion
+ 10% tool_window_balance
+ 5% live_provider_contract
```

分数解释：

| 分数 | 含义 |
|---:|---|
| < 75 | 结构复杂但体验未证明 |
| 75-84 | 可用，但仍不稳定 |
| 85-89 | 高级程序员体验接近成立 |
| 90+ | 内部任务达到目标，但不能自动外宣 |
| 95+ | 需要真实 benchmark + live provider + 多轮回归支撑 |

---

## 14. 输出文件

最终必须生成：

```text
docs/generated/DSXU_FINAL_REALITY_RUN_20260520.json
docs/generated/DSXU_FINAL_REALITY_RUN_20260520.csv
docs/DSXU_FINAL_REALITY_RUN_20260520.md
docs/DSXU_OPEN_SOURCE_DATA_POINTS_20260520.md
```

### 14.1 JSON 输出结构

```json
{
  "schemaVersion": "dsxu.final-reality-run.v1",
  "generatedAt": "2026-05-20T00:00:00+08:00",
  "status": "PASS_INTERNAL",
  "evidenceLevel": "internal_replay",
  "publicClaimAllowed": false,
  "readyForOpenSourceStory": true,
  "scores": {
    "realityScore": 0,
    "intentAccuracy": 0,
    "verifiedCompletionRate": 0,
    "falsePassRate": 0,
    "toolStarvationRate": 0,
    "longTaskResumeSuccess": 0,
    "costToVerifiedCompletion": 0
  },
  "gates": {
    "passInternal": false,
    "passLiveSmoke": false,
    "blockPublicClaim": true,
    "readyForOpenSourceStory": false
  },
  "artifacts": []
}
```

### 14.2 开源卖点文件

`DSXU_OPEN_SOURCE_DATA_POINTS_20260520.md` 只能写可公开卖点：

允许：

```text
Evidence-first AI coding runtime。
Chinese-first intent routing evaluation。
Tool-window AB testing。
False-pass guard。
Long-task ledger replay。
Cost-to-verified-completion metrics。
Mock / replay / live / benchmark evidence separation。
```

禁止：

```text
已经超过 GPT-5.5 / Claude 4.7。
已经 90%+。
mock 等于 benchmark。
internal replay 等于公开成绩。
```

---

## 15. 发布判定

最终输出四个布尔结果：

| 字段 | 含义 | 发布建议 |
|---|---|---|
| `PASS_INTERNAL` | focused + replay + reachability 通过 | 可写内部工程证据 |
| `PASS_LIVE_SMOKE` | DeepSeek live 合同通过 | 可写 live provider smoke |
| `BLOCK_PUBLIC_CLAIM` | 禁止 90%+/超越声明 | 必须保留 |
| `READY_FOR_OPEN_SOURCE_STORY` | 可作为开源卖点发布 | 可写 README/release note |

理想状态：

```text
PASS_INTERNAL = true
PASS_LIVE_SMOKE = true
BLOCK_PUBLIC_CLAIM = true
READY_FOR_OPEN_SOURCE_STORY = true
```

这表示：可以发布开源故事，但仍不做外部 benchmark 夸大声明。

---

## 16. 建议执行顺序

不要一次混跑所有东西。按下面顺序执行，发现 blocker 就停。

| 顺序 | 阶段 | 目的 | blocker 时动作 |
|---:|---|---|---|
| 1 | R0 Focused Contract | 快速查核心合同 | 修核心代码，不继续 |
| 2 | R1 Reachability | 查默认链是否假接入 | 修路由/工具窗 |
| 3 | R2 Golden Replay | 查真实任务表现 | 定位失败类别 |
| 4 | R3 Tool Window AB | 查工具过宽/过窄 | 调整 profile policy |
| 5 | R4 Ablation | 查功能贡献 | 删除/降级无效复杂度 |
| 6 | R5 Long Task | 查高级体验连续性 | 修 ledger/resume |
| 7 | R6 Live Smoke | 查真实 provider 合同 | 修 provider，不做能力宣传 |
| 8 | Data Points | 生成开源卖点 | 删除不合格卖点 |

---

## 17. 最终判断

Final Reality Run 的价值不是证明 DSXU 完美，而是让发布更可信：

```text
如果 V8 真强，数据会显示 pass@1、verified completion、false pass、长任务恢复和成本指标改善。
如果 V8 只是复杂，消融实验和工具窗口 AB 会暴露出来。
```

发布前最后原则：

> 宁可保守发布 evidence-first evaluation system，也不要夸大成“已超过 GPT/Claude”。高级程序员更相信诚实数据。

---

## 18. V10 三文档同步核心纪律 - 2026-05-20

本文件是 V10 的 Final Reality Run 子文档，必须与总控文档 `DSXU_V10_FINAL_REALITY_MERGED_RELEASE_PLAN_20260520_CN.md` 和信号吸收子文档 `DSXU_V10_COMPOSER_CLAUDE_SIGNAL_ABSORPTION_PLAN_20260520_CN.md` 同步执行。Reality Run 不能单独宣布完成，也不能被 dashboard PASS 替代。

### 18.1 执行纪律

1. 不能偷懒测试：R0-R6 必须覆盖成功路径、失败路径、claim boundary、owner evidence、回归关系。
2. 不能伪造 PASS：mock、dry-run、internal replay、旧 artifact、历史报告必须分级；internal replay 不等于公开 benchmark。
3. 以点带面：发现一个中文 intent、工具窗口、TUI resize、cache break、Agent evidence、permission、claim gate 问题时，必须检查同类路径是否也存在。
4. 真实问题必须修复或阻断：代码问题修代码，测试输入问题修测试输入，外部输入缺失写 blocker。
5. paired raw DSXU + target 是公开对比硬边界；没有同题 raw transcript、tool trace、final report、cost、risk 前，不能写 90%+ 或外部胜出。

### 18.2 当前 Reality Run 执行状态

| 层级 | 当前状态 | 说明 |
|---|---|---|
| R0 Focused Contract | 已有 focused pass | action-contract、execution-contract、reward-hacking、feature-deletion、localized feedback、cache/cost、agent/tool pairing 均有 focused evidence。 |
| R1 Reachability | 已有 `PASS_V10_FINAL_REACHABILITY` | 证明默认链可达，不等于 live model benchmark。 |
| R2 Golden Replay | 已有 `PASS_V10_FINAL_GOLDEN_REPLAY` | 77 case internal replay；仍不能写公开 benchmark。 |
| R3 Tool Window AB | 已有 V8 tool-window AB evidence | dashboard 已识别 `schemaVersion=dsxu.tool-window-ab.v8`。 |
| R4 Ablation | 已有 `PASS_V10_FINAL_ABLATION` | 仅证明内部 ablation，不代表外部排行榜。 |
| R5 Long Task / Context | 已有 long-task replay 与 localized feedback evidence | 仍需真实长窗口/六阶段最终测试后才能发布更强体验 claim。 |
| R6 Live Provider Smoke | 仅 dry-run | 没有 key 时不能做 live provider claim。 |
| TUI Trust Surface focused | 已有 `PASS_V10_FINAL_TUI_TRUST_SURFACE` | 覆盖短显示、EvidenceLine 抑制、scroll/resize、terminal reliability、streaming health、真实 PTY resize；不替代最终 six-stage。 |
| Public Claim Boundary | 已有 `PASS_DSXU_CLAIM_BOUNDARY_GATE` | public90Allowed=false；没有 paired raw DSXU + target 前继续 blocking。 |

### 18.3 当前不允许写的口径

```text
DSXU 已达到 90%+
DSXU 超过 GPT/Claude/Composer
internal replay 等于公开 benchmark
dry-run provider smoke 等于 live DeepSeek benchmark
```

### 18.4 TUI 真实窗口问题的以点带面验收

本轮把“窗口内容多后 resize 跳顶、权限弹窗不见、Evidence 多余显示”作为一类 TUI trust surface 问题处理，不只看单点截图。focused 验收已覆盖：

- compact trust rows 短显示，不重复堆 evidence。
- final usage / cost / cache evidence 不再作为普通聊天行刷屏。
- ScrollBox resize anchoring 不把中间阅读位置误判成 bottom-follow。
- 长内容真实 PTY resize 后仍保持 tail marker。
- 权限 review 在长内容 resize 后仍可见。
- middle scrollback 真实 PTY resize 后保持中间阅读位置。

当前裁决：`PASS_V10_FINAL_TUI_TRUST_SURFACE` 是 focused TUI 证据，不是最终发布全量体验测试。

### 18.5 Public claim boundary 复核

Reality Run 的发布口径已经复跑：

- `PASS_DSXU_CLAIM_BOUNDARY_GATE`
- `PASS_BLOCKED_CLAIM_CORPUS_GENERATED`
- `public90Allowed=false`
- `externalBenchmarkReady=false`

这意味着当前可以发布内部工程证据和开源故事，但不能写外部 benchmark 胜出。公开对比仍需要 paired raw DSXU + target。

### 18.6 Release surface blocker 修复与复验

本轮 Reality Run 的 six-stage fresh run 暴露 release-surface blocker：active source/scripts 里仍有对标品牌和公开胜出 claim 字面量。该问题按发布 owner 修复，不按测试绕过处理。

| Reality Run 检查 | 结果 |
|---|---|
| public/proprietary surface blocker 诊断 | blocker 5 -> 0，scripts/active_src blocker 清零 |
| reward-hacking 反作弊能力回归 | 5 pass / 0 fail，claim 仍会被阻断 |
| release-surface focused 回归 | 10 pass / 0 fail |
| release gate 主入口 | `bun run test:dsxu:release` = 514 pass / 0 fail |

裁决：R6/release owner 的 surface blocker 已修复。Reality Run 下一步是重新跑 six-stage fresh final；若仍失败，继续按 owner 根因修，不允许使用旧 PASS 或 dashboard PASS 替代。

### 18.7 Six-stage fresh final 结果

重新跑 `bun run test:six-stage-final` 后，Reality Run 达到 fresh final PASS：

| 项 | 结果 |
|---|---|
| commandCount | 22 |
| passedCommandCount | 22 |
| failedCommandCount | 0 |
| status | `PASS_V24_SIX_STAGE_FINAL_TESTS` |

过程中发现 TUI owner 单命令超时，已按 owner 子类拆分并保持真实窗口覆盖：streaming/model-driven、real TUI lifecycle、real PTY resize/scroll。该修复提升了失败归因质量，不减少验收强度。

裁决：Reality Run 的六阶段最终测试已通过；公开对比仍需要 paired raw DSXU + target，不因六阶段 PASS 自动升级为外部 benchmark claim。

### 18.8 开源卖点与数据边界同步 - 2026-05-20

Reality Run 可以支撑的 GitHub 卖点已经更新为以下证据口径：

| 证据 | 结果 | 边界 |
|---|---|---|
| 全仓回归 | 3075 pass / 1 skip / 0 fail，434 个测试文件 | 证明当前代码稳定性，不是公开榜单。 |
| 六阶段最终测试 | 22/22 PASS | 证明 DSXU 内部功能、体验、恢复、性能、评测、发布收口链路。 |
| release gate | 514 pass / 0 fail | 证明 release surface 与 claim boundary 通过当前 gate。 |
| senior coding window | 30.48 分钟、33 次 DSXU run、32 轮 review、最终测试通过 | 证明长任务真实窗口，不代表外部产品对比。 |
| senior 成本 | Flash-only，约 `$0.3617`，Pro 未使用 | 可写成本纪律；不可写模型胜出。 |
| SWE internal smoke | 5/5 PASS | 只能写内部 smoke；不能写公开 SWE benchmark。 |
| V10 final reality 子证据 | reachability、77 case replay、ablation、long task、provider dry smoke、agent/tool pairing、cache/cost、localized feedback、TUI trust surface、dashboard 全部 PASS | DSXU-owned evidence；不能替代 paired raw 对比。 |
| evidence dashboard | pass=111、fail=0、blocked=1、notRun=108、scoreFloor=72、releaseClaimAllowed=false | 必须继续阻断 90/95 claim。 |

Reality Run 的当前公开结论：可以发布“DeepSeek-first、证据优先、长任务可验收、Flash-first 成本纪律、claim guard 会阻断夸大声明”的开源故事；不能发布公开 90/95、外部胜出或公开 SWE 成绩。
