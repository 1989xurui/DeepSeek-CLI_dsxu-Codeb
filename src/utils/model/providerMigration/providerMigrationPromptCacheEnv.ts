import { isEnvTruthy } from '../../envUtils.js'

export function isArchivedSmallFastPromptCachingDisabled(): boolean {
  return isEnvTruthy(process.env.DISABLE_PROMPT_CACHING_HAIKU)
}

export function isArchivedDefaultCodingPromptCachingDisabled(): boolean {
  return isEnvTruthy(process.env.DISABLE_PROMPT_CACHING_SONNET)
}

export function isArchivedDefaultHighCapacityPromptCachingDisabled(): boolean {
  return isEnvTruthy(process.env.DISABLE_PROMPT_CACHING_OPUS)
}

export function isArchivedPromptCacheBreakDetectionExcludedModel(
  model: string,
): boolean {
  return model.includes('haiku')
}

export const isProviderMigrationSmallFastPromptCachingDisabled =
  isArchivedSmallFastPromptCachingDisabled
export const isProviderMigrationDefaultCodingPromptCachingDisabled =
  isArchivedDefaultCodingPromptCachingDisabled
export const isProviderMigrationDefaultHighCapacityPromptCachingDisabled =
  isArchivedDefaultHighCapacityPromptCachingDisabled
export const isProviderMigrationPromptCacheBreakDetectionExcludedModel =
  isArchivedPromptCacheBreakDetectionExcludedModel
