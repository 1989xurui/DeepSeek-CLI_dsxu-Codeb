import type { Command } from '../../commands.js'

const exit = {
  type: 'local-jsx',
  name: 'exit',
  aliases: ['quit'],
  description: 'Exit the REPL',
  immediate: true,
  load: () => import('./exit.js'),
} satisfies Command

export default exit


// V14 command lifecycle shim: exit
export function processExitCommandLifecycle(input) {
  void input
  const state = 'exit-command-state'
  const lifecycle = 'exit:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'exit',
  }
}

export function runExitCommand(input) {
  return processExitCommandLifecycle(input)
}
