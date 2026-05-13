import type { Command } from '../../commands.js'
import { checkStatsigFeatureGate_CACHED_MAY_BE_STALE } from '../../services/analytics/growthbook.js'

const thinkback = {
  type: 'local-jsx',
  name: 'think-back',
  description: 'Your 2025 DSXU Code Year in Review',
  isEnabled: () =>
    checkStatsigFeatureGate_CACHED_MAY_BE_STALE('tengu_thinkback'),
  load: () => import('./thinkback.js'),
} satisfies Command

export default thinkback


// V14 command lifecycle shim: thinkback
export function processThinkbackCommandLifecycle(input) {
  void input
  const state = 'thinkback-command-state'
  const lifecycle = 'thinkback:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'thinkback',
  }
}

export function runThinkbackCommand(input) {
  return processThinkbackCommandLifecycle(input)
}
