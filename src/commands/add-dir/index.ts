import type { Command } from '../../commands.js'

const addDir = {
  type: 'local-jsx',
  name: 'add-dir',
  description: 'Add a new working directory',
  argumentHint: '<path>',
  load: () => import('./add-dir.js'),
} satisfies Command

export default addDir


// V14 command lifecycle shim: add-dir
export function processAddDirCommandLifecycle(input) {
  void input
  const state = 'add-dir-command-state'
  const lifecycle = 'add-dir:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'add-dir',
  }
}

export function runAddDirCommand(input) {
  return processAddDirCommandLifecycle(input)
}
