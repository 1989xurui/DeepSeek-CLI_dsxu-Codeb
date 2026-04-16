import {
  clampMaxTokensToBudget,
  getBudgetKillThreshold,
  getBudgetTriggerRatio,
  getSafetyMargin,
  isBeijingOffPeak,
} from './model-limits'

export interface ProxyBudgetBase {
  action: string
  promptTok: number
  maxTok: number
  ctxMax: number
}

export interface ProxyBudgetGuard extends ProxyBudgetBase {
  safetyMargin: number
  triggerRatio: number
  targetTokens: number
  isNightMode: boolean
  stillOverBudget: boolean
  /** 降级策略（如果触发了降级） */
  degradationStrategy?: 'none' | 'reduce_output' | 'compress_input' | 'emergency'
  /** 建议的压缩阈值 */
  suggestedCompactThreshold?: number
  /** 是否应用了reasoner特殊策略 */
  reasonerStrategyApplied?: boolean
}

export interface ProxyBudgetGuardState {
  consecutive400s: number
  last400At?: string
}

export interface ProxyBudgetGuardTransition {
  nextState: ProxyBudgetGuardState
  killThreshold: number
  shouldKill: boolean
}

export interface BudgetMessageSummary {
  role: unknown
  hasToolCalls: boolean
  toolCallIds: string[]
  tool_call_id: unknown
  contentLen: number
}

export interface BudgetKillSwitchPayload {
  ts: string
  reason: string
  error: string
  killThreshold: number
  state: ProxyBudgetGuardState
  budget: ProxyBudgetGuard
  messages: any[]
}

export function buildProxyBudgetGuard(
  model: string,
  base: ProxyBudgetBase,
  targetTokens: number,
  date: Date = new Date(),
  scenario: string = 'normal',
): ProxyBudgetGuard {
  const safetyMargin = getSafetyMargin(date, model, scenario)
  const triggerRatio = getBudgetTriggerRatio(date)
  const isNightMode = isBeijingOffPeak(date)
  const budgetResult = clampMaxTokensToBudget(
    model,
    base.promptTok,
    base.maxTok,
    date,
    scenario,
  )

  return {
    ...base,
    safetyMargin,
    triggerRatio,
    targetTokens,
    isNightMode,
    stillOverBudget: budgetResult.overBudget,
    // 添加降级策略信息
    ...(budgetResult.degradationStrategy !== 'none' && {
      degradationStrategy: budgetResult.degradationStrategy,
      suggestedCompactThreshold: budgetResult.suggestedCompactThreshold,
    }),
    // 添加reasoner策略信息
    ...(budgetResult.reasonerStrategyApplied && {
      reasonerStrategyApplied: budgetResult.reasonerStrategyApplied,
    }),
  }
}

export function summarizeBudgetMessages(
  messages: any[],
): BudgetMessageSummary[] {
  return (messages ?? []).map((m: any) => ({
    role: m.role,
    hasToolCalls: !!m.tool_calls,
    toolCallIds: Array.isArray(m.tool_calls)
      ? m.tool_calls.map((tc: any) => String(tc.id ?? ''))
      : [],
    tool_call_id: m.tool_call_id,
    contentLen: typeof m.content === 'string' ? m.content.length : 0,
  }))
}

export function advanceBudgetGuardState(
  state: ProxyBudgetGuardState | undefined,
  date: Date = new Date(),
): ProxyBudgetGuardTransition {
  const nextCount = (state?.consecutive400s ?? 0) + 1
  const killThreshold = getBudgetKillThreshold(date)

  return {
    nextState: {
      consecutive400s: nextCount,
      last400At: date.toISOString(),
    },
    killThreshold,
    shouldKill: nextCount >= killThreshold,
  }
}

export function resetBudgetGuardState(): ProxyBudgetGuardState {
  return { consecutive400s: 0 }
}

export function buildBudgetIncidentDetails(
  params: {
    error: string
    budget?: ProxyBudgetGuard
    messages?: any[]
    state?: ProxyBudgetGuardState
    date?: Date
  },
): Record<string, unknown> {
  const date = params.date ?? new Date()
  return {
    error: params.error,
    budget: params.budget,
    state: params.state ?? resetBudgetGuardState(),
    isNightMode: isBeijingOffPeak(date),
    messages: summarizeBudgetMessages(params.messages ?? []),
  }
}

export function shouldBlockProxyRequest(guard: ProxyBudgetGuard): boolean {
  return guard.stillOverBudget
}

export function buildLocalBudgetExceededError(guard: ProxyBudgetGuard): {
  type: string
  message: string
  budget: ProxyBudgetGuard
} {
  return {
    type: 'context_budget_exceeded',
    message:
      'LOCAL_BUDGET_GUARD_BLOCKED: prompt still exceeds safe context budget after compression',
    budget: guard,
  }
}

export function buildBudgetKillSwitchPayload(params: {
  error: string
  killThreshold: number
  state: ProxyBudgetGuardState
  budget: ProxyBudgetGuard
  messages: any[]
  date?: Date
}): BudgetKillSwitchPayload {
  return {
    ts: (params.date ?? new Date()).toISOString(),
    reason: 'deepseek_400_budget_guard',
    error: params.error,
    killThreshold: params.killThreshold,
    state: params.state,
    budget: params.budget,
    messages: params.messages,
  }
}
