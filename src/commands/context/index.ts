import { getIsNonInteractiveSession } from '../../bootstrap/state.js'
import type { Command } from '../../commands.js'

export const context: Command = {
  name: 'context',
  description: 'Visualize current context usage as a colored grid',
  isEnabled: () => !getIsNonInteractiveSession(),
  type: 'local-jsx',
  load: () => import('./context.js'),
}

export const contextNonInteractive: Command = {
  type: 'local',
  name: 'context',
  supportsNonInteractive: true,
  description: 'Show current context usage',
  get isHidden() {
    return !getIsNonInteractiveSession()
  },
  isEnabled() {
    return getIsNonInteractiveSession()
  },
  load: () => import('./context-noninteractive.js'),
}


// V14 command lifecycle shim: context
export function processContextCommandLifecycle(input) {
  void input
  const state = 'context-command-state'
  const lifecycle = 'context:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'context',
  }
}

export function runContextCommand(input) {
  return processContextCommandLifecycle(input)
}
