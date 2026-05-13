import type { Command } from '../../commands.js'
import { isDsxuRuntimeMode } from '../../utils/envUtils.js'

const stats = {
  type: 'local-jsx',
  name: 'stats',
  get description() {
    return isDsxuRuntimeMode()
      ? 'Show your DSXU Code usage statistics and activity'
      : 'Show your DSXU Code usage statistics and activity'
  },
  load: () => import('./stats.js'),
} satisfies Command

export default stats

export function getDsxuStatsCommandRuntimeProfile(): {
  command: '/stats'
  runtime: 'DSXU Usage Statistics Command'
  activationEvidence: readonly string[]
} {
  return {
    command: '/stats',
    runtime: 'DSXU Usage Statistics Command',
    activationEvidence: [
      'description is resolved dynamically from DSXU_CODE_MODE',
      'DSXU runtime no longer presents DSXU Code as the usage-statistics product',
      'command remains on the local JSX stats path',
    ],
  }
}


// V14 command lifecycle shim: stats
export function processStatsCommandLifecycle(input) {
  void input
  const state = 'stats-command-state'
  const lifecycle = 'stats:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'stats',
  }
}

export function runStatsCommand(input) {
  return processStatsCommandLifecycle(input)
}
