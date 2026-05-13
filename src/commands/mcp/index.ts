import type { Command } from '../../commands.js'

const mcp = {
  type: 'local-jsx',
  name: 'mcp',
  description: 'Manage MCP servers',
  immediate: true,
  argumentHint: '[enable|disable [server-name]]',
  load: () => import('./mcp.js'),
} satisfies Command

export default mcp


// V14 command lifecycle shim: mcp
export function processMcpCommandLifecycle(input) {
  void input
  const state = 'mcp-command-state'
  const lifecycle = 'mcp:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'mcp',
  }
}

export function runMcpCommand(input) {
  return processMcpCommandLifecycle(input)
}
