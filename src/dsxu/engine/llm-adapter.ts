/**
 * DSxu LLM 适配器 — 连接 Query Engine 到 DeepSeek
 *
 * 重构版本：去除Claude映射，直接使用DeepSeek原生接口
 *
 * 两种模式：
 * 1. 通过 proxy（默认）— 复用 proxy 的所有基建（预算守卫、孤儿清理、成本账本）
 * 2. 直连 DeepSeek API — 用于测试或绕过 proxy
 *
 * 输出标准化为 Query Engine 的 LLMResponse 格式。
 */

import type { Message, ToolSchema, LLMCallFn, LLMCallOptions, LLMResponse } from './types'
import { getModelConfig, isCompatibilityModel } from './model-config'

/** 通过 DSxu proxy 调用（推荐 — 复用全部基建） */
export function createProxyLLMCall(proxyUrl: string = 'http://localhost:8082'): LLMCallFn {
  return async (messages, tools, options) => {
    // 获取模型配置
    const modelConfig = getModelConfig(options.model)

    // 构造请求体 - 直接使用DeepSeek模型名称
    const body: any = {
      model: modelConfig.name,
      max_tokens: options.maxTokens ?? modelConfig.maxOutputTokens,
      stream: false,
      messages: convertToAnthropicMessages(messages),
    }

    // 记录兼容性映射使用情况
    if (isCompatibilityModel(options.model)) {
      console.warn(`[LLMAdapter] Using compatibility model mapping: ${options.model} -> ${modelConfig.name}`)
    }

    // System prompt
    const systemMsg = messages.find(m => m.role === 'system')
    if (systemMsg) {
      body.system = typeof systemMsg.content === 'string'
        ? systemMsg.content
        : JSON.stringify(systemMsg.content)
    }

    // Tools
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
        'x-api-key': 'dsxu-engine',  // proxy 不校验，但保留标准格式
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: options.abortSignal,
    })

    if (!resp.ok) {
      const err = await resp.text()
      throw new Error(`Proxy error ${resp.status}: ${err}`)
    }

    const data = await resp.json() as any
    return parseAnthropicResponse(data)
  }
}

/** 直连 DeepSeek API（跳过 proxy） */
export function createDirectLLMCall(
  apiKey: string,
  baseUrl: string = 'https://api.deepseek.com/v1',
): LLMCallFn {
  return async (messages, tools, options) => {
    // 获取模型配置
    const modelConfig = getModelConfig(options.model)

    const oaiMessages = convertToOpenAIMessages(messages)
    const body: any = {
      model: modelConfig.name,
      messages: oaiMessages,
      max_tokens: options.maxTokens ?? modelConfig.maxOutputTokens,
    }

    // 记录兼容性映射使用情况
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

/** Mock LLM（用于测试） */
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

// ── 格式转换 ──

function convertToAnthropicMessages(messages: Message[]): any[] {
  return messages
    .filter(m => m.role !== 'system')  // system 单独处理
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

function parseAnthropicResponse(data: any): LLMResponse {
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
