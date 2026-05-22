import { describe, expect, test } from 'bun:test'
import {
  DEEPSEEK_V4_CONTEXT_WINDOW,
  DEEPSEEK_V4_FLASH_MODEL,
  DEEPSEEK_V4_PRO_MODEL,
} from '../../../utils/model/deepseekV4Control'
import {
  MODEL_CAPABILITY_FACT_OWNER,
  getModelCapability,
  routeModel,
} from '../model-capability-v1'
import { createModelGateway } from '../model-gateway-v1'

describe('model-capability-v1', () => {
  test('projects current DeepSeek V4 Flash facts from the canonical owner', () => {
    const capability = getModelCapability(DEEPSEEK_V4_FLASH_MODEL)

    expect(capability.model).toBe(DEEPSEEK_V4_FLASH_MODEL)
    expect(capability.contextWindow).toBe(DEEPSEEK_V4_CONTEXT_WINDOW)
    expect(capability.supportsTools).toBe(true)
    expect(capability.supportsThinking).toBe(true)
    expect(capability.supportsJson).toBe(true)
    expect(capability.defaultThinkingMode).toBe('non-thinking')
    expect(capability.lifecycle).toBe('current')
  })

  test('downgrades archived chat and flash-thinking aliases to canonical Flash facts', () => {
    const chat = getModelCapability('deepseek-chat')
    const flashThinking = getModelCapability('deepseek-v4-flash-thinking')

    expect(chat.model).toBe(DEEPSEEK_V4_FLASH_MODEL)
    expect(chat.contextWindow).toBe(DEEPSEEK_V4_CONTEXT_WINDOW)
    expect(chat.lifecycle).toBe('archived-alias')

    expect(flashThinking.model).toBe(DEEPSEEK_V4_FLASH_MODEL)
    expect(flashThinking.contextWindow).toBe(DEEPSEEK_V4_CONTEXT_WINDOW)
    expect(flashThinking.supportsThinking).toBe(true)
    expect(flashThinking.defaultThinkingMode).toBe('thinking')
    expect(flashThinking.lifecycle).toBe('archived-alias')
  })

  test('routes long-thinking work through Flash thinking instead of a standalone fake model', () => {
    const routed = routeModel({
      taskType: 'feature',
      requiresTools: true,
      requiresLongThinking: true,
      budgetConstraint: 'medium',
    })

    expect(routed.model).toBe(DEEPSEEK_V4_FLASH_MODEL)
    expect(routed.defaultThinkingMode).toBe('thinking')
    expect(routed.reasoningEffort).toBe('high')
    expect(routed.routeReason).toBe('coding_flash_thinking_high')
  })

  test('keeps Pro as explicit canonical capability without making high budget a Pro trigger', () => {
    expect(getModelCapability(DEEPSEEK_V4_PRO_MODEL).model).toBe(DEEPSEEK_V4_PRO_MODEL)

    const highBudgetLongThinking = routeModel({
      taskType: 'planning',
      requiresLongThinking: true,
      budgetConstraint: 'high',
    })

    expect(highBudgetLongThinking.model).toBe(DEEPSEEK_V4_FLASH_MODEL)
    expect(highBudgetLongThinking.defaultThinkingMode).toBe('thinking')
    expect(highBudgetLongThinking.reasoningEffort).toBe('max')
  })

  test('compares model-gateway switch suggestions against canonical model identity', () => {
    const gateway = createModelGateway({ defaultModel: 'deepseek-chat' })

    gateway.updateContextUsage(DEEPSEEK_V4_CONTEXT_WINDOW)
    const boundary = gateway.checkBoundary({
      taskType: 'feature',
      requiredContext: 1,
      requiresLongThinking: true,
      budgetConstraint: 'medium',
    })

    expect(boundary.result.currentModel).toBe('deepseek-chat')
    expect(boundary.result.routedModel).toBe(DEEPSEEK_V4_FLASH_MODEL)
    expect(boundary.result.suggestedAction).not.toBe('switch_model')
  })

  test('records the owner of replaced model facts', () => {
    expect(MODEL_CAPABILITY_FACT_OWNER.owner).toBe('src/utils/model/deepseekV4Control.ts')
    expect(MODEL_CAPABILITY_FACT_OWNER.replacedFacts).toContain(
      'deepseek-v4-flash-thinking as standalone model id',
    )
  })
})
