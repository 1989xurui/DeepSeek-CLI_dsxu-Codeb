import type { Command } from '../../commands.js'

const bridge = {
  type: 'local-jsx',
  name: 'remote-control',
  aliases: ['rc'],
  description: 'Archived remote-control alias handled by DSXU provider contract',
  argumentHint: '[name]',
  isEnabled: () => false,
  get isHidden() {
    return true
  },
  immediate: true,
  load: () => import('./bridge.js'),
} satisfies Command

export default bridge

export function processBridgeCommandLifecycle(input: unknown) {
  void input
  return {
    state: 'provider-alias-blocked',
    lifecycle: 'provider-alias:block-result',
    invoked: false,
    commandId: 'remote-control',
  }
}

export function runBridgeCommand(input: unknown) {
  return processBridgeCommandLifecycle(input)
}
