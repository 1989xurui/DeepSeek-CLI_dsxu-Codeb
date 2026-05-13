/**
 *
 *
 * 三层策略：
 *   1. DeepSeek API response.usage（最精确，免费附带）
 *   2. tiktoken cl100k_base（离线精确，需要加载 BPE 数据）
 *   3. 启发式估算（零依赖兜底，当前 proxy 使用的方式）
 *
 * V13 选择：先用启发式（已在 proxy 中验证），加精确度监控。
 * 当实际 vs 估算偏差 > 15% 时告警，提示升级到 tiktoken。
 *
 * 与 DSXU 的区别：
 *   - DSXU 用 Provider tokenizer（私有）
 *   - DSxu 用 DeepSeek tokenizer（BPE，cl100k 系列）
 */

import type { Message, LLMResponse } from './types'
import {
  getModelContextLimit,
  clampMaxTokensToBudget,
} from './model-limits'
import {
  DEEPSEEK_V4_CONTEXT_WINDOW,
  DEEPSEEK_V4_FLASH_MODEL,
  DEEPSEEK_V4_PRO_MODEL,
} from '../../utils/model/deepseekV4Control'

// ── 启发式估算（与 proxy/compact 一致） ──

/** 估算字符串 token 数（中文 ~0.6 tok/char, 英文 ~0.28 tok/char） */
export function estimateTokens(text: string): number {
  if (!text) return 0
  let zh = 0, other = 0
  for (const char of text) {
    const c = char.charCodeAt(0)
    if (c >= 0x4e00 && c <= 0x9fff) zh++
    else other++
  }
  return Math.ceil(zh * 0.6 + other * 0.28)
}

/** 估算单条消息 token 数 */
export function estimateMessageTokens(msg: Message): number {
  let t = 4  // role overhead (~4 tokens per message)
  if (typeof msg.content === 'string') {
    t += estimateTokens(msg.content)
  } else if (Array.isArray(msg.content)) {
    for (const b of msg.content) {
      t += estimateTokens(JSON.stringify(b))
    }
  }
  if (msg.toolCalls) t += estimateTokens(JSON.stringify(msg.toolCalls))
  if (msg.reasoning) t += estimateTokens(msg.reasoning)
  return t
}

/** 估算消息列表总 token 数 */
export function estimateAllTokens(messages: Message[]): number {
  return messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0)
}

// ── 精确度监控 ──

export interface TokenAccuracyStats {
  /** 总样本数 */
  samples: number
  /** 平均偏差百分比 */
  avgDeviationPercent: number
  /** 最大偏差百分比 */
  maxDeviationPercent: number
  /** 偏差 > 15% 的次数（需要告警） */
  highDeviationCount: number
  /** 累计估算值 */
  totalEstimated: number
  /** 累计实际值 */
  totalActual: number
}

class TokenAccuracyMonitor {
  private samples: Array<{ estimated: number; actual: number }> = []
  private maxSamples = 100  // 滑动窗口

  /** 记录一次估算 vs 实际的对比 */
  record(estimated: number, actual: number): void {
    this.samples.push({ estimated, actual })
    if (this.samples.length > this.maxSamples) {
      this.samples.shift()
    }

    // 偏差 > 15% 时告警
    const deviation = Math.abs(estimated - actual) / Math.max(actual, 1)
    if (deviation > 0.15 && actual > 100) {
      console.warn(
        `[TokenEstimator] ⚠️ Deviation ${(deviation * 100).toFixed(1)}%: ` +
        `estimated ${estimated} vs actual ${actual}`
      )
    }
  }

  /** 获取精确度统计 */
  getStats(): TokenAccuracyStats {
    if (this.samples.length === 0) {
      return {
        samples: 0,
        avgDeviationPercent: 0,
        maxDeviationPercent: 0,
        highDeviationCount: 0,
        totalEstimated: 0,
        totalActual: 0,
      }
    }

    let totalDeviation = 0
    let maxDeviation = 0
    let highCount = 0
    let totalEst = 0
    let totalAct = 0

    for (const s of this.samples) {
      const dev = Math.abs(s.estimated - s.actual) / Math.max(s.actual, 1)
      totalDeviation += dev
      maxDeviation = Math.max(maxDeviation, dev)
      if (dev > 0.15) highCount++
      totalEst += s.estimated
      totalAct += s.actual
    }

    return {
      samples: this.samples.length,
      avgDeviationPercent: (totalDeviation / this.samples.length) * 100,
      maxDeviationPercent: maxDeviation * 100,
      highDeviationCount: highCount,
      totalEstimated: totalEst,
      totalActual: totalAct,
    }
  }

  /** 重置 */
  reset(): void {
    this.samples = []
  }
}

// 全局单例
export const tokenAccuracyMonitor = new TokenAccuracyMonitor()

/**
 * 从 LLM 响应中校准 token 估算
 *
 * 每次 LLM 响应后调用：
 *   calibrateFromResponse(estimatedInput, response)
 */
export function calibrateFromResponse(
  estimatedInputTokens: number,
  response: LLMResponse,
): void {
  const actualInput = response.usage.inputTokens
  const actualOutput = response.usage.outputTokens

  if (actualInput > 0) {
    tokenAccuracyMonitor.record(estimatedInputTokens, actualInput)
  }
}

// ── Token Budget 计算 ──

export interface TokenBudget {
  /** 模型最大上下文窗口 */
  maxContext: number
  /** 当前已用 token */
  usedTokens: number
  /** 剩余可用 token */
  remainingTokens: number
  /** 使用百分比 */
  usagePercent: number
  /** 是否需要压缩 */
  shouldCompact: boolean
  /** 是否接近上限 */
  isNearLimit: boolean
}

const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  [DEEPSEEK_V4_FLASH_MODEL]: DEEPSEEK_V4_CONTEXT_WINDOW,
  [DEEPSEEK_V4_PRO_MODEL]: DEEPSEEK_V4_CONTEXT_WINDOW,
  'gpt-4o-mini': 128_000,
  'gpt-4o': 128_000,
}

/**
 * 计算 token 预算
 *
 * @param messages 当前消息列表
 * @param model 当前模型
 * @param compactThreshold 压缩阈值（默认 0.7 = 70%）
 */
export function calculateTokenBudget(
  messages: Message[],
  model: string = DEEPSEEK_V4_FLASH_MODEL,
  compactThreshold: number = 0.7,
): TokenBudget {
  const maxContext = MODEL_CONTEXT_LIMITS[model] ?? getModelContextLimit(model)
  const usedTokens = estimateAllTokens(messages)
  const remainingTokens = maxContext - usedTokens
  const usagePercent = usedTokens / maxContext

  return {
    maxContext,
    usedTokens,
    remainingTokens: Math.max(0, remainingTokens),
    usagePercent,
    shouldCompact: usagePercent >= compactThreshold,
    isNearLimit: usagePercent >= 0.9,
  }
}

export function calculateBudgetedMaxTokens(
  messages: Message[],
  model: string = DEEPSEEK_V4_FLASH_MODEL,
  requestedMaxTokens?: number,
  date: Date = new Date(),
  scenario: string = 'normal',
): ReturnType<typeof clampMaxTokensToBudget> & { promptTokens: number } {
  const promptTokens = estimateAllTokens(messages)
  return {
    promptTokens,
    ...clampMaxTokensToBudget(model, promptTokens, requestedMaxTokens, date, scenario),
  }
}
