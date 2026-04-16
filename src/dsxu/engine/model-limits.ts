/**
 * DeepSeek 模型预算与输出上限
 *
 * 统一 DSxu engine 与 deepseek-proxy 的模型口径，避免：
 * - context window 不一致
 * - max_tokens 裁剪不一致
 * - 400 budget 规则分叉
 *
 * 重构：使用模型配置管理器，支持更多DeepSeek模型
 */

import { getModelConfig } from './model-config'

export const DEEPSEEK_CONTEXT_WINDOW = 128_000

/** @deprecated 使用 getModelConfig(model).maxOutputTokens 替代 */
export const DEEPSEEK_MAX_OUTPUT_TOKENS: Record<string, number> = {
  'deepseek-chat': 8_192,
  'deepseek-reasoner': 65_536,
}

// 基础安全边际
export const DEFAULT_SAFETY_MARGIN = 2_000
export const NIGHT_SAFETY_MARGIN = 4_000

// 按模型调整的安全边际乘数
export const MODEL_SAFETY_MULTIPLIER: Record<string, number> = {
  'deepseek-chat': 1.0,      // 标准
  'deepseek-reasoner': 1.5,  // reasoner需要更多安全边际（长输出）
  'gpt-4o': 1.2,
  'gpt-4o-mini': 1.0,
}

// 按场景调整的安全边际
export const SCENARIO_SAFETY_ADJUSTMENT: Record<string, number> = {
  'normal': 0,           // 正常对话
  'code_generation': 500, // 代码生成需要更多token
  'reasoning': 1000,     // 推理任务
  'summarization': -500, // 摘要任务可以少一些
}

export const DEFAULT_BUDGET_TRIGGER_RATIO = 0.75
export const NIGHT_BUDGET_TRIGGER_RATIO = 0.65
export const DEFAULT_BUDGET_KILL_THRESHOLD = 3
export const NIGHT_BUDGET_KILL_THRESHOLD = 2

/**
 * 北京时间 off-peak: 00:30-08:30
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
  scenario: string = 'normal'
): number {
  const baseMargin = isBeijingOffPeak(date) ? NIGHT_SAFETY_MARGIN : DEFAULT_SAFETY_MARGIN
  const modelMultiplier = model ? (MODEL_SAFETY_MULTIPLIER[model] ?? 1.0) : 1.0
  const scenarioAdjustment = SCENARIO_SAFETY_ADJUSTMENT[scenario] ?? 0

  return Math.max(1000, Math.floor(baseMargin * modelMultiplier + scenarioAdjustment))
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
  if (model === 'deepseek-chat' || model === 'deepseek-reasoner') {
    return DEEPSEEK_CONTEXT_WINDOW
  }
  return 128_000
}

export function getModelMaxOutputTokens(model: string): number {
  try {
    const config = getModelConfig(model)
    return config.maxOutputTokens
  } catch {
    return 8_192 // 默认值
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
 * 预算恒等式：
 * prompt_tokens + max_tokens + safety_margin <= context_limit
 */
export interface BudgetClampResult {
  contextLimit: number
  safetyMargin: number
  modelMaxOutput: number
  maxTokens: number
  remainingForOutput: number
  overBudget: boolean
  /** 降级策略：'none' | 'reduce_output' | 'compress_input' | 'emergency' */
  degradationStrategy: 'none' | 'reduce_output' | 'compress_input' | 'emergency'
  /** 建议的压缩阈值（如果需要压缩输入） */
  suggestedCompactThreshold?: number
  /** 原始请求的max_tokens */
  requestedMaxTokens?: number
  /** 是否触发了reasoner特殊策略 */
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

  // 基础计算
  let maxTokens = Math.max(1_024, Math.min(wanted, remainingForOutput))
  const overBudget = promptTokens + wanted + safetyMargin > contextLimit

  // 降级策略决策
  let degradationStrategy: BudgetClampResult['degradationStrategy'] = 'none'
  let suggestedCompactThreshold: number | undefined
  let reasonerStrategyApplied = false

  // 对reasoner的特殊策略：允许更激进的输出限制
  if (model === 'deepseek-reasoner') {
    reasonerStrategyApplied = true
    // reasoner可以接受更低的输出限制，因为主要价值在推理过程
    if (overBudget && remainingForOutput < 4096) {
      // 如果剩余空间很小，进一步降低输出限制
      maxTokens = Math.max(512, remainingForOutput)
      degradationStrategy = 'reduce_output'
    }
  }

  // 降级路径1：减少输出（如果输出请求过高）
  if (overBudget && wanted > modelMaxOutput * 0.5) {
    // 如果请求的输出超过模型最大输出的50%，先减少输出
    maxTokens = Math.max(1024, Math.min(modelMaxOutput * 0.5, remainingForOutput))
    degradationStrategy = 'reduce_output'
  }

  // 降级路径2：需要压缩输入（使用率超过85%）
  const usageRatio = promptTokens / contextLimit
  if (overBudget && usageRatio > 0.85) {
    degradationStrategy = 'compress_input'
    suggestedCompactThreshold = 0.7  // 建议压缩到70%使用率
  }

  // 降级路径3：紧急情况（使用率超过95%）
  if (overBudget && usageRatio > 0.95) {
    degradationStrategy = 'emergency'
    suggestedCompactThreshold = 0.5  // 紧急压缩到50%使用率
    // 极端情况下，进一步限制输出
    maxTokens = Math.max(512, Math.min(maxTokens, 2048))
  }

  // 最终检查：确保maxTokens至少为512
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
