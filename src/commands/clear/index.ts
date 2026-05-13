/**
 * Clear command - minimal metadata only.
 * Implementation is lazy-loaded from clear.ts to reduce startup time.
 * Utility functions:
 * - clearSessionCaches: import from './clear/caches.js'
 * - clearConversation: import from './clear/conversation.js'
 */
import type { Command } from '../../commands.js'

const clear = {
  type: 'local',
  name: 'clear',
  description: 'Clear conversation history and free up context',
  aliases: ['reset', 'new'],
  supportsNonInteractive: false, // Should just create a new session
  load: () => import('./clear.js'),
} satisfies Command

export default clear


// V14 command lifecycle shim: clear
export function processClearCommandLifecycle(input) {
  void input
  const state = 'clear-command-state'
  const lifecycle = 'clear:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'clear',
  }
}

export function runClearCommand(input) {
  return processClearCommandLifecycle(input)
}
