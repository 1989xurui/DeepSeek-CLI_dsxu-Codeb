export {
  estimateCost,
  estimateCostDetailed,
  MODEL_PRICING,
} from '../engine/cost-tracker'
export type {
  ModelPricing,
} from '../engine/cost-tracker'

import { estimateCostDetailed } from '../engine/cost-tracker'

export type CostUsage = {
  prompt_tokens?: number
  completion_tokens?: number
  prompt_cache_hit_tokens?: number
  prompt_cache_miss_tokens?: number
}

export type CostLedgerEntry = {
  timestamp: number
  module: string
  model: string
  inputTokens: number
  outputTokens: number
  cachedTokens: number
  cacheMissTokens: number
  cost: number
}

export class CostTracker {
  private entries: CostLedgerEntry[] = []

  constructor(readonly ledgerPath: string) {}

  async track(
    module: string,
    model: string,
    usage: CostUsage,
  ): Promise<CostLedgerEntry> {
    const inputTokens = usage.prompt_tokens ?? 0
    const outputTokens = usage.completion_tokens ?? 0
    const cachedTokens = usage.prompt_cache_hit_tokens ?? 0
    const cacheMissTokens =
      usage.prompt_cache_miss_tokens ?? Math.max(0, inputTokens - cachedTokens)
    const cost = estimateCostDetailed({
      model,
      cacheHitInputTokens: cachedTokens,
      cacheMissInputTokens: cacheMissTokens,
      outputTokens,
    })
    const entry: CostLedgerEntry = {
      timestamp: Date.now(),
      module,
      model,
      inputTokens,
      outputTokens,
      cachedTokens,
      cacheMissTokens,
      cost,
    }

    this.entries.push(entry)
    return entry
  }

  totalCost(module?: string): number {
    return this.getEntries(module).reduce((sum, entry) => sum + entry.cost, 0)
  }

  budgetCheck(limit: number): { ok: boolean; current: number; remaining: number; limit: number } {
    const current = this.totalCost()
    return {
      ok: current <= limit,
      current,
      remaining: Math.max(0, limit - current),
      limit,
    }
  }

  getEntries(module?: string): CostLedgerEntry[] {
    const entries = module
      ? this.entries.filter(entry => entry.module === module)
      : this.entries
    return [...entries]
  }
}
