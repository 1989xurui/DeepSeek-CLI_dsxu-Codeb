import type { Command } from '../../commands.js'

const outputStyle = {
  type: 'local-jsx',
  name: 'output-style',
  description: 'Deprecated: use /config to change output style',
  isHidden: true,
  load: () => import('./output-style.js'),
} satisfies Command

export default outputStyle


// V14 command lifecycle shim: output-style
export function processOutputStyleCommandLifecycle(input) {
  void input
  const state = 'output-style-command-state'
  const lifecycle = 'output-style:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'output-style',
  }
}

export function runOutputStyleCommand(input) {
  return processOutputStyleCommandLifecycle(input)
}
