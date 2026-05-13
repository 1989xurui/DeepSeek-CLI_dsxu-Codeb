import type { Command } from '../../commands.js'

const hooks = {
  type: 'local-jsx',
  name: 'hooks',
  description: 'View hook configurations for tool events',
  immediate: true,
  load: () => import('./hooks.js'),
} satisfies Command

export default hooks


// V14 command lifecycle shim: hooks
export function processHooksCommandLifecycle(input) {
  void input
  const state = 'hooks-command-state'
  const lifecycle = 'hooks:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'hooks',
  }
}

export function runHooksCommand(input) {
  return processHooksCommandLifecycle(input)
}
