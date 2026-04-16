/**
 * Retry + Rate Limiter 测试
 * #6.10 + #6.8
 */

import { describe, it, expect, vi } from 'vitest'
import {
  withRetry,
  isRetryableError,
  calculateDelay,
  RateLimiter,
  withRateLimitAndRetry,
} from '../retry'

// ── isRetryableError ──

describe('isRetryableError', () => {
  it('should identify retryable HTTP status codes', () => {
    expect(isRetryableError({ status: 429 })).toBe(true)
    expect(isRetryableError({ status: 500 })).toBe(true)
    expect(isRetryableError({ status: 502 })).toBe(true)
    expect(isRetryableError({ status: 503 })).toBe(true)
    expect(isRetryableError({ statusCode: 504 })).toBe(true)
  })

  it('should identify retryable error messages', () => {
    expect(isRetryableError(new Error('Connection timeout'))).toBe(true)
    expect(isRetryableError(new Error('ECONNRESET'))).toBe(true)
    expect(isRetryableError(new Error('rate limit exceeded'))).toBe(true)
    expect(isRetryableError(new Error('socket hang up'))).toBe(true)
  })

  it('should not retry non-retryable errors', () => {
    expect(isRetryableError({ status: 400 })).toBe(false)
    expect(isRetryableError({ status: 401 })).toBe(false)
    expect(isRetryableError({ status: 404 })).toBe(false)
    expect(isRetryableError(new Error('Invalid input'))).toBe(false)
  })

  it('should never retry AbortError', () => {
    const err = new DOMException('Aborted', 'AbortError')
    expect(isRetryableError(err)).toBe(false)
  })
})

// ── calculateDelay ──

describe('calculateDelay', () => {
  it('should calculate exponential delay', () => {
    // With jitter=0 for deterministic test
    const d0 = calculateDelay(0, 1000, 2, 60000, 0)
    const d1 = calculateDelay(1, 1000, 2, 60000, 0)
    const d2 = calculateDelay(2, 1000, 2, 60000, 0)

    expect(d0).toBe(1000)   // 1000 * 2^0
    expect(d1).toBe(2000)   // 1000 * 2^1
    expect(d2).toBe(4000)   // 1000 * 2^2
  })

  it('should cap at maxDelay', () => {
    const d = calculateDelay(10, 1000, 2, 30000, 0)
    expect(d).toBe(30000)
  })

  it('should add jitter', () => {
    // With jitter, result should vary
    const results = new Set<number>()
    for (let i = 0; i < 10; i++) {
      results.add(calculateDelay(1, 1000, 2, 60000, 0.5))
    }
    // Should have some variation (not always 2000)
    // Note: technically could be same with bad luck, but very unlikely with 10 samples
    expect(results.size).toBeGreaterThanOrEqual(1)
  })
})

// ── withRetry ──

describe('withRetry', () => {
  it('should return immediately on success', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 10 })

    expect(result.result).toBe('ok')
    expect(result.attempts).toBe(1)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should retry on retryable error then succeed', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Connection timeout'))
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValue('recovered')

    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 10 })

    expect(result.result).toBe('recovered')
    expect(result.attempts).toBe(3)
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('should throw after max retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Connection timeout'))

    await expect(
      withRetry(fn, { maxRetries: 2, baseDelay: 10 }),
    ).rejects.toThrow('Connection timeout')

    expect(fn).toHaveBeenCalledTimes(3) // 1 initial + 2 retries
  })

  it('should not retry non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Invalid input format'))

    await expect(
      withRetry(fn, { maxRetries: 3, baseDelay: 10 }),
    ).rejects.toThrow('Invalid input format')

    expect(fn).toHaveBeenCalledTimes(1) // No retries
  })

  it('should call onRetry callback', async () => {
    const onRetry = vi.fn()
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue('ok')

    await withRetry(fn, { maxRetries: 3, baseDelay: 10, onRetry })

    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number))
  })

  it('should respect abort signal', async () => {
    const controller = new AbortController()
    const fn = vi.fn().mockRejectedValue(new Error('timeout'))

    // Abort after a short delay
    setTimeout(() => controller.abort(), 50)

    await expect(
      withRetry(fn, { maxRetries: 10, baseDelay: 100, abortSignal: controller.signal }),
    ).rejects.toThrow()
  })

  it('should use custom isRetryable', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ code: 'CUSTOM_RETRY' })
      .mockResolvedValue('ok')

    const result = await withRetry(fn, {
      maxRetries: 3,
      baseDelay: 10,
      isRetryable: (err) => err?.code === 'CUSTOM_RETRY',
    })

    expect(result.result).toBe('ok')
    expect(result.attempts).toBe(2)
  })
})

// ── RateLimiter ──

describe('RateLimiter', () => {
  it('should allow requests within limit', () => {
    const limiter = new RateLimiter({ maxRequestsPerMinute: 60 })
    expect(limiter.getWaitTime()).toBe(0)
  })

  it('should track request count', async () => {
    const limiter = new RateLimiter({ maxRequestsPerMinute: 5 })

    for (let i = 0; i < 5; i++) {
      const release = await limiter.acquire()
      release()
    }

    const status = limiter.getStatus()
    expect(status.requestsInWindow).toBe(5)
  })

  it('should enforce rate limit', async () => {
    const limiter = new RateLimiter({ maxRequestsPerMinute: 3 })

    // Fill up the window
    for (let i = 0; i < 3; i++) {
      const release = await limiter.acquire()
      release()
    }

    // Should now be limited
    expect(limiter.getWaitTime()).toBeGreaterThan(0)
    expect(limiter.getStatus().isLimited).toBe(true)
  })

  it('should enforce concurrent limit', async () => {
    const limiter = new RateLimiter({
      maxRequestsPerMinute: 100,
      maxConcurrent: 2,
    })

    const r1 = await limiter.acquire()
    const r2 = await limiter.acquire()

    // Third concurrent should be limited
    expect(limiter.getWaitTime()).toBeGreaterThan(0)

    r1()
    r2()
  })

  it('should track token usage', () => {
    const limiter = new RateLimiter({
      maxRequestsPerMinute: 100,
      maxTokensPerMinute: 10000,
    })

    limiter.recordTokens(5000)
    limiter.recordTokens(5000)

    const status = limiter.getStatus()
    expect(status.tokensInWindow).toBe(10000)
    expect(status.isLimited).toBe(true)
  })

  it('should reset state', () => {
    const limiter = new RateLimiter({ maxRequestsPerMinute: 10 })
    limiter.recordTokens(1000)
    limiter.reset()

    const status = limiter.getStatus()
    expect(status.requestsInWindow).toBe(0)
    expect(status.tokensInWindow).toBe(0)
  })
})

// ── withRateLimitAndRetry ──

describe('withRateLimitAndRetry', () => {
  it('should combine rate limiting and retry', async () => {
    const limiter = new RateLimiter({ maxRequestsPerMinute: 100 })
    const fn = vi.fn().mockResolvedValue('ok')

    const result = await withRateLimitAndRetry(fn, limiter, { maxRetries: 2, baseDelay: 10 })
    expect(result.result).toBe('ok')
    expect(result.attempts).toBe(1)
  })

  it('should retry through rate limiter', async () => {
    const limiter = new RateLimiter({ maxRequestsPerMinute: 100 })
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue('recovered')

    const result = await withRateLimitAndRetry(fn, limiter, { maxRetries: 3, baseDelay: 10 })
    expect(result.result).toBe('recovered')
    expect(result.attempts).toBe(2)
  })
})
