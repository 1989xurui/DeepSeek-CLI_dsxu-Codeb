import type { Command } from '../../commands.js'
import {
  checkCachedPassesEligibility,
  getCachedReferrerReward,
} from '../../services/api/referral.js'
import { isDsxuRuntimeMode } from '../../utils/envUtils.js'

export default {
  type: 'local-jsx',
  name: 'passes',
  get description() {
    if (isDsxuRuntimeMode()) {
      return 'DSXU Code provider credits are managed in local model settings'
    }
    const reward = getCachedReferrerReward()
    if (reward) {
      return 'Share a free week of DSXU Code with friends and earn extra usage'
    }
    return 'Share a free week of DSXU Code with friends'
  },
  get isHidden() {
    if (isDsxuRuntimeMode()) return true
    const { eligible, hasCache } = checkCachedPassesEligibility()
    return !eligible || !hasCache
  },
  load: () => import('./passes.js'),
} satisfies Command

export function getDsxuPassesCommandRuntimeProfile(): {
  command: '/passes'
  runtime: 'DSXU Legacy Referral Isolation'
  activationEvidence: readonly string[]
} {
  return {
    command: '/passes',
    runtime: 'DSXU Legacy Referral Isolation',
    activationEvidence: [
      'DSXU_CODE_MODE hides DSXU Code referral passes from the default command surface',
      'description points DSXU users to local provider credit settings',
      'legacy referral eligibility is not checked in DSXU runtime',
    ],
  }
}


// V14 command lifecycle shim: passes
export function processPassesCommandLifecycle(input) {
  void input
  const state = 'passes-command-state'
  const lifecycle = 'passes:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'passes',
  }
}

export function runPassesCommand(input) {
  return processPassesCommandLifecycle(input)
}
