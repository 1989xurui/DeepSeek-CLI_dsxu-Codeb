/**
 * #6.9 Real-time Cost Tracker
 *
 * 实时追踪 LLM API 调用费用：
 *   - 按模型分别计费（DeepSeek chat / reasoner）
 *   - 支持 cache hit 折扣
 *   - 会话/日/月累计
 *   - 预算警告
 */

// ── Pricing ──

export interface ModelPricing {
  /** 输入价格 $/M tokens */
  inputPerMillion: number
  /** 输出价格 $/M tokens */
  outputPerMillion: number
  /** 缓存命中折扣率（0-1，如 0.9 表示 90% off） */
  cacheDiscount: number
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  'deepseek-chat': {
    inputPerMillion: 0.27,
    outputPerMillion: 1.10,
    cacheDiscount: 0.90,
  },
  'deepseek-reasoner': {
    inputPerMillion: 0.55,
    outputPerMillion: 2.19,
    cacheDiscount: 0.90,
  },
  // Fallback models
  'gpt-4o-mini': {
    inputPerMillion: 0.15,
    outputPerMillion: 0.60,
    cacheDiscount: 0.50,
  },
  'gpt-4o': {
    inputPerMillion: 2.50,
    outputPerMillion: 10.00,
    cacheDiscount: 0.50,
  },
}

// ── Cost Entry ──

export interface CostEntry {
  timestamp: number
  model: string
  inputTokens: number
  outputTokens: number
  cacheHit: boolean
  cost: number  // USD
  sessionId: string
}

// ── Cost Tracker ──

export interface CostBudget {
  /** 每次会话预算 USD */
  perSession?: number
  /** 每日预算 USD */
  perDay?: number
  /** 每月预算 USD */
  perMonth?: number
}

export interface CostAlert {
  type: 'warning' | 'limit'
  message: string
  current: number
  limit: number
}

export class CostTracker {
  private entries: CostEntry[] = []
  private budget: CostBudget
  private currentSessionId: string
  private onAlert?: (alert: CostAlert) => void

  constructor(
    sessionId: string,
    budget?: CostBudget,
    onAlert?: (alert: CostAlert) => void,
  ) {
    this.currentSessionId = sessionId
    this.budget = budget || {}
    this.onAlert = onAlert
  }

  /**
   * 记录一次 API 调用的费用
   */
  record(
    model: string,
    inputTokens: number,
    outputTokens: number,
    cacheHit: boolean = false,
  ): CostEntry {
    const pricing = MODEL_PRICING[model] || MODEL_PRICING['deepseek-chat']

    let inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion
    if (cacheHit) {
      inputCost *= (1 - pricing.cacheDiscount)
    }
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion
    const cost = inputCost + outputCost

    const entry: CostEntry = {
      timestamp: Date.now(),
      model,
      inputTokens,
      outputTokens,
      cacheHit,
      cost,
      sessionId: this.currentSessionId,
    }

    this.entries.push(entry)
    this.checkBudget()

    return entry
  }

  /**
   * 获取会话费用
   */
  getSessionCost(sessionId?: string): number {
    const sid = sessionId || this.currentSessionId
    return this.entries
      .filter(e => e.sessionId === sid)
      .reduce((sum, e) => sum + e.cost, 0)
  }

  /**
   * 获取今日费用
   */
  getDailyCost(): number {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    return this.entries
      .filter(e => e.timestamp >= startOfDay.getTime())
      .reduce((sum, e) => sum + e.cost, 0)
  }

  /**
   * 获取本月费用
   */
  getMonthlyCost(): number {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    return this.entries
      .filter(e => e.timestamp >= startOfMonth.getTime())
      .reduce((sum, e) => sum + e.cost, 0)
  }

  /**
   * 获取总费用
   */
  getTotalCost(): number {
    return this.entries.reduce((sum, e) => sum + e.cost, 0)
  }

  /**
   * 按模型统计费用
   */
  getCostByModel(): Record<string, { cost: number; calls: number; tokens: number }> {
    const byModel: Record<string, { cost: number; calls: number; tokens: number }> = {}

    for (const e of this.entries) {
      if (!byModel[e.model]) {
        byModel[e.model] = { cost: 0, calls: 0, tokens: 0 }
      }
      byModel[e.model].cost += e.cost
      byModel[e.model].calls++
      byModel[e.model].tokens += e.inputTokens + e.outputTokens
    }

    return byModel
  }

  /**
   * 获取详细摘要
   */
  getSummary(): string {
    const sessionCost = this.getSessionCost()
    const dailyCost = this.getDailyCost()
    const totalEntries = this.entries.filter(e => e.sessionId === this.currentSessionId).length
    const cacheHits = this.entries.filter(e => e.sessionId === this.currentSessionId && e.cacheHit).length

    const lines = [
      `Session cost: $${sessionCost.toFixed(4)} (${totalEntries} calls, ${cacheHits} cache hits)`,
      `Daily cost: $${dailyCost.toFixed(4)}`,
    ]

    const byModel = this.getCostByModel()
    for (const [model, stats] of Object.entries(byModel)) {
      lines.push(`  ${model}: $${stats.cost.toFixed(4)} (${stats.calls} calls, ${stats.tokens} tokens)`)
    }

    if (this.budget.perSession) {
      const pct = (sessionCost / this.budget.perSession * 100).toFixed(1)
      lines.push(`Budget: ${pct}% of $${this.budget.perSession} session limit`)
    }

    return lines.join('\n')
  }

  /**
   * 获取所有条目
   */
  getEntries(): CostEntry[] {
    return [...this.entries]
  }

  /**
   * 获取条目数
   */
  get size(): number {
    return this.entries.length
  }

  /**
   * 预算检查
   */
  private checkBudget(): void {
    const sessionCost = this.getSessionCost()

    // Session budget
    if (this.budget.perSession) {
      if (sessionCost >= this.budget.perSession) {
        this.onAlert?.({
          type: 'limit',
          message: `Session budget exceeded: $${sessionCost.toFixed(4)} >= $${this.budget.perSession}`,
          current: sessionCost,
          limit: this.budget.perSession,
        })
      } else if (sessionCost >= this.budget.perSession * 0.8) {
        this.onAlert?.({
          type: 'warning',
          message: `Session budget at 80%: $${sessionCost.toFixed(4)} / $${this.budget.perSession}`,
          current: sessionCost,
          limit: this.budget.perSession,
        })
      }
    }

    // Daily budget
    if (this.budget.perDay) {
      const dailyCost = this.getDailyCost()
      if (dailyCost >= this.budget.perDay) {
        this.onAlert?.({
          type: 'limit',
          message: `Daily budget exceeded: $${dailyCost.toFixed(4)} >= $${this.budget.perDay}`,
          current: dailyCost,
          limit: this.budget.perDay,
        })
      }
    }
  }

  /** 重置（测试用） */
  reset(): void {
    this.entries = []
  }
}

/**
 * 计算单次调用的预估费用
 */
export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheHit: boolean = false,
): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['deepseek-chat']
  let inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion
  if (cacheHit) {
    inputCost *= (1 - pricing.cacheDiscount)
  }
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion
  return inputCost + outputCost
}
