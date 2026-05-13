import type { Command } from '../../commands.js'

const ide = {
  type: 'local-jsx',
  name: 'ide',
  description: 'Manage IDE integrations and show status',
  argumentHint: '[open]',
  load: () => import('./ide.js'),
} satisfies Command

export default ide


// V14 command lifecycle shim: ide
export function processIdeCommandLifecycle(input) {
  void input
  const state = 'ide-command-state'
  const lifecycle = 'ide:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'ide',
  }
}

export function runIdeCommand(input) {
  return processIdeCommandLifecycle(input)
}
