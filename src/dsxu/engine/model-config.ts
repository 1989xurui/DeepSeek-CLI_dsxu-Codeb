/**
 * DeepSeek 模型配置管理器
 * 
 * 统一管理所有DeepSeek模型配置，去除Claude映射残留
 */

import type { DeepSeekModelConfig } from './types'

/** DeepSeek 官方模型配置 */
export const DEEPSEEK_MODELS: Record<string, DeepSeekModelConfig> = {
  'deepseek-chat': {
    name: 'deepseek-chat',
    displayName: 'DeepSeek Chat',
    contextWindow: 128_000,
    maxOutputTokens: 8_192,
    supportsReasoning: false,
    defaultTemperature: 0.7,
    supportsTools: true,
    inputPricePerMillion: 0.14,
    outputPricePerMillion: 0.28,
  },
  'deepseek-reasoner': {
    name: 'deepseek-reasoner',
    displayName: 'DeepSeek Reasoner',
    contextWindow: 128_000,
    maxOutputTokens: 65_536,
    supportsReasoning: true,
    defaultTemperature: 0.5,
    supportsTools: true,
    inputPricePerMillion: 0.28,
    outputPricePerMillion: 0.56,
  },
  'deepseek-coder': {
    name: 'deepseek-coder',
    displayName: 'DeepSeek Coder',
    contextWindow: 128_000,
    maxOutputTokens: 8_192,
    supportsReasoning: false,
    defaultTemperature: 0.3,
    supportsTools: true,
    inputPricePerMillion: 0.14,
    outputPricePerMillion: 0.28,
  },
}

/** 兼容性映射（向后兼容） */
export const COMPATIBILITY_MAPPING: Record<string, string> = {
  'claude-sonnet-4-6': 'deepseek-chat',
  'claude-opus-4-6': 'deepseek-reasoner',
  'gpt-4o': 'deepseek-chat',
  'gpt-4o-mini': 'deepseek-chat',
}

/**
 * 获取模型配置
 * @param modelName 模型名称（支持兼容性名称）
 * @returns 模型配置，如果未找到则返回默认配置
 */
export function getModelConfig(modelName: string): DeepSeekModelConfig {
  // 首先尝试直接匹配
  if (DEEPSEEK_MODELS[modelName]) {
    return DEEPSEEK_MODELS[modelName]
  }

  // 尝试兼容性映射
  const mappedName = COMPATIBILITY_MAPPING[modelName]
  if (mappedName && DEEPSEEK_MODELS[mappedName]) {
    console.warn(`[ModelConfig] Using compatibility mapping: ${modelName} -> ${mappedName}`)
    return DEEPSEEK_MODELS[mappedName]
  }

  // 默认配置（DeepSeek Chat）
  console.warn(`[ModelConfig] Model not found: ${modelName}, using default`)
  return DEEPSEEK_MODELS['deepseek-chat']
}

/**
 * 检查是否为DeepSeek原生模型
 */
export function isDeepSeekNativeModel(modelName: string): boolean {
  return modelName in DEEPSEEK_MODELS
}

/**
 * 检查是否为兼容性模型（Claude/GPT映射）
 */
export function isCompatibilityModel(modelName: string): boolean {
  return modelName in COMPATIBILITY_MAPPING
}

/**
 * 获取所有可用的DeepSeek模型名称
 */
export function getAvailableModels(): string[] {
  return Object.keys(DEEPSEEK_MODELS)
}

/**
 * 根据任务类型推荐模型
 */
export function recommendModelForTask(taskType: string): DeepSeekModelConfig {
  switch (taskType.toLowerCase()) {
    case 'reasoning':
    case 'analysis':
    case 'planning':
      return DEEPSEEK_MODELS['deepseek-reasoner']
    case 'coding':
    case 'programming':
    case 'refactoring':
      return DEEPSEEK_MODELS['deepseek-coder'] || DEEPSEEK_MODELS['deepseek-chat']
    default:
      return DEEPSEEK_MODELS['deepseek-chat']
  }
}

/**
 * 验证模型配置是否有效
 */
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
