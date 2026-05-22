import type { Command } from '../../commands.js'
import { checkStatsigFeatureGate_CACHED_MAY_BE_STALE } from '../../services/analytics/featureFlags.js'
import { isDsxuRuntimeMode } from '../../utils/envUtils.js'

const thinkback = {
  type: 'local-jsx',
  name: 'think-back',
  description: 'Archived year-in-review plugin installer',
  isEnabled: () =>
    !isDsxuRuntimeMode() &&
    checkStatsigFeatureGate_CACHED_MAY_BE_STALE('tengu_thinkback'),
  load: () => import('./thinkback.js'),
} satisfies Command

export default thinkback
