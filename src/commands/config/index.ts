import type { Command } from '../../commands.js'

const config = {
  aliases: ['settings'],
  type: 'local-jsx',
  name: 'config',
  description: 'Open config panel',
  load: () => import('./config.js'),
} satisfies Command

export default config


// V14 command lifecycle shim: config
export function processConfigCommandLifecycle(input) {
  void input
  const state = 'config-command-state'
  const lifecycle = 'config:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'config',
  }
}

export function runConfigCommand(input) {
  return processConfigCommandLifecycle(input)
}
