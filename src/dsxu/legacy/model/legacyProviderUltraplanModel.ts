import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../../services/analytics/growthbook.js'
import { ALL_MODEL_CONFIGS } from '../../../utils/model/configs.js'

export function getCompatUltraplanModel(): string {
  return getFeatureValue_CACHED_MAY_BE_STALE(
    'tengu_ultraplan_model',
    ALL_MODEL_CONFIGS.opus46.firstParty,
  )
}
