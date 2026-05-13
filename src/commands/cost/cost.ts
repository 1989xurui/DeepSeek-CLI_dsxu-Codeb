import { formatTotalCost } from '../../cost-tracker.js'
import { currentLimits } from '../../services/dsxuLimits.js'
import type { LocalCommandCall } from '../../types/command.js'
import { isLegacyCloudSubscriber } from '../../utils/auth.js'
import { isDsxuRuntimeMode } from '../../utils/envUtils.js'

export const call: LocalCommandCall = async () => {
  if (isDsxuRuntimeMode()) {
    return {
      type: 'text',
      value: `DSXU Code cost so far:\n${formatTotalCost()}`,
    }
  }

  if (isLegacyCloudSubscriber()) {
    let value: string

    if (currentLimits.isUsingOverage) {
      value =
        'You are currently using your overages to power your DSXU Code usage. We will automatically switch you back to your subscription rate limits when they reset'
    } else {
      value =
        'You are currently using your subscription to power your DSXU Code usage'
    }

    if (process.env.USER_TYPE === 'ant') {
      value += `\n\n[ANT-ONLY] Showing cost anyway:\n ${formatTotalCost()}`
    }
    return { type: 'text', value }
  }
  return { type: 'text', value: formatTotalCost() }
}

export function getDsxuCostCommandRuntimeProfile(): {
  command: '/cost'
  runtime: 'DSXU Cost Ledger'
  defaultProvider: 'DSXU/DeepSeek'
  activationEvidence: readonly string[]
  legacyIsolation: readonly string[]
} {
  return {
    command: '/cost',
    runtime: 'DSXU Cost Ledger',
    defaultProvider: 'DSXU/DeepSeek',
    activationEvidence: [
      'DSXU_CODE_MODE returns local DSXU cost text before legacy subscription checks',
      'formatTotalCost remains the single session cost source',
      'Legacy cloud subscriber limit messaging is bypassed in DSXU runtime',
    ],
    legacyIsolation: [
      'DsxuLimits is read only in non-DSXU legacy command mode',
      'legacy cloud subscriber state is not consulted for DSXU cost output',
    ],
  }
}

// V14 lifecycle shim: cost
export function processCostLifecycle(input) {
  void input
  const state = 'cost-state'
  const lifecycle = 'cost:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
