import type { ContextManagementConfig } from '../../services/compact/apiMicrocompact.js'
import { resolveAPIContextManagementTokenPolicy } from '../../services/compact/apiMicrocompact.js'
import { isBeijingOffPeak } from './model-limits.js'

export type APIMicrocompactBridgeInput = {
  estimatedTokens: number
  modelContextLimit: number
  date?: Date
  contextManagement?: ContextManagementConfig
}

export type APIMicrocompactBridgeResult = {
  configuredTriggerTokens: number
  targetTokens: number
  localFallbackTriggerTokens: number
  shouldPreCompact: boolean
}

export function resolveAPIMicrocompactBridge(input: APIMicrocompactBridgeInput): APIMicrocompactBridgeResult {
  const toolClearEdit = input.contextManagement?.edits.find(
    edit => edit.type === 'clear_tool_uses_20250919',
  )
  const tokenPolicy = resolveAPIContextManagementTokenPolicy({
    contextWindow: input.modelContextLimit,
  })
  const configuredTriggerTokens =
    toolClearEdit?.trigger?.value ?? tokenPolicy.triggerTokens
  const targetTokens = tokenPolicy.targetTokens
  const dayFallback = Math.floor(input.modelContextLimit * 0.75)
  const nightFallback = Math.floor(input.modelContextLimit * 0.65)
  const fallbackBudget = isBeijingOffPeak(input.date ?? new Date())
    ? nightFallback
    : dayFallback
  const localFallbackTriggerTokens = Math.min(configuredTriggerTokens, fallbackBudget)

  return {
    configuredTriggerTokens,
    targetTokens,
    localFallbackTriggerTokens,
    shouldPreCompact: input.estimatedTokens >= localFallbackTriggerTokens,
  }
}
