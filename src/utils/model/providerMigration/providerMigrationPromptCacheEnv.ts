import { isEnvTruthy } from '../../envUtils.js'

export function isProviderMigrationSmallFastPromptCachingDisabled(): boolean {
  return isEnvTruthy(process.env.DISABLE_PROMPT_CACHING_HAIKU)
}

export function isProviderMigrationDefaultCodingPromptCachingDisabled(): boolean {
  return isEnvTruthy(process.env.DISABLE_PROMPT_CACHING_SONNET)
}

export function isProviderMigrationDefaultHighCapacityPromptCachingDisabled(): boolean {
  return isEnvTruthy(process.env.DISABLE_PROMPT_CACHING_OPUS)
}

export function isProviderMigrationPromptCacheBreakDetectionExcludedModel(
  model: string,
): boolean {
  return model.includes('haiku')
}
