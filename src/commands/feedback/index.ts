import type { Command } from '../../commands.js'
import { isPolicyAllowed } from '../../services/policyLimits/index.js'
import { isEnvTruthy } from '../../utils/envUtils.js'
import { isEssentialTrafficOnly } from '../../utils/privacyLevel.js'

const productName = 'DSXU Code'

const feedback = {
  aliases: ['bug'],
  type: 'local-jsx',
  name: 'feedback',
  description: `Submit feedback about ${productName}`,
  argumentHint: '[report]',
  isEnabled: () =>
    !(
      isEnvTruthy(process.env.DSXU_CODE_USE_BEDROCK) ||
      isEnvTruthy(process.env.DSXU_CODE_USE_VERTEX) ||
      isEnvTruthy(process.env.DSXU_CODE_USE_FOUNDRY) ||
      isEnvTruthy(process.env.DISABLE_FEEDBACK_COMMAND) ||
      isEnvTruthy(process.env.DISABLE_BUG_COMMAND) ||
      isEssentialTrafficOnly() ||
      process.env.USER_TYPE === 'ant' ||
      !isPolicyAllowed('allow_product_feedback')
    ),
  load: () => import('./feedback.js'),
} satisfies Command

export default feedback


// V14 command lifecycle shim: feedback
export function processFeedbackCommandLifecycle(input) {
  void input
  const state = 'feedback-command-state'
  const lifecycle = 'feedback:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'feedback',
  }
}

export function runFeedbackCommand(input) {
  return processFeedbackCommandLifecycle(input)
}
