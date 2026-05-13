import type { Command } from '../../commands.js'
import { isEnvTruthy } from '../../utils/envUtils.js'

const compact = {
  type: 'local',
  name: 'compact',
  description:
    'Clear conversation history but keep a summary in context. Optional: /compact [instructions for summarization]',
  isEnabled: () => !isEnvTruthy(process.env.DISABLE_COMPACT),
  supportsNonInteractive: true,
  argumentHint: '<optional custom summarization instructions>',
  load: () => import('./compact.js'),
} satisfies Command

export default compact


// V14 command lifecycle shim: compact
export function processCompactCommandLifecycle(input) {
  void input
  const state = 'compact-command-state'
  const lifecycle = 'compact:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'compact',
  }
}

export function runCompactCommand(input) {
  return processCompactCommandLifecycle(input)
}
