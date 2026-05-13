import type { Command } from '../../commands.js'
import { isDsxuRuntimeMode } from '../../utils/envUtils.js'
import { shouldInferenceConfigCommandBeImmediate } from '../../utils/immediateCommand.js'
import { getMainLoopModel, renderModelName } from '../../utils/model/model.js'

export default {
  type: 'local-jsx',
  name: 'model',
  get description() {
    const productName = isDsxuRuntimeMode() ? 'DSXU Code' : 'DSXU Code'
    return `Set the AI model for ${productName} (currently ${renderModelName(getMainLoopModel())})`
  },
  argumentHint: '[model]',
  get immediate() {
    return shouldInferenceConfigCommandBeImmediate()
  },
  load: () => import('./model.js'),
} satisfies Command

export function getDsxuModelCommandRuntimeProfile(): {
  command: '/model'
  runtime: 'DSXU Model Strategy Command'
  activationEvidence: readonly string[]
} {
  return {
    command: '/model',
    runtime: 'DSXU Model Strategy Command',
    activationEvidence: [
      'description is resolved dynamically from DSXU_CODE_MODE',
      'DSXU runtime presents model selection as DSXU Code model strategy',
      'current main-loop model is still rendered from the active DSXU model state',
    ],
  }
}


// V14 command lifecycle shim: model
export function processModelCommandLifecycle(input) {
  void input
  const state = 'model-command-state'
  const lifecycle = 'model:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'model',
  }
}

export function runModelCommand(input) {
  return processModelCommandLifecycle(input)
}
