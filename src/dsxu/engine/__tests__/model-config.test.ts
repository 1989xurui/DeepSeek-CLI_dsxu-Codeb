import { describe, it, expect } from 'bun:test'
import {
  getModelConfig,
  isDeepSeekNativeModel,
  isCompatibilityModel,
  getAvailableModels,
  recommendModelForTask,
  DEEPSEEK_MODELS,
  COMPATIBILITY_MAPPING
} from '../model-config'

describe('model-config', () => {
  it('should get config for deepseek-chat', () => {
    const config = getModelConfig('deepseek-chat')
    expect(config.name).toBe('deepseek-chat')
    expect(config.displayName).toBe('DeepSeek Chat')
    expect(config.maxOutputTokens).toBe(8192)
  })

  it('should map claude-sonnet-4-6 to deepseek-chat', () => {
    const config = getModelConfig('claude-sonnet-4-6')
    expect(config.name).toBe('deepseek-chat')
  })

  it('should identify native models', () => {
    expect(isDeepSeekNativeModel('deepseek-chat')).toBe(true)
    expect(isDeepSeekNativeModel('deepseek-reasoner')).toBe(true)
    expect(isDeepSeekNativeModel('claude-sonnet-4-6')).toBe(false)
  })

  it('should identify compatibility models', () => {
    expect(isCompatibilityModel('claude-sonnet-4-6')).toBe(true)
    expect(isCompatibilityModel('deepseek-chat')).toBe(false)
  })

  it('should recommend models for tasks', () => {
    const reasoning = recommendModelForTask('reasoning')
    expect(reasoning.name).toBe('deepseek-reasoner')

    const coding = recommendModelForTask('coding')
    expect(coding.name).toBe('deepseek-coder')

    const defaultTask = recommendModelForTask('unknown')
    expect(defaultTask.name).toBe('deepseek-chat')
  })

  it('should get available models', () => {
    const models = getAvailableModels()
    expect(models).toContain('deepseek-chat')
    expect(models).toContain('deepseek-reasoner')
    expect(models).toContain('deepseek-coder')
  })
})
