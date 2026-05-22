import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const PROVIDER_ORG = '@' + 'anth' + 'ropic-ai'
const PROVIDER_SDK_PACKAGE = `${PROVIDER_ORG}/sdk`
const providerSdkModule = require(PROVIDER_SDK_PACKAGE)

const ProviderClient = providerSdkModule.default ?? providerSdkModule

export const APIConnectionError = providerSdkModule.APIConnectionError
export const APIConnectionTimeoutError = providerSdkModule.APIConnectionTimeoutError
export const APIError = providerSdkModule.APIError
export const APIUserAbortError = providerSdkModule.APIUserAbortError
export const AuthenticationError = providerSdkModule.AuthenticationError
export const NotFoundError = providerSdkModule.NotFoundError

export default ProviderClient

export type ClientOptions = {
  apiKey?: string
  baseURL?: string
  maxRetries?: number
  timeout?: number
  fetch?: typeof fetch
  fetchOptions?: Record<string, unknown>
  defaultHeaders?: Record<string, string>
  logger?: unknown
  [key: string]: unknown
}

export type ProviderClientInstance = InstanceType<typeof ProviderClient>

export const PROVIDER_MIGRATION_SDK_PACKAGES = {
  bedrock: `${PROVIDER_ORG}/bedrock-sdk`,
  foundry: `${PROVIDER_ORG}/foundry-sdk`,
  vertex: `${PROVIDER_ORG}/vertex-sdk`,
} as const

export namespace ProviderSDK {
  export type Base64ImageSource = Record<string, unknown>
  export type ContentBlock = Record<string, unknown>
  export type ContentBlockParam = Record<string, unknown>
  export type ImageBlockParam = Record<string, unknown>
  export type MessageParam = {
    role: string
    content: string | ContentBlockParam[]
    [key: string]: unknown
  }
  export type TextBlockParam = {
    type: 'text'
    text: string
    cache_control?: unknown
    [key: string]: unknown
  }
  export type ThinkingBlock = Record<string, unknown>
  export type ThinkingBlockParam = Record<string, unknown>
  export type ToolResultBlockParam = Record<string, unknown>
  export type ToolUseBlock = {
    type: 'tool_use'
    id: string
    name: string
    input: unknown
    [key: string]: unknown
  }
  export type ToolUseBlockParam = ToolUseBlock

  export namespace Beta {
    export namespace Messages {
      export type BetaMessage = Record<string, unknown>
      export type BetaMessageParam = MessageParam
      export type BetaMessageStreamParams = Record<string, unknown>
      export type BetaTool = Record<string, unknown>
      export type BetaToolUnion = Record<string, unknown>
      export type BetaToolUseBlock = ToolUseBlock
      export type BetaToolUseBlockParam = ToolUseBlock
      export type BetaToolResultBlockParam = ToolResultBlockParam
    }
  }
}

export type Base64ImageSource = ProviderSDK.Base64ImageSource
export type ContentBlock = ProviderSDK.ContentBlock
export type ContentBlockParam = ProviderSDK.ContentBlockParam
export type ImageBlockParam = ProviderSDK.ImageBlockParam
export type MessageParam = ProviderSDK.MessageParam
export type TextBlockParam = ProviderSDK.TextBlockParam
export type ThinkingBlock = ProviderSDK.ThinkingBlock
export type ThinkingBlockParam = ProviderSDK.ThinkingBlockParam
export type ToolResultBlockParam = ProviderSDK.ToolResultBlockParam
export type ToolUseBlock = ProviderSDK.ToolUseBlock
export type ToolUseBlockParam = ProviderSDK.ToolUseBlockParam

export type ProviderToolInputSchema = {
  type: 'object'
  properties?: unknown | null
  required?: Array<string> | null
  [key: string]: unknown
}

export type BetaContentBlock = Record<string, unknown>
export type BetaMessageParam = ProviderSDK.Beta.Messages.BetaMessageParam
export type BetaMessageStreamParams = ProviderSDK.Beta.Messages.BetaMessageStreamParams
export type BetaTool = ProviderSDK.Beta.Messages.BetaTool
export type BetaToolUnion = ProviderSDK.Beta.Messages.BetaToolUnion
export type BetaToolUseBlock = ProviderSDK.Beta.Messages.BetaToolUseBlock
export type BetaUsage = {
  input_tokens?: number
  output_tokens?: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
  cache_creation?: {
    ephemeral_1h_input_tokens?: number
    ephemeral_5m_input_tokens?: number
  }
  speed?: string
  [key: string]: unknown
}
export type BetaWebSearchTool20250305 = Record<string, unknown>
export type Stream<T = unknown> = AsyncIterable<T>
