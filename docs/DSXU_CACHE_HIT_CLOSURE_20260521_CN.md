# DSXU 缓存命中率收口报告 20260521

## 结论

缓存命中率已经达到内部工程收口标准，但不能扩大成公开性能卖点。

- `cache:warm` 默认仍然是 dry-run，不调用 provider。
- `cache:live-ab` 默认仍然是 dry-run，不调用 provider。
- `onCacheMiss` 只记录 dry-run ledger event，不自动真实 warm。
- `querySource` 只做 lane 级统计与建议，不强制合并。
- placeholder prefix 已改为 legacy opt-in，不能再被误判为默认真实 prefix。
- live A/B 已真实调用 DeepSeek provider，重复 stable prefix 的命中率从 `0%` 提升到 `99.6%`。

## 硬验收结果

| 项目 | 结果 |
|---|---|
| `bun run cache:warm --dry-run` | PASS，`warmedKeys=1`，无 provider 调用 |
| `bun run cache:reality-run` | PASS，`PASS_CACHE_REALITY_DRY_RUN`，hash-only public report |
| `bun run cache:live-ab` | PASS dry-run，`didCallProvider=false` |
| live A/B | PASS，`didCallProvider=true`，`0% -> 99.6% -> 99.6%` |
| `bun run cache:closure` | PASS，`PASS_CACHE_HIT_CLOSURE_INTERNAL` |
| 缓存相关回归 | PASS，`105 pass / 0 fail` |
| `bun run evidence:dashboard` | PASS gate count increased to `pass=138`，无新增 fail |

## 新增文件和入口

| 文件 | 作用 |
|---|---|
| `scripts/dsxu-cache-hit-closure.ts` | 汇总 live A/B、reality run、源码安全边界，生成缓存收口报告 |
| `scripts/__tests__/dsxu-cache-hit-closure.test.ts` | 验证必须有 live 证据才允许内部 cache closure |
| `docs/generated/DSXU_CACHE_HIT_CLOSURE_20260521.json` | 机器可读缓存收口报告 |
| `docs/generated/DSXU_V3_CACHE_FIRST_FOLLOWUP_TRACKER_20260521.json` | V3 缓存优先跟踪表，已加入 C10 收口项 |
| `package.json` | 新增 `cache:closure` |

## 允许声明

可以内部声明：

> DSXU 对一个真实 runtime stable prefix 做了 DeepSeek live A/B，重复请求第 2/3 轮 cache hit rate 达到 `99.6%`。

可以内部使用：

> 当前 stable/dynamic prefix 分区、dry-run warmer、live A/B、lane stats 与 claim boundary 已形成缓存命中率工程闭环。

## 禁止声明

不能公开声明：

- DSXU 日常长任务缓存命中率已经稳定 80-90%。
- DSXU 整体成本已经按 99.6% 命中率下降。
- DSXU 编程能力因为缓存命中率而达到 90%+。
- 这个 single-prefix A/B 可以替代 20+ 分钟长任务、多工具、多 querySource 的真实轨迹。

## 后续证据需求

下一阶段如果要把缓存变成公开卖点，需要补：

1. 20+ 分钟长任务 live trajectory。
2. 多 querySource lane 真实任务缓存命中率统计。
3. finalization 14 个 non-pass replay 的修复结果。
4. 长任务成本、命中率、任务完成率三者 join 后的证据包。

## 当前边界

本轮收口证明的是：

> DeepSeek 原生缓存 + DSXU stable prefix 分区，在单个重复 stable prefix 场景中有效。

本轮没有证明的是：

> DSXU 所有真实复杂任务都能稳定保持 80-90% 缓存命中率。
