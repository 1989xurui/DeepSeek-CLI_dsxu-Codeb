import type { Command } from '../../commands.js'
import { shouldInferenceConfigCommandBeImmediate } from '../../utils/immediateCommand.js'

export default {
  type: 'local-jsx',
  name: 'effort',
  description: 'Set effort level for model usage',
  argumentHint: '[low|medium|high|max|auto]',
  get immediate() {
    return shouldInferenceConfigCommandBeImmediate()
  },
  load: () => import('./effort.js'),
} satisfies Command


// V14 command lifecycle shim: effort
export function processEffortCommandLifecycle(input) {
  void input
  const state = 'effort-command-state'
  const lifecycle = 'effort:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'effort',
  }
}

export function runEffortCommand(input) {
  return processEffortCommandLifecycle(input)
}
