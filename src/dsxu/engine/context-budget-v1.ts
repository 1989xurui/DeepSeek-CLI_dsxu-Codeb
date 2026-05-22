export type ContextBudgetRisk = 'none' | 'low' | 'medium' | 'high'

export type ContextBudget = {
  model: string
  contextWindow: number
  lowWatermark: number
  mediumWatermark: number
  highWatermark: number
}

export function createBudgetForContextWindow(
  model: string,
  contextWindow: number
): ContextBudget {
  const safeWindow = Math.max(1, contextWindow)
  return {
    model,
    contextWindow: safeWindow,
    lowWatermark: Math.floor(safeWindow * 0.5),
    mediumWatermark: Math.floor(safeWindow * 0.7),
    highWatermark: Math.floor(safeWindow * 0.85),
  }
}

export function checkBudgetUsage(tokens: number, budget: ContextBudget): {
  tokens: number
  usageRatio: number
  riskLevel: ContextBudgetRisk
  suggestedAction: 'continue' | 'monitor' | 'compact' | 'switch_model'
} {
  const safeTokens = Math.max(0, tokens)
  const usageRatio = safeTokens / Math.max(1, budget.contextWindow)
  const riskLevel: ContextBudgetRisk =
    safeTokens >= budget.highWatermark
      ? 'high'
      : safeTokens >= budget.mediumWatermark
        ? 'medium'
        : safeTokens >= budget.lowWatermark
          ? 'low'
          : 'none'

  return {
    tokens: safeTokens,
    usageRatio,
    riskLevel,
    suggestedAction:
      riskLevel === 'high'
        ? 'switch_model'
        : riskLevel === 'medium'
          ? 'compact'
          : riskLevel === 'low'
            ? 'monitor'
            : 'continue',
  }
}
