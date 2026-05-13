import type { LocalCommandCall } from '../../types/command.js'
import { clearConversation } from './conversation.js'

export const call: LocalCommandCall = async (_, context) => {
  await clearConversation(context)
  return { type: 'text', value: '' }
}


// V14 lifecycle shim: clear
export function processClearLifecycle(input) {
  void input
  const state = 'clear-state'
  const lifecycle = 'clear:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
