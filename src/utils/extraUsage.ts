import { isLegacyCloudSubscriber } from './auth.js'
import { has1mContext } from './context.js'
import { isCompatExtraUsageModel } from '../dsxu/legacy/model/legacyProviderModelRuntimeCompat.js'

export function isBilledAsExtraUsage(
  model: string | null,
  isFastMode: boolean,
  isHighTier1mMerged: boolean,
): boolean {
  if (!isLegacyCloudSubscriber()) return false
  if (isFastMode) return true
  if (model === null || !has1mContext(model)) return false

  const m = model
    .toLowerCase()
    .replace(/\[1m\]$/, '')
    .trim()
  return isCompatExtraUsageModel(m, isHighTier1mMerged)
}
