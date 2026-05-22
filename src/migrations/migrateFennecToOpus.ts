import { isDsxuRuntimeMode } from '../utils/envUtils.js'
import {
  getSettingsForSource,
  updateSettingsForSource,
} from '../utils/settings/settings.js'

/**
 * Migrate users on removed fennec model aliases to their new Opus 4.6 aliases.
 * - fennec-latest → opus
 * - fennec-latest[1m] → opus[1m]
 * - fennec-fast-latest → opus[1m] + fast mode
 * - opus-4-5-fast → opus + fast mode
 *
 * Only touches userSettings. Reading and writing the same source keeps this
 * idempotent without a completion flag. Fennec aliases in project/local/policy
 * settings are left alone — we can't rewrite those, and reading merged
 * settings here would cause infinite re-runs + silent global promotion.
 */
export function migrateFennecToOpus(): void {
  if (isDsxuRuntimeMode()) return
  if (process.env.USER_TYPE !== 'ant') {
    return
  }

  const settings = getSettingsForSource('userSettings')

  const model = settings?.model
  if (typeof model === 'string') {
    if (model.startsWith('fennec-latest[1m]')) {
      updateSettingsForSource('userSettings', {
        model: 'opus[1m]',
      })
    } else if (model.startsWith('fennec-latest')) {
      updateSettingsForSource('userSettings', {
        model: 'opus',
      })
    } else if (
      model.startsWith('fennec-fast-latest') ||
      model.startsWith('opus-4-5-fast')
    ) {
      updateSettingsForSource('userSettings', {
        model: 'opus[1m]',
        fastMode: true,
      })
    }
  }
}


export function getDsxuFennecMigrationRuntimeProfile() {
  return {
    runtime: 'DSXU Fennec/Opus Migration Boundary',
    defaultBehavior: 'archived alias intake is disabled in DSXU runtime so DeepSeek defaults are preserved',
    providerTarget: 'DSXU DeepSeek Model Policy',
    activationEvidence: [
      'migrateFennecToOpus returns immediately in DSXU mode',
      'legacy first-party aliases are not promoted into DSXU user settings',
      'fast-mode semantics are handled by DSXU thinking/cost router instead',
    ],
  }
}
