import {
  DEEPSEEK_V4_FLASH_MODEL,
  DEEPSEEK_V4_PRICING,
  DEEPSEEK_V4_PRO_MODEL,
  estimateDeepSeekV4Cost,
  normalizeDeepSeekV4Model,
  type DeepSeekV4Model,
} from '../../utils/model/deepseekV4Control'

export interface ModelPricing {
  inputPerMillion: number
  cacheHitInputPerMillion: number
  cacheMissInputPerMillion: number
  outputPerMillion: number
  cacheDiscount: number
}

function toLegacyPricing(model: DeepSeekV4Model): ModelPricing {
  const pricing = DEEPSEEK_V4_PRICING[model]
  return {
    inputPerMillion: pricing.cacheMissInputPerMillion,
    cacheHitInputPerMillion: pricing.cacheHitInputPerMillion,
    cacheMissInputPerMillion: pricing.cacheMissInputPerMillion,
    outputPerMillion: pricing.outputPerMillion,
    cacheDiscount: 1 - pricing.cacheHitInputPerMillion / pricing.cacheMissInputPerMillion,
  }
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  [DEEPSEEK_V4_FLASH_MODEL]: toLegacyPricing(DEEPSEEK_V4_FLASH_MODEL),
  [DEEPSEEK_V4_PRO_MODEL]: toLegacyPricing(DEEPSEEK_V4_PRO_MODEL),
  'gpt-4o-mini': {
    inputPerMillion: 0.15,
    cacheHitInputPerMillion: 0.075,
    cacheMissInputPerMillion: 0.15,
    outputPerMillion: 0.60,
    cacheDiscount: 0.50,
  },
  'gpt-4o': {
    inputPerMillion: 2.50,
    cacheHitInputPerMillion: 1.25,
    cacheMissInputPerMillion: 2.50,
    outputPerMillion: 10.00,
    cacheDiscount: 0.50,
  },
}

export interface CostEntry {
  timestamp: number
  model: string
  inputTokens: number
  outputTokens: number
  cacheHit: boolean
  cost: number
  sessionId: string
}

export interface CostBudget {
  perSession?: number
  perDay?: number
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

  record(
    model: string,
    inputTokens: number,
    outputTokens: number,
    cacheHit: boolean = false,
  ): CostEntry {
    const cost = estimateCost(model, inputTokens, outputTokens, cacheHit)
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

  getSessionCost(sessionId?: string): number {
    const sid = sessionId || this.currentSessionId
    return this.entries
      .filter(e => e.sessionId === sid)
      .reduce((sum, e) => sum + e.cost, 0)
  }

  getDailyCost(): number {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    return this.entries
      .filter(e => e.timestamp >= startOfDay.getTime())
      .reduce((sum, e) => sum + e.cost, 0)
  }

  getMonthlyCost(): number {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    return this.entries
      .filter(e => e.timestamp >= startOfMonth.getTime())
      .reduce((sum, e) => sum + e.cost, 0)
  }

  getTotalCost(): number {
    return this.entries.reduce((sum, e) => sum + e.cost, 0)
  }

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

  getEntries(): CostEntry[] {
    return [...this.entries]
  }

  get size(): number {
    return this.entries.length
  }

  private checkBudget(): void {
    const sessionCost = this.getSessionCost()

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

  reset(): void {
    this.entries = []
  }
}

export function estimateCostDetailed(input: {
  model: string
  cacheHitInputTokens?: number
  cacheMissInputTokens?: number
  inputTokens?: number
  outputTokens: number
  cacheHit?: boolean
}): number {
  if (input.model.startsWith('deepseek')) {
    const normalized = normalizeDeepSeekV4Model(input.model)
    return estimateDeepSeekV4Cost({
      ...input,
      model: normalized,
    })
  }

  const pricing = MODEL_PRICING[input.model] || MODEL_PRICING[DEEPSEEK_V4_FLASH_MODEL]
  const cacheHitInputTokens =
    input.cacheHitInputTokens ?? (input.cacheHit ? input.inputTokens ?? 0 : 0)
  const cacheMissInputTokens =
    input.cacheMissInputTokens ?? (input.cacheHit ? 0 : input.inputTokens ?? 0)

  return (
    (cacheHitInputTokens / 1_000_000) * pricing.cacheHitInputPerMillion +
    (cacheMissInputTokens / 1_000_000) * pricing.cacheMissInputPerMillion +
    (input.outputTokens / 1_000_000) * pricing.outputPerMillion
  )
}

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheHit: boolean = false,
): number {
  return estimateCostDetailed({
    model,
    inputTokens,
    outputTokens,
    cacheHit,
  })
}

export function processCostTrackerLifecycle(input) {
  void input
  const state = 'cost-tracker-state'
  const lifecycle = 'cost-tracker:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
