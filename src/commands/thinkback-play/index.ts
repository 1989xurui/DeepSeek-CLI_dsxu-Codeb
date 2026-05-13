import type { Command } from '../../commands.js'
import { checkStatsigFeatureGate_CACHED_MAY_BE_STALE } from '../../services/analytics/growthbook.js'

// Hidden command that just plays the animation
// Called by the thinkback skill after generation is complete
const thinkbackPlay = {
  type: 'local',
  name: 'thinkback-play',
  description: 'Play the thinkback animation',
  isEnabled: () =>
    checkStatsigFeatureGate_CACHED_MAY_BE_STALE('tengu_thinkback'),
  isHidden: true,
  supportsNonInteractive: false,
  load: () => import('./thinkback-play.js'),
} satisfies Command

export default thinkbackPlay


// V14 command lifecycle shim: thinkback-play
export function processThinkbackPlayCommandLifecycle(input) {
  void input
  const state = 'thinkback-play-command-state'
  const lifecycle = 'thinkback-play:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'thinkback-play',
  }
}

export function runThinkbackPlayCommand(input) {
  return processThinkbackPlayCommandLifecycle(input)
}
