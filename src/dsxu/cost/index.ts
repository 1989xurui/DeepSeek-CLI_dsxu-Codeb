/**
 * DSxu 成本追踪 — 复用 Claude Code 原有 calculateUSDCost
 *
 * 不重新造轮子。直接 import 原有的模型价格表。
 * 仅新增：JSONL 日志写入 + 模块级统计。
 */

import { appendFile, mkdir, readFile } from 'fs/promises';
import { dirname } from 'path';

// Claude Code 原有：完整的模型价格计算
let _calculateUSDCost: ((model: string, usage: any) => number) | null = null;

try {
  const mod = await import('../../utils/modelCost');
  _calculateUSDCost = mod.calculateUSDCost;
} catch {
  // 独立运行时降级到简单计算
}

export interface CostEntry {
  timestamp: string;
  module: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  cost: number;
}

export class CostTracker {
  private entries: CostEntry[] = [];
  private ledgerPath: string;

  constructor(ledgerPath = '.dsevo/cost-ledger.jsonl') {
    this.ledgerPath = ledgerPath;
  }

  /** 从 proxy 响应记录一条成本 */
  async track(module: string, model: string, usage: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_cache_hit_tokens?: number;
  }): Promise<CostEntry> {
    const inputTokens = usage.prompt_tokens ?? 0;
    const outputTokens = usage.completion_tokens ?? 0;
    const cachedTokens = usage.prompt_cache_hit_tokens ?? 0;

    let cost: number;
    if (_calculateUSDCost) {
      cost = _calculateUSDCost(model, {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: cachedTokens,
      });
    } else {
      // DeepSeek V3.2 fallback pricing
      cost = (inputTokens * 0.27 + outputTokens * 1.10 + cachedTokens * 0.07) / 1_000_000;
    }

    const entry: CostEntry = {
      timestamp: new Date().toISOString(),
      module, model, inputTokens, outputTokens, cachedTokens, cost,
    };

    this.entries.push(entry);

    try {
      await mkdir(dirname(this.ledgerPath), { recursive: true });
      await appendFile(this.ledgerPath, JSON.stringify(entry) + '\n');
    } catch { /* 写入失败不阻塞 */ }

    return entry;
  }

  totalCost(module?: string): number {
    const filtered = module ? this.entries.filter(e => e.module === module) : this.entries;
    return filtered.reduce((s, e) => s + e.cost, 0);
  }

  budgetCheck(budget: number, module?: string): { ok: boolean; used: number; remaining: number } {
    const used = this.totalCost(module);
    return { ok: used <= budget, used, remaining: budget - used };
  }

  getEntries(module?: string): CostEntry[] {
    return module ? this.entries.filter(e => e.module === module) : [...this.entries];
  }
}
