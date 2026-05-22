import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createPreferredDSXULLMCall } from '../llm-adapter'

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
})
