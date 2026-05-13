import { LEGACY_CLOUD_AVAILABILITY, type Command } from '../../types/command.js'
import { getSubscriptionType } from '../../utils/auth.js'
import { isDsxuRuntimeMode, isEnvTruthy } from '../../utils/envUtils.js'

const upgrade = {
  type: 'local-jsx',
  name: 'upgrade',
  description: 'Upgrade to Max for higher rate limits and larger planning capacity',
  availability: [LEGACY_CLOUD_AVAILABILITY],
  isEnabled: () =>
    !isDsxuRuntimeMode() &&
    !isEnvTruthy(process.env.DISABLE_UPGRADE_COMMAND) &&
    getSubscriptionType() !== 'enterprise',
  load: () => import('./upgrade.js'),
} satisfies Command

export default upgrade


// V14 command lifecycle shim: upgrade
export function processUpgradeCommandLifecycle(input) {
  void input
  const state = 'upgrade-command-state'
  const lifecycle = 'upgrade:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'upgrade',
  }
}

export function runUpgradeCommand(input) {
  return processUpgradeCommandLifecycle(input)
}
