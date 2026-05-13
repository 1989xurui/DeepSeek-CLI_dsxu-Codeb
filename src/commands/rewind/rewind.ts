import type { LocalCommandResult } from '../../commands.js'
import type { ToolUseContext } from '../../Tool.js'

export async function call(
  _args: string,
  context: ToolUseContext,
): Promise<LocalCommandResult> {
  if (context.openMessageSelector) {
    context.openMessageSelector()
  }
  // Return a skip message to not append any messages.
  return { type: 'skip' }
}


// V14 lifecycle shim: rewind
export function processRewindLifecycle(input) {
  void input
  const state = 'rewind-state'
  const lifecycle = 'rewind:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
