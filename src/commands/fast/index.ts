import type { Command } from '../../commands.js'
import {
  FAST_MODE_MODEL_DISPLAY,
  isFastModeEnabled,
} from '../../utils/fastMode.js'
import { shouldInferenceConfigCommandBeImmediate } from '../../utils/immediateCommand.js'

const fast = {
  type: 'local-jsx',
  name: 'fast',
  get description() {
    return `Toggle fast mode (${FAST_MODE_MODEL_DISPLAY} only)`
  },
  availability: ['dsxu', 'console'],
  isEnabled: () => isFastModeEnabled(),
  get isHidden() {
    return !isFastModeEnabled()
  },
  argumentHint: '[on|off]',
  get immediate() {
    return shouldInferenceConfigCommandBeImmediate()
  },
  load: () => import('./fast.js'),
} satisfies Command

export default fast


// V14 command lifecycle shim: fast
export function processFastCommandLifecycle(input) {
  void input
  const state = 'fast-command-state'
  const lifecycle = 'fast:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'fast',
  }
}

export function runFastCommand(input) {
  return processFastCommandLifecycle(input)
}
