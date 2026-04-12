# V10 附录 A · Claude Code 原有功能全吃方案

> **问题**：DSxu-V1 在 12 个维度重新造了轮子，Claude Code 原有实现更成熟
> **目标**：全部吃下来，零浪费
> **策略**：**三层 Facade 架构** — 不改原码，只加桥接

---

## §0 架构约束分析

### 0.1 耦合深度测量

| 原有模块 | bootstrap/state 引用 | Tool/ToolUseContext 引用 | React 引用 | 可直接 import |
|---|---|---|---|---|
| `memdir/memoryScan.ts` | 0 | 0 | 0 | ✅ 直接可用 |
| `memdir/memoryTypes.ts` | 0 | 0 | 0 | ✅ 直接可用 |
| `memdir/paths.ts` | 2 (analytics, bootstrap) | 0 | 0 | ⚠️ 需薄 shim |
| `memdir/memdir.ts` | 2 | 1 (GrepTool) | 0 | ⚠️ 需薄 shim |
| `memdir/findRelevantMemories.ts` | 0 | 0 | 0 | ⚠️ 依赖 sideQuery |
| `services/extractMemories/` | 1 | 3 | 0 | ⚠️ 需中等 shim |
| `services/SessionMemory/` | 1 | 4+ | 0 | ⚠️ 需中等 shim |
| `services/autoDream/` | 3 | 3+ | 0 | ⚠️ 需中等 shim |
| `services/compact/` | 5+ | 5+ | 0 | 🔴 需重 facade |
| `services/MagicDocs/` | 0 | 4+ | 0 | ⚠️ 需中等 shim |
| `cost-tracker.ts` | 15+ | 0 | 0 | 🔴 需重 facade |
| `utils/forkedAgent.ts` | 0 | 6+ | 0 | 🔴 核心依赖 query.ts |
| `utils/fileHistory.ts` | 0 | 0 | 0 | ✅ 需少量 shim |
| `services/mcp/client.ts` | 0 | 2+ | 0 | ⚠️ 需薄 shim |
| `services/lsp/LSPServerManager.ts` | 0 | 0 | 0 | ✅ 基本可用 |
| `utils/permissions/bashClassifier.ts` | 0 | 0 | 0 | ✅ 直接可用 |
| `query/tokenBudget.ts` | 0 | 0 | 0 | ✅ 直接可用 |
| `services/tokenEstimation.ts` | 0 | 0 | 0 | ⚠️ 依赖 API 客户端 |
| `services/PromptSuggestion/speculation.ts` | 3+ | 5+ | 0 | 🔴 深耦合 |

### 0.2 核心洞察

> **85% 的原有功能不依赖 React**，只依赖 3 个内部模块：
> 1. `bootstrap/state.ts` — 全局状态（sessionId, cwd, model, betas）
> 2. `Tool.ts` + `hooks/useCanUseTool.ts` — 工具上下文
> 3. `query.ts` — LLM 查询入口
>
> **方案**：造 3 个 shim，一切打通。

---

## §1 三层 Facade 架构

```
┌──────────────────────────────────────────────┐
│            DSxu Runtime (src/dsxu/)          │
│  ExperienceStore · DAG · Roles · Tuning ...  │
├──────────────────────────────────────────────┤
│       Layer 2: DSxu Bridge (新建)            │  ← 本方案核心
│  把 Claude Code 原有能力包装成 DSxu 可用接口  │
├──────────────────────────────────────────────┤
│       Layer 1: Shim 层 (新建)                │  ← 3 个薄 shim
│  mock bootstrap/state · mock Tool · mock query│
├──────────────────────────────────────────────┤
│       Layer 0: Claude Code 原码 (不改)        │
│  memdir · compact · forkedAgent · cost ...   │
└──────────────────────────────────────────────┘
```

### 1.1 Layer 1 — Shim 层（3 个文件）

**文件**：`src/dsxu/shims/`

#### shim-state.ts（mock bootstrap/state）

```typescript
/**
 * 为 Claude Code 原有模块提供 bootstrap/state 的最小替代。
 * DSxu 运行时在启动时注入实际值。
 */
let _sessionId = 'dsxu-' + Date.now();
let _cwd = process.cwd();
let _projectRoot = process.cwd();
let _model = 'deepseek-chat';

export function getSessionId() { return _sessionId; }
export function getOriginalCwd() { return _cwd; }
export function getProjectRoot() { return _projectRoot; }
export function getKairosActive() { return false; }
export function getIsRemoteMode() { return false; }
export function getSdkBetas() { return []; }

// DSxu 注入点
export function configureState(opts: {
  sessionId?: string;
  cwd?: string;
  projectRoot?: string;
  model?: string;
}) {
  if (opts.sessionId) _sessionId = opts.sessionId;
  if (opts.cwd) _cwd = opts.cwd;
  if (opts.projectRoot) _projectRoot = opts.projectRoot;
  if (opts.model) _model = opts.model;
}
```

#### shim-tool.ts（mock Tool + ToolUseContext）

```typescript
/**
 * 为使用 Tool/ToolUseContext 的模块提供最小替代。
 * 当原有模块需要 canUseTool / tool 列表时走这里。
 */
export interface Tool {
  name: string;
  description: string;
  inputSchema: any;
}

export interface ToolUseContext {
  options: { thinkingConfig?: any };
  abortController: AbortController;
}

export type CanUseToolFn = (tool: string) => boolean;

// DSxu 默认：允许所有工具
export const defaultCanUseTool: CanUseToolFn = () => true;

export function createToolUseContext(): ToolUseContext {
  return {
    options: {},
    abortController: new AbortController(),
  };
}
```

#### shim-query.ts（mock query 入口）

```typescript
/**
 * 为 forkedAgent / findRelevantMemories 等需要 LLM 查询的模块
 * 提供 DSxu 的 DeepSeek V3.2 查询入口。
 *
 * 这是关键桥接点：Claude Code 用 Anthropic API，DSxu 用 DeepSeek。
 */
import type { Message } from '../../types/message';

export interface QueryConfig {
  model?: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

// DSxu 注入真实 query 函数
let _queryFn: ((messages: Message[], config: QueryConfig) =>
  Promise<{ content: string; usage: any }>) | null = null;

export function setQueryFn(fn: typeof _queryFn) { _queryFn = fn; }

export async function query(messages: any[], config?: QueryConfig) {
  if (!_queryFn) throw new Error('Query function not configured. Call setQueryFn() first.');
  return _queryFn(messages, config ?? {});
}

// sideQuery: 轻量级查询（不影响主对话）
export async function sideQuery(prompt: string, config?: QueryConfig) {
  return query([{ role: 'user', content: prompt }], config);
}
```

### 1.2 Layer 2 — DSxu Bridge（12 个 Bridge 文件）

**目录**：`src/dsxu/bridges/`

每个 bridge 把一组原有功能包装成 DSxu Runtime 可用的接口。

---

## §2 十二桥详细设计

### Bridge 1: MemoryBridge（永久记忆）

**吃掉**：`memdir/` + `extractMemories/` + `autoDream/`

```typescript
// src/dsxu/bridges/memory-bridge.ts

import { scanMemoryFiles, type MemoryHeader } from '../../memdir/memoryScan';
import { ENTRYPOINT_NAME } from '../../memdir/memdir';
import { ExperienceStore } from '../../services/experience/store';

export class MemoryBridge {
  private memoryDir: string;     // ~/.claude/projects/<path>/memory/
  private experienceStore: ExperienceStore;

  constructor(memoryDir: string, experienceStore: ExperienceStore) {
    this.memoryDir = memoryDir;
    this.experienceStore = experienceStore;
  }

  /** 扫描现有记忆文件 */
  async scanMemories(): Promise<MemoryHeader[]> {
    return scanMemoryFiles(this.memoryDir, new AbortController().signal);
  }

  /** 双写：ExperienceStore + memdir 文件系统 */
  async remember(record: {
    task: string;
    outcome: string;
    plan: string;
    helpfulness: number;
  }): Promise<string> {
    // 写入 ExperienceStore（向量检索）
    const id = await this.experienceStore.add({
      task: record.task,
      taskDescription: record.task,
      plan: record.plan,
      outcome: record.outcome,
      helpfulness: record.helpfulness,
      feedback: [],
    });

    // 同时写入 memdir（文件持久化 + Claude Code 兼容）
    await this.writeMemoryFile(record);
    return id;
  }

  /** 检索：先 ExperienceStore（语义），再 memdir（关键词 fallback） */
  async recall(query: string, topK = 5): Promise<any[]> {
    const vectorResults = await this.experienceStore.retrieve(query, topK);
    // memdir 补充（文件扫描 + 关键词匹配）
    const fileResults = await this.scanMemories();
    // 合并去重
    return this.mergeResults(vectorResults, fileResults, query);
  }

  /** Dream: 后台整合旧记忆（简化版 autoDream） */
  async consolidate(): Promise<void> {
    // 扫描所有记忆 → 聚合 → 删除冗余 → 写回精简版
    // 复用 autoDream 的 consolidationPrompt 逻辑
  }

  private async writeMemoryFile(record: any): Promise<void> { /* ... */ }
  private mergeResults(vec: any[], files: MemoryHeader[], query: string): any[] { /* ... */ }
}
```

**连线效果**：
- `ExperienceStore.add()` → 自动写 memdir 文件 ✅
- `ExperienceStore.retrieve()` → 自动查 memdir fallback ✅
- autoDream 定期整合 → 连接 TuningEngine periodic hook ✅

---

### Bridge 2: CompactBridge（对话紧缩）

**吃掉**：`services/compact/`

```typescript
// src/dsxu/bridges/compact-bridge.ts

export class CompactBridge {
  /**
   * 当 DSxu DAG 运行长对话超过 context window 时自动压缩。
   * 不直接用 autoCompact（依赖太深），而是提取其核心算法。
   */

  /** 检查是否需要压缩 */
  shouldCompact(tokenCount: number, windowSize: number): boolean {
    return tokenCount > windowSize * 0.9;
  }

  /** 压缩对话历史 */
  async compact(messages: Message[], config: {
    maxTokens: number;
    preserveRecent: number;  // 保留最近 N 条
  }): Promise<{ summary: string; preserved: Message[] }> {
    // 提取 compact.ts 的分组 + 摘要逻辑
    // 用 DSxu 的 DeepSeek 调用替代 Anthropic API
  }

  /** 微压缩：只压缩工具输出（保留用户消息） */
  async microCompact(messages: Message[]): Promise<Message[]> {
    // 提取 microCompact.ts 的逻辑
  }
}
```

**连线**：DAG runner 每层执行后检查 tokenCount → 自动触发

---

### Bridge 3: ForkedAgentBridge（子智能体）

**吃掉**：`utils/forkedAgent.ts` + `services/AgentSummary/`

```typescript
// src/dsxu/bridges/forked-agent-bridge.ts

/**
 * 核心桥接：让 DSxu 的 Planner/Critic/Executor/Verifier
 * 使用 Claude Code 的 forkedAgent 机制运行。
 *
 * 关键收益：
 * 1. Prompt cache 共享（多个角色共享同一 system prompt prefix）
 * 2. 子智能体摘要（实时显示进度）
 * 3. 成本追踪自动关联
 */

export class ForkedAgentBridge {
  /** 以 forked agent 方式运行 DSxu 角色 */
  async runRole(role: 'planner' | 'critic' | 'executor' | 'verifier', opts: {
    systemPrompt: string;
    userMessage: string;
    tools?: string[];
    parentCacheKey?: string;
  }): Promise<{ output: string; usage: any }> {
    // 如果在 Claude Code 运行时内 → 用 forkedAgent（cache 共享）
    // 如果独立运行 → 用 DSxu 的 DeepSeek 直接调用
  }

  /** 定期生成子智能体摘要 */
  startSummaryLoop(agentId: string, interval = 30_000): void {
    // 复用 AgentSummary 的 30s 定期摘要逻辑
  }
}
```

**连线**：`src/coordinator/roles/` 的 Planner/Executor 底层替换为 `ForkedAgentBridge.runRole()`

---

### Bridge 4: CostBridge（成本追踪）

**吃掉**：`cost-tracker.ts` + `costHook.ts`

```typescript
// src/dsxu/bridges/cost-bridge.ts

import { calculateUSDCost } from '../../utils/modelCost';

export class CostBridge {
  private entries: CostEntry[] = [];

  /** 从 proxy 响应提取成本 */
  trackFromResponse(response: any, model: string): CostEntry {
    const usage = response.usage ?? {};
    const cost = calculateUSDCost(model, usage);
    const entry: CostEntry = {
      timestamp: new Date().toISOString(),
      model,
      inputTokens: usage.prompt_tokens ?? 0,
      outputTokens: usage.completion_tokens ?? 0,
      cachedTokens: usage.prompt_cache_hit_tokens ?? 0,
      cost,
    };
    this.entries.push(entry);
    return entry;
  }

  /** 对接原有 cost-tracker 的统计 */
  getTotalCost(): number { /* ... */ }
  getCostByModule(module: string): number { /* ... */ }
  budgetCheck(budget: number): { ok: boolean; remaining: number } { /* ... */ }
}
```

**连线**：
- `deepseek-proxy.ts` 每次请求完成 → `costBridge.trackFromResponse()`
- 自调优 `cost-budget-monitor` hook → `costBridge.budgetCheck()`

---

### Bridge 5: FileHistoryBridge（文件历史）

**吃掉**：`utils/fileHistory.ts` → 替代 R5-29 自建 snapshot

```typescript
// src/dsxu/bridges/file-history-bridge.ts

export class FileHistoryBridge {
  /** 合并 Claude Code fileHistory + DSxu snapshot 能力 */
  async createSnapshot(milestone: string): Promise<string> {
    // 用 fileHistory 记录每个文件状态
    // 同时创建 git tag 作为回滚点
  }

  async restore(snapshotId: string, dryRun = true): Promise<RestoreResult> {
    // 用 fileHistory 的 restore 逻辑
  }
}
```

---

### Bridge 6: McpBridge（MCP 完整连接）

**吃掉**：`services/mcp/client.ts` + `config.ts` + `auth.ts`

```typescript
// src/dsxu/bridges/mcp-bridge.ts

/**
 * 把 R5-32 的 5 个 mock adapter 接入 Claude Code 真实 MCP client。
 * 当 MCP server 配置存在时走真实连接，否则 fallback 到 mock。
 */
export class McpBridge {
  async connectAll(): Promise<void> {
    // 读取 .claude/settings.json 的 MCP 配置
    // 用 Claude Code 的 MCP client 建立真实连接
    // 为每个 adapter 注入真实 invoke 函数
  }
}
```

---

### Bridge 7: LspBridge（LSP 完整实现）

**吃掉**：`services/lsp/LSPServerManager.ts` + `LSPClient.ts` + `handlers/`

```typescript
// src/dsxu/bridges/lsp-bridge.ts

/**
 * 把 R5-31 的 mock LSP server 接入 Claude Code 真实 LSP 基础设施。
 */
export class LspBridge {
  async startServer(): Promise<void> {
    // 用 LSPServerManager 启动真实 LSP server
    // 注册 DSxu 特有的 handler（static-analysis, mutation 建议等）
  }
}
```

---

### Bridge 8: PermissionBridge（权限系统）

**吃掉**：`utils/permissions/bashClassifier.ts` + `dangerousPatterns.ts`

```typescript
// src/dsxu/bridges/permission-bridge.ts

/**
 * 把 R5-27 WSL2 sandbox 的安全检查增强为 Claude Code 完整权限系统。
 */
export class PermissionBridge {
  /** 用 bashClassifier 分类命令安全等级 */
  classifyCommand(cmd: string): 'safe' | 'review' | 'dangerous' { /* ... */ }

  /** 用 dangerousPatterns 检测恶意模式 */
  detectDangerousPatterns(patch: string): string[] { /* ... */ }
}
```

---

### Bridge 9: TokenBridge（Token 管理）

**吃掉**：`query/tokenBudget.ts` + `services/tokenEstimation.ts`

```typescript
// src/dsxu/bridges/token-bridge.ts

export class TokenBridge {
  /** Token 预算追踪 */
  createBudget(maxTokens: number): BudgetTracker { /* ... */ }

  /** 判断是否需要续写 */
  shouldContinue(tracker: BudgetTracker, newTokens: number): ContinueDecision { /* ... */ }

  /** 估算消息 token 数（不调 API） */
  estimateTokens(text: string): number { /* ... */ }
}
```

---

### Bridge 10: SkillBridge（Skills 系统）

**吃掉**：`skills/bundled/remember.ts` + `batch.ts` + `verify.ts` + `loop.ts`

```typescript
// src/dsxu/bridges/skill-bridge.ts

/**
 * 选用 Claude Code 的 bundled skills 增强 DSxu 能力。
 */
export class SkillBridge {
  /** /remember: 写入永久记忆 */
  async remember(content: string): Promise<void> { /* 调用 memoryBridge */ }

  /** /batch: 批量执行任务 */
  async batch(tasks: string[]): Promise<any[]> { /* ... */ }

  /** /verify: 验证代码正确性 */
  async verify(code: string): Promise<VerifyResult> { /* ... */ }

  /** /loop: 循环直到条件满足 */
  async loop(condition: string, action: string, maxIter: number): Promise<any> { /* ... */ }
}
```

---

### Bridge 11: CacheBridge（Prompt Cache 检测）

**吃掉**：`services/api/promptCacheBreakDetection.ts`

```typescript
// src/dsxu/bridges/cache-bridge.ts

/**
 * 增强 R5-19 cache-stats：接入 Claude Code 的 cache break 检测。
 */
export class CacheBridge {
  /** 检测 prompt cache 是否被破坏 */
  detectCacheBreak(currentPrompt: string, previousPrompt: string): {
    broken: boolean;
    breakPoint?: number;
    diff?: string;
  } { /* 提取 promptCacheBreakDetection 的 diff 逻辑 */ }
}
```

---

### Bridge 12: SpeculationBridge（预测执行）

**吃掉**：`services/PromptSuggestion/speculation.ts`

```typescript
// src/dsxu/bridges/speculation-bridge.ts

/**
 * 预测 DAG 下一节点的执行，提前构建 prompt。
 * 深耦合原码，此 bridge 提取核心算法，去掉 UI 层。
 */
export class SpeculationBridge {
  /** 预测下一步 */
  async speculate(currentNode: string, dagSpec: DagSpec): Promise<{
    predictedNode: string;
    prebuiltPrompt: string;
    confidence: number;
  }> { /* ... */ }
}
```

---

## §3 DsxuRuntime 全集成版

```typescript
// src/dsxu/integration/index.ts (扩展)

export interface DsxuRuntime {
  // === 原有 DSxu 模块（23 个）===
  vectorStore: VectorStore;
  experienceStore: ExperienceStore;
  search: typeof search;
  mcpAdapters: McpAdapter[];
  mutation: typeof runMutationTests;
  pbt: { suggest; run };
  staticAnalysis: StaticAnalysisRunner;
  tddGate: TddGate;
  roles: RoleOrchestrator;
  voting: VotingService;
  dagRunner: DagRunner;
  dagPersist: PersistentDagRunner;
  sandbox: SandboxService;
  snapshot: SnapshotService;
  lsp: LspServer;
  ingestion: IngestionService;
  abHarness: AbHarness;
  sweBench: SweBenchBridge;
  cacheStats: CacheStatsService;
  samplingPolicy: SamplingPolicyService;

  // === 12 个 Bridge（吃 Claude Code）===
  memory: MemoryBridge;         // memdir + extractMemories + autoDream
  compact: CompactBridge;       // 对话紧缩
  forkedAgent: ForkedAgentBridge; // 子智能体 cache 共享
  cost: CostBridge;             // 成本追踪
  fileHistory: FileHistoryBridge; // 文件历史
  mcpReal: McpBridge;           // MCP 真实连接
  lspReal: LspBridge;           // LSP 真实 server
  permission: PermissionBridge; // 权限系统
  token: TokenBridge;           // Token 预算
  skills: SkillBridge;          // bundled skills
  cache: CacheBridge;           // Prompt cache 检测
  speculation: SpeculationBridge; // 预测执行

  // === 框架 ===
  tuningEngine: TuningEngine;
  hitlReporter: IncidentReporter;
  hookRegistry: HookRegistry;
}
```

---

## §4 执行计划（按优先级）

### Phase 0A: Shim 层（半天）

| 任务 | 文件 | 行数 |
|---|---|---|
| T0.1 shim-state.ts | `src/dsxu/shims/shim-state.ts` | ~40 |
| T0.2 shim-tool.ts | `src/dsxu/shims/shim-tool.ts` | ~30 |
| T0.3 shim-query.ts | `src/dsxu/shims/shim-query.ts` | ~40 |
| T0.4 单测 | `src/dsxu/shims/__tests__/shims.test.ts` | ~50 |

### Phase 0B: 12 Bridges（2-3 天）

| 优先级 | Bridge | 吃掉的原有功能 | 新增行数 | 收益 |
|---|---|---|---|---|
| 🔥 P0 | MemoryBridge | memdir + extractMemories + autoDream | ~200 | 永久记忆，DSxu 最大缺失 |
| 🔥 P0 | CostBridge | cost-tracker + modelCost | ~100 | 成本追踪，V8 硬要求 |
| 🔥 P0 | CompactBridge | compact/* | ~150 | 长对话必需 |
| 🟡 P1 | ForkedAgentBridge | forkedAgent + AgentSummary | ~150 | 角色系统升级 |
| 🟡 P1 | PermissionBridge | permissions/bashClassifier | ~80 | 安全增强 |
| 🟡 P1 | CacheBridge | promptCacheBreakDetection | ~60 | R5-19 增强 |
| 🟡 P1 | TokenBridge | tokenBudget + tokenEstimation | ~80 | DAG 执行预算 |
| 🟡 P1 | FileHistoryBridge | fileHistory | ~80 | R5-29 增强 |
| 🟢 P2 | McpBridge | mcp/client + config + auth | ~120 | R5-32 真实化 |
| 🟢 P2 | LspBridge | lsp/LSPServerManager | ~100 | R5-31 真实化 |
| 🟢 P2 | SkillBridge | skills/bundled/* | ~100 | remember/batch/verify |
| 🟢 P2 | SpeculationBridge | PromptSuggestion/speculation | ~100 | DAG 预测加速 |

### Phase 0C: 连线 + 全量测试（1 天）

| 任务 | 说明 |
|---|---|
| T0C.1 | createRuntime() 加入 12 个 bridge |
| T0C.2 | ExperienceStore.add() → MemoryBridge.remember() 双写 |
| T0C.3 | deepseek-proxy → CostBridge.trackFromResponse() |
| T0C.4 | DAG runner → CompactBridge.shouldCompact() |
| T0C.5 | roles/ → ForkedAgentBridge.runRole() |
| T0C.6 | R5-19 cache-stats → CacheBridge.detectCacheBreak() |
| T0C.7 | R5-27 sandbox → PermissionBridge.classifyCommand() |
| T0C.8 | bun test 全量 → 0 fail |

---

## §5 为什么这个方案能"全吃"

| 设计原则 | 如何实现 |
|---|---|
| **不改原码** | Shim + Bridge 全是新文件，Claude Code 原码零修改 |
| **渐进接入** | 每个 Bridge 独立，可逐个开启 |
| **mock 兼容** | 有 shim-query → 无 LLM 也能跑（mock 模式） |
| **双写不丢** | MemoryBridge 同时写 ExperienceStore + memdir |
| **成本透明** | CostBridge 统一追踪 DSxu 和 proxy 的成本 |
| **cache 最优** | ForkedAgentBridge 复用 prompt cache |

### 投入产出

| | 新写代码 | 吃掉的原有代码 | 杠杆比 |
|---|---|---|---|
| Shim 层 | ~160 行 | — | 基础设施 |
| 12 Bridges | ~1320 行 | ~8000+ 行成熟功能 | **1:6** |
| 单测 | ~400 行 | — | 质量保证 |
| **合计** | **~1880 行** | **~8000+ 行** | **花 1880 行吃 8000+ 行成熟代码** |

---

## §6 V10 修订建议

V10 原计划中以下任务应调整：

| V10 原计划 | 修订为 |
|---|---|
| T6.3 新建 CostLedger 类 | → **CostBridge** 复用 cost-tracker.ts |
| T6.4 新建 OTEL trace | → **Bridge 层自带 trace**（每个 bridge 方法加 withTrace） |
| Phase 5 集成层 5→23 | → **Phase 0B + 0C** 一步到 23 模块 + 12 bridge |
| Phase 6.1 VSCode 扩展从零写 | → **LspBridge** 接入真实 LSPServerManager |

---

**END · V10 Annex A**

> 一句话：**造 3 个 shim + 12 个 bridge，花 1880 行吃 8000+ 行成熟代码，零改原码。**
