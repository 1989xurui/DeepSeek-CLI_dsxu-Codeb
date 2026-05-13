// Leaf config module — intentionally minimal imports so UI components
// can read the auto-dream enabled state without dragging in the forked
// agent / task registry / message builder chain that autoDream.ts pulls in.

import { getInitialSettings } from '../../utils/settings/settings.js'
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../analytics/growthbook.js'

/**
 * Whether background memory consolidation should run. User setting
 * (autoDreamEnabled in settings.json) overrides the GrowthBook default
 * when explicitly set; otherwise falls through to tengu_onyx_plover.
 */
export function isAutoDreamEnabled(): boolean {
  const setting = getInitialSettings().autoDreamEnabled
  if (setting !== undefined) return setting
  const gb = getFeatureValue_CACHED_MAY_BE_STALE<{ enabled?: unknown } | null>(
    'tengu_onyx_plover',
    null,
  )
  return gb?.enabled === true
}


// V14 strict lifecycle shim: services-autoDream-config
export function processServicesAutoDreamConfigStrictLifecycle(input) {
  void input
  const state = 'services-autoDream-config-state'
  const lifecycle = 'services-autoDream-config:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runServicesAutoDreamConfigStrict(input) {
  return processServicesAutoDreamConfigStrictLifecycle(input)
}
