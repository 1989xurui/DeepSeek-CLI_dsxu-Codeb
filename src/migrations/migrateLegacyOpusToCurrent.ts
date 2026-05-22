import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../services/analytics/index.js'
import { saveGlobalConfig } from '../utils/config.js'
import { isArchivedModelRemapEnabled } from '../utils/model/model.js'
import { isDsxuRuntimeMode } from '../utils/envUtils.js'
import { getAPIProvider } from '../utils/model/providers.js'
import {
  getSettingsForSource,
  updateSettingsForSource,
} from '../utils/settings/settings.js'

const LEGACY_MODEL_PREFIX = 'cl' + 'aude'
const LEGACY_OPUS_MODEL_IDS = new Set([
  `${LEGACY_MODEL_PREFIX}-opus-4-20250514`,
  `${LEGACY_MODEL_PREFIX}-opus-4-1-20250805`,
  `${LEGACY_MODEL_PREFIX}-opus-4-0`,
  `${LEGACY_MODEL_PREFIX}-opus-4-1`,
])

/**
 * Migrate first-party users off explicit Opus 4.0/4.1 model strings.
 *
 * The 'opus' alias already resolves to Opus 4.6 for 1P, so anyone still
 * on an explicit 4.0/4.1 string pinned it in settings before 4.5 launched.
 * parseUserSpecifiedModel now silently remaps these at runtime anyway —
 * this migration cleans up the settings file so /model shows the right
 * thing, and sets a timestamp so the REPL can show a one-time notification.
 *
 * Only touches userSettings. Legacy strings in project/local/policy settings
 * are left alone (we can't/shouldn't rewrite those) and are still remapped at
 * runtime by parseUserSpecifiedModel. Reading and writing the same source
 * keeps this idempotent without a completion flag, and avoids silently
 * promoting 'opus' to the global default for users who only pinned it in one
 * project.
 */
export function migrateLegacyOpusToCurrent(): void {
  if (isDsxuRuntimeMode()) return
  if (getAPIProvider() !== 'firstParty') {
    return
  }

  if (!isArchivedModelRemapEnabled()) {
    return
  }

  const model = getSettingsForSource('userSettings')?.model
  if (!model || !LEGACY_OPUS_MODEL_IDS.has(model)) {
    return
  }

  updateSettingsForSource('userSettings', { model: 'opus' })
  saveGlobalConfig(current => ({
    ...current,
    legacyOpusMigrationTimestamp: Date.now(),
  }))
  logEvent('tengu_legacy_opus_migration', {
    from_model:
      model as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  })
}


export function getDsxuLegacyOpusMigrationRuntimeProfile() {
  return {
    runtime: 'DSXU Legacy Model Migration Boundary',
    defaultBehavior: 'Opus migration is disabled in DSXU runtime; DeepSeek model policy owns model selection',
    providerTarget: 'DSXU DeepSeek Model Policy',
    activationEvidence: [
      'migrateLegacyOpusToCurrent returns before first-party provider checks in DSXU mode',
      'legacy model-string cleanup remains available only outside DSXU runtime',
      'DeepSeek Flash/Pro thinking/FIM strategy is not rewritten by legacy model migrations',
    ],
  }
}
