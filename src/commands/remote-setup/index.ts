import { PROVIDER_MIGRATION_CLOUD_AVAILABILITY, type Command } from '../../types/command.js'
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../services/analytics/featureFlags.js'
import { isPolicyAllowed } from '../../services/policyLimits/index.js'
import { isDsxuRuntimeMode } from '../../utils/envUtils.js'

const web = {
  type: 'local-jsx',
  name: 'web-setup',
  get description() {
    return isDsxuRuntimeMode()
      ? 'DSXU remote setup is handled by the local Remote Session Provider'
      : 'Setup provider-migration remote workspace (requires connecting your GitHub account)'
  },
  availability: [PROVIDER_MIGRATION_CLOUD_AVAILABILITY],
  isEnabled: () =>
    !isDsxuRuntimeMode() &&
    getFeatureValue_CACHED_MAY_BE_STALE('tengu_cobalt_lantern', false) &&
    isPolicyAllowed('allow_remote_sessions'),
  get isHidden() {
    if (isDsxuRuntimeMode()) return true
    return !isPolicyAllowed('allow_remote_sessions')
  },
  load: () => import('./remote-setup.js'),
} satisfies Command

export default web

export function getDsxuRemoteSetupCommandRuntimeProfile(): {
  command: '/web-setup'
  runtime: 'DSXU Local Remote Session Setup'
  activationEvidence: readonly string[]
} {
  return {
    command: '/web-setup',
    runtime: 'DSXU Local Remote Session Setup',
    activationEvidence: [
      'DSXU_CODE_MODE disables the provider-migration web setup command',
      'DSXU remote execution is routed through the local Remote Session Provider',
      'provider-migration feature flag and policy checks are bypassed in DSXU runtime',
    ],
  }
}
