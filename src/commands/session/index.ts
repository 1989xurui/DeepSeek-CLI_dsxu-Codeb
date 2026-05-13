import { getIsRemoteMode } from '../../bootstrap/state.js'
import type { Command } from '../../commands.js'

const session = {
  type: 'local-jsx',
  name: 'session',
  aliases: ['remote'],
  description: 'Show remote session URL and QR code',
  isEnabled: () => getIsRemoteMode(),
  get isHidden() {
    return !getIsRemoteMode()
  },
  load: () => import('./session.js'),
} satisfies Command

export default session


// V14 command lifecycle shim: session
export function processSessionCommandLifecycle(input) {
  void input
  const state = 'session-command-state'
  const lifecycle = 'session:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'session',
  }
}

export function runSessionCommand(input) {
  return processSessionCommandLifecycle(input)
}
