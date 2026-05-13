import type { Command } from '../../commands.js'

const mobile = {
  type: 'local-jsx',
  name: 'mobile',
  aliases: ['ios', 'android'],
  description: 'Legacy mobile app migration information',
  isHidden: true,
  load: () => import('./mobile.js'),
} satisfies Command

export default mobile


// V14 command lifecycle shim: mobile
export function processMobileCommandLifecycle(input) {
  void input
  const state = 'mobile-command-state'
  const lifecycle = 'mobile:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'mobile',
  }
}

export function runMobileCommand(input) {
  return processMobileCommandLifecycle(input)
}
