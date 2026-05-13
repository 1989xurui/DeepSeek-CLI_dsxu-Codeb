import type { DeepSeekModelConfig } from './types'
import {
  DEEPSEEK_V4_CONTEXT_WINDOW,
  DEEPSEEK_V4_FLASH_MODEL,
  DEEPSEEK_V4_MAX_CHAT_OUTPUT_TOKENS,
  DEEPSEEK_V4_MODEL_SPECS,
  decideDeepSeekV4Route,
  isDeepSeekV4ModelLike,
  normalizeDeepSeekV4Model,
  type DeepSeekV4ApiMode,
  type DeepSeekV4Model,
} from '../../utils/model/deepseekV4Control'
import { getCompatDeepSeekModelMapping } from '../legacy/model/legacyProviderModelRuntimeCompat'

export type DeepSeekApiMode = DeepSeekV4ApiMode

export type DeepSeekModelFeature = {
  supportsFim: boolean
  fimMode: 'non_thinking_only' | 'unsupported'
  supportedApiModes: DeepSeekApiMode[]
  supportsThinkingMode: boolean
  supportedReasoningEfforts: Array<'high' | 'max'>
  supportsJsonOutput: boolean
  supportsToolCalls: boolean
  supportsPrefixCompletion: boolean
  apiMode: DeepSeekApiMode
  lifecycle: 'current' | 'compatibility'
}

export type DSXUDeepSeekModelConfig = DeepSeekModelConfig & DeepSeekModelFeature

export const DEEPSEEK_1M_CONTEXT_WINDOW = DEEPSEEK_V4_CONTEXT_WINDOW
export const DEEPSEEK_V4_MAX_OUTPUT_TOKENS = DEEPSEEK_V4_MAX_CHAT_OUTPUT_TOKENS

export const DEEPSEEK_MODELS: Record<DeepSeekV4Model, DSXUDeepSeekModelConfig> = Object.fromEntries(
  Object.values(DEEPSEEK_V4_MODEL_SPECS).map(spec => [
    spec.name,
    {
      name: spec.name,
      displayName: spec.displayName,
      contextWindow: spec.contextWindow,
      maxOutputTokens: spec.maxOutputTokens,
      supportsReasoning: spec.supportsReasoning,
      defaultTemperature: spec.defaultTemperature,
      supportsTools: spec.supportsTools,
      supportsFim: spec.supportsFim,
      fimMode: 'non_thinking_only',
      supportedApiModes: [...spec.supportedApiModes],
      supportsThinkingMode: true,
      supportedReasoningEfforts: [...spec.supportedReasoningEfforts],
      supportsJsonOutput: spec.supportsJsonOutput,
      supportsToolCalls: spec.supportsTools,
      supportsPrefixCompletion: spec.supportsPrefixCompletion,
      apiMode: spec.defaultApiMode,
      lifecycle: 'current',
      inputPricePerMillion: spec.pricing.cacheMissInputPerMillion,
      outputPricePerMillion: spec.pricing.outputPerMillion,
    },
  ]),
) as Record<DeepSeekV4Model, DSXUDeepSeekModelConfig>

export const COMPATIBILITY_MAPPING: Record<string, DeepSeekV4Model> =
  getCompatDeepSeekModelMapping()

export function getModelConfig(modelName: string): DSXUDeepSeekModelConfig {
  if (modelName in DEEPSEEK_MODELS) {
    return DEEPSEEK_MODELS[modelName as DeepSeekV4Model]
  }

  const mappedName = COMPATIBILITY_MAPPING[modelName]
  if (mappedName && DEEPSEEK_MODELS[mappedName]) {
    console.warn(`[ModelConfig] Using compatibility mapping: ${modelName} -> ${mappedName}`)
    return DEEPSEEK_MODELS[mappedName]
  }

  if (isDeepSeekV4ModelLike(modelName)) {
    return DEEPSEEK_MODELS[normalizeDeepSeekV4Model(modelName)]
  }

  console.warn(`[ModelConfig] Model not found: ${modelName}, using default`)
  return DEEPSEEK_MODELS[DEEPSEEK_V4_FLASH_MODEL]
}

export function isDeepSeekNativeModel(modelName: string): boolean {
  return modelName in DEEPSEEK_MODELS
}

export function isCompatibilityModel(modelName: string): boolean {
  return modelName in COMPATIBILITY_MAPPING
}

export function getAvailableModels(): string[] {
  return Object.keys(DEEPSEEK_MODELS)
}

export function recommendModelForTask(taskType: string): DSXUDeepSeekModelConfig {
  const normalized = taskType.toLowerCase()
  const workflowKind =
    /reasoning|analysis|planning|review|recovery/.test(normalized)
      ? normalized === 'recovery' ? 'recovery' : normalized === 'review' ? 'review' : 'planning'
      : /fim|completion|autocomplete/.test(normalized)
        ? 'fim'
        : /coding|programming|refactoring/.test(normalized)
          ? 'feature'
          : 'generic_chat'
  const decision = decideDeepSeekV4Route({
    workflowKind,
    requiresFim: workflowKind === 'fim',
  })
  return DEEPSEEK_MODELS[decision.model]
}

export function selectDeepSeekModelForMode(input: { requiresReasoning?: boolean; requiresFim?: boolean; latencySensitive?: boolean }) {
  const decision = decideDeepSeekV4Route({
    workflowKind: input.requiresFim ? 'fim' : input.requiresReasoning && !input.latencySensitive ? 'planning' : 'generic_chat',
    requiresFim: input.requiresFim,
    requiresReasoning: input.requiresReasoning,
    latencySensitive: input.latencySensitive,
  })
  return DEEPSEEK_MODELS[decision.model]
}

export function selectDeepSeekInvocationMode(input: {
  requiresReasoning?: boolean
  requiresFim?: boolean
  complexAgentTask?: boolean
  latencySensitive?: boolean
}) {
  const decision = decideDeepSeekV4Route({
    workflowKind: input.requiresFim ? 'fim' : input.requiresReasoning && !input.latencySensitive ? 'planning' : 'generic_chat',
    requiresFim: input.requiresFim,
    requiresReasoning: input.requiresReasoning,
    complexAgentTask: input.complexAgentTask,
    latencySensitive: input.latencySensitive,
  })

  return {
    model: DEEPSEEK_MODELS[decision.model],
    apiMode: decision.apiMode,
    reasoningEffort: decision.reasoningEffort,
  }
}

export function validateModelConfig(config: DeepSeekModelConfig): string[] {
  const errors: string[] = []

  if (!config.name) errors.push('Model name is required')
  if (!config.displayName) errors.push('Display name is required')
  if (config.contextWindow <= 0) errors.push('Context window must be positive')
  if (config.maxOutputTokens <= 0) errors.push('Max output tokens must be positive')
  if (config.maxOutputTokens > config.contextWindow) {
    errors.push('Max output tokens cannot exceed context window')
  }
  if (config.defaultTemperature < 0 || config.defaultTemperature > 2) {
    errors.push('Default temperature must be between 0 and 2')
  }

  return errors
}
