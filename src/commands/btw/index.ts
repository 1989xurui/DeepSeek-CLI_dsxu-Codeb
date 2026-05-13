import type { Command } from '../../commands.js'

const btw = {
  type: 'local-jsx',
  name: 'btw',
  description:
    'Ask a quick side question without interrupting the main conversation',
  immediate: true,
  argumentHint: '<question>',
  load: () => import('./btw.js'),
} satisfies Command

export default btw


// V14 command lifecycle shim: btw
export function processBtwCommandLifecycle(input) {
  void input
  const state = 'btw-command-state'
  const lifecycle = 'btw:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'btw',
  }
}

export function runBtwCommand(input) {
  return processBtwCommandLifecycle(input)
}
