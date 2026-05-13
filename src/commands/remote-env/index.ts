import type { Command } from '../../commands.js'
import { isPolicyAllowed } from '../../services/policyLimits/index.js'
import { isLegacyCloudSubscriber } from '../../utils/auth.js'
import { isDsxuRuntimeMode } from '../../utils/envUtils.js'

export default {
  type: 'local-jsx',
  name: 'remote-env',
  description: 'Configure the default remote environment for teleport sessions',
  isEnabled: () =>
    !isDsxuRuntimeMode() &&
    isLegacyCloudSubscriber() && isPolicyAllowed('allow_remote_sessions'),
  get isHidden() {
    if (isDsxuRuntimeMode()) return true
    return (
      !isLegacyCloudSubscriber() || !isPolicyAllowed('allow_remote_sessions')
    )
  },
  load: () => import('./remote-env.js'),
} satisfies Command


// V14 command lifecycle shim: remote-env
export function processRemoteEnvCommandLifecycle(input) {
  void input
  const state = 'remote-env-command-state'
  const lifecycle = 'remote-env:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'remote-env',
  }
}

export function runRemoteEnvCommand(input) {
  return processRemoteEnvCommandLifecycle(input)
}
