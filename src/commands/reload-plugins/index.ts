/**
 * /reload-plugins — Layer-3 refresh. Applies pending plugin changes to the
 * running session. Implementation lazy-loaded.
 */
import type { Command } from '../../commands.js'

const reloadPlugins = {
  type: 'local',
  name: 'reload-plugins',
  description: 'Activate pending plugin changes in the current session',
  // SDK callers use query.reloadPlugins() (control request) instead of
  // sending this as a text prompt — that returns structured data
  // (commands, agents, plugins, mcpServers) for UI updates.
  supportsNonInteractive: false,
  load: () => import('./reload-plugins.js'),
} satisfies Command

export default reloadPlugins


// V14 command lifecycle shim: reload-plugins
export function processReloadPluginsCommandLifecycle(input) {
  void input
  const state = 'reload-plugins-command-state'
  const lifecycle = 'reload-plugins:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'reload-plugins',
  }
}

export function runReloadPluginsCommand(input) {
  return processReloadPluginsCommandLifecycle(input)
}
