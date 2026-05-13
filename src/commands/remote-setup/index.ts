import { LEGACY_CLOUD_AVAILABILITY, type Command } from '../../types/command.js'
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../services/analytics/growthbook.js'
import { isPolicyAllowed } from '../../services/policyLimits/index.js'
import { isDsxuRuntimeMode } from '../../utils/envUtils.js'

const web = {
  type: 'local-jsx',
  name: 'web-setup',
  get description() {
    return isDsxuRuntimeMode()
      ? 'DSXU remote setup is handled by the local Remote Session Provider'
      : 'Setup DSXU Code on the web (requires connecting your GitHub account)'
  },
  availability: [LEGACY_CLOUD_AVAILABILITY],
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
      'DSXU_CODE_MODE disables the legacy web setup command',
      'DSXU remote execution is routed through the local Remote Session Provider',
      'legacy feature flag and policy checks are bypassed in DSXU runtime',
    ],
  }
}


// V14 command lifecycle shim: remote-setup
export function processRemoteSetupCommandLifecycle(input) {
  void input
  const state = 'remote-setup-command-state'
  const lifecycle = 'remote-setup:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'remote-setup',
  }
}

export function runRemoteSetupCommand(input) {
  return processRemoteSetupCommandLifecycle(input)
}
