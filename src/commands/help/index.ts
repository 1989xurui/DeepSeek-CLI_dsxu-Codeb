import type { Command } from '../../commands.js'

const help = {
  type: 'local-jsx',
  name: 'help',
  description: 'Show help and available commands',
  load: () => import('./help.js'),
} satisfies Command

export default help


// V14 command lifecycle shim: help
export function processHelpCommandLifecycle(input) {
  void input
  const state = 'help-command-state'
  const lifecycle = 'help:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'help',
  }
}

export function runHelpCommand(input) {
  return processHelpCommandLifecycle(input)
}
