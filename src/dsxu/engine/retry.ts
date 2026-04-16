/**
 * #6.10 Retry with Exponential Backoff
 *
 * 智能重试策略：
 *   1. 指数退避 + 抖动（Jitter）
 *   2. 区分可重试/不可重试错误
 *   3. 可配置最大重试次数、基础延迟、最大延迟
 *   4. 支持 AbortSignal 取消
 *
 * 用于包装 LLM 调用和外部 API 请求。
 */

// ── Types ──

export interface RetryConfig {
  /** 最大重试次数（默认 3） */
  maxRetries: number
  /** 基础延迟 ms（默认 1000） */
  baseDelay: number
  /** 最大延迟 ms（默认 30000） */
  maxDelay: number
  /** 退避倍数（默认 2） */
  backoffMultiplier: number
  /** 抖动范围 0-1（默认 0.25，即 ±25%） */
  jitter: number
  /** 取消信号 */
  abortSignal?: AbortSignal
  /** 判断错误是否可重试（默认：网络错误 + 429/5xx） */
  isRetryable?: (error: any) => boolean
  /** 重试回调（日志/监控） */
  onRetry?: (attempt: number, error: any, delay: number) => void
}

export interface RetryResult<T> {
  /** 最终结果 */
  result: T
  /** 实际尝试次数（1 = 没重试） */
  attempts: number
  /** 总耗时 ms */
  totalTime: number
}

// ── Default retryable check ──

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504])

const RETRYABLE_ERROR_PATTERNS = [
  /timeout/i,
  /ECONNRESET/,
  /ECONNREFUSED/,
  /ETIMEDOUT/,
  /ENOTFOUND/,
  /socket hang up/i,
  /network/i,
  /rate limit/i,
  /too many requests/i,
  /server error/i,
  /service unavailable/i,
  /bad gateway/i,
]

/**
 * 默认重试判断：网络错误 + 429/5xx 可重试
 */
export function isRetryableError(error: any): boolean {
  // Abort errors are never retryable
  if (error?.name === 'AbortError') return false

  // HTTP status code
  const status = error?.status || error?.statusCode || error?.response?.status
  if (status && RETRYABLE_STATUS_CODES.has(status)) return true

  // Error message pattern matching
  const message = error?.message || String(error)
  return RETRYABLE_ERROR_PATTERNS.some(p => p.test(message))
}

/**
 * 计算退避延迟（含抖动）
 */
export function calculateDelay(
  attempt: number,
  baseDelay: number,
  backoffMultiplier: number,
  maxDelay: number,
  jitter: number,
): number {
  // Exponential: base * multiplier^attempt
  const exponential = baseDelay * Math.pow(backoffMultiplier, attempt)
  const capped = Math.min(exponential, maxDelay)

  // Add jitter: ±jitter%
  const jitterRange = capped * jitter
  const jitterValue = (Math.random() * 2 - 1) * jitterRange

  return Math.max(0, Math.round(capped + jitterValue))
}

/**
 * Sleep with abort support
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }

    const timer = setTimeout(resolve, ms)

    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }, { once: true })
  })
}

// ── Core retry function ──

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30_000,
  backoffMultiplier: 2,
  jitter: 0.25,
}

/**
 * 带指数退避的重试包装器
 *
 * @example
 * const result = await withRetry(
 *   () => llmCall(messages, tools, options),
 *   { maxRetries: 3, baseDelay: 1000 }
 * )
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>,
): Promise<RetryResult<T>> {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const isRetryable = cfg.isRetryable || isRetryableError
  const startTime = Date.now()
  let lastError: any

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    // Check abort before each attempt
    if (cfg.abortSignal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    try {
      const result = await fn()
      return {
        result,
        attempts: attempt + 1,
        totalTime: Date.now() - startTime,
      }
    } catch (error: any) {
      lastError = error

      // Don't retry on non-retryable errors or last attempt
      if (!isRetryable(error) || attempt >= cfg.maxRetries) {
        throw error
      }

      // Calculate delay
      const delay = calculateDelay(
        attempt,
        cfg.baseDelay,
        cfg.backoffMultiplier,
        cfg.maxDelay,
        cfg.jitter,
      )

      // Notify
      cfg.onRetry?.(attempt + 1, error, delay)

      // Wait
      await sleep(delay, cfg.abortSignal)
    }
  }

  // Should not reach here, but just in case
  throw lastError
}

// ── Rate Limiter (#6.8) ──

export interface RateLimiterConfig {
  /** 每分钟最大请求数 */
  maxRequestsPerMinute: number
  /** 每分钟最大 token 数（可选） */
  maxTokensPerMinute?: number
  /** 并发请求上限 */
  maxConcurrent?: number
}

interface RateLimiterState {
  /** 最近的请求时间戳 */
  requestTimestamps: number[]
  /** 最近的 token 使用量 */
  tokenUsage: { timestamp: number; tokens: number }[]
  /** 当前并发数 */
  concurrent: number
}

/**
 * Token Bucket + Sliding Window 速率限制器
 */
export class RateLimiter {
  private config: Required<RateLimiterConfig>
  private state: RateLimiterState

  constructor(config: RateLimiterConfig) {
    this.config = {
      maxRequestsPerMinute: config.maxRequestsPerMinute,
      maxTokensPerMinute: config.maxTokensPerMinute ?? Infinity,
      maxConcurrent: config.maxConcurrent ?? 10,
    }
    this.state = {
      requestTimestamps: [],
      tokenUsage: [],
      concurrent: 0,
    }
  }

  /**
   * 检查是否可以发送请求，返回需等待的 ms（0 = 可以立即发送）
   */
  getWaitTime(): number {
    this.cleanup()

    // Check concurrent limit
    if (this.state.concurrent >= this.config.maxConcurrent) {
      return 1000  // Wait 1s and retry
    }

    // Check requests per minute
    if (this.state.requestTimestamps.length >= this.config.maxRequestsPerMinute) {
      const oldest = this.state.requestTimestamps[0]
      return Math.max(0, oldest + 60_000 - Date.now())
    }

    // Check tokens per minute
    if (this.config.maxTokensPerMinute < Infinity) {
      const recentTokens = this.state.tokenUsage.reduce((sum, u) => sum + u.tokens, 0)
      if (recentTokens >= this.config.maxTokensPerMinute) {
        const oldest = this.state.tokenUsage[0]
        return Math.max(0, oldest.timestamp + 60_000 - Date.now())
      }
    }

    return 0
  }

  /**
   * 获取一个请求槽位（自动等待限速）
   */
  async acquire(signal?: AbortSignal): Promise<() => void> {
    let waitTime = this.getWaitTime()

    while (waitTime > 0) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      await sleep(Math.min(waitTime, 5000), signal)
      waitTime = this.getWaitTime()
    }

    this.state.requestTimestamps.push(Date.now())
    this.state.concurrent++

    // Return release function
    return () => {
      this.state.concurrent = Math.max(0, this.state.concurrent - 1)
    }
  }

  /**
   * 记录 token 使用量
   */
  recordTokens(tokens: number): void {
    this.state.tokenUsage.push({ timestamp: Date.now(), tokens })
  }

  /**
   * 获取当前状态
   */
  getStatus(): {
    requestsInWindow: number
    tokensInWindow: number
    concurrent: number
    isLimited: boolean
  } {
    this.cleanup()
    return {
      requestsInWindow: this.state.requestTimestamps.length,
      tokensInWindow: this.state.tokenUsage.reduce((sum, u) => sum + u.tokens, 0),
      concurrent: this.state.concurrent,
      isLimited: this.getWaitTime() > 0,
    }
  }

  /** 清理过期的窗口数据 */
  private cleanup(): void {
    const oneMinuteAgo = Date.now() - 60_000
    this.state.requestTimestamps = this.state.requestTimestamps.filter(t => t > oneMinuteAgo)
    this.state.tokenUsage = this.state.tokenUsage.filter(u => u.timestamp > oneMinuteAgo)
  }

  /** 重置（测试用） */
  reset(): void {
    this.state.requestTimestamps = []
    this.state.tokenUsage = []
    this.state.concurrent = 0
  }
}

/**
 * 用 RateLimiter + Retry 包装 LLM 调用
 */
export function withRateLimitAndRetry<T>(
  fn: () => Promise<T>,
  limiter: RateLimiter,
  retryConfig?: Partial<RetryConfig>,
): Promise<RetryResult<T>> {
  return withRetry(async () => {
    const release = await limiter.acquire(retryConfig?.abortSignal)
    try {
      return await fn()
    } finally {
      release()
    }
  }, retryConfig)
}
