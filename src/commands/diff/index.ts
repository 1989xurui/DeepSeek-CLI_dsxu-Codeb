import type { Command } from '../../commands.js'

export default {
  type: 'local-jsx',
  name: 'diff',
  description: 'View uncommitted changes and per-turn diffs',
  load: () => import('./diff.js'),
} satisfies Command


// V14 command lifecycle shim: diff
export function processDiffCommandLifecycle(input) {
  void input
  const state = 'diff-command-state'
  const lifecycle = 'diff:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'diff',
  }
}

export function runDiffCommand(input) {
  return processDiffCommandLifecycle(input)
}
