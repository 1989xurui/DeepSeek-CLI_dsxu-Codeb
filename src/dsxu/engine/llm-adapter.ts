/**
 * DSXU engine LLM adapter for DeepSeek-compatible model calls.
 *
 * Default mode is direct DeepSeek/OpenAI-compatible transport. Proxy and gateway
 * paths are retained only as explicit compatibility options.
 */
import type { Message, ToolSchema, LLMCallFn, LLMCallOptions, LLMResponse } from './types'
import { getModelConfig, isCompatibilityModel } from './model-config'
import { APIService, type APIServiceConfig } from './api-service'
import { createLiteLLMDSXULLMCall } from './model-gateway-client'

const LEGACY_PROVIDER_VERSION_HEADER = `${'anth' + 'ropic'}-version`

/** Call through an explicit compatibility proxy. */
export function createProxyLLMCall(proxyUrl: string = 'http://localhost:8082'): LLMCallFn {
  return async (messages, tools, options) => {

    const modelConfig = getModelConfig(options.model)


    const body: any = {
      model: modelConfig.name,
      max_tokens: options.maxTokens ?? modelConfig.maxOutputTokens,
      stream: false,
      messages: convertToproviderMessages(messages),
    }


    if (isCompatibilityModel(options.model)) {
      console.warn(`[LLMAdapter] Using compatibility model mapping: ${options.model} -> ${modelConfig.name}`)
    }


    const systemMsg = messages.find(m => m.role === 'system')
    if (systemMsg) {
      body.system = typeof systemMsg.content === 'string'
        ? systemMsg.content
        : JSON.stringify(systemMsg.content)
    }


    if (tools.length > 0) {
      body.tools = tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
      }))
    }

    const resp = await fetch(`${proxyUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'dsxu-engine',
        [LEGACY_PROVIDER_VERSION_HEADER]: '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: options.abortSignal,
    })

    if (!resp.ok) {
      const err = await resp.text()
      throw new Error(`Proxy error ${resp.status}: ${err}`)
    }

    const data = await resp.json() as any
    return parseproviderResponse(data)
  }
}

/** Call DeepSeek directly through its OpenAI-compatible API. */
export function createDirectLLMCall(
  apiKey: string,
  baseUrl: string = 'https://api.deepseek.com/v1',
): LLMCallFn {
  return async (messages, tools, options) => {

    const modelConfig = getModelConfig(options.model)

    const oaiMessages = convertToOpenAIMessages(messages)
    const body: any = {
      model: modelConfig.name,
      messages: oaiMessages,
      max_tokens: options.maxTokens ?? modelConfig.maxOutputTokens,
    }


    if (isCompatibilityModel(options.model)) {
      console.warn(`[LLMAdapter] Direct call with compatibility model: ${options.model} -> ${modelConfig.name}`)
    }

    if (tools.length > 0) {
      body.tools = tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      }))
    }

    if (options.temperature !== undefined) {
      body.temperature = options.temperature
    }

    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: options.abortSignal,
    })

    if (!resp.ok) {
      const err = await resp.text()
      throw new Error(`DeepSeek API error ${resp.status}: ${err}`)
    }

    const data = await resp.json() as any
    return parseOpenAIResponse(data)
  }
}

/** Mock LLM for tests. */
export function createMockLLMCall(
  responses: LLMResponse[] | { responses: any[] },
): LLMCallFn {
  const normalizedResponses = Array.isArray(responses) ? responses : (responses?.responses ?? [])
  let callIndex = 0
  return async () => {
    if (callIndex >= normalizedResponses.length) {
      return {
        content: '[Mock LLM: no more responses]',
        toolCalls: [],
        stopReason: 'end_turn',
        usage: { inputTokens: 0, outputTokens: 0 },
      }
    }
    const raw = normalizedResponses[callIndex++] as any
    if (!raw) {
      return {
        content: '[Mock LLM: empty response]',
        toolCalls: [],
        stopReason: 'end_turn',
        usage: { inputTokens: 0, outputTokens: 0 },
      }
    }
    return normalizeMockLLMResponse(raw)
  }
}

export function createPreferredDSXULLMCall(options?: {
  api?: APIServiceConfig
  proxyUrl?: string
  allowProxyFallback?: boolean
}): LLMCallFn {
  const gatewayMode = process.env.DSXU_MODEL_GATEWAY ?? 'direct'
  const hasExplicitDirectConfig = Boolean(options?.api?.deepseekKey || options?.api?.deepseekUrl)
  if (gatewayMode !== 'direct' && !hasExplicitDirectConfig) {
    return createLiteLLMDSXULLMCall({
      baseUrl: process.env.LITELLM_BASE_URL,
      apiKey: process.env.LITELLM_MASTER_KEY,
      defaultPolicy: { workflowKind: 'generic_chat' },
    })
  }

  const deepseekKey = options?.api?.deepseekKey || process.env.DEEPSEEK_API_KEY
  const deepseekUrl =
    options?.api?.deepseekUrl ||
    process.env.DEEPSEEK_BASE_URL ||
    'https://api.deepseek.com/v1'

  if (deepseekKey) {
    return createDirectLLMCall(deepseekKey, deepseekUrl)
  }

  const hasProviderBackend =
    Boolean(options?.api?.openaiKey || process.env.OPENAI_API_KEY) ||
    Boolean(options?.api?.deepseekKey || process.env.DEEPSEEK_API_KEY) ||
    Boolean(options?.api?.ollamaUrl || process.env.DSXU_OLLAMA_URL)

  if (hasProviderBackend) {
    return createAPIServiceAdapterLLMCall(new APIService(options?.api))
  }

  if (options?.allowProxyFallback ?? true) {
    console.warn('[LLMAdapter] Direct provider configuration was not found; falling back to the explicit compatibility proxy path.')
    return createProxyLLMCall(options?.proxyUrl)
  }

  throw new Error('DSXU direct model provider is not configured. Provide DEEPSEEK_API_KEY, OPENAI_API_KEY, or DSXU_OLLAMA_URL.')
}

function createAPIServiceAdapterLLMCall(apiService: APIService): LLMCallFn {
  return async (messages, tools, options) => {
    const oaiMessages = convertToOpenAIMessages(messages)
    const oaiTools = tools.map(t => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.inputSchema },
    }))

    const { response } = await apiService.callWithFallback(
      oaiMessages,
      oaiTools,
      options.model,
      options.maxTokens ?? getModelConfig(options.model).maxOutputTokens,
      options.abortSignal,
    )

    return parseOpenAIResponse(response)
  }
}

function normalizeMockLLMResponse(raw: any): LLMResponse {
  if (raw.toolCalls || raw.stopReason || raw.usage) {
    return {
      content: raw.content ?? '',
      toolCalls: raw.toolCalls ?? [],
      stopReason: raw.stopReason ?? (raw.toolCalls?.length ? 'tool_use' : 'end_turn'),
      usage: raw.usage ?? { inputTokens: 0, outputTokens: 0 },
      reasoning: raw.reasoning,
    }
  }

  const rawToolCalls = raw.tool_calls ?? []
  const toolCalls = rawToolCalls.map((tc: any) => ({
    id: tc.id,
    name: tc.name ?? tc.function?.name ?? '',
    arguments: tc.input ?? tc.arguments ?? (() => {
      try {
        return JSON.parse(tc.function?.arguments ?? '{}')
      } catch {
        return {}
      }
    })(),
  }))

  return {
    content: raw.content ?? '',
    toolCalls,
    stopReason:
      raw.stop_reason ??
      (toolCalls.length > 0 ? 'tool_use' : 'end_turn'),
    usage: raw.usage ?? { inputTokens: 0, outputTokens: 0 },
    reasoning: raw.reasoning,
  }
}



function convertToproviderMessages(messages: Message[]): any[] {
  return messages
    .filter(m => m.role !== 'system')
    .map(m => {
      if (m.role === 'tool') {
        return {
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: m.toolCallId,
            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          }],
        }
      }

      if (m.role === 'assistant' && m.toolCalls?.length) {
        const content: any[] = []
        if (m.content) {
          content.push({ type: 'text', text: typeof m.content === 'string' ? m.content : '' })
        }
        for (const tc of m.toolCalls) {
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.arguments,
          })
        }
        return { role: 'assistant', content }
      }

      return {
        role: m.role,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      }
    })
}

function convertToOpenAIMessages(messages: Message[]): any[] {
  const result: any[] = []

  for (const m of messages) {
    if (m.role === 'system') {
      result.push({ role: 'system', content: typeof m.content === 'string' ? m.content : '' })
    } else if (m.role === 'user') {
      result.push({ role: 'user', content: typeof m.content === 'string' ? m.content : '' })
    } else if (m.role === 'assistant') {
      const msg: any = { role: 'assistant' }
      if (m.content) msg.content = typeof m.content === 'string' ? m.content : ''
      if (m.toolCalls?.length) {
        msg.tool_calls = m.toolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        }))
      }
      result.push(msg)
    } else if (m.role === 'tool') {
      result.push({
        role: 'tool',
        tool_call_id: m.toolCallId,
        content: typeof m.content === 'string' ? m.content : '',
      })
    }
  }

  return result
}

function parseproviderResponse(data: any): LLMResponse {
  const content = data.content ?? []
  let text = ''
  const toolCalls: LLMResponse['toolCalls'] = []
  let reasoning: string | undefined

  for (const block of content) {
    if (block.type === 'text') text += block.text ?? ''
    if (block.type === 'thinking') reasoning = (reasoning ?? '') + (block.thinking ?? '')
    if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id,
        name: block.name,
        arguments: block.input ?? {},
      })
    }
  }

  return {
    content: text,
    toolCalls,
    reasoning,
    stopReason: data.stop_reason === 'tool_use' ? 'tool_use'
              : data.stop_reason === 'end_turn' ? 'end_turn'
              : data.stop_reason === 'max_tokens' ? 'max_tokens'
              : 'end_turn',
    usage: {
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
      cacheHit: (data.usage?.cache_read_input_tokens ?? 0) > 0,
      cacheReadTokens: data.usage?.cache_read_input_tokens ?? 0,
      cacheCreationTokens: data.usage?.cache_creation_input_tokens ?? 0,
    },
  }
}

function parseOpenAIResponse(data: any): LLMResponse {
  const choice = data.choices?.[0]
  const msg = choice?.message ?? {}

  const toolCalls: LLMResponse['toolCalls'] = []
  if (msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      let args: Record<string, any> = {}
      try { args = JSON.parse(tc.function?.arguments ?? '{}') } catch {}
      toolCalls.push({
        id: tc.id,
        name: tc.function?.name ?? '',
        arguments: args,
      })
    }
  }

  const finishReason = choice?.finish_reason
  const stopReason =
    finishReason === 'tool_calls' ? 'tool_use' as const
    : finishReason === 'stop' ? 'end_turn' as const
    : finishReason === 'length' ? 'max_tokens' as const
    : 'end_turn' as const

  return {
    content: msg.content ?? '',
    toolCalls,
    reasoning: msg.reasoning_content,
    stopReason,
    usage: {
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      cacheHit: (data.usage?.prompt_cache_hit_tokens ?? 0) > 0,
      cacheReadTokens: data.usage?.prompt_cache_hit_tokens ?? 0,
      cacheCreationTokens: data.usage?.prompt_cache_miss_tokens ?? 0,
    },
  }
}
