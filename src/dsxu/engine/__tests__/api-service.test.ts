/**
 * API Service 测试
 *
 * 测试策略：
 * - Mock fetch（不依赖真实 API）
 * - 覆盖 fallback、健康检查、故障切换
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { APIService } from '../api-service'
import type { APIServiceConfig } from '../api-service'

// Mock fetch
const mockFetch = vi.fn()
const originalFetch = globalThis.fetch

function okChatResponse(content = 'Hello', model = 'deepseek-chat') {
  return new Response(JSON.stringify({
    choices: [{ message: { content, tool_calls: [] }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 10, completion_tokens: 5 },
  }), { status: 200 })
}

function errorResponse(status = 500, body = 'Internal Server Error') {
  return new Response(body, { status })
}

function healthOkResponse() {
  return new Response(JSON.stringify({ models: [] }), { status: 200 })
}

const baseConfig: APIServiceConfig = {
  deepseekKey: 'sk-test-ds',
  deepseekUrl: 'https://api.deepseek.com/v1',
  openaiKey: 'sk-test-oai',
  openaiUrl: 'https://api.openai.com/v1',
  ollamaUrl: 'http://localhost:11434',
  allowProviderFallbacks: true,
}

describe('APIService', () => {
  const originalOpenAIKey = process.env.OPENAI_API_KEY
  const originalDeepSeekKey = process.env.DEEPSEEK_API_KEY
  const originalOllamaUrl = process.env.DSXU_OLLAMA_URL
  const originalAllowProviderFallbacks = process.env.DSXU_ALLOW_PROVIDER_MODEL_FALLBACKS
  const originalAllowOpenAIFallback = process.env.DSXU_ALLOW_OPENAI_FALLBACK
  const originalAllowOllamaFallback = process.env.DSXU_ALLOW_OLLAMA_FALLBACK

  beforeEach(() => {
    mockFetch.mockReset()
    ;(globalThis as any).fetch = mockFetch
    process.env.OPENAI_API_KEY = ''
    process.env.DEEPSEEK_API_KEY = ''
    process.env.DSXU_OLLAMA_URL = ''
    process.env.DSXU_ALLOW_PROVIDER_MODEL_FALLBACKS = ''
    process.env.DSXU_ALLOW_OPENAI_FALLBACK = ''
    process.env.DSXU_ALLOW_OLLAMA_FALLBACK = ''
  })

  afterEach(() => {
    ;(globalThis as any).fetch = originalFetch
    process.env.OPENAI_API_KEY = originalOpenAIKey
    process.env.DEEPSEEK_API_KEY = originalDeepSeekKey
    process.env.DSXU_OLLAMA_URL = originalOllamaUrl
    process.env.DSXU_ALLOW_PROVIDER_MODEL_FALLBACKS = originalAllowProviderFallbacks
    process.env.DSXU_ALLOW_OPENAI_FALLBACK = originalAllowOpenAIFallback
    process.env.DSXU_ALLOW_OLLAMA_FALLBACK = originalAllowOllamaFallback
  })

  describe('constructor', () => {
    it('should create backends from config', () => {
      const api = new APIService(baseConfig)
      const status = api.getStatus()

      expect(status).toHaveLength(3)
      expect(status[0].name).toBe('deepseek')
      expect(status[1].name).toBe('openai')
      expect(status[2].name).toBe('ollama')
      expect(status.every(s => s.healthy)).toBe(true)
      expect(status.every(s => s.breakerState === 'closed')).toBe(true)
    })

    it('should default to the DeepSeek owner without implicit fallback runtimes', () => {
      const api = new APIService({
        deepseekKey: 'sk-test-ds',
        openaiKey: 'sk-test-oai',
        ollamaUrl: 'http://localhost:11434',
      })
      const status = api.getStatus()

      expect(status).toHaveLength(1)
      expect(status[0].name).toBe('deepseek')
    })

    it('should skip backends without API keys', () => {
      const api = new APIService({ ollamaUrl: 'http://localhost:11434' })
      const status = api.getStatus()

      expect(status).toHaveLength(0)
    })

    it('should add local Ollama only through an explicit fallback owner flag', () => {
      const api = new APIService({
        ollamaUrl: 'http://localhost:11434',
        allowOllamaFallback: true,
      })
      const status = api.getStatus()

      expect(status).toHaveLength(1)
      expect(status[0].name).toBe('ollama')
    })

    it('should have all backends available initially', () => {
      const api = new APIService(baseConfig)
      expect(api.getAvailableBackends()).toHaveLength(3)
    })
  })

  describe('callWithFallback', () => {
    it('should use primary backend (DeepSeek) first', async () => {
      const api = new APIService(baseConfig)
      mockFetch.mockResolvedValueOnce(okChatResponse('from deepseek'))

      const { response, backend } = await api.callWithFallback(
        [{ role: 'user', content: 'hi' }],
        [],
        'deepseek-chat',
        8192,
      )

      expect(backend).toBe('deepseek')
      expect(response.choices[0].message.content).toBe('from deepseek')

      // Verify called DeepSeek URL
      const callUrl = mockFetch.mock.calls[0][0]
      expect(callUrl).toContain('deepseek.com')
    })

    it('should fallback to OpenAI when DeepSeek fails', async () => {
      const api = new APIService(baseConfig)

      // DeepSeek fails
      mockFetch.mockResolvedValueOnce(errorResponse(502, 'Gateway Error'))
      // OpenAI succeeds
      mockFetch.mockResolvedValueOnce(okChatResponse('from openai'))

      const { response, backend } = await api.callWithFallback(
        [{ role: 'user', content: 'hi' }],
        [],
        'deepseek-chat',
        8192,
      )

      expect(backend).toBe('openai')
      expect(response.choices[0].message.content).toBe('from openai')
    })

    it('should fallback to Ollama when both DeepSeek and OpenAI fail', async () => {
      const api = new APIService(baseConfig)

      // DeepSeek fails
      mockFetch.mockResolvedValueOnce(errorResponse(502))
      // OpenAI fails
      mockFetch.mockResolvedValueOnce(errorResponse(503))
      // Ollama succeeds
      mockFetch.mockResolvedValueOnce(okChatResponse('from ollama'))

      const { response, backend } = await api.callWithFallback(
        [{ role: 'user', content: 'hi' }],
        [],
        'deepseek-chat',
        8192,
      )

      expect(backend).toBe('ollama')
    })

    it('should throw when all backends fail', async () => {
      const api = new APIService(baseConfig)

      // All fail
      mockFetch.mockResolvedValue(errorResponse(500))

      await expect(
        api.callWithFallback([{ role: 'user', content: 'hi' }], [], 'deepseek-chat', 8192)
      ).rejects.toThrow()
    })

    it('should map models correctly per backend', async () => {
      const api = new APIService(baseConfig)

      // DeepSeek fails → OpenAI
      mockFetch.mockResolvedValueOnce(errorResponse(500))
      mockFetch.mockResolvedValueOnce(okChatResponse())

      await api.callWithFallback(
        [{ role: 'user', content: 'hi' }],
        [],
        'deepseek-chat',
        8192,
      )

      // OpenAI call should map deepseek-chat → gpt-4o-mini
      const oaiCall = mockFetch.mock.calls[1]
      const body = JSON.parse(oaiCall[1].body)
      expect(body.model).toBe('gpt-4o-mini')
    })

    it('should include tools in request body', async () => {
      const api = new APIService(baseConfig)
      mockFetch.mockResolvedValueOnce(okChatResponse())

      const tools = [{ type: 'function', function: { name: 'test', parameters: {} } }]
      await api.callWithFallback(
        [{ role: 'user', content: 'hi' }],
        tools,
        'deepseek-chat',
        8192,
      )

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.tools).toEqual([
        {
          type: 'function',
          function: {
            name: 'test',
            description: '',
            parameters: {},
          },
        },
      ])
    })

    it('observes model switches by default without overriding the requested model', async () => {
      const api = new APIService(baseConfig)
      mockFetch
        .mockResolvedValueOnce(okChatResponse('flash'))
        .mockResolvedValueOnce(okChatResponse('pro'))

      await api.callWithFallback([{ role: 'user', content: 'hi' }], [], 'deepseek-v4-flash', 8192)
      await api.callWithFallback([{ role: 'user', content: 'hard' }], [], 'deepseek-v4-pro', 8192)

      const secondBody = JSON.parse(mockFetch.mock.calls[1][1].body)
      expect(secondBody.model).toBe('deepseek-v4-pro')
      expect(api.getStickyModelRoutingSnapshot()).toMatchObject({
        mode: 'observe',
        model: 'deepseek-v4-flash',
        lastRequestedModel: 'deepseek-v4-pro',
        switchCount: 1,
        lastDecision: 'observed',
      })
    })

    it('can enforce session-sticky model routing when explicitly enabled', async () => {
      const api = new APIService({
        ...baseConfig,
        stickyModelRouting: true,
      })
      mockFetch
        .mockResolvedValueOnce(okChatResponse('flash'))
        .mockResolvedValueOnce(okChatResponse('still flash'))

      await api.callWithFallback([{ role: 'user', content: 'hi' }], [], 'deepseek-v4-flash', 8192)
      await api.callWithFallback([{ role: 'user', content: 'hard' }], [], 'deepseek-v4-pro', 8192)

      const secondBody = JSON.parse(mockFetch.mock.calls[1][1].body)
      expect(secondBody.model).toBe('deepseek-v4-flash')
      expect(api.getStickyModelRoutingSnapshot()).toMatchObject({
        mode: 'enforce',
        model: 'deepseek-v4-flash',
        lastRequestedModel: 'deepseek-v4-pro',
        switchCount: 1,
        lastDecision: 'locked',
      })
    })
  })

  describe('health tracking', () => {
    it('should mark backend unhealthy after MAX_CONSECUTIVE_FAILURES', async () => {
      const api = new APIService(baseConfig)

      // Fail DeepSeek 3 times (+ fallback succeeds each time)
      for (let i = 0; i < 3; i++) {
        mockFetch.mockResolvedValueOnce(errorResponse(500))
        mockFetch.mockResolvedValueOnce(okChatResponse())  // OpenAI fallback
      }

      for (let i = 0; i < 3; i++) {
        await api.callWithFallback(
          [{ role: 'user', content: 'hi' }],
          [],
          'deepseek-chat',
          8192,
        )
      }

      const status = api.getStatus()
      const ds = status.find(s => s.name === 'deepseek')!
      expect(ds.healthy).toBe(false)
      expect(ds.failures).toBe(3)
      expect(ds.breakerState).toBe('open')
    })

    it('should recover backend on success', async () => {
      const api = new APIService(baseConfig)

      // Fail 3 times
      for (let i = 0; i < 3; i++) {
        mockFetch.mockResolvedValueOnce(errorResponse(500))
        mockFetch.mockResolvedValueOnce(okChatResponse())
      }
      for (let i = 0; i < 3; i++) {
        await api.callWithFallback([{ role: 'user', content: 'hi' }], [], 'deepseek-chat', 8192)
      }

      // DeepSeek is now unhealthy
      expect(api.getStatus().find(s => s.name === 'deepseek')!.healthy).toBe(false)

      // Now manually set it back to healthy (simulating recovery check)
      // The actual recovery happens through checkHealth
      mockFetch.mockResolvedValueOnce(healthOkResponse())
      const backends = (api as any).backends
      const recovered = await api.checkHealth(backends[0])
      expect(recovered).toBe(true)
      expect(api.getStatus().find(s => s.name === 'deepseek')!.healthy).toBe(true)
      expect(api.getStatus().find(s => s.name === 'deepseek')!.breakerState).toBe('closed')
    })

    it('should skip an open backend during cooldown and retry it after cooldown expires', async () => {
      const nowSpy = vi.spyOn(Date, 'now')

      try {
        nowSpy.mockReturnValue(new Date('2026-04-13T01:00:00.000Z').getTime())
        const api = new APIService({
          ...baseConfig,
          circuitBreakerCooldownMs: 60_000,
        })

        for (let i = 0; i < 3; i++) {
          mockFetch.mockResolvedValueOnce(errorResponse(500, 'DeepSeek down'))
          mockFetch.mockResolvedValueOnce(okChatResponse('from openai'))
          await api.callWithFallback([{ role: 'user', content: 'hi' }], [], 'deepseek-chat', 8192)
        }

        mockFetch.mockResolvedValueOnce(okChatResponse('still from openai'))
        const duringCooldown = await api.callWithFallback(
          [{ role: 'user', content: 'hi again' }],
          [],
          'deepseek-chat',
          8192,
        )
        expect(duringCooldown.backend).toBe('openai')
        expect(String(mockFetch.mock.calls.at(-1)?.[0])).toContain('openai.com')

        nowSpy.mockReturnValue(new Date('2026-04-13T01:01:01.000Z').getTime())

        mockFetch.mockResolvedValueOnce(okChatResponse('deepseek recovered'))
        const afterCooldown = await api.callWithFallback(
          [{ role: 'user', content: 'hi recovered' }],
          [],
          'deepseek-chat',
          8192,
        )
        expect(afterCooldown.backend).toBe('deepseek')
      } finally {
        nowSpy.mockRestore()
      }
    })
  })

  describe('checkHealth', () => {
    it('should check DeepSeek health via /models endpoint', async () => {
      const api = new APIService(baseConfig)
      mockFetch.mockResolvedValueOnce(healthOkResponse())

      const backends = (api as any).backends
      const healthy = await api.checkHealth(backends[0])

      expect(healthy).toBe(true)
      expect(mockFetch.mock.calls[0][0]).toContain('/models')
    })

    it('should check Ollama health via /api/tags endpoint', async () => {
      const api = new APIService(baseConfig)
      mockFetch.mockResolvedValueOnce(healthOkResponse())

      const backends = (api as any).backends
      const ollamaBackend = backends.find((b: any) => b.name === 'ollama')
      const healthy = await api.checkHealth(ollamaBackend)

      expect(healthy).toBe(true)
      expect(mockFetch.mock.calls[0][0]).toContain('/api/tags')
    })

    it('should mark unhealthy on fetch error', async () => {
      const api = new APIService(baseConfig)
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'))

      const backends = (api as any).backends
      const healthy = await api.checkHealth(backends[0])

      expect(healthy).toBe(false)
    })
  })

  describe('health monitoring controls', () => {
    it('should probe all backends on demand', async () => {
      const api = new APIService(baseConfig)
      mockFetch
        .mockResolvedValueOnce(healthOkResponse())
        .mockResolvedValueOnce(healthOkResponse())
        .mockResolvedValueOnce(healthOkResponse())

      const report = await api.probeBackends()
      expect(report).toHaveLength(3)
      expect(report.every(r => r.healthy)).toBe(true)
    })

    it('should start and stop background health checks', async () => {
      vi.useFakeTimers()
      try {
        const api = new APIService({
          ...baseConfig,
          healthCheckInterval: 1000,
        })

        expect(api.isHealthCheckRunning()).toBe(false)
        expect(api.startHealthChecks()).toBe(true)
        expect(api.isHealthCheckRunning()).toBe(true)
        expect(api.startHealthChecks()).toBe(false)

        mockFetch
          .mockResolvedValueOnce(healthOkResponse())
          .mockResolvedValueOnce(healthOkResponse())
          .mockResolvedValueOnce(healthOkResponse())
        vi.advanceTimersByTime(1000)
        await Promise.resolve()

        expect(mockFetch).toHaveBeenCalled()

        expect(api.stopHealthChecks()).toBe(true)
        expect(api.isHealthCheckRunning()).toBe(false)
        expect(api.stopHealthChecks()).toBe(false)
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('provider transport boundary', () => {
    it('returns raw provider response and backend owner to the model adapter', async () => {
      const api = new APIService(baseConfig)
      mockFetch.mockResolvedValueOnce(okChatResponse('response text'))

      const result = await api.callWithFallback(
        [{ role: 'user', content: 'hi' }],
        [{ type: 'function', function: { name: 'test', description: 'A test tool', parameters: { type: 'object' } } }],
        'deepseek-chat',
        4096,
      )

      expect(result.backend).toBe('deepseek')
      expect(result.response.choices[0].message.content).toBe('response text')
      expect(result.response.usage.prompt_tokens).toBe(10)
    })
  })
})
