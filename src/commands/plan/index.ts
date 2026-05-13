import type { Command } from '../../commands.js'

const plan = {
  type: 'local-jsx',
  name: 'plan',
  description: 'Enable plan mode or view the current session plan',
  argumentHint: '[open|<description>]',
  load: () => import('./plan.js'),
} satisfies Command

export default plan


// V14 command lifecycle shim: plan
export function processPlanCommandLifecycle(input) {
  void input
  const state = 'plan-command-state'
  const lifecycle = 'plan:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'plan',
  }
}

export function runPlanCommand(input) {
  return processPlanCommandLifecycle(input)
}
