export { MCPAgentServerMenu } from './MCPAgentServerMenu.js'
export { MCPListPanel } from './MCPListPanel.js'
export { MCPReconnect } from './MCPReconnect.js'
export { MCPRemoteServerMenu } from './MCPRemoteServerMenu.js'
export { MCPSettings } from './MCPSettings.js'
export { MCPStdioServerMenu } from './MCPStdioServerMenu.js'
export { MCPToolDetailView } from './MCPToolDetailView.js'
export { MCPToolListView } from './MCPToolListView.js'
export type { AgentMcpServerInfo, MCPViewState, ServerInfo } from './types.js'


// V14 strict lifecycle shim: components-mcp-index
export function processComponentsMcpIndexStrictLifecycle(input) {
  void input
  const state = 'components-mcp-index-state'
  const lifecycle = 'components-mcp-index:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runComponentsMcpIndexStrict(input) {
  return processComponentsMcpIndexStrictLifecycle(input)
}
