import type { Command } from '../../commands.js'

const command = {
  name: 'vim',
  description: 'Toggle between Vim and Normal editing modes',
  supportsNonInteractive: false,
  type: 'local',
  load: () => import('./vim.js'),
} satisfies Command

export default command


// V14 command lifecycle shim: vim
export function processVimCommandLifecycle(input) {
  void input
  const state = 'vim-command-state'
  const lifecycle = 'vim:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'vim',
  }
}

export function runVimCommand(input) {
  return processVimCommandLifecycle(input)
}
