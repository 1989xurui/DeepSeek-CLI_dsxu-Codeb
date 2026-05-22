import type { Command } from '../../commands.js'
import { isDsxuRuntimeMode } from '../../utils/envUtils.js'

const status = {
  type: 'local-jsx',
  name: 'status',
  get description() {
    return isDsxuRuntimeMode()
      ? 'Show DSXU Code status including version, model, account, API connectivity, and tool statuses'
      : 'Show DSXU Code status including version, model, account, API connectivity, and tool statuses'
  },
  immediate: true,
  load: () => import('./status.js'),
} satisfies Command

export default status

export function getDsxuStatusCommandRuntimeProfile(): {
  command: '/status'
  runtime: 'DSXU Status Command'
  activationEvidence: readonly string[]
} {
  return {
    command: '/status',
    runtime: 'DSXU Status Command',
    activationEvidence: [
      'description is resolved dynamically from DSXU_CODE_MODE',
      'DSXU runtime no longer presents DSXU Code as the status surface',
      'command remains immediate for quick runtime health checks',
    ],
  }
}
