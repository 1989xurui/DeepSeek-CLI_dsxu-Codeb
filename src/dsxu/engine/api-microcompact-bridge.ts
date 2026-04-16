import {
  API_MICROCOMPACT_DEFAULT_MAX_INPUT_TOKENS,
  API_MICROCOMPACT_DEFAULT_TARGET_INPUT_TOKENS,
  getAPIContextManagement,
  type ContextManagementConfig,
} from '../../services/compact/apiMicrocompact'
import { getBudgetTriggerRatio } from './model-limits'

export interface APIMicrocompactBridgeOptions {
  estimatedTokens: number
  modelContextLimit: number
  date?: Date
  hasThinking?: boolean
  isRedactThinkingActive?: boolean
  clearAllThinking?: boolean
  contextManagement?: ContextManagementConfig
}

export interface APIMicrocompactBridgeResult {
  contextManagement?: ContextManagementConfig
  configuredTriggerTokens: number
  localFallbackTriggerTokens: number
  targetTokens: number
  shouldPreCompact: boolean
}

function getConfiguredTriggerTokens(
  contextManagement: ContextManagementConfig | undefined,
): number {
  const clearToolStrategy = contextManagement?.edits.find(
    edit => edit.type === 'clear_tool_uses_20250919' && edit.trigger?.type === 'input_tokens',
  )

  return clearToolStrategy?.trigger?.value ?? API_MICROCOMPACT_DEFAULT_MAX_INPUT_TOKENS
}

function getConfiguredTargetTokens(
  contextManagement: ContextManagementConfig | undefined,
): number {
  const clearToolStrategy = contextManagement?.edits.find(
    edit => edit.type === 'clear_tool_uses_20250919' && edit.clear_at_least?.type === 'input_tokens',
  )

  if (!clearToolStrategy?.clear_at_least?.value) {
    return API_MICROCOMPACT_DEFAULT_TARGET_INPUT_TOKENS
  }

  const triggerValue = clearToolStrategy.trigger?.type === 'input_tokens'
    ? clearToolStrategy.trigger.value
    : API_MICROCOMPACT_DEFAULT_MAX_INPUT_TOKENS

  return triggerValue - clearToolStrategy.clear_at_least.value
}

export function resolveAPIMicrocompactBridge(
  options: APIMicrocompactBridgeOptions,
): APIMicrocompactBridgeResult {
  const date = options.date ?? new Date()
  const contextManagement = options.contextManagement ?? getAPIContextManagement({
    hasThinking: options.hasThinking,
    isRedactThinkingActive: options.isRedactThinkingActive,
    clearAllThinking: options.clearAllThinking,
  })

  const configuredTriggerTokens = getConfiguredTriggerTokens(contextManagement)
  const targetTokens = getConfiguredTargetTokens(contextManagement)
  const budgetTriggerTokens = Math.floor(
    options.modelContextLimit * getBudgetTriggerRatio(date),
  )
  const localFallbackTriggerTokens = Math.min(
    configuredTriggerTokens,
    budgetTriggerTokens,
  )

  return {
    contextManagement,
    configuredTriggerTokens,
    localFallbackTriggerTokens,
    targetTokens,
    shouldPreCompact: options.estimatedTokens >= localFallbackTriggerTokens,
  }
}
