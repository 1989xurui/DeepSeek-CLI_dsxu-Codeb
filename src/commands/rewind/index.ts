import type { Command } from '../../commands.js'

const rewind = {
  description: `Restore the code and/or conversation to a previous point`,
  name: 'rewind',
  aliases: ['checkpoint'],
  argumentHint: '',
  type: 'local',
  supportsNonInteractive: false,
  load: () => import('./rewind.js'),
} satisfies Command

export default rewind


// V14 command lifecycle shim: rewind
export function processRewindCommandLifecycle(input) {
  void input
  const state = 'rewind-command-state'
  const lifecycle = 'rewind:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'rewind',
  }
}

export function runRewindCommand(input) {
  return processRewindCommandLifecycle(input)
}
