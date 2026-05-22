import {
  DEEPSEEK_V4_FLASH_MODEL,
  DEEPSEEK_V4_MAX_FIM_OUTPUT_TOKENS,
  clampDeepSeekV4MaxTokens,
} from '../../utils/model/deepseekV4Control.js'
import { getProviderApiKey } from '../../utils/auth.js'

export type DeepSeekFIMRequest = {
  prompt: string
  suffix?: string
  model?: string
  maxTokens?: number
  temperature?: number
}

export type DeepSeekFIMResult = {
  id: string
  model: string
  text: string
  usage?: unknown
}

function getBaseUrl(): string {
  const fromEnv = process.env.DEEPSEEK_BASE_URL?.trim()
  return (fromEnv && fromEnv.length > 0 ? fromEnv : 'https://api.deepseek.com').replace(/\/+$/, '')
}

function getConfiguredDeepSeekFimApiKey(): string | null {
  if (process.env.DEEPSEEK_API_KEY?.trim()) {
    return process.env.DEEPSEEK_API_KEY
  }
  try {
    return getProviderApiKey()
  } catch {
    return null
  }
}

export async function runDeepSeekFIMCompletion(
  input: DeepSeekFIMRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<DeepSeekFIMResult> {
  const apiKey = getConfiguredDeepSeekFimApiKey()
  if (!apiKey) {
    throw new Error('DSXU model access is not configured. Run /login to configure a DeepSeek API key.')
  }

  const model = input.model || process.env.DSXU_DEEPSEEK_FIM_MODEL || DEEPSEEK_V4_FLASH_MODEL
  const maxTokens = clampDeepSeekV4MaxTokens({
    model,
    requestedMaxTokens: input.maxTokens ?? DEEPSEEK_V4_MAX_FIM_OUTPUT_TOKENS,
    endpointKind: 'fim_completion',
  })
  const response = await fetchImpl(`${getBaseUrl()}/beta/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt: input.prompt,
      suffix: input.suffix,
      max_tokens: maxTokens,
      temperature: input.temperature ?? 0.2,
      stream: false,
    }),
  })

  if (!response.ok) {
    throw new Error(`DeepSeek FIM API ${response.status}: ${await response.text()}`)
  }

  const data = await response.json()
  return {
    id: data.id || `fim-${Date.now()}`,
    model: data.model || model,
    text: data.choices?.[0]?.text ?? data.choices?.[0]?.message?.content ?? '',
    usage: data.usage,
  }
}
