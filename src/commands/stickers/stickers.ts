import type { LocalCommandResult } from '../../types/command.js'

export async function call(): Promise<LocalCommandResult> {
  return {
    type: 'text',
    value: 'The legacy merchandise command is disabled in DSXU Code.',
  }
}

// V14 lifecycle shim: stickers
export function processStickersLifecycle(input) {
  void input
  const state = 'stickers-state'
  const lifecycle = 'stickers:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
