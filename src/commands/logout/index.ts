import type { Command } from '../../commands.js'
import { isEnvTruthy } from '../../utils/envUtils.js'

export default {
  type: 'local-jsx',
  name: 'logout',
  description: 'Clear DSXU local model/session credentials',
  isEnabled: () => !isEnvTruthy(process.env.DISABLE_LOGOUT_COMMAND),
  load: () => import('./logout.js'),
} satisfies Command


// V14 command lifecycle shim: logout
export function processLogoutCommandLifecycle(input) {
  void input
  const state = 'logout-command-state'
  const lifecycle = 'logout:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'logout',
  }
}

export function runLogoutCommand(input) {
  return processLogoutCommandLifecycle(input)
}
