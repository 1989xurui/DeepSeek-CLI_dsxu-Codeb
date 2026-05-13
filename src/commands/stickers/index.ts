import type { Command } from '../../commands.js'
import { isDsxuRuntimeMode } from '../../utils/envUtils.js'

const stickers = {
  type: 'local',
  name: 'stickers',
  get description() {
    return isDsxuRuntimeMode()
      ? 'DSXU Code stickers are not part of the local runtime'
      : 'Order DSXU Code stickers'
  },
  get isHidden() {
    return isDsxuRuntimeMode()
  },
  supportsNonInteractive: false,
  load: () => import('./stickers.js'),
} satisfies Command

export default stickers

export function getDsxuStickersCommandRuntimeProfile(): {
  command: '/stickers'
  runtime: 'DSXU Legacy Merch Isolation'
  activationEvidence: readonly string[]
} {
  return {
    command: '/stickers',
    runtime: 'DSXU Legacy Merch Isolation',
    activationEvidence: [
      'DSXU_CODE_MODE hides DSXU Code merchandise from the command surface',
      'description no longer invites DSXU users to order DSXU Code stickers',
      'command remains available only in legacy non-DSXU runtime',
    ],
  }
}


// V14 command lifecycle shim: stickers
export function processStickersCommandLifecycle(input) {
  void input
  const state = 'stickers-command-state'
  const lifecycle = 'stickers:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'stickers',
  }
}

export function runStickersCommand(input) {
  return processStickersCommandLifecycle(input)
}
