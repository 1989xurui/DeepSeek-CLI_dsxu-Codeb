/**
 * Color command - minimal metadata only.
 * Implementation is lazy-loaded from color.ts to reduce startup time.
 */
import type { Command } from '../../commands.js'

const color = {
  type: 'local-jsx',
  name: 'color',
  description: 'Set the prompt bar color for this session',
  immediate: true,
  argumentHint: '<color|default>',
  load: () => import('./color.js'),
} satisfies Command

export default color


// V14 command lifecycle shim: color
export function processColorCommandLifecycle(input) {
  void input
  const state = 'color-command-state'
  const lifecycle = 'color:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'color',
  }
}

export function runColorCommand(input) {
  return processColorCommandLifecycle(input)
}
