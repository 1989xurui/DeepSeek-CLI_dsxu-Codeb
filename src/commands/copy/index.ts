/**
 * Copy command - minimal metadata only.
 * Implementation is lazy-loaded from copy.tsx to reduce startup time.
 */
import type { Command } from '../../commands.js'

const copy = {
  type: 'local-jsx',
  name: 'copy',
  description:
    "Copy DSXU's last response to clipboard (or /copy N for the Nth-latest)",
  load: () => import('./copy.js'),
} satisfies Command

export default copy


// V14 command lifecycle shim: copy
export function processCopyCommandLifecycle(input) {
  void input
  const state = 'copy-command-state'
  const lifecycle = 'copy:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'copy',
  }
}

export function runCopyCommand(input) {
  return processCopyCommandLifecycle(input)
}
