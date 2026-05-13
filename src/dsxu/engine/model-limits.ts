/**
 * DeepSeek model budget and output limits.
 *
 * Keep DSXU engine model limits in one place so context window, max_tokens,
 * and budget guard behavior do not split across runtime paths.
 */

import {
  DEEPSEEK_V4_CONTEXT_WINDOW,
  DEEPSEEK_V4_FLASH_MODEL,
  DEEPSEEK_V4_MAX_CHAT_OUTPUT_TOKENS,
  DEEPSEEK_V4_PRO_MODEL,
  getDeepSeekV4ModelSpec,
  isDeepSeekV4ModelLike,
  normalizeDeepSeekV4Model,
} from '../../utils/model/deepseekV4Control'

export const DEEPSEEK_CONTEXT_WINDOW = DEEPSEEK_V4_CONTEXT_WINDOW

/** @deprecated Use getModelConfig(model).maxOutputTokens instead. */
export const DEEPSEEK_MAX_OUTPUT_TOKENS: Record<string, number> = {
  [DEEPSEEK_V4_FLASH_MODEL]: DEEPSEEK_V4_MAX_CHAT_OUTPUT_TOKENS,
  [DEEPSEEK_V4_PRO_MODEL]: DEEPSEEK_V4_MAX_CHAT_OUTPUT_TOKENS,
}

export const DEFAULT_SAFETY_MARGIN = 2_000
export const NIGHT_SAFETY_MARGIN = 4_000

export const MODEL_SAFETY_MULTIPLIER: Record<string, number> = {
  'gpt-4o': 1.2,
  'gpt-4o-mini': 1.0,
}

export const SCENARIO_SAFETY_ADJUSTMENT: Record<string, number> = {
  normal: 0,
  code_generation: 500,
  reasoning: 1000,
  summarization: -500,
}

export const DEFAULT_BUDGET_TRIGGER_RATIO = 0.75
export const NIGHT_BUDGET_TRIGGER_RATIO = 0.65
export const DEFAULT_BUDGET_KILL_THRESHOLD = 3
export const NIGHT_BUDGET_KILL_THRESHOLD = 2

/**
 * Beijing off-peak window: 00:30-08:30.
 */
export function isBeijingOffPeak(date: Date = new Date()): boolean {
  const beijing = new Date(
    date.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }),
  )
  const minutes = beijing.getHours() * 60 + beijing.getMinutes()
  return minutes >= 30 && minutes < 8 * 60 + 30
}

export function getSafetyMargin(
  date: Date = new Date(),
  model?: string,
  scenario: string = 'normal',
): number {
  const baseMargin = isBeijingOffPeak(date)
    ? NIGHT_SAFETY_MARGIN
    : DEFAULT_SAFETY_MARGIN
  const modelMultiplier = model ? getModelSafetyMultiplier(model) : 1.0
  const scenarioAdjustment = SCENARIO_SAFETY_ADJUSTMENT[scenario] ?? 0

  return Math.max(1000, Math.floor(baseMargin * modelMultiplier + scenarioAdjustment))
}

export function getModelSafetyMultiplier(model: string): number {
  if (isDeepSeekV4ModelLike(model)) {
    return normalizeDeepSeekV4Model(model) === DEEPSEEK_V4_PRO_MODEL ? 1.5 : 1.0
  }
  return MODEL_SAFETY_MULTIPLIER[model] ?? 1.0
}

export function getBudgetTriggerRatio(date: Date = new Date()): number {
  return isBeijingOffPeak(date)
    ? NIGHT_BUDGET_TRIGGER_RATIO
    : DEFAULT_BUDGET_TRIGGER_RATIO
}

export function getBudgetKillThreshold(date: Date = new Date()): number {
  return isBeijingOffPeak(date)
    ? NIGHT_BUDGET_KILL_THRESHOLD
    : DEFAULT_BUDGET_KILL_THRESHOLD
}

export function getModelContextLimit(model: string): number {
  if (isDeepSeekV4ModelLike(model)) {
    return getDeepSeekV4ModelSpec(model).contextWindow
  }
  return DEEPSEEK_CONTEXT_WINDOW
}

export function getModelMaxOutputTokens(model: string): number {
  try {
    return getDeepSeekV4ModelSpec(normalizeDeepSeekV4Model(model)).maxOutputTokens
  } catch {
    return 8_192
  }
}

export function shouldTriggerBudgetCompaction(
  model: string,
  promptTokens: number,
  date: Date = new Date(),
): boolean {
  const contextLimit = getModelContextLimit(model)
  return promptTokens / contextLimit >= getBudgetTriggerRatio(date)
}

/**
 * Budget invariant:
 * prompt_tokens + max_tokens + safety_margin <= context_limit
 */
export interface BudgetClampResult {
  contextLimit: number
  safetyMargin: number
  modelMaxOutput: number
  maxTokens: number
  remainingForOutput: number
  overBudget: boolean
  degradationStrategy: 'none' | 'reduce_output' | 'compress_input' | 'emergency'
  suggestedCompactThreshold?: number
  requestedMaxTokens?: number
  reasonerStrategyApplied?: boolean
}

export function clampMaxTokensToBudget(
  model: string,
  promptTokens: number,
  requestedMaxTokens?: number,
  date: Date = new Date(),
  scenario: string = 'normal',
): BudgetClampResult {
  const contextLimit = getModelContextLimit(model)
  const safetyMargin = getSafetyMargin(date, model, scenario)
  const modelMaxOutput = getModelMaxOutputTokens(model)
  const wanted = Math.min(requestedMaxTokens ?? modelMaxOutput, modelMaxOutput)
  const remainingForOutput = Math.max(0, contextLimit - promptTokens - safetyMargin)

  let maxTokens = Math.max(1_024, Math.min(wanted, remainingForOutput))
  const overBudget = promptTokens + wanted + safetyMargin > contextLimit

  let degradationStrategy: BudgetClampResult['degradationStrategy'] = 'none'
  let suggestedCompactThreshold: number | undefined
  let reasonerStrategyApplied = false

  if (normalizeDeepSeekV4Model(model) === DEEPSEEK_V4_PRO_MODEL) {
    reasonerStrategyApplied = true
    if (overBudget && remainingForOutput < 4096) {
      maxTokens = Math.max(512, remainingForOutput)
      degradationStrategy = 'reduce_output'
    }
  }

  if (overBudget && wanted > modelMaxOutput * 0.5) {
    maxTokens = Math.max(1024, Math.min(modelMaxOutput * 0.5, remainingForOutput))
    degradationStrategy = 'reduce_output'
  }

  const usageRatio = promptTokens / contextLimit
  if (overBudget && usageRatio > 0.85) {
    degradationStrategy = 'compress_input'
    suggestedCompactThreshold = 0.7
  }

  if (overBudget && usageRatio > 0.95) {
    degradationStrategy = 'emergency'
    suggestedCompactThreshold = 0.5
    maxTokens = Math.max(512, Math.min(maxTokens, 2048))
  }

  maxTokens = Math.max(512, maxTokens)

  return {
    contextLimit,
    safetyMargin,
    modelMaxOutput,
    maxTokens,
    remainingForOutput,
    overBudget,
    degradationStrategy,
    suggestedCompactThreshold,
    requestedMaxTokens: wanted,
    reasonerStrategyApplied,
  }
}
