import type { LLMCallFn, LLMResponse, Message, ToolSchema } from './types'
import { decideDSXUDeepSeekPolicy, type DSXUDeepSeekPolicy, type DSXUDeepSeekPolicyInput } from './deepseek-model-policy'

export interface DSXULiteLLMGatewayConfig {
  baseUrl?: string
  apiKey?: string
  fetchImpl?: typeof fetch
  defaultPolicy?: DSXUDeepSeekPolicyInput
}

export interface DSXULiteLLMChatRequest {
  model: string
  messages: Array<Record<string, unknown>>
  tools?: Array<Record<string, unknown>>
  max_tokens: number
  temperature?: number
  stream: false
  thinking: {
    type: 'enabled' | 'disabled'
  }
  reasoning_effort?: 'high' | 'max'
  response_format?: {
    type: 'json_object'
  }
  metadata: {
    dsxu_gateway: 'litellm'
    dsxu_policy_model: string
    dsxu_policy_api_mode: 'thinking' | 'non_thinking'
    dsxu_policy_reason: string
  }
}

export function normalizeLiteLLMBaseUrl(raw?: string): string {
  const base = (raw || process.env.LITELLM_BASE_URL || 'http://localhost:4000/v1').replace(/\/+$/, '')
  return base.endsWith('/v1') ? base : `${base}/v1`
}

export function getDSXULiteLLMApiKey(raw?: string): string {
  return raw || process.env.LITELLM_MASTER_KEY || 'sk-dsxu-local'
}

export function buildLiteLLMChatRequest(input: {
  messages: Message[]
  tools: ToolSchema[]
  model?: string
  maxTokens?: number
  temperature?: number
  responseFormat?: 'json_object'
  policy?: DSXUDeepSeekPolicyInput
}): { policy: DSXUDeepSeekPolicy; request: DSXULiteLLMChatRequest } {
  const policy = decideDSXUDeepSeekPolicy(input.policy ?? { workflowKind: 'generic_chat' })
  const request: DSXULiteLLMChatRequest = {
    model: policy.litellmModel,
    messages: convertToOpenAIMessages(input.messages),
    max_tokens: input.maxTokens ?? policy.maxTokens,
    stream: false,
    thinking: {
      type: policy.apiMode === 'thinking' ? 'enabled' : 'disabled',
    },
    metadata: {
      dsxu_gateway: 'litellm',
      dsxu_policy_model: policy.model,
      dsxu_policy_api_mode: policy.apiMode,
      dsxu_policy_reason: policy.reason,
    },
  }

  if (input.tools.length > 0) {
    request.tools = input.tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }))
  }

  if (input.temperature !== undefined) request.temperature = input.temperature
  if (input.responseFormat === 'json_object') request.response_format = { type: 'json_object' }
  if (policy.apiMode === 'thinking' && policy.reasoningEffort) {
    request.reasoning_effort = policy.reasoningEffort
  }

  return { policy, request }
}

export function createLiteLLMDSXULLMCall(config?: DSXULiteLLMGatewayConfig): LLMCallFn {
  const baseUrl = normalizeLiteLLMBaseUrl(config?.baseUrl)
  const apiKey = getDSXULiteLLMApiKey(config?.apiKey)
  const fetchImpl = config?.fetchImpl ?? fetch

  return async (messages, tools, options) => {
    const { request } = buildLiteLLMChatRequest({
      messages,
      tools,
      model: options.model,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      responseFormat: options.responseFormat,
      policy: config?.defaultPolicy,
    })

    const response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'x-dsxu-gateway': 'litellm',
      },
      body: JSON.stringify(request),
      signal: options.abortSignal,
    })

    if (!response.ok) {
      throw new Error(`LiteLLM gateway error ${response.status}: ${await response.text()}`)
    }

    return parseOpenAICompatibleResponse(await response.json())
  }
}

function convertToOpenAIMessages(messages: Message[]): Array<Record<string, unknown>> {
  const result: Array<Record<string, unknown>> = []
  for (const message of messages) {
    if (message.role === 'tool') {
      result.push({
        role: 'tool',
        tool_call_id: message.toolCallId,
        content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
      })
      continue
    }

    if (message.role === 'assistant' && message.toolCalls?.length) {
      result.push({
        role: 'assistant',
        content: typeof message.content === 'string' ? message.content : '',
        tool_calls: message.toolCalls.map((toolCall) => ({
          id: toolCall.id,
          type: 'function',
          function: {
            name: toolCall.name,
            arguments: JSON.stringify(toolCall.arguments),
          },
        })),
      })
      continue
    }

    result.push({
      role: message.role,
      content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
    })
  }
  return result
}

function parseOpenAICompatibleResponse(data: any): LLMResponse {
  const choice = data.choices?.[0]
  const message = choice?.message ?? {}
  const toolCalls = (message.tool_calls ?? []).map((toolCall: any) => {
    let args: Record<string, unknown> = {}
    try {
      args = JSON.parse(toolCall.function?.arguments ?? '{}')
    } catch {
      args = {}
    }
    return {
      id: toolCall.id,
      name: toolCall.function?.name ?? '',
      arguments: args,
    }
  })

  const finishReason = choice?.finish_reason
  return {
    content: message.content ?? '',
    toolCalls,
    reasoning: message.reasoning_content,
    stopReason: finishReason === 'tool_calls'
      ? 'tool_use'
      : finishReason === 'length'
        ? 'max_tokens'
        : 'end_turn',
    usage: {
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      cacheHit: (data.usage?.prompt_cache_hit_tokens ?? 0) > 0,
      cacheReadTokens: data.usage?.prompt_cache_hit_tokens ?? 0,
      cacheCreationTokens: data.usage?.prompt_cache_miss_tokens ?? 0,
    },
  }
}
