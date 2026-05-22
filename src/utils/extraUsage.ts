import { isProviderSubscriptionAccount } from './auth.js'
import { has1mContext } from './context.js'
import { isProviderMigrationExtraUsageModel } from './model/providerMigration/providerMigrationModelCompat.js'

export function isBilledAsExtraUsage(
  model: string | null,
  isFastMode: boolean,
  isHighTier1mMerged: boolean,
): boolean {
  if (!isProviderSubscriptionAccount()) return false
  if (isFastMode) return true
  if (model === null || !has1mContext(model)) return false

  const m = model
    .toLowerCase()
    .replace(/\[1m\]$/, '')
    .trim()
  return isProviderMigrationExtraUsageModel(m, isHighTier1mMerged)
}
