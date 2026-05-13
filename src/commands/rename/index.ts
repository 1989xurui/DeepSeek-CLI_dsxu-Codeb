import type { Command } from '../../commands.js'

const rename = {
  type: 'local-jsx',
  name: 'rename',
  description: 'Rename the current conversation',
  immediate: true,
  argumentHint: '[name]',
  load: () => import('./rename.js'),
} satisfies Command

export default rename


// V14 command lifecycle shim: rename
export function processRenameCommandLifecycle(input) {
  void input
  const state = 'rename-command-state'
  const lifecycle = 'rename:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'rename',
  }
}

export function runRenameCommand(input) {
  return processRenameCommandLifecycle(input)
}
