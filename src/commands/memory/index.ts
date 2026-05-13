import type { Command } from '../../commands.js'

const memory: Command = {
  type: 'local-jsx',
  name: 'memory',
  description: 'Edit DSXU memory files',
  load: () => import('./memory.js'),
}

export default memory


// V14 command lifecycle shim: memory
export function processMemoryCommandLifecycle(input) {
  void input
  const state = 'memory-command-state'
  const lifecycle = 'memory:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'memory',
  }
}

export function runMemoryCommand(input) {
  return processMemoryCommandLifecycle(input)
}
