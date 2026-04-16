/**
 * MSA (Memory Storage Architecture) — 三级分层记忆编排器
 *
 * 核心职责：
 * 1. 协调 L1/L2/L3 三层记忆的构建和组装
 * 2. 在总 token 预算内动态分配各层配额
 * 3. 提供统一的 context 注入接口给 proxy / query engine
 *
 * 设计原则：
 * - L1 固定、L2 动态、L3 按需 — 总预算 ≤ 8K token
 * - L1 越稳定，DeepSeek prefix cache 命中率越高 → 成本越低
 * - L3 只在有明确查询时才检索，不浪费 token
 *
 * 用法：
 *   const msa = new MSA({ l1: { projectRoot: '/path/to/project' } });
 *   await msa.init();
 *   msa.l2.addConversationRound(user, assistant);
 *   const ctx = await msa.buildContext('当前任务描述');
 *   // ctx.l1.prefix → 注入 system prompt 开头
 *   // ctx.l2.text   → 注入 system prompt 或 user message
 *   // ctx.l3Results  → 注入 system prompt 尾部
 */

import { L1Core } from './l1-core';
import { L2Working } from './l2-working';
import { L3Archive } from './l3-archive';
import type {
  MSAConfig,
  MSAContext,
  L1CoreConfig,
  L2WorkingConfig,
  L3ArchiveConfig,
  L3RecordInput,
} from './types';

export { L1Core } from './l1-core';
export { L2Working } from './l2-working';
export { L3Archive } from './l3-archive';
export { createOllamaEmbedFn, getEmbeddingDimension } from './embedding-ollama';
export type { OllamaEmbeddingConfig } from './embedding-ollama';
export * from './types';

/** 默认总预算 */
const DEFAULT_TOTAL_BUDGET = 8000;

/** 简易 token 估算 */
function estimateTokens(text: string): number {
  let tokens = 0;
  for (const char of text) {
    tokens += char.charCodeAt(0) > 0x7F ? 0.6 : 0.28;
  }
  return Math.ceil(tokens);
}

export class MSA {
  readonly l1: L1Core;
  readonly l2: L2Working;
  readonly l3: L3Archive;

  private totalBudget: number;
  private initialized = false;

  constructor(config: MSAConfig) {
    this.l1 = new L1Core(config.l1);
    this.l2 = new L2Working(config.l2);
    this.l3 = new L3Archive(config.l3);
    this.totalBudget = config.totalBudget ?? DEFAULT_TOTAL_BUDGET;
  }

  /**
   * 初始化所有层
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    await this.l3.init();
    this.initialized = true;
  }

  /**
   * 构建完整 MSA 上下文 — 核心 API
   *
   * @param taskQuery - 当前任务描述 (用于 L3 检索)
   * @param options - 可选配置
   * @returns MSAContext 包含三层记忆的组装结果
   */
  async buildContext(
    taskQuery?: string,
    options?: {
      /** 是否启用 L3 检索 (默认 true, 无 taskQuery 时自动禁用) */
      enableL3?: boolean;
      /** L3 最大检索条目 */
      l3TopK?: number;
      /** 自定义总预算 */
      budgetOverride?: number;
    }
  ): Promise<MSAContext> {
    this.ensureInit();

    const budget = options?.budgetOverride ?? this.totalBudget;
    const enableL3 = (options?.enableL3 ?? true) && !!taskQuery;

    // Step 1: 构建 L1 (最稳定，优先保证)
    const l1 = await this.l1.build();

    // Step 2: 计算 L2 可用预算
    const l2Budget = Math.max(0, budget - l1.estimatedTokens - (enableL3 ? 1000 : 0));
    const l2 = this.l2.build(l2Budget);

    // Step 3: L3 按需检索
    let l3Results = '';
    let l3Tokens = 0;

    if (enableL3 && taskQuery) {
      const remainingBudget = budget - l1.estimatedTokens - l2.estimatedTokens;
      if (remainingBudget > 200) {
        const results = await this.l3.retrieve(taskQuery, {
          topK: options?.l3TopK ?? 3,
        });
        l3Results = this.l3.formatForInjection(results);
        l3Tokens = estimateTokens(l3Results);

        // 如果 L3 超预算，截断
        if (l3Tokens > remainingBudget) {
          const ratio = remainingBudget / l3Tokens;
          const maxChars = Math.floor(l3Results.length * ratio * 0.9);
          l3Results = l3Results.slice(0, maxChars) + '\n</archived_knowledge>';
          l3Tokens = estimateTokens(l3Results);
        }
      }
    }

    const totalTokens = l1.estimatedTokens + l2.estimatedTokens + l3Tokens;

    return {
      l1,
      l2,
      l3Results,
      l3Tokens,
      totalTokens,
      overBudget: totalTokens > budget,
    };
  }

  /**
   * 快速归档 — 将信息存入 L3
   */
  async archive(input: L3RecordInput): Promise<string | null> {
    this.ensureInit();
    return this.l3.add(input);
  }

  /**
   * 会话结束归档 — 将 L2 当前对话压缩后存入 L3
   */
  async archiveSession(sessionSummary: string): Promise<string | null> {
    this.ensureInit();

    const rounds = this.l2.getConversationRounds();
    if (rounds.length === 0 && !sessionSummary) return null;

    return this.l3.add({
      ts: Date.now(),
      type: 'conversation_summary',
      description: sessionSummary.slice(0, 200),
      content: sessionSummary,
      quality: 0.7, // 会话摘要默认中等质量
      helpfulness: null,
      source: 'session_archive',
    });
  }

  /**
   * 获取 MSA 统计信息
   */
  stats(): {
    l1: { tokens: number; cached: boolean };
    l2: { entries: number };
    l3: { total: number; avgQuality: number };
    budget: number;
  } {
    const l1Cached = this.l1.getCached();
    const l3Stats = this.l3.stats();

    return {
      l1: {
        tokens: l1Cached?.estimatedTokens ?? 0,
        cached: !!l1Cached,
      },
      l2: { entries: this.l2.entryCount },
      l3: { total: l3Stats.total, avgQuality: l3Stats.avgQuality },
      budget: this.totalBudget,
    };
  }

  /**
   * 清空 L2 工作记忆 (新会话时调用)
   */
  resetSession(): void {
    this.l2.clear();
  }

  private ensureInit(): void {
    if (!this.initialized) throw new Error('MSA not initialized. Call init() first.');
  }
}
