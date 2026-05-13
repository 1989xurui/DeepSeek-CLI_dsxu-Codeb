import { LEGACY_CLOUD_AVAILABILITY, type Command } from '../../types/command.js'

export default {
  type: 'local-jsx',
  name: 'usage',
  description: 'Show legacy plan usage limits',
  // DSXU usage is handled by the local provider usage/cost path.
  availability: [LEGACY_CLOUD_AVAILABILITY],
  load: () => import('./usage.js'),
} satisfies Command


// V14 command lifecycle shim: usage
export function processUsageCommandLifecycle(input) {
  void input
  const state = 'usage-command-state'
  const lifecycle = 'usage:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'usage',
  }
}

export function runUsageCommand(input) {
  return processUsageCommandLifecycle(input)
}
