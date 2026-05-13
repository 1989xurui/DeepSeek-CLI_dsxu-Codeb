import type { Command } from '../../commands.js'

const theme = {
  type: 'local-jsx',
  name: 'theme',
  description: 'Change the theme',
  load: () => import('./theme.js'),
} satisfies Command

export default theme


// V14 command lifecycle shim: theme
export function processThemeCommandLifecycle(input) {
  void input
  const state = 'theme-command-state'
  const lifecycle = 'theme:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'theme',
  }
}

export function runThemeCommand(input) {
  return processThemeCommandLifecycle(input)
}
