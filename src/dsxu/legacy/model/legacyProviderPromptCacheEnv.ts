import { isEnvTruthy } from '../../../utils/envUtils.js'

export function isCompatSmallFastPromptCachingDisabled(): boolean {
  return isEnvTruthy(process.env.DISABLE_PROMPT_CACHING_HAIKU)
}

export function isCompatDefaultCodingPromptCachingDisabled(): boolean {
  return isEnvTruthy(process.env.DISABLE_PROMPT_CACHING_SONNET)
}

export function isCompatDefaultHighCapacityPromptCachingDisabled(): boolean {
  return isEnvTruthy(process.env.DISABLE_PROMPT_CACHING_OPUS)
}

export function isCompatPromptCacheBreakDetectionExcludedModel(
  model: string,
): boolean {
  return model.includes('haiku')
}
