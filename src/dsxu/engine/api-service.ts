/**
 * #37 API Service with three-backend fallback.
 *
 * DeepSeek primary -> OpenAI backup -> Ollama local fallback.
 * Provides automatic health checks, failover, and recovery checks.
 *
 */

import { CircuitBreaker } from './circuit-breaker'
import {
  clampDeepSeekV4MaxTokens,
  normalizeDeepSeekV4Model,
} from '../../utils/model/deepseekV4Control'

export interface APIBackend {
  name: string
  baseUrl: string
  apiKey: string
  /** Model name mapping. */
  modelMap: Record<string, string>
  /** Whether this backend is enabled. */
  enabled: boolean
  /** Last health check timestamp. */
  lastHealthCheck: number
  /** Whether the backend is healthy. */
  healthy: boolean
  /** Consecutive failure count. */
  consecutiveFailures: number
  /** Circuit breaker. */
  circuitBreaker: CircuitBreaker
}

export interface APIServiceConfig {
  /** DeepSeek API key */
  deepseekKey?: string
  deepseekUrl?: string
  /** OpenAI API key for optional backup. */
  openaiKey?: string
  openaiUrl?: string
  /** Ollama URL for local fallback. */
  ollamaUrl?: string
  /** Health check interval in milliseconds. */
  healthCheckInterval?: number
  /** Maximum consecutive failures before marking a backend unhealthy. */
  maxFailures?: number
  /** Circuit breaker cooldown period. */
  circuitBreakerCooldownMs?: number
  /** OpenRouter referer header (optional) */
  openrouterReferer?: string
  /** OpenRouter title header (optional) */
  openrouterTitle?: string
}

const HEALTH_CHECK_INTERVAL = 60_000  // 1 minute.
const MAX_CONSECUTIVE_FAILURES = 3
const RECOVERY_CHECK_INTERVAL = 5 * 60_000  // Retry recovery after 5 minutes.

export class APIService {
  private backends: APIBackend[] = []
  private healthTimer: ReturnType<typeof setInterval> | null = null
  private readonly healthCheckIntervalMs: number
  private readonly openrouterReferer?: string
  private readonly openrouterTitle?: string

  constructor(config?: APIServiceConfig) {
    this.healthCheckIntervalMs = config?.healthCheckInterval ?? HEALTH_CHECK_INTERVAL
    this.openrouterReferer = config?.openrouterReferer || process.env.OPENROUTER_HTTP_REFERER
    this.openrouterTitle = config?.openrouterTitle || process.env.OPENROUTER_X_TITLE

    // Backend 1: DeepSeek primary.
    const dsKey = config?.deepseekKey || process.env.DEEPSEEK_API_KEY || ''
    if (dsKey) {
      const deepseekBaseUrl = config?.deepseekUrl || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1'
      const isOpenRouter = /openrouter\.ai/i.test(deepseekBaseUrl)
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: config?.maxFailures ?? MAX_CONSECUTIVE_FAILURES,
        cooldownMs: config?.circuitBreakerCooldownMs ?? RECOVERY_CHECK_INTERVAL,
      })
      this.backends.push({
        name: 'deepseek',
        baseUrl: deepseekBaseUrl,
        apiKey: dsKey,
        modelMap: isOpenRouter
          ? {
              'deepseek-v4-flash': process.env.OPENROUTER_CHAT_MODEL || 'deepseek/deepseek-v4-flash',
              'deepseek-v4-pro': process.env.OPENROUTER_REASONER_MODEL || 'deepseek/deepseek-v4-pro',
            }
          : {
              'deepseek-v4-flash': 'deepseek-v4-flash',
              'deepseek-v4-pro': 'deepseek-v4-pro',
            },
        enabled: true,
        lastHealthCheck: 0,
        healthy: true,  // Default healthy state.
        consecutiveFailures: 0,
        circuitBreaker,
      })
    }

    // Backend 2: OpenAI fallback.
    const oaiKey = config?.openaiKey || process.env.OPENAI_API_KEY || ''
    if (oaiKey) {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: config?.maxFailures ?? MAX_CONSECUTIVE_FAILURES,
        cooldownMs: config?.circuitBreakerCooldownMs ?? RECOVERY_CHECK_INTERVAL,
      })
      this.backends.push({
        name: 'openai',
        baseUrl: config?.openaiUrl || 'https://api.openai.com/v1',
        apiKey: oaiKey,
        modelMap: {
          'deepseek-v4-flash': 'gpt-4o-mini',
          'deepseek-v4-pro': 'gpt-4o',
        },
        enabled: true,
        lastHealthCheck: 0,
        healthy: true,
        consecutiveFailures: 0,
        circuitBreaker,
      })
    }

    // Backend 3: local Ollama fallback.
    const ollamaUrl = config?.ollamaUrl || process.env.DSXU_OLLAMA_URL || 'http://localhost:11434'
    const circuitBreaker = new CircuitBreaker({
      failureThreshold: config?.maxFailures ?? MAX_CONSECUTIVE_FAILURES,
      cooldownMs: config?.circuitBreakerCooldownMs ?? RECOVERY_CHECK_INTERVAL,
    })
    this.backends.push({
      name: 'ollama',
      baseUrl: ollamaUrl,
      apiKey: '', // DSXU comment sanitized.
      modelMap: {
        'deepseek-v4-flash': process.env.DSXU_OLLAMA_CHAT_MODEL || 'qwen3-coder:27b',
        'deepseek-v4-pro': process.env.DSXU_OLLAMA_REASONER_MODEL || 'qwen3:27b',
      },
      enabled: true,
      lastHealthCheck: 0,
      healthy: true,
      consecutiveFailures: 0,
      circuitBreaker,
    })
  }

  /** DSXU comment sanitized. */
  getAvailableBackends(): APIBackend[] {
    // Let circuit breaker decide request eligibility. This enables half-open probes
    // for previously unhealthy backends after cooldown.
    return this.backends.filter(b => b.enabled && b.circuitBreaker.canRequest())
  }

  /** DSXU comment sanitized. */
  getStatus(): Array<{ name: string; healthy: boolean; failures: number; breakerState: string }> {
    return this.backends.map(b => ({
      name: b.name,
      healthy: b.healthy,
      failures: b.consecutiveFailures,
      breakerState: b.circuitBreaker.getSnapshot().state,
    }))
  }

  /** Actively probe all backends for scheduled recovery and diagnostics. */
  async probeBackends(): Promise<Array<{ name: string; healthy: boolean }>> {
    const results: Array<{ name: string; healthy: boolean }> = []
    for (const backend of this.backends) {
      const healthy = await this.checkHealth(backend)
      results.push({ name: backend.name, healthy })
    }
    return results
  }

  /** Start backend health checks. Repeated calls do not start duplicates. */
  startHealthChecks(options?: { immediate?: boolean }): boolean {
    if (this.healthTimer) return false

    const runProbe = async () => {
      try {
        await this.probeBackends()
      } catch {
        // Health checks should never crash the runtime loop.
      }
    }

    this.healthTimer = setInterval(() => {
      void runProbe()
    }, this.healthCheckIntervalMs)

    if (options?.immediate) {
      void runProbe()
    }

    return true
  }

  stopHealthChecks(): boolean {
    if (!this.healthTimer) return false
    clearInterval(this.healthTimer)
    this.healthTimer = null
    return true
  }

  isHealthCheckRunning(): boolean {
    return this.healthTimer !== null
  }

  /** Mark backend failure. */
  private markFailure(backend: APIBackend): void {
    backend.consecutiveFailures++
    backend.circuitBreaker.recordFailure()
    if (backend.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      backend.healthy = false
      console.warn(`[APIService] ${backend.name} marked unhealthy after ${backend.consecutiveFailures} consecutive failures`)
    }
  }

  /** Mark backend success. */
  private markSuccess(backend: APIBackend): void {
    if (!backend.healthy) {
      console.log(`[APIService] ${backend.name} recovered`)
    }
    backend.consecutiveFailures = 0
    backend.healthy = true
    backend.circuitBreaker.recordSuccess()
  }

  /** Check a single backend health state. */
  async checkHealth(backend: APIBackend): Promise<boolean> {
    try {
      const url = backend.name === 'ollama'
        ? `${backend.baseUrl}/api/tags`
        : `${backend.baseUrl}/models`

      const headers: Record<string, string> = {}
      if (backend.apiKey) {
        headers['Authorization'] = `Bearer ${backend.apiKey}`
      }

      const resp = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(5000),
      })

      const healthy = resp.ok
      if (healthy) this.markSuccess(backend)
      else this.markFailure(backend)

      backend.lastHealthCheck = Date.now()
      return healthy
    } catch {
      this.markFailure(backend)
      backend.lastHealthCheck = Date.now()
      return false
    }
  }

  /** DSXU comment sanitized. */
  async callWithFallback(
    messages: any[],
    tools: any[],
    model: string,
    maxTokens: number,
    abortSignal?: AbortSignal,
  ): Promise<{ response: any; backend: string }> {
    const available = this.getAvailableBackends()

    if (available.length === 0) {
      // Try to recover one backend before failing the request.
      for (const b of this.backends) {
        if (!b.circuitBreaker.canRequest()) continue
        if (await this.checkHealth(b)) {
          available.push(b)
          break
        }
      }
      if (available.length === 0) {
        throw new Error('[APIService] All configured backends are unavailable')
      }
    }

    let lastError: Error | null = null

    for (const backend of available) {
      try {
        const normalizedModel = normalizeDeepSeekV4Model(model)
        const mappedModel = backend.modelMap[model] || backend.modelMap[normalizedModel] || normalizedModel
        const url = backend.name === 'ollama'
          ? `${backend.baseUrl}/v1/chat/completions`
          : `${backend.baseUrl}/chat/completions`

        const body: any = {
          model: mappedModel,
          messages,
          max_tokens: clampDeepSeekV4MaxTokens({
            model: normalizedModel,
            requestedMaxTokens: maxTokens,
            endpointKind: 'chat_completions',
          }),
        }
        if (tools?.length) body.tools = tools

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        }
        if (backend.apiKey) {
          headers['Authorization'] = `Bearer ${backend.apiKey}`
        }
        if (/openrouter\.ai/i.test(backend.baseUrl)) {
          headers['HTTP-Referer'] =
            this.openrouterReferer || 'https://local.dsxu'
          headers['X-Title'] =
            this.openrouterTitle || 'DSXU'
        }

        const resp = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: abortSignal,
        })

        if (!resp.ok) {
          const err = await resp.text()
          throw new Error(`${backend.name} ${resp.status}: ${err}`)
        }

        const data = await resp.json()
        this.markSuccess(backend)

        console.log(`[APIService] ${backend.name} (${mappedModel}) succeeded`)
        return { response: data, backend: backend.name }
      } catch (error: any) {
        lastError = error
        this.markFailure(backend)
        console.warn(`[APIService] ${backend.name} failed: ${error.message}; trying next backend...`)
      }
    }

    throw lastError || new Error('[APIService] all backends failed')
  }

  destroy(): void {
    this.stopHealthChecks()
  }
}
