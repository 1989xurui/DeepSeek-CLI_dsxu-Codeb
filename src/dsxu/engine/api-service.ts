/**
 * #37 API Service — 三后端 Fallback
 *
 * DeepSeek（主） → OpenAI（备） → Ollama（本地兜底）
 * 自动健康检查 + 故障切换 + 恢复检测
 *
 * 用法：
 *   const api = new APIService()
 *   const call = api.createLLMCall()  // 返回 LLMCallFn，自动 fallback
 */

import type { LLMCallFn, LLMResponse, Message, ToolSchema, LLMCallOptions } from './types'
import { CircuitBreaker } from './circuit-breaker'

export interface APIBackend {
  name: string
  baseUrl: string
  apiKey: string
  /** 模型名称映射 */
  modelMap: Record<string, string>
  /** 是否启用 */
  enabled: boolean
  /** 最后健康检查时间 */
  lastHealthCheck: number
  /** 是否健康 */
  healthy: boolean
  /** 连续失败次数 */
  consecutiveFailures: number
  /** 工业化断路器 */
  circuitBreaker: CircuitBreaker
}

export interface APIServiceConfig {
  /** DeepSeek API key */
  deepseekKey?: string
  deepseekUrl?: string
  /** OpenAI API key（可选备份） */
  openaiKey?: string
  openaiUrl?: string
  /** Ollama URL（本地兜底） */
  ollamaUrl?: string
  /** 健康检查间隔 ms */
  healthCheckInterval?: number
  /** 单个后端最大连续失败次数，超过标记为不健康 */
  maxFailures?: number
  /** 断路器冷却期 */
  circuitBreakerCooldownMs?: number
  /** OpenRouter referer header (optional) */
  openrouterReferer?: string
  /** OpenRouter title header (optional) */
  openrouterTitle?: string
}

const HEALTH_CHECK_INTERVAL = 60_000  // 1 分钟
const MAX_CONSECUTIVE_FAILURES = 3
const RECOVERY_CHECK_INTERVAL = 5 * 60_000  // 5 分钟尝试恢复

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

    // 后端 1: DeepSeek（主）
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
              'deepseek-chat': process.env.OPENROUTER_CHAT_MODEL || 'deepseek/deepseek-chat-v3-0324',
              'deepseek-reasoner': process.env.OPENROUTER_REASONER_MODEL || 'deepseek/deepseek-r1-0528',
            }
          : {
              'deepseek-chat': 'deepseek-chat',
              'deepseek-reasoner': 'deepseek-reasoner',
            },
        enabled: true,
        lastHealthCheck: 0,
        healthy: true,  // 默认健康
        consecutiveFailures: 0,
        circuitBreaker,
      })
    }

    // 后端 2: OpenAI（备用）
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
          'deepseek-chat': 'gpt-4o-mini',
          'deepseek-reasoner': 'gpt-4o',
        },
        enabled: true,
        lastHealthCheck: 0,
        healthy: true,
        consecutiveFailures: 0,
        circuitBreaker,
      })
    }

    // 后端 3: Ollama（本地兜底）
    const ollamaUrl = config?.ollamaUrl || process.env.DSXU_OLLAMA_URL || 'http://localhost:11434'
    const circuitBreaker = new CircuitBreaker({
      failureThreshold: config?.maxFailures ?? MAX_CONSECUTIVE_FAILURES,
      cooldownMs: config?.circuitBreakerCooldownMs ?? RECOVERY_CHECK_INTERVAL,
    })
    this.backends.push({
      name: 'ollama',
      baseUrl: ollamaUrl,
      apiKey: '',  // Ollama 不需要 key
      modelMap: {
        'deepseek-chat': 'deepseek-v2:latest',
        'deepseek-reasoner': 'deepseek-r1:latest',
      },
      enabled: true,
      lastHealthCheck: 0,
      healthy: true,  // 假定可用，首次调用时检测
      consecutiveFailures: 0,
      circuitBreaker,
    })
  }

  /** 获取当前可用的后端列表（按优先级） */
  getAvailableBackends(): APIBackend[] {
    // Let circuit breaker decide request eligibility. This enables half-open probes
    // for previously unhealthy backends after cooldown.
    return this.backends.filter(b => b.enabled && b.circuitBreaker.canRequest())
  }

  /** 获取所有后端状态 */
  getStatus(): Array<{ name: string; healthy: boolean; failures: number; breakerState: string }> {
    return this.backends.map(b => ({
      name: b.name,
      healthy: b.healthy,
      failures: b.consecutiveFailures,
      breakerState: b.circuitBreaker.getSnapshot().state,
    }))
  }

  /** 主动巡检所有后端，适合定时恢复与诊断 */
  async probeBackends(): Promise<Array<{ name: string; healthy: boolean }>> {
    const results: Array<{ name: string; healthy: boolean }> = []
    for (const backend of this.backends) {
      const healthy = await this.checkHealth(backend)
      results.push({ name: backend.name, healthy })
    }
    return results
  }

  /** 开启后台健康巡检（可重复调用，已开启时不重复） */
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

  /** 标记后端失败 */
  private markFailure(backend: APIBackend): void {
    backend.consecutiveFailures++
    backend.circuitBreaker.recordFailure()
    if (backend.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      backend.healthy = false
      console.warn(`[APIService] ❌ ${backend.name} 标记为不健康（连续失败 ${backend.consecutiveFailures} 次）`)
    }
  }

  /** 标记后端成功 */
  private markSuccess(backend: APIBackend): void {
    if (!backend.healthy) {
      console.log(`[APIService] ✅ ${backend.name} 恢复健康`)
    }
    backend.consecutiveFailures = 0
    backend.healthy = true
    backend.circuitBreaker.recordSuccess()
  }

  /** 健康检查单个后端 */
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

  /** 调用 LLM（带自动 fallback） */
  async callWithFallback(
    messages: any[],
    tools: any[],
    model: string,
    maxTokens: number,
    abortSignal?: AbortSignal,
  ): Promise<{ response: any; backend: string }> {
    const available = this.getAvailableBackends()

    if (available.length === 0) {
      // 尝试恢复所有后端
      for (const b of this.backends) {
        if (!b.circuitBreaker.canRequest()) continue
        if (await this.checkHealth(b)) {
          available.push(b)
          break
        }
      }
      if (available.length === 0) {
        throw new Error('[APIService] 所有后端不可用')
      }
    }

    let lastError: Error | null = null

    for (const backend of available) {
      try {
        const mappedModel = backend.modelMap[model] || model
        const url = backend.name === 'ollama'
          ? `${backend.baseUrl}/v1/chat/completions`
          : `${backend.baseUrl}/chat/completions`

        const body: any = {
          model: mappedModel,
          messages,
          max_tokens: maxTokens,
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

        console.log(`[APIService] ✓ ${backend.name} (${mappedModel})`)
        return { response: data, backend: backend.name }
      } catch (error: any) {
        lastError = error
        this.markFailure(backend)
        console.warn(`[APIService] ${backend.name} 失败: ${error.message}, 尝试下一个...`)
      }
    }

    throw lastError || new Error('[APIService] 所有后端失败')
  }

  /** 创建 LLMCallFn（给 Query Engine 用） */
  createLLMCall(): LLMCallFn {
    return async (messages, tools, options) => {
      // 转换 Message[] → OpenAI 格式
      const oaiMessages = messages.map(m => {
        if (m.role === 'tool') {
          return { role: 'tool', tool_call_id: m.toolCallId, content: typeof m.content === 'string' ? m.content : '' }
        }
        if (m.role === 'assistant' && m.toolCalls?.length) {
          return {
            role: 'assistant',
            content: typeof m.content === 'string' ? m.content : '',
            tool_calls: m.toolCalls.map(tc => ({
              id: tc.id,
              type: 'function',
              function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
            })),
          }
        }
        return { role: m.role, content: typeof m.content === 'string' ? m.content : '' }
      })

      // 转换 ToolSchema[] → OpenAI 格式
      const oaiTools = tools.map(t => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.inputSchema },
      }))

      const { response, backend } = await this.callWithFallback(
        oaiMessages,
        oaiTools,
        options.model,
        options.maxTokens ?? 8192,
        options.abortSignal,
      )

      // 解析 OpenAI 格式响应
      const choice = response.choices?.[0]
      const msg = choice?.message ?? {}
      const toolCalls = (msg.tool_calls ?? []).map((tc: any) => {
        let args: Record<string, any> = {}
        try { args = JSON.parse(tc.function?.arguments ?? '{}') } catch {}
        return { id: tc.id, name: tc.function?.name ?? '', arguments: args }
      })

      const fr = choice?.finish_reason
      return {
        content: msg.content ?? '',
        toolCalls,
        reasoning: msg.reasoning_content,
        stopReason: fr === 'tool_calls' ? 'tool_use'
                  : fr === 'stop' ? 'end_turn'
                  : fr === 'length' ? 'max_tokens'
                  : 'end_turn',
        usage: {
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
          cacheHit: (response.usage?.prompt_cache_hit_tokens ?? 0) > 0,
          cacheReadTokens: response.usage?.prompt_cache_hit_tokens ?? 0,
          cacheCreationTokens: response.usage?.prompt_cache_miss_tokens ?? 0,
        },
      } satisfies LLMResponse
    }
  }

  destroy(): void {
    this.stopHealthChecks()
  }
}
