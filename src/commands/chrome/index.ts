import { getIsNonInteractiveSession } from '../../bootstrap/state.js'
import type { Command } from '../../commands.js'

const command: Command = {
  name: 'chrome',
  description: 'DSXU Browser Provider settings',
  availability: ['dsxu', 'console'],
  isEnabled: () => !getIsNonInteractiveSession(),
  type: 'local-jsx',
  load: () => import('./chrome.js'),
}

export default command


// V14 command lifecycle shim: chrome
export function processChromeCommandLifecycle(input) {
  void input
  const state = 'chrome-command-state'
  const lifecycle = 'chrome:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'chrome',
  }
}

export function runChromeCommand(input) {
  return processChromeCommandLifecycle(input)
}
