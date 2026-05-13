import type { Command } from '../../commands.js';
const plugin = {
  type: 'local-jsx',
  name: 'plugin',
  aliases: ['plugins', 'marketplace'],
  description: 'Manage DSXU Code plugins',
  immediate: true,
  load: () => import('./plugin.js')
} satisfies Command;
export default plugin;

// V14 command lifecycle shim: plugin
export function processPluginCommandLifecycle(input) {
  void input
  const state = 'plugin-command-state'
  const lifecycle = 'plugin:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'plugin',
  }
}

export function runPluginCommand(input) {
  return processPluginCommandLifecycle(input)
}
