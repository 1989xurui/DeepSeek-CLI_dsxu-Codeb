import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../../services/analytics/featureFlags.js'
import { ALL_MODEL_CONFIGS } from '../configs.js'

export function getArchivedUltraplanModel(): string {
  return getFeatureValue_CACHED_MAY_BE_STALE(
    'tengu_ultraplan_model',
    ALL_MODEL_CONFIGS.opus46.firstParty,
  )
}

export const getProviderMigrationUltraplanModel = getArchivedUltraplanModel
