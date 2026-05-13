/**
 *
 *
 * 监控 DeepSeek prompt_cache_hit_tokens 字段：
 *   - 正常：cache hit > 50% → 成本折扣 90%
 *   - 异常：cache hit < 30% → 告警 + 自动排查
 *
 * 排查逻辑：
 *   1. L1 前缀是否变动（hash 对比）
 *   2. 工具 schema 是否排序不稳定
 *   3. 系统消息是否被修改
 *
 * 与 S.2 影子预热联动：
 *   cache miss → 触发 warmPrefixCache()
 */

import type { LLMResponse } from './types'

export interface CacheStats {
  /** 总请求数 */
  totalRequests: number
  /** 缓存命中次数 */
  cacheHits: number
  /** 缓存未命中次数 */
  cacheMisses: number
  /** 命中率 */
  hitRate: number
  /** 总缓存节省的 token */
  totalCachedTokens: number
  /** 总输入 token */
  totalInputTokens: number
  /** 估算节省成本 (CNY) */
  estimatedSavings: number
  /** 连续 miss 次数 */
  consecutiveMisses: number
  /** 是否需要告警 */
  shouldAlert: boolean
}

export interface CacheBreakEvent {
  timestamp: string
  reason: string
  consecutiveMisses: number
  inputTokens: number
  cachedTokens: number
}

// ── 常量 ──

const ALERT_THRESHOLD_CONSECUTIVE_MISSES = 5
const ALERT_THRESHOLD_HIT_RATE = 0.3  // 低于 30% 告警
const DEEPSEEK_INPUT_PRICE = 0.14 / 1_000_000  // ¥0.14/M tokens
const DEEPSEEK_CACHE_DISCOUNT = 0.9  // 缓存命中 90% 折扣

// ── Cache Monitor ──

export class CacheMonitor {
  private stats: CacheStats = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    hitRate: 0,
    totalCachedTokens: 0,
    totalInputTokens: 0,
    estimatedSavings: 0,
    consecutiveMisses: 0,
    shouldAlert: false,
  }

  private breakEvents: CacheBreakEvent[] = []
  private l1Hash: string | null = null  // L1 前缀 hash
  private onAlert?: (event: CacheBreakEvent) => void
  private onCacheMiss?: () => void // DSXU comment sanitized.

  constructor(options?: {
    onAlert?: (event: CacheBreakEvent) => void
    onCacheMiss?: () => void
  }) {
    this.onAlert = options?.onAlert
    this.onCacheMiss = options?.onCacheMiss
  }

  /**
   * 记录一次 LLM 响应的缓存状态
   *
   * 在每次 LLM 调用后调用：
   *   cacheMonitor.recordResponse(response)
   */
  recordResponse(response: LLMResponse): void {
    this.stats.totalRequests++
    const inputTokens = response.usage.inputTokens
    this.stats.totalInputTokens += inputTokens

    const cacheReadTokens = response.usage.cacheReadTokens ?? 0
    const isCacheHit = cacheReadTokens > 0 || response.usage.cacheHit === true

    if (isCacheHit) {
      this.stats.cacheHits++
      this.stats.consecutiveMisses = 0
      // Prefer provider-reported cache read tokens; fallback to estimate.
      const estimatedCached = cacheReadTokens > 0
        ? cacheReadTokens
        : Math.floor(inputTokens * 0.85)
      this.stats.totalCachedTokens += estimatedCached
      this.stats.estimatedSavings += estimatedCached * DEEPSEEK_INPUT_PRICE * DEEPSEEK_CACHE_DISCOUNT
    } else {
      this.stats.cacheMisses++
      this.stats.consecutiveMisses++

      // 连续 miss 检测
      if (this.stats.consecutiveMisses >= ALERT_THRESHOLD_CONSECUTIVE_MISSES) {
        const event: CacheBreakEvent = {
          timestamp: new Date().toISOString(),
          reason: `连续 ${this.stats.consecutiveMisses} 次 cache miss`,
          consecutiveMisses: this.stats.consecutiveMisses,
          inputTokens,
          cachedTokens: 0,
        }
        this.breakEvents.push(event)
        this.stats.shouldAlert = true

        console.warn(
          `[CacheMonitor] ⚠️ Cache break detected: ${event.reason}. ` +
          `Hit rate: ${(this.stats.hitRate * 100).toFixed(1)}%`
        )

        this.onAlert?.(event)
      }

      // 触发缓存预热
      if (this.stats.consecutiveMisses >= 2 && this.onCacheMiss) {
        this.onCacheMiss()
      }
    }

    // 更新命中率
    this.stats.hitRate = this.stats.cacheHits / this.stats.totalRequests
    this.stats.shouldAlert = this.stats.hitRate < ALERT_THRESHOLD_HIT_RATE && this.stats.totalRequests > 10
  }

  /**
   * 设置 L1 前缀 hash（用于检测 L1 变动）
   */
  setL1Hash(hash: string): void {
    if (this.l1Hash && this.l1Hash !== hash) {
      console.warn(
        `[CacheMonitor] ⚠️ L1 prefix changed! Old: ${this.l1Hash.slice(0, 8)}... New: ${hash.slice(0, 8)}...`
      )
      this.breakEvents.push({
        timestamp: new Date().toISOString(),
        reason: 'L1 prefix hash changed',
        consecutiveMisses: this.stats.consecutiveMisses,
        inputTokens: 0,
        cachedTokens: 0,
      })
    }
    this.l1Hash = hash
  }

  /**
   * 诊断缓存未命中原因
   */
  diagnose(): string[] {
    const issues: string[] = []

    if (this.stats.hitRate < ALERT_THRESHOLD_HIT_RATE && this.stats.totalRequests > 5) {
      issues.push(`Low cache hit rate: ${(this.stats.hitRate * 100).toFixed(1)}%`)
    }

    if (this.stats.consecutiveMisses >= ALERT_THRESHOLD_CONSECUTIVE_MISSES) {
      issues.push(`${this.stats.consecutiveMisses} consecutive cache misses`)
    }

    // 检查 break events
    const recentBreaks = this.breakEvents.filter(
      e => Date.now() - new Date(e.timestamp).getTime() < 10 * 60_000  // 最近 10 分钟
    )
    if (recentBreaks.length > 0) {
      issues.push(`${recentBreaks.length} cache break events in last 10 minutes`)
    }

    if (issues.length === 0) {
      issues.push('Cache performance normal')
    }

    return issues
  }

  /** 获取统计 */
  getStats(): CacheStats {
    return { ...this.stats }
  }

  /** 获取 break 事件历史 */
  getBreakEvents(): CacheBreakEvent[] {
    return [...this.breakEvents]
  }

  /** 重置 */
  reset(): void {
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRate: 0,
      totalCachedTokens: 0,
      totalInputTokens: 0,
      estimatedSavings: 0,
      consecutiveMisses: 0,
      shouldAlert: false,
    }
    this.breakEvents = []
  }
}
