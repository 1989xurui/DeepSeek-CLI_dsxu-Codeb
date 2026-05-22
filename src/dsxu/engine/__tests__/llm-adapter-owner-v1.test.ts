import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createDirectLLMCall, createPreferredDSXULLMCall } from '../llm-adapter'
import { buildLiteLLMChatRequest } from '../model-gateway-client'

const envKeys = [
  'DEEPSEEK_API_KEY',
  'DEEPSEEK_BASE_URL',
  'OPENAI_API_KEY',
  'DSXU_OLLAMA_URL',
  'DSXU_MODEL_GATEWAY',
  'DSXU_ALLOW_PROVIDER_MODEL_FALLBACKS',
  'DSXU_ALLOW_OPENAI_FALLBACK',
  'DSXU_ALLOW_OLLAMA_FALLBACK',
  'DSXU_ALLOW_PROVIDER_MIGRATION_PROXY_FALLBACK',
] as const

describe('LLM adapter provider owner gates', () => {
  const savedEnv = new Map<string, string | undefined>()
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    for (const key of envKeys) {
      savedEnv.set(key, process.env[key])
      process.env[key] = ''
    }
    process.env.DSXU_MODEL_GATEWAY = 'direct'
  })

  afterEach(() => {
    for (const key of envKeys) {
      const value = savedEnv.get(key)
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
    ;(globalThis as any).fetch = originalFetch
  })

  test('does not turn OpenAI or Ollama env into an implicit provider runtime', async () => {
    process.env.OPENAI_API_KEY = 'sk-test-openai'
    process.env.DSXU_OLLAMA_URL = 'http://localhost:11434'

    const llm = createPreferredDSXULLMCall()

    await expect(
      llm([{ role: 'user', content: 'hi' }], [], {
        model: 'deepseek-chat',
        maxTokens: 256,
      }),
    ).rejects.toThrow('explicitly enable a provider fallback owner gate')
  })

  test('uses OpenAI fallback only when the owner gate is explicit', async () => {
    process.env.OPENAI_API_KEY = 'sk-test-openai'
    process.env.DSXU_ALLOW_OPENAI_FALLBACK = '1'
    ;(globalThis as any).fetch = () => Promise.resolve(new Response(JSON.stringify({
      choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    }), { status: 200 }))

    const llm = createPreferredDSXULLMCall()
    const result = await llm([{ role: 'user', content: 'hi' }], [], {
      model: 'deepseek-chat',
      maxTokens: 256,
    })

    expect(result.content).toBe('ok')
  })

  test('direct DeepSeek calls use the DeepSeek adapter request planner and preserve thinking tool replay', async () => {
    let capturedUrl = ''
    let capturedBody: any
    ;(globalThis as any).fetch = (url: string, init: RequestInit) => {
      capturedUrl = url
      capturedBody = JSON.parse(String(init.body))
      return Promise.resolve(new Response(JSON.stringify({
        id: 'chatcmpl-test',
        model: 'deepseek-v4-pro',
        choices: [{ message: { content: 'done' }, finish_reason: 'stop' }],
        usage: {
          prompt_tokens: 8,
          completion_tokens: 2,
          prompt_cache_hit_tokens: 4,
          prompt_cache_miss_tokens: 4,
        },
      }), { status: 200, headers: { 'x-request-id': 'req-test' } }))
    }

    const llm = createDirectLLMCall('sk-test', 'https://api.deepseek.test/v1')
    const result = await llm([
      { role: 'system', content: 'system guard' },
      { role: 'user', content: 'inspect' },
      {
        role: 'assistant',
        content: 'I will inspect.',
        reasoning: 'route evidence',
        toolCalls: [{ id: 'call-1', name: 'Read', arguments: { file_path: 'a.ts' } }],
      },
      { role: 'tool', toolCallId: 'call-1', content: 'file body' },
      { role: 'user', content: 'continue' },
    ], [{
      name: 'Read',
      description: 'Read a file',
      inputSchema: {
        type: 'object',
        properties: { file_path: { type: 'string' } },
        required: ['file_path'],
      },
    }], {
      model: 'deepseek-v4-pro',
      maxTokens: 256,
    })

    const assistant = capturedBody.messages.find((message: any) => message.role === 'assistant')

    expect(capturedUrl).toBe('https://api.deepseek.test/v1/chat/completions')
    expect(capturedBody.thinking).toEqual({ type: 'enabled' })
    expect(capturedBody.reasoning_effort).toBeDefined()
    expect(assistant.reasoning_content).toBe('route evidence')
    expect(assistant.tool_calls[0]).toMatchObject({
      id: 'call-1',
      type: 'function',
      function: { name: 'Read' },
    })
    expect(result.content).toBe('done')
    expect(result.usage.cacheHit).toBe(true)
  })

  test('preferred DeepSeek config stays on the direct adapter before APIService fallback', async () => {
    let capturedUrl = ''
    let capturedBody: any
    ;(globalThis as any).fetch = (url: string, init: RequestInit) => {
      capturedUrl = url
      capturedBody = JSON.parse(String(init.body))
      return Promise.resolve(new Response(JSON.stringify({
        id: 'chatcmpl-preferred',
        model: 'deepseek-v4-flash',
        choices: [{ message: { content: 'preferred' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 2, completion_tokens: 1 },
      }), { status: 200 }))
    }

    const llm = createPreferredDSXULLMCall({
      api: {
        deepseekKey: 'sk-test-ds',
        deepseekUrl: 'https://api.deepseek.preferred/v1',
        openaiKey: 'sk-test-oai',
        allowOpenAIFallback: true,
      },
    })
    const result = await llm([{ role: 'user', content: 'hi' }], [], {
      model: 'deepseek-chat',
      maxTokens: 128,
    })

    expect(capturedUrl).toBe('https://api.deepseek.preferred/v1/chat/completions')
    expect(capturedBody.model).toBe('deepseek-v4-flash')
    expect(capturedBody.thinking).toEqual({ type: 'disabled' })
    expect(capturedBody.metadata).toBeUndefined()
    expect(result.content).toBe('preferred')
  })

  test('LiteLLM gateway lane is explicit and preserves thinking replay only under thinking policy', () => {
    const thinking = buildLiteLLMChatRequest({
      messages: [
        {
          role: 'assistant',
          content: 'I will inspect.',
          reasoning: 'planner trace',
          toolCalls: [{ id: 'call-1', name: 'Read', arguments: { file_path: 'a.ts' } }],
        },
      ],
      tools: [],
      policy: { workflowKind: 'planning' },
    })
    const nonThinking = buildLiteLLMChatRequest({
      messages: [
        {
          role: 'assistant',
          content: 'I will inspect.',
          reasoning: 'planner trace',
          toolCalls: [{ id: 'call-1', name: 'Read', arguments: { file_path: 'a.ts' } }],
        },
      ],
      tools: [],
      policy: { workflowKind: 'verification' },
    })

    expect(thinking.request.metadata.dsxu_gateway).toBe('litellm')
    expect(thinking.request.metadata.dsxu_policy_reason).toBe('planning_flash_thinking_max')
    expect(thinking.request.thinking).toEqual({ type: 'enabled' })
    expect(thinking.request.messages[0]).toMatchObject({
      role: 'assistant',
      reasoning_content: 'planner trace',
    })

    expect(nonThinking.request.metadata.dsxu_gateway).toBe('litellm')
    expect(nonThinking.request.metadata.dsxu_policy_reason).toBe('verification_flash_non_thinking')
    expect(nonThinking.request.thinking).toEqual({ type: 'disabled' })
    expect(nonThinking.request.messages[0]).not.toHaveProperty('reasoning_content')
  })
})
