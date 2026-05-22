/**
 * #37 API Service provider transport boundary.
 *
 * DeepSeek is the default owner. External and local providers are explicit
 * fallback boundaries for tests, recovery drills, or operator-approved degraded mode.
 * They are not registered implicitly as a second provider runtime.
 *
 */

import { CircuitBreaker } from './circuit-breaker'
import {
  clampDeepSeekV4MaxTokens,
  normalizeDeepSeekV4Model,
} from '../../utils/model/deepseekV4Control'
import { DeepSeekAdapter } from '../../services/api/deepseek-adapter'

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
  /** External fallback API key for optional backup. */
  openaiKey?: string
  openaiUrl?: string
  /** Local model URL for fallback. */
  ollamaUrl?: string
  /** Enable all non-DeepSeek provider fallbacks explicitly. */
  allowProviderFallbacks?: boolean
  /** Enable external provider fallback explicitly. */
  allowOpenAIFallback?: boolean
  /** Enable local provider fallback explicitly. */
  allowOllamaFallback?: boolean
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
  /**
   * Session-level sticky model routing. Default is observe-only so cache
   * evidence is collected without reducing quality by blocking an intentional
   * Pro upgrade. Set true or DSXU_STICKY_MODEL_ROUTING=1 to enforce.
   */
  stickyModelRouting?: boolean | 'observe'
  /** How long a sticky model lock is considered part of the same session. */
  stickyModelRoutingWindowMs?: number
}

export function getDsxuApiServiceRuntimeProfile(): {
  runtime: 'DSXU API Service Provider Boundary'
  owner: 'DSXU Model Router / Cost Evidence Owner'
  primaryProvider: 'DeepSeek-compatible transport'
  fallbackPolicy: 'explicit-operator-gated-only'
  activationEvidence: readonly string[]
  releaseRiskControls: readonly string[]
} {
  return {
    runtime: 'DSXU API Service Provider Boundary',
    owner: 'DSXU Model Router / Cost Evidence Owner',
    primaryProvider: 'DeepSeek-compatible transport',
    fallbackPolicy: 'explicit-operator-gated-only',
    activationEvidence: [
      'DeepSeek-compatible chat completions are the default provider route',
      'external chat/agent API use requires explicit operator opt-in before non-DeepSeek fallback is enabled',
      'external provider fallback requires allowProviderFallbacks or provider-specific opt-in',
      'local provider fallback requires allowProviderFallbacks or local opt-in',
      'usage tokens are normalized before cost evidence is attached to the response',
    ],
    releaseRiskControls: [
      'external chat-completions-compatible clients do not create a second provider runtime',
      'external fallback cannot activate from environment keys alone without the owner gate',
      'circuit breaker state belongs to the provider boundary, not Query Loop orchestration',
      'model names are normalized through DSXU DeepSeek V4 control before dispatch',
    ],
  }
}

const HEALTH_CHECK_INTERVAL = 60_000  // 1 minute.
const MAX_CONSECUTIVE_FAILURES = 3
const RECOVERY_CHECK_INTERVAL = 5 * 60_000  // Retry recovery after 5 minutes.

function isTruthyEnv(value: string | undefined): boolean {
  return value === '1' || value?.toLowerCase() === 'true'
}

function isOpenAIFallbackAllowed(config?: APIServiceConfig): boolean {
  return config?.allowProviderFallbacks === true
    || config?.allowOpenAIFallback === true
    || isTruthyEnv(process.env.DSXU_ALLOW_PROVIDER_MODEL_FALLBACKS)
    || isTruthyEnv(process.env.DSXU_ALLOW_OPENAI_FALLBACK)
}

function isOllamaFallbackAllowed(config?: APIServiceConfig): boolean {
  return config?.allowProviderFallbacks === true
    || config?.allowOllamaFallback === true
    || isTruthyEnv(process.env.DSXU_ALLOW_PROVIDER_MODEL_FALLBACKS)
    || isTruthyEnv(process.env.DSXU_ALLOW_OLLAMA_FALLBACK)
}

export class APIService {
  private backends: APIBackend[] = []
  private healthTimer: ReturnType<typeof setInterval> | null = null
  private readonly healthCheckIntervalMs: number
  private readonly openrouterReferer?: string
  private readonly openrouterTitle?: string
  private readonly stickyModelRoutingMode: 'off' | 'observe' | 'enforce'
  private readonly stickyModelRoutingWindowMs: number
  private stickyModelLock: {
    model: string
    lockedAt: number
    lastRequestedModel: string
    switchCount: number
    lastDecision: 'locked' | 'observed' | 'expired' | 'unchanged'
  } | null = null

  constructor(config?: APIServiceConfig) {
    this.healthCheckIntervalMs = config?.healthCheckInterval ?? HEALTH_CHECK_INTERVAL
    this.openrouterReferer = config?.openrouterReferer || process.env.OPENROUTER_HTTP_REFERER
    this.openrouterTitle = config?.openrouterTitle || process.env.OPENROUTER_X_TITLE
    this.stickyModelRoutingMode =
      config?.stickyModelRouting === false
        ? 'off'
        : config?.stickyModelRouting === true || isTruthyEnv(process.env.DSXU_STICKY_MODEL_ROUTING)
        ? 'enforce'
        : config?.stickyModelRouting === 'observe' || isTruthyEnv(process.env.DSXU_STICKY_MODEL_ROUTING_OBSERVE)
          ? 'observe'
          : 'observe'
    const envStickyWindowMs = Number.parseInt(
      process.env.DSXU_STICKY_MODEL_ROUTING_WINDOW_MS || '',
      10,
    )
    this.stickyModelRoutingWindowMs =
      config?.stickyModelRoutingWindowMs ??
      (Number.isFinite(envStickyWindowMs) && envStickyWindowMs > 0
        ? envStickyWindowMs
        : 30 * 60_000)

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

    // Backend 2: explicit external provider fallback boundary.
    const oaiKey = config?.openaiKey || process.env.OPENAI_API_KEY || ''
    if (oaiKey && isOpenAIFallbackAllowed(config)) {
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

    // Backend 3: explicit local provider fallback boundary.
    if (isOllamaFallbackAllowed(config)) {
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

  private resolveStickyModelRoute(requestedModel: string): {
    modelForRequest: string
    decision: 'locked' | 'observed' | 'expired' | 'unchanged'
  } {
    const now = Date.now()
    if (
      this.stickyModelLock &&
      now - this.stickyModelLock.lockedAt > this.stickyModelRoutingWindowMs
    ) {
      this.stickyModelLock.lastDecision = 'expired'
      this.stickyModelLock = null
    }

    if (this.stickyModelRoutingMode === 'off') {
      return { modelForRequest: requestedModel, decision: 'unchanged' }
    }

    if (!this.stickyModelLock) {
      this.stickyModelLock = {
        model: requestedModel,
        lockedAt: now,
        lastRequestedModel: requestedModel,
        switchCount: 0,
        lastDecision: 'unchanged',
      }
      return { modelForRequest: requestedModel, decision: 'unchanged' }
    }

    if (this.stickyModelLock.model === requestedModel) {
      this.stickyModelLock.lastRequestedModel = requestedModel
      this.stickyModelLock.lastDecision = 'unchanged'
      return { modelForRequest: requestedModel, decision: 'unchanged' }
    }

    this.stickyModelLock.switchCount++
    this.stickyModelLock.lastRequestedModel = requestedModel

    if (this.stickyModelRoutingMode === 'enforce') {
      this.stickyModelLock.lastDecision = 'locked'
      return { modelForRequest: this.stickyModelLock.model, decision: 'locked' }
    }

    this.stickyModelLock.lastDecision = 'observed'
    return { modelForRequest: requestedModel, decision: 'observed' }
  }

  getStickyModelRoutingSnapshot(): {
    mode: 'off' | 'observe' | 'enforce'
    model?: string
    lastRequestedModel?: string
    switchCount: number
    lastDecision?: 'locked' | 'observed' | 'expired' | 'unchanged'
    performanceBoundary: string
  } {
    return {
      mode: this.stickyModelRoutingMode,
      model: this.stickyModelLock?.model,
      lastRequestedModel: this.stickyModelLock?.lastRequestedModel,
      switchCount: this.stickyModelLock?.switchCount ?? 0,
      lastDecision: this.stickyModelLock?.lastDecision,
      performanceBoundary:
        'session-local routing decision only; no provider preflight, no synchronous cache warmup, no extra model turn',
    }
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
    const normalizedRequestedModel = normalizeDeepSeekV4Model(model)
    const stickyRoute = this.resolveStickyModelRoute(normalizedRequestedModel)
    if (stickyRoute.decision === 'locked') {
      console.warn(`[APIService] sticky model routing kept ${stickyRoute.modelForRequest} instead of ${normalizedRequestedModel}`)
    }

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
        const normalizedModel = stickyRoute.modelForRequest
        const mappedModel = backend.modelMap[normalizedModel] || normalizedModel
        const url = backend.name === 'ollama'
          ? `${backend.baseUrl}/v1/chat/completions`
          : `${backend.baseUrl}/chat/completions`

        const body = backend.name === 'deepseek'
          ? DeepSeekAdapter.buildDeepSeekChatCompletionBody({
              plan: {
                ...DeepSeekAdapter.resolveRequestPlanForBaseUrl({
                  model: normalizedModel,
                  max_tokens: maxTokens,
                  messages,
                  tools,
                }, backend.baseUrl),
                modelName: mappedModel,
              },
              messages,
              tools,
              stream: false,
            })
          : {
              model: mappedModel,
              messages,
              max_tokens: clampDeepSeekV4MaxTokens({
                model: normalizedModel,
                requestedMaxTokens: maxTokens,
                endpointKind: 'chat_completions',
              }),
              ...(tools?.length ? { tools } : {}),
            }

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
