import type { Command } from '../../commands.js'
import { isPolicyAllowed } from '../../services/policyLimits/index.js'
import { isProviderSubscriptionAccount } from '../../utils/auth.js'
import { isDsxuRuntimeMode } from '../../utils/envUtils.js'

export default {
  type: 'local-jsx',
  name: 'remote-env',
  description: 'Configure the default remote environment for teleport sessions',
  isEnabled: () =>
    !isDsxuRuntimeMode() &&
    isProviderSubscriptionAccount() && isPolicyAllowed('allow_remote_sessions'),
  get isHidden() {
    if (isDsxuRuntimeMode()) return true
    return (
      !isProviderSubscriptionAccount() || !isPolicyAllowed('allow_remote_sessions')
    )
  },
  load: () => import('./remote-env.js'),
} satisfies Command
