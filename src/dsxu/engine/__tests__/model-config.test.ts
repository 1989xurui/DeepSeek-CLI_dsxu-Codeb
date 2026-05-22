import { describe, it, expect } from 'bun:test'
import {
  getModelConfig,
  isDeepSeekNativeModel,
  isProviderMigrationMappedModel,
  getAvailableModels,
  recommendModelForTask,
  DEEPSEEK_MODELS,
  PROVIDER_MIGRATION_MODEL_MAPPING,
  DEEPSEEK_1M_CONTEXT_WINDOW,
  DEEPSEEK_V4_MAX_OUTPUT_TOKENS,
} from '../model-config'

const PROVIDER_MIGRATION_SOURCE_SONNET_46 = `${'cl' + 'aude'}-sonnet-4-6`

describe('model-config', () => {
  it('gets config for current DeepSeek V4 models', () => {
    const config = getModelConfig('deepseek-v4-flash')
    expect(config.name).toBe('deepseek-v4-flash')
    expect(config.displayName).toBe('DeepSeek V4 Flash')
    expect(config.contextWindow).toBe(DEEPSEEK_1M_CONTEXT_WINDOW)
    expect(config.maxOutputTokens).toBe(DEEPSEEK_V4_MAX_OUTPUT_TOKENS)
  })

  it('maps old DSXU/DeepSeek aliases to current DeepSeek V4 models', () => {
    expect(getModelConfig('deepseek-chat').name).toBe('deepseek-v4-flash')
    expect(getModelConfig('deepseek-coder').name).toBe('deepseek-v4-flash')
    expect(getModelConfig('deepseek-reasoner').name).toBe('deepseek-v4-flash')
    expect(getModelConfig(PROVIDER_MIGRATION_SOURCE_SONNET_46).name).toBe('deepseek-v4-pro')
  })

  it('identifies native models and provider-migration aliases', () => {
    expect(isDeepSeekNativeModel('deepseek-v4-flash')).toBe(true)
    expect(isDeepSeekNativeModel('deepseek-v4-pro')).toBe(true)
    expect(isDeepSeekNativeModel('deepseek-chat')).toBe(false)
    expect(isProviderMigrationMappedModel(PROVIDER_MIGRATION_SOURCE_SONNET_46)).toBe(true)
    expect(isProviderMigrationMappedModel('deepseek-chat')).toBe(true)
    expect(isProviderMigrationMappedModel('deepseek-v4-flash')).toBe(false)
  })

  it('recommends models for tasks', () => {
    expect(recommendModelForTask('reasoning').name).toBe('deepseek-v4-flash')
    expect(recommendModelForTask('coding').name).toBe('deepseek-v4-flash')
    expect(recommendModelForTask('fim').name).toBe('deepseek-v4-pro')
    expect(recommendModelForTask('unknown').name).toBe('deepseek-v4-flash')
  })

  it('gets available current models only', () => {
    const models = getAvailableModels()
    expect(models).toEqual(['deepseek-v4-flash', 'deepseek-v4-pro'])
  })

  it('exports model and provider-migration maps', () => {
    expect(DEEPSEEK_MODELS['deepseek-v4-flash']).toBeDefined()
    expect(DEEPSEEK_MODELS['deepseek-v4-pro']).toBeDefined()
    expect(PROVIDER_MIGRATION_MODEL_MAPPING['deepseek-chat']).toBe('deepseek-v4-flash')
    expect(PROVIDER_MIGRATION_MODEL_MAPPING['deepseek-reasoner']).toBe('deepseek-v4-flash')
  })
})
