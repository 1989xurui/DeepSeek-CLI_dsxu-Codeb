# DSXU V3 Cache-First Follow-up Tracker

日期：2026-05-21

目标：先把缓存命中率优化链收口，再跑 14 个 finalization non-pass replay，最后处理 V2 训练/证据缺口。本文只记录待办、验收和顺序，不新增大架构。

## 执行顺序

1. 先完成缓存命中率优化收口。
2. 缓存聚焦测试通过后，跑 14 个 finalization non-pass replay。
3. replay 通过后处理 V2 训练数据闭环缺口。
4. 最后刷新 evidence dashboard，不提前声明 80-90% 真实命中率。

## 规划记录表

| ID | 轨道 | 状态 | 需要做的事 | 当前代码证据 | 验收命令 | 硬验收标准 |
|---|---|---|---|---|---|---|
| C1 | Cache | DONE | `cache:warm` 默认使用真实运行时 stable prefix 的 dry-run 计划，不再空跑 | `scripts/dsxu-cache-warm.ts` 会在无显式 prefix 时调用 `getSystemPrompt()` 并传入 `systemPromptSections` | `bun run cache:warm --dry-run` | `warmedKeys >= 1`，输出只有 hash/长度，不泄露完整 prompt |
| C2 | Cache | READY | 刷新 hash-only cache reality run | `scripts/dsxu-cache-reality-run.ts` 已存在；`docs/generated/DSXU_CACHE_REALITY_RUN_20260521.json` 当前是 dry-run | `bun run cache:reality-run` | `status=PASS_CACHE_REALITY_DRY_RUN`，`boundaryFound=true`，`publicReportHashOnly=true` |
| C3 | Cache | READY | 跑 cache live A/B 前置检查，默认 dry-run，不自动打 provider | `scripts/dsxu-cache-live-ab.ts` 与 `src/services/cache-live-ab.ts` 已有 dry-run/live 分层 | `bun run cache:live-ab` | dry-run 必须 `didCallProvider=false`；只有显式 live 才允许 provider 请求 |
| C4 | Cache | DONE | 默认 prompt 主链具备 stable/dynamic boundary | `src/constants/prompts.ts` 插入 `SYSTEM_PROMPT_DYNAMIC_BOUNDARY`；`src/utils/api.ts` 和 `src/services/api/deepseek-adapter.ts` 会处理 boundary | `bun test src/services/__tests__/cache-warmer.test.ts src/services/api/deepseek-adapter-cache-prefix-v1.test.ts` | stable prefix 不包含 cwd/env/task 动态尾部；adapter 不把 boundary 发送给模型 |
| C5 | Cache | DONE | sticky routing 保持性能安全：默认 observe，不默认强制锁模型 | `src/dsxu/engine/api-service.ts` 支持 `stickyModelRouting: 'observe'` 和显式 enforce | `bun test src/dsxu/engine/__tests__/api-service.test.ts` | 默认不阻止 Pro 升级；显式开启时才固定 session model |
| C6 | Cache | BLOCKED-LIVE | 真实 80-90% 命中率证明 | 当前 `DSXU_CACHE_LIVE_AB_20260521.json` 是 `DRY_RUN_CACHE_LIVE_AB` | `bun run cache:live-ab --execute-live --rounds 3` | 需要真实 API usage，`PASS_CACHE_LIVE_AB` 后才允许对外声明真实命中率提升 |
| F1 | Finalization | RAN-PARTIAL | 跑 14 个 non-pass replay，验证 finalization runtime gate 是否打掉剩余最大类问题 | `bun run evidence:public-comparable-dsxu` 已跑；结果仍是 16/30 pass，14 non-pass | `bun run evidence:public-comparable-dsxu` | 目标仍未达成：14 个 non-pass 未下降；下一步按失败类型拆 owner，不再只加 finalization gate |
| F2 | Finalization | DONE | 聚焦 gate 测试通过 | `query-message-shape-guard-v1.test.ts` / `tool-batch-gate-classification-v1.test.ts` | `bun test src/dsxu/engine/__tests__/query-message-shape-guard-v1.test.ts src/dsxu/engine/__tests__/tool-batch-gate-classification-v1.test.ts` | 已验证 `18 pass / 0 fail` 级别的 finalization 聚焦用例；本轮合并缓存后需继续回归 |
| V2-1 | Training V2 | DONE | 补 `training:v2` 脚本入口 | `package.json` 新增 `"training:v2": "bun run scripts/dsxu-training-v2-runner.ts"` | `bun run training:v2` | 输出 `PASS_INTERNAL_TRAINING_FLYWHEEL`，stage/gate 可解析 |
| V2-2 | Training V2 | OPEN | V2 从 synthetic/internal 转到真实捕获轨迹 | `docs/generated/DSXU_TRAINING_DATA_FLYWHEEL_V2_RUN_20260520.json` 是 internal 证据 | 后续用真实 DSXU lane raw transcript / tool trace 跑 V2 | 真实轨迹包含 `rawTranscriptPath`、`toolTracePath`、`finalReport`、`metrics.json` |
| V2-3 | Evidence | OPEN | 刷新 dashboard，确认缓存和 V2 不影响 release gate | `evidence:dashboard` 已存在 | `bun run evidence:dashboard` | 不新增 fail gate；release/public claim blocker 必须仍明确标出 |

## 不允许的捷径

| 禁止项 | 原因 |
|---|---|
| 不把 dry-run cache report 当真实 80-90% 命中率 | dry-run 没有 provider usage 字段 |
| 不为提高缓存默认强制 sticky model | 会损害复杂任务自动升级 Pro 的质量 |
| 不在 14 个 replay 前声明 finalization 问题完全消失 | 单元测试不能替代真实失败回放 |
| 不把 V2 internal flywheel 当公开训练效果 | 当前还是内部/合成证据 |

## 下一步命令批次

```bash
bun run cache:warm --dry-run
bun run cache:reality-run
bun run cache:live-ab
bun test src/services/__tests__/cache-warmer.test.ts src/services/__tests__/cache-prefix-registry.test.ts src/services/__tests__/cache-live-ab.test.ts scripts/__tests__/dsxu-cache-reality-run.test.ts src/dsxu/engine/__tests__/prompt-cache-break-detection.test.ts src/dsxu/engine/__tests__/api-service.test.ts
bun test src/dsxu/engine/__tests__/query-message-shape-guard-v1.test.ts src/dsxu/engine/__tests__/tool-batch-gate-classification-v1.test.ts
bun run training:v2
bun run evidence:dashboard
```

## 2026-05-21 执行记录

| 命令 | 结果 | 结论 |
|---|---|---|
| `bun run cache:warm --dry-run` | PASS，`warmedKeys=1`，prefix hash `9c54e02b6ba96ca2` | cache warmer 已默认取真实运行时 stable prefix，未打 provider |
| `bun run cache:live-ab` | PASS dry-run，`DRY_RUN_CACHE_LIVE_AB`，`didCallProvider=false`，无 blocker | live A/B 脚本已默认取真实 stable prefix，但还没有真实 provider 命中率 |
| `bun run cache:reality-run` | PASS，`PASS_CACHE_REALITY_DRY_RUN`，stable approx tokens `5963`，dynamic tail approx tokens `3483` | 缓存工程链 dry-run 收口；真实 80-90% 仍需 live A/B |
| cache/finalization 聚焦测试 | PASS，`75 pass / 0 fail` | 本轮改动没有破坏 cache/finalization/sticky routing 合同 |
| `bun run training:v2` | PASS，`PASS_INTERNAL_TRAINING_FLYWHEEL` | V2 脚本入口已补齐并可跑 |
| `bun run evidence:public-comparable-dsxu` | PARTIAL，`passedCaseCount=16`，`nonPassingCaseCount=14` | 14 个问题不是单靠 finalization gate 就能打掉，需要拆成预算、工具、verification、agent/MCP、strict JSON 输出等 owner |
| `bun run evidence:dashboard` | `scoreFloor=72`，`pass=136 fail=0 blocked=1 claimBlocked=3` | runtime/cache 未新增 fail；release/public claim 仍按证据阻塞 |

## 14 个 non-pass 当前清单

| Case | Exit | Tool count | Cache hit | 初步归因 |
|---|---:|---:|---:|---|
| `governance-query-recovery-live` | 0 | 3 | 63.58% | 证据不足/预算导致 PARTIAL |
| `governance-skills-selection-live` | 0 | 5 | 52.76% | skill 选择证据不足 |
| `todo-task-closeout` | 0 | 3 | 68.17% | closeout/final rubric 未满足 |
| `compact-state-preservation` | 0 | 5 | 41.82% | compact 状态保持证据不足 |
| `product-workflow-recovery-live` | 0 | 4 | 80.55% | recovery workflow 证据不足 |
| `product-compact-two-phase-live` | 1 | 10 | 55.73% | 未输出可解析 final JSON / exit 非 0 |
| `product-agent-worker-longrun-live` | 1 | 6 | 77.58% | agent long-run 失败/exit 非 0 |
| `product-agent-failure-correction-live` | 0 | 6 | 77.41% | agent 修复证据不足 |
| `product-real-mcp-task-live` | 1 | 13 | 42.43% | MCP 真实任务失败/exit 非 0 |
| `v8-real-review-fix` | 1 | 8 | 72.23% | review/fix 任务失败/exit 非 0 |
| `tool-prompt-read-edit-cache-golden` | 1 | 12 | 39.56% | read/edit/cache golden 失败/exit 非 0 |
| `mutation-tool-prompt-read-edit-cache-live` | 0 | 11 | 54.4% | mutation 任务 rubric 未满足 |
| `mutation-real-mcp-resource-guided-fix-live` | 1 | 13 | 56.33% | MCP resource-guided fix 失败/exit 非 0 |
| `experience-agent-team-governance-live` | 1 | 23 | 79.71% | agent team governance 长任务失败/exit 非 0 |

下一步处理原则：先按失败类型分组，不继续盲目加 gate。优先级为：final JSON/exit=1 修复、预算与 read 策略、Agent/MCP 真实任务、compact/recovery 证据充分性。

## 2026-05-21 Cache 收口增量记录

| 项目 | 状态 | 真实结论 |
|---|---|---|
| 保持 dry-run 默认 | DONE | `cache:warm`、`cache:live-ab`、`cache:reality-run` 默认均不调用 provider；真实调用必须显式 `--execute-live`。 |
| live A/B 真实命中率 | DONE | `bun run scripts/dsxu-cache-live-ab.ts --execute-live --rounds 3 --timeout-ms 60000 --out docs/generated/DSXU_CACHE_LIVE_AB_20260521.json` 已通过，首轮 0%，第 2/3 轮 99.6%。 |
| onCacheMiss dry-run ledger | DONE | `CacheMonitor` 连续 miss 后只记录 dry-run warmup event，不触发真实 warm，不增加模型轮次、工具调用、网络调用或当前回合延迟。 |
| querySource lane 统计 | DONE | `cache-prefix-registry` 新增 lane-level stats，记录 source/workflow/model/status 分布，只给建议，不强行合并 querySource。 |
| placeholder prefix 命名 | DONE | `DEFAULT_PREFIXES` 已清理为 `LEGACY_PLACEHOLDER_PREFIXES`，placeholder 只能通过 `allowPlaceholderPrefixes` opt-in，避免误判为默认真实 prefix。 |

新增硬证据：

```bash
bun run cache:warm --dry-run
bun run cache:live-ab
bun run cache:reality-run
bun run scripts/dsxu-cache-live-ab.ts --execute-live --rounds 3 --timeout-ms 60000 --out docs/generated/DSXU_CACHE_LIVE_AB_20260521.json
bun test src/services/__tests__/cache-prefix-registry.test.ts src/dsxu/engine/__tests__/wave2.test.ts src/services/__tests__/cache-warmer.test.ts src/services/__tests__/cache-live-ab.test.ts scripts/__tests__/dsxu-cache-reality-run.test.ts src/dsxu/engine/__tests__/prompt-cache-break-detection.test.ts src/dsxu/engine/__tests__/api-service.test.ts src/services/api/deepseek-adapter-cache-prefix-v1.test.ts
```

验收结果：

- cache dry-run 三件套全部通过，且没有 provider 调用。
- live A/B 真实 provider 调用通过：`PASS_CACHE_LIVE_AB`，末轮真实 cache hit rate `99.6%`。
- 缓存/路由/adapter/monitor 相关回归：`99 pass / 0 fail`。
- 该结果只证明一个重复 stable prefix 的真实 cache 行为，仍不能替代真实长任务整体成本/命中率声明。
