# DSxu V1 执行文档 V10（补完 + 调优拉满 · 高标准收尾）

> **版本**：V10 · 2026-04-12
> **前置**：V8.2-S 全部阅读 + 实地审计（audit agent 全扫 + bun test 全跑）
> **性质**：V8.2-S 的 **缺口补完文档** — 只包含"V8 要求但还没做"的部分
> **执行者分工**：
> - **Claude Code（外部）**：代码实现、单测、集成连线、框架骨架
> - **本地 AI（DSxu-V1）**：G2 差分跑分、G3 SWE-bench 真跑、自调优 loop 真执行、bench 矩阵出分
> **调优标准**：拉满 — 每个 hook 有真实逻辑、每个模块连入运行时、HITL 真触发

---

# §0 V8 缺口总账

基于全量审计（git log + bun test + grep + 目录扫描），缺口分 6 类：

| 类别 | 缺口数 | 阻塞等级 | 说明 |
|---|---|---|---|
| **A. 代码缺陷** | 33 | 🔴 P0 | 26 static-analysis parser + 4 SWE-bench + 3 Snapshot 测试失败 |
| **B. 缺失单测** | 2 | 🔴 P0 | R5-21 TDD gate、R5-23 Voting 无 bun:test |
| **C. 框架空壳** | 3 | 🟡 P1 | 自调优 hook 全 placeholder、HITL 未连线、集成层仅 5/23 模块 |
| **D. 缺失产物** | 4 | 🟡 P1 | VSCode 扩展空目录、G2 harness 无代码、成本台账未接源码、OTEL 未接 |
| **E. 验收缺失** | 5 | 🟡 P1 | M2-M5 milestone JSON、bench 矩阵报告、A/B 对照报告 |
| **F. 文档缺失** | 3 | 🟢 P2 | 23 独立 FMEA 文件、Phase 7 切割评估、23 独立 R5 spec 卡片 |

---

# §1 Phase 1 · 代码缺陷修复（P0，阻塞一切）

## 1.1 R5-22 静态分析 parser 修复（26 failing tests）

**问题根因**：ESLint parser 和 TSC parser 的输出解析逻辑与测试期望不匹配。

**执行计划**：

### T1.1.1 ESLint parser 修复（7 tests）

| # | 失败测试 | 修复方向 |
|---|---|---|
| 1 | JSON 格式输出解析 | `parseEslintOutput()` 需正确处理 ESLint JSON formatter 输出 |
| 2 | severity 转换 | 0→off, 1→warning, 2→error 映射对齐 |
| 3 | 文件路径规范化 | 绝对路径 → 相对路径 + `path.normalize()` |
| 4 | Windows 路径处理 | `\\` → `/` 统一 |
| 5 | 文本格式 fallback | 当 JSON parse 失败时的文本行解析 |
| 6 | 无效 JSON fallback | 格式检测 + 降级逻辑 |
| 7 | 空输出处理 | 空字符串 → 空数组 |

**文件**：`src/services/static-analysis/parsers/eslint.ts`
**测试**：`src/services/static-analysis/__tests__/parsers/eslint.test.ts`
**验收**：`bun test src/services/static-analysis/__tests__/parsers/eslint.test.ts` → 7/7 pass

### T1.1.2 TSC parser 修复（10 tests）

| # | 失败测试 | 修复方向 |
|---|---|---|
| 1 | 标准错误格式解析 | `file(line,col): severity TSxxxx: msg` regex 对齐 |
| 2 | severity 转换 | error/warning/info 映射 |
| 3 | 未知 severity | fallback 到 `info` |
| 4 | 文件路径规范化 | 相对路径解析 |
| 5 | Windows 路径 | `\\` 处理 |
| 6 | 相对路径 | cwd 拼接 |
| 7 | 空行跳过 | 过滤空白行 |
| 8 | 没有行号列号 | 降级到 line=0, col=0 |
| 9 | 部分匹配行 | 非标格式 fallback |
| 10 | 多行消息 | 多行错误消息拼接 |

**文件**：`src/services/static-analysis/parsers/tsc.ts`
**测试**：`src/services/static-analysis/__tests__/parsers/tsc.test.ts`
**验收**：`bun test src/services/static-analysis/__tests__/parsers/tsc.test.ts` → 10/10 pass

### T1.1.3 Semgrep parser 验证

Semgrep parser 目前测试全绿，保持不动。
**验证**：`bun test src/services/static-analysis/__tests__/parsers/semgrep.test.ts`

## 1.2 R5-28 SWE-bench 测试修复（4 failing tests）

**文件**：`src/services/__tests__/swe-bench.test.ts`

| # | 失败测试 | 修复方向 |
|---|---|---|
| 1 | 环境准备/创建工作目录 | mock fs 未正确注入或 execSync mock 缺失 |
| 2 | 测试输出解析（通过+失败） | parser regex 与实际 pytest 输出格式不匹配 |
| 3 | 测试输出解析（含错误） | error case 处理 |
| 4 | 进度通知/回调调用 | callback 注入路径断裂 |

**验收**：`bun test src/services/__tests__/swe-bench.test.ts` → 全绿

## 1.3 R5-29 Snapshot/Restore 测试修复（3 failing tests）

**文件**：`src/services/snapshot/__tests__/snapshot.test.ts`

| # | 失败测试 | 修复方向 |
|---|---|---|
| 1 | listSnapshots returns created | mock 存储层的 list 逻辑与 createSnapshot 不对齐 |
| 2 | restoreSnapshot dry-run | dry-run 标志未传递或返回格式错误 |
| 3 | restoreSnapshot real | mockGitOps.restore 调用签名不匹配 |

**验收**：`bun test src/services/snapshot/__tests__/snapshot.test.ts` → 全绿

---

# §2 Phase 2 · 缺失单测补全（P0）

## 2.1 R5-21 TDD Gate 单测

**现状**：`src/coordinator/tdd-gate/` 有 6 个文件（contract, extractor, generator, runner, gate, index），零单测。

**新建**：`src/coordinator/tdd-gate/__tests__/tdd-gate.test.ts`

**覆盖要求**（≥ 85% 分支覆盖）：

| describe | 测试项 |
|---|---|
| `extractor` | 从需求文本提取 test skeleton；空输入返回空 |
| `generator` | 生成 failing test 代码；mock LLM 返回 test 模板 |
| `runner` | 执行 test 并返回红/绿状态；超时处理；错误输出捕获 |
| `gate` | 完整 TDD flow（extract→generate→run→判定）；跳过无测试模块；连续失败触发 HITL |

**验收**：`bun test src/coordinator/tdd-gate/__tests__/` → ≥ 15 tests, 0 fail

## 2.2 R5-23 Self-Consistency Voting 单测

**现状**：`src/coordinator/voting/` 有 5 个文件（contract, similarity, clusterer, voter, index），零单测。

**新建**：`src/coordinator/voting/__tests__/voting.test.ts`

**覆盖要求**：

| describe | 测试项 |
|---|---|
| `similarity` | 字符串相似度计算；空输入；完全相同；完全不同 |
| `clusterer` | N 个 patch 聚类；单 patch 返回 1 簇；全相同返回 1 簇；全不同返回 N 簇 |
| `voter` | 最大簇获胜；平局处理；N=1 直接返回；N=0 返回空 |
| `integration` | 完整投票流程（6 路 mock）；共识率计算 |

**验收**：`bun test src/coordinator/voting/__tests__/` → ≥ 12 tests, 0 fail

---

# §3 Phase 3 · 自调优引擎（拉满实现）

V8.2-S §6.2 定义了 `SelfTuningHook` 接口，当前状态：**全部 placeholder，enabled: false，action: noop**。

**目标**：每个 R5 模块实现真实 `SelfTuningHook`，拉满标准。

## 3.1 SelfTuningHook 接口（强化版）

**文件**：`src/dsxu/tuning/self-tuning.ts`（新建）

```typescript
interface SelfTuningHook {
  moduleId: string;
  getParams(): Record<string, any>;
  proposeNext(failure: TestFailure): Record<string, any> | null;
  hasConverged(history: TuningRun[]): boolean;
}

interface TestFailure {
  gate: 'G1' | 'G2' | 'G3';
  metrics: Record<string, number>;
  errorMessages: string[];
  attempt: number;
}

interface TuningRun {
  params: Record<string, any>;
  gate: string;
  passed: boolean;
  metrics: Record<string, number>;
  timestamp: string;
}

interface TuningEngine {
  register(hook: SelfTuningHook): void;
  runLoop(moduleId: string, maxK?: number): Promise<TuningResult>;
  getHistory(moduleId: string): TuningRun[];
}
```

## 3.2 TuningEngine 实现

**文件**：`src/dsxu/tuning/engine.ts`（新建）

核心逻辑：
```
for k = 1..K (default 3):
  failure = runGates(module)
  if failure == null: return SUCCESS
  newParams = hook.proposeNext(failure)
  if newParams == null: break  // hook 认为无法再调
  applyParams(newParams)
  writeLog(.dsevo/tuning/<module>-<ts>.json)
  if hook.hasConverged(history): break
return HITL_ESCALATION
```

**安全护栏实现**：
- `applyParams()` 只允许写入 `.dsevo/tuning/` 目录（不改源码）
- 参数白名单校验（temperature ∈ [0,2], top_p ∈ [0,1], N ∈ [1,16], timeout ∈ [1000,600000]）
- 禁止修改 `*.test.ts` 文件的断言
- 每次 loop 写 JSON 日志

## 3.3 每模块 Hook 实现表

| 模块 | Hook 文件 | 可调参数 | proposeNext 策略 | hasConverged 条件 |
|---|---|---|---|---|
| R5-19 | `cache-stats-hook.ts` | prefix_order, cache_warmup_batch | 命中率<30%→调prefix顺序 | 连续2次ratio≥50% |
| R5-20 | `sampling-hook.ts` | temperature, top_p, N | Critic通过率<60%→降温 | Critic通过率∈[60%,80%] |
| R5-22 | `static-analysis-hook.ts` | semgrep_rules_blacklist, timeout | 噪音>50%→扩黑名单 | 噪音<30% |
| R5-21 | `tdd-gate-hook.ts` | test_gen_retries, prompt_variant | 生成率<70%→换prompt模板 | 生成率≥85% |
| R5-17 | `roles-hook.ts` | orchestration_mode, critic_threshold | 拒绝率>40%→切Linear | 拒绝率∈[20%,40%] |
| R5-23 | `voting-hook.ts` | N, similarity_threshold | 共识率<60%→N+=2 | 共识率≥70% |
| R5-24 | `mutation-hook.ts` | operator_blacklist, max_mutations | 噪音操作符→加黑名单 | killRate变化<2% |
| R5-01+ | `search-hook.ts` | tier_preference, bm25_k1, bm25_b | 命中率低→调BM25参数 | 命中率≥80% |
| R5-12v2 | `dag-hook.ts` | layer_timeout, max_retries | 超时→按节点历史调 | 超时率<5% |
| R5-25 | `embedding-hook.ts` | chunk_size, overlap, dimension | 召回率低→调chunk | 召回率≥85% |
| R5-26 | `experience-hook.ts` | retrieval_k, helpfulness_weight | 帮助度<0.5→降权 | 平均帮助度≥0.7 |
| R5-27 | `sandbox-hook.ts` | warmup_pool_size, timeout | 启动慢→加池 | 冷启<3s |
| R5-28 | `swe-bench-hook.ts` | batch_size, retry_limit | 失败任务→入incident | pass@5波动<3% |
| R5-29 | `snapshot-hook.ts` | snapshot_frequency, max_snapshots | 风险评分高→增频 | 零丢失 |
| R5-30 | `pbt-hook.ts` | property_templates, runs_per_prop | 发现率低→加模板 | 发现率≥单测+20% |
| R5-31 | `lsp-hook.ts` | suggestion_filter_threshold | 接受率<40%→提阈值 | 接受率≥60% |
| R5-32 | `mcp-hook.ts` | retry_limit, fallback_adapter | 失败率>10%→降级 | 失败率<5% |
| R5-33 | `dag-persist-hook.ts` | commit_timeout, checkpoint_interval | 恢复失败→缩checkpoint | 恢复成功率100% |
| R5-34 | `ingestion-hook.ts` | chunk_size, overlap, parser_type | 命中率低→调切块 | 命中率≥75% |
| R5-35 | `ab-hook.ts` | task_sampling_strategy | 失败任务→入ExperienceStore | gap收窄 |

**目录结构**：
```
src/dsxu/tuning/
├── index.ts           (已有，更新 HookRegistry)
├── self-tuning.ts     (新建：接口定义)
├── engine.ts          (新建：TuningEngine 循环)
├── param-guard.ts     (新建：参数白名单校验)
└── hooks/             (新建：23 个 hook 实现)
    ├── cache-stats-hook.ts
    ├── sampling-hook.ts
    └── ... (每模块一个)
```

**单测**：`src/dsxu/tuning/__tests__/`
- `engine.test.ts`：循环逻辑、K次上限、收敛退出、HITL升级
- `param-guard.test.ts`：白名单校验、越界拒绝
- `hooks.test.ts`：每个 hook 的 proposeNext / hasConverged

**验收**：`bun test src/dsxu/tuning/` → ≥ 40 tests, 0 fail

---

# §4 Phase 4 · HITL 真连线

**现状**：`IncidentReporter` 存在但仅被自己的测试 import，零模块使用。

## 4.1 HITL 触发点连线表

| 触发模块 | 触发条件 | severity | category | 实现方式 |
|---|---|---|---|---|
| R5-19 | 连续3次cache ratio<20% | warning | eval-regression | 在 cache-stats 的 check() 中注入 reporter |
| R5-22 | 单次分析>30s | warning | timeout | runner.ts 的 timeout 分支加 report |
| R5-21 | TDD gate 连续3次生成失败 | critical | test-failure | gate.ts 的失败路径加 report |
| R5-17 | Critic 拒绝率连续>50% | warning | eval-regression | orchestrator 统计后触发 |
| R5-28 | SWE-bench 任务 crash | critical | runtime-error | bridge.ts catch 块 |
| R5-29 | Snapshot restore 数据不一致 | critical | runtime-error | hash 校验失败时 |
| TuningEngine | K 次调优失败 | critical | test-failure | engine.ts loop 退出时 |
| CostLedger | 单次运行成本>预算 | warning | cost-overrun | 接入成本台账后 |

## 4.2 实现方式

**不侵入现有模块接口**——通过 runtime 注入：

```typescript
// src/dsxu/hitl/wiring.ts (新建)
export function wireHitlToRuntime(runtime: DsxuRuntime, reporter: IncidentReporter): void {
  // 包装各模块，在错误路径注入 report 调用
  // 通过 Proxy/wrapper 而非修改源码
}
```

**单测**：`src/dsxu/hitl/__tests__/wiring.test.ts`
**验收**：每个触发点至少 1 个测试证明 incident 被创建

---

# §5 Phase 5 · 集成层补全（5/23 → 23/23）

**现状**：`createRuntime()` 只连了 VectorStore, ExperienceStore, search, mcpAdapters, mutation。

## 5.1 补全连线表

**文件**：`src/dsxu/integration/index.ts`（扩展）

```typescript
export interface DsxuRuntime {
  // === 已有 ===
  vectorStore: VectorStore;
  experienceStore: ExperienceStore;
  search: typeof search;
  mcpAdapters: McpAdapter[];
  mutation: typeof runMutationTests;
  pbt: { suggest; run };

  // === 新增 ===
  // M1
  cacheStats: CacheStatsService;
  samplingPolicy: SamplingPolicyService;

  // M2
  staticAnalysis: StaticAnalysisRunner;
  tddGate: TddGate;
  roles: RoleOrchestrator;
  voting: VotingService;
  sweBench: SweBenchBridge;

  // M4
  sandbox: SandboxService;
  snapshot: SnapshotService;

  // M5
  lsp: LspServer;
  dagPersist: PersistentDagRunner;
  ingestion: IngestionService;
  abHarness: AbHarness;

  // 框架
  tuningEngine: TuningEngine;
  hitlReporter: IncidentReporter;
  hookRegistry: HookRegistry;
}
```

## 5.2 初始化顺序（拓扑排序）

```
1. cacheStats, samplingPolicy     (无依赖)
2. staticAnalysis                 (无依赖)
3. tddGate                       (依赖 staticAnalysis)
4. roles                         (依赖 tddGate)
5. voting                        (依赖 samplingPolicy)
6. vectorStore                   (无依赖)
7. search + bm25                 (依赖 vectorStore)
8. experienceStore               (依赖 vectorStore)
9. dagRunner + dagPersist        (依赖 roles, voting)
10. mutation, pbt                (依赖 staticAnalysis)
11. sandbox, snapshot            (无依赖)
12. sweBench, abHarness          (依赖 sandbox)
13. mcpAdapters                  (无依赖)
14. lsp                          (依赖 vectorStore)
15. ingestion                    (依赖 vectorStore)
16. tuningEngine + hookRegistry  (依赖全部模块)
17. hitlReporter + wiring        (依赖 tuningEngine)
```

**单测**：`src/dsxu/integration/__tests__/full-runtime.test.ts`
**验收**：`createRuntime()` 成功返回且所有字段非 null/undefined

---

# §6 Phase 6 · 缺失产物补建

## 6.1 VSCode 扩展骨架（R5-31）

**现状**：`extensions/vscode-dsxu/` 完全为空。

**交付文件**：

```
extensions/vscode-dsxu/
├── package.json           (VSCode extension manifest)
├── tsconfig.json
├── src/
│   ├── extension.ts       (activate/deactivate 入口)
│   ├── lsp-client.ts      (LSP client 连接 DSxu server)
│   ├── hover-provider.ts  (hover 展示 DSxu 分析)
│   ├── completion.ts      (代码补全)
│   └── code-action.ts     (quick-fix from static analysis)
└── __tests__/
    └── extension.test.ts
```

**最小可用标准**：
- `vsce package` 能打出 .vsix
- hover 调用 DSxu LSP 返回函数签名
- completion 触发 DSxu 建议
- codeAction 展示 static-analysis 发现的问题

## 6.2 G2 差分基线 Harness

**现状**：V8 §0.3 定义了 G2 门但零代码实现。

**新建**：`src/dsxu/eval/g2-harness.ts`

```typescript
interface G2Config {
  goldenDir: string;           // dsevo/golden/
  baselineCommit?: string;     // 默认 HEAD~1
  metrics: string[];           // 要比较的指标名
  thresholds: {
    minImprove: number;        // 至少1项 +5%
    maxRegress: number;        // 无项 -1%
  };
  mockRunner?: (task: GoldenTask) => Promise<G2Result>;
}

interface G2Result {
  taskId: string;
  metrics: Record<string, number>;
  durationMs: number;
}

interface G2Report {
  passed: boolean;
  improved: string[];          // 提升 ≥5% 的指标
  regressed: string[];         // 回归 >1% 的指标
  details: G2Result[];
}

export async function runG2(moduleId: string, config: G2Config): Promise<G2Report>;
```

**单测**：`src/dsxu/eval/__tests__/g2-harness.test.ts`
**验收**：mock 模式下 pass/fail 判定正确

## 6.3 成本台账源码接入

**现状**：`.dsevo/cost-ledger.jsonl` 由外部写入，源码中零引用。

**新建**：`src/dsxu/cost/ledger.ts`

```typescript
interface CostEntry {
  timestamp: string;
  module: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  cost: number;
}

export class CostLedger {
  append(entry: CostEntry): Promise<void>;
  query(opts: { module?: string; since?: string }): Promise<CostEntry[]>;
  totalCost(opts?: { module?: string }): Promise<number>;
  budgetCheck(module: string, budget: number): Promise<{ ok: boolean; used: number; remaining: number }>;
}
```

**连线**：proxy 的每次请求完成后调用 `ledger.append()`
**单测**：`src/dsxu/cost/__tests__/ledger.test.ts`

## 6.4 OTEL Trace 接入

**现状**：proxy 已有 OTEL 基础设施，但 DSxu 新模块（coordinator, tuning, eval）未接入。

**新建**：`src/dsxu/observability/trace.ts`

```typescript
import { trace, SpanKind } from '@opentelemetry/api';

const tracer = trace.getTracer('dsxu-v1');

export function withTrace<T>(name: string, fn: () => Promise<T>): Promise<T> {
  return tracer.startActiveSpan(name, { kind: SpanKind.INTERNAL }, async (span) => {
    try {
      const result = await fn();
      span.setStatus({ code: 0 });
      return result;
    } catch (err) {
      span.setStatus({ code: 2, message: String(err) });
      throw err;
    } finally {
      span.end();
    }
  });
}
```

**连线点**：
- DAG runner 每层/每节点一个 span
- TDD gate 每个 extract→generate→run 一个 span
- Static analysis 每个 tool（tsc/eslint/semgrep）一个 span
- Tuning engine 每次 loop 一个 span

---

# §7 Phase 7 · 里程碑验收产物

## 7.1 Milestone Completion JSON

V8 §4.1 要求每个 M 末尾输出 `.dsevo/milestones/M<n>.json`。

**现状**：仅有 `M1-COMPLETE.json` 和 `M2-R5-28.json`，缺 M2/M3/M4/M5 完整版。

**格式**（V8 §4.2 定义）：

```json
{
  "milestone": "M3",
  "timestamp": "2026-04-12T...",
  "weighted_total": 91.2,
  "categories": {
    "A": { "weight": 0.25, "score": 94, "items": {"A-1": 95, "A-3": 92, ...} },
    "B": { "weight": 0.20, "score": 95, "items": {...} },
    "C": { "weight": 0.15, "score": 92, "items": {...} },
    "D": { "weight": 0.15, "score": 78, "items": {...} },
    "E": { "weight": 0.10, "score": 95, "items": {...} },
    "F": { "weight": 0.15, "score": 88, "items": {...} }
  },
  "vs_opus_4_6": { "swe_bench_pass_at_1": 0.0, "swe_bench_pass_at_5": 0.0 },
  "regressions": [],
  "blocking": false,
  "g1_results": { "total_tests": 169, "passing": 169, "coverage": 0.87 },
  "modules_completed": ["R5-24", "R5-01+", "R5-12v2", "R5-25"]
}
```

**生成脚本**：`scripts/milestone-report.ts`
**执行者**：本地 AI（需跑 bench 矩阵拿真实分数）

## 7.2 Bench 矩阵全量运行

**执行者**：本地 AI

```bash
# 每个 milestone 末尾跑：
bun run dsevo/bench/baseline.ts          # 基线
bun run scripts/distill/g4-check-*.ts    # G4 蒸馏
bun run src/dsxu/eval/g2-harness.ts      # G2 差分（需 G2 harness 先就绪）
# SWE-bench 真跑（需 Python 环境 + API key）
python evals/swe-bench/fetch.py && python evals/swe-bench/runner.py
```

## 7.3 A/B 对照报告

**执行者**：本地 AI（需 Claude API key 调 Opus 4.6）

输出：`.dsevo/ab-reports/M<n>-ab.json`

---

# §8 Phase 8 · 文档补全

## 8.1 23 独立 R5 Spec 卡片

**现状**：仅有 `.dsxu/specs/FMEA-all.md` 合并版，无独立文件。

**目标**：`Desktop/R5-specs/R5-{19,15,03,20,...,35}.md`，每个包含 V8 §2 定义的 9 段。

**执行者**：本地 AI（从 FMEA-all.md + V8.2-S §3 拆分）

## 8.2 23 独立 FMEA 文件

**目标**：`Desktop/R5-fmea/R5-{19,...,35}.md`

**执行者**：本地 AI

## 8.3 Phase 7 切割可行性评估

**目标**：评估 `dsxu_core` 与 Claude Code fork 的解耦度。

**文件**：`.dsxu/specs/phase7-cutover-assessment.md`

**内容**：
1. 依赖分析：DSxu 新增模块 import Claude Code 原有模块的次数
2. 接口边界：哪些接口是 DSxu 独有 vs 共享
3. 切割路径：哪些文件可直接移到独立 repo
4. 解耦度估算（目标 ≥ 80%）

---

# §9 执行顺序 + 分工矩阵

## 9.1 严格执行顺序

```
Phase 1 (P0 · 代码缺陷修复)
  ├── T1.1 ESLint parser 修复 ─────────── Claude Code
  ├── T1.2 TSC parser 修复 ────────────── Claude Code
  ├── T1.3 SWE-bench 测试修复 ─────────── Claude Code
  └── T1.4 Snapshot 测试修复 ──────────── Claude Code
  验收门: bun test src/ → 0 fail (减去 0 个豁免)

Phase 2 (P0 · 缺失单测)
  ├── T2.1 R5-21 TDD Gate 单测 ────────── Claude Code
  └── T2.2 R5-23 Voting 单测 ──────────── Claude Code
  验收门: 新增 ≥27 tests, 0 fail

Phase 3 (P1 · 自调优引擎)
  ├── T3.1 SelfTuningHook 接口 ────────── Claude Code (骨架)
  ├── T3.2 TuningEngine 实现 ──────────── Claude Code
  ├── T3.3 ParamGuard 白名单 ──────────── Claude Code
  ├── T3.4 23 个 module hook ──────────── Claude Code (逻辑实现)
  └── T3.5 单测 ≥40 tests ────────────── Claude Code
  验收门: bun test src/dsxu/tuning/ → ≥40 tests, 0 fail

Phase 4 (P1 · HITL 连线)
  ├── T4.1 wiring.ts ────────��─────────── Claude Code
  └── T4.2 每触发点 ≥1 test ──────────── Claude Code
  验收门: 8 个触发点全有测试覆盖

Phase 5 (P1 · 集成层 23/23)
  ├── T5.1 DsxuRuntime 扩展 ──────────── Claude Code
  ├── T5.2 初始化拓扑排序 ──────────���─── Claude Code
  └── T5.3 full-runtime.test.ts ───────── Claude Code
  验收门: createRuntime() 全字段非空

Phase 6 (P1 · 缺失产物)
  ├── T6.1 VSCode 扩展骨架 ───────────── Claude Code
  ├── T6.2 G2 harness ────────────────── Claude Code (框架)
  ├── T6.3 成本台账接入 ──────────────── Claude Code
  └── T6.4 OTEL trace 接入 ───────────── Claude Code
  验收门: 每个产物有 ≥3 tests

Phase 7 (P1 · 里程碑验收)
  ├── T7.1 milestone-report.ts ────────── Claude Code (脚本)
  ├── T7.2 M2-M5 JSON 生成 ────────────�� 本地 AI (跑 bench)
  ├── T7.3 Bench 矩阵全跑 ────────────── 本地 AI
  └── T7.4 A/B 报告 ──────────��───────── 本地 AI
  验收门: 5 个 milestone JSON 齐全

Phase 8 (P2 · 文档补全)
  ├── T8.1 23 R5 spec 卡片 ───────────── 本地 AI
  ├── T8.2 23 FMEA 文件 ──────────────── 本地 AI
  └── T8.3 Phase 7 切割评估 ──────────── Claude Code
  验收门: 所有文件存在且非空
```

## 9.2 分工总结

| 执行者 | 任务数 | 任务类型 |
|---|---|---|
| **Claude Code** | T1.1-T1.4, T2.1-T2.2, T3.1-T3.5, T4.1-T4.2, T5.1-T5.3, T6.1-T6.4, T7.1, T8.3 | 代码实现 + 单测 + 框架 |
| **本地 AI** | T7.2-T7.4, T8.1-T8.2 | 真实跑分 + 文档生成 |

## 9.3 验收检查清单（V8 §7 逐项）

### 7.1 编程能力
- [ ] 加权平均 ≥ 91%（本地 AI 跑分）
- [ ] A-3 找 bug ≥ 92（依赖 R5-22 修复）
- [ ] B-3 长会话 ≥ 92
- [ ] B-5 重构 ≥ 92
- [ ] C-1 多文件 ≥ 93
- [ ] D-3 IDE 形态 ≥ 80（依赖 VSCode 扩展）
- [ ] F-1/F-6 cache ≥ 88
- [ ] F-4 可观测性 ≥ 88（依赖 OTEL 接入）

### 7.2 工程标准
- [ ] 全 23 模块单测覆盖率 ≥ 85%（bun test --coverage）
- [ ] FMEA 文件覆盖率 100%（23 文件）
- [ ] OTEL trace 覆盖关键路径 100%
- [ ] Snapshot/Restore 100 次零丢失（本地 AI 跑）
- [ ] WSL2 沙箱恶意 patch 零影响（本地 AI 跑）
- [ ] SWE-bench 50 任务 pass@5 ≥ 75%（本地 AI 跑）

### 7.3 铁律合规
- [ ] 所有 commit author 合规
- [ ] dsxu_core 解耦度 ≥ 80%
- [ ] Phase 7 切割文档存在

### 7.4 文档完整性
- [ ] 23 个 R5 spec 文件
- [ ] 23 个 FMEA 文件
- [ ] 5 个 milestone audit 报告
- [ ] 所有 incident 有 diagnosis + 修复链接

---

# §10 调优拉满标准

## 10.1 "拉满"的定义

| 维度 | 底线（V8 要求） | 拉满（V10 标准） |
|---|---|---|
| 自调优 hook | 接口存在 | **每个 hook 有真实 proposeNext 逻辑，不是 noop** |
| 参数调整 | 手动 | **TuningEngine 自动 loop，带收敛判定** |
| HITL 触发 | 框架存在 | **8 个触发点全连线，每个有测试证明** |
| 集成层 | 部分连接 | **23/23 模块全入 DsxuRuntime** |
| 测试覆盖 | ≥ 85% | **0 个 failing test，169+ → 250+ tests** |
| G2 基线 | 定义门槛 | **harness 代码可执行，mock 模式验证通过** |
| 成本追踪 | 数据文件 | **源码内 CostLedger 类，proxy 调用后自动写入** |
| 可观测性 | OTEL 已有 | **DSxu 新模块全部加 trace span** |

## 10.2 数量指标目标

| 指标 | 当前 | V10 目标 |
|---|---|---|
| bun:test passing | 295/321 (26 fail) | **≥ 350/350 (0 fail)** |
| G4 distillation | 177/177 | **177/177 (保持)** |
| 模块单测文件数 | 16 | **≥ 22** |
| 集成层连线 | 5/23 | **23/23** |
| 自调优 hook (真实逻辑) | 0/23 | **23/23** |
| HITL 触发点连线 | 0/8 | **8/8** |

---

**END · V10**

> V10 = V8 缺口的完整补完方案。
> Claude Code 做实现，本地 AI 做跑分。调优拉满，高标准验收。
