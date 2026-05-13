import { c as _c } from 'react/compiler-runtime'
import { useEffect } from 'react'
import { useNotifications } from 'src/context/notifications.js'
import { getIsRemoteMode } from '../../bootstrap/state.js'
import { LEGACY_CLOUD_MCP_TRANSPORT } from '../../constants/legacyProviderProtocol.js'
import { Text } from '../../ink.js'
import { hasLegacyCloudMcpEverConnected } from '../../services/mcp/legacyRemoteMcpProvider.js'
import type { MCPServerConnection } from '../../services/mcp/types.js'

type Props = {
  mcpClients?: MCPServerConnection[]
}

const EMPTY_MCP_CLIENTS: MCPServerConnection[] = []

export function useMcpConnectivityStatus({
  mcpClients = EMPTY_MCP_CLIENTS,
}: Props): void {
  const $ = _c(4)
  const { addNotification } = useNotifications()
  let effect
  let deps
  if ($[0] !== addNotification || $[1] !== mcpClients) {
    effect = () => {
      if (getIsRemoteMode()) return

      const failedLocalClients = mcpClients.filter(isFailedLocalClient)
      const failedLegacyCloudClients = mcpClients.filter(isFailedLegacyCloudClient)
      const needsAuthLocalServers = mcpClients.filter(isNeedsAuthLocalServer)
      const needsAuthLegacyCloudServers = mcpClients.filter(
        isNeedsAuthLegacyCloudServer,
      )

      if (
        failedLocalClients.length === 0 &&
        failedLegacyCloudClients.length === 0 &&
        needsAuthLocalServers.length === 0 &&
        needsAuthLegacyCloudServers.length === 0
      ) {
        return
      }

      if (failedLocalClients.length > 0) {
        addNotification({
          key: 'mcp-failed',
          jsx: (
            <>
              <Text color="error">
                {failedLocalClients.length} MCP{' '}
                {failedLocalClients.length === 1 ? 'server' : 'servers'} failed
              </Text>
              <Text dimColor> /mcp</Text>
            </>
          ),
          priority: 'medium',
        })
      }

      if (failedLegacyCloudClients.length > 0) {
        addNotification({
          key: 'mcp-legacy-cloud-failed',
          jsx: (
            <>
              <Text color="error">
                {failedLegacyCloudClients.length} legacy cloud{' '}
                {failedLegacyCloudClients.length === 1
                  ? 'connector'
                  : 'connectors'}{' '}
                unavailable
              </Text>
              <Text dimColor> /mcp</Text>
            </>
          ),
          priority: 'medium',
        })
      }

      if (needsAuthLocalServers.length > 0) {
        addNotification({
          key: 'mcp-needs-auth',
          jsx: (
            <>
              <Text color="warning">
                {needsAuthLocalServers.length} MCP{' '}
                {needsAuthLocalServers.length === 1
                  ? 'server needs'
                  : 'servers need'}{' '}
                auth
              </Text>
              <Text dimColor> /mcp</Text>
            </>
          ),
          priority: 'medium',
        })
      }

      if (needsAuthLegacyCloudServers.length > 0) {
        addNotification({
          key: 'mcp-legacy-cloud-needs-auth',
          jsx: (
            <>
              <Text color="warning">
                {needsAuthLegacyCloudServers.length} legacy cloud{' '}
                {needsAuthLegacyCloudServers.length === 1
                  ? 'connector needs'
                  : 'connectors need'}{' '}
                auth
              </Text>
              <Text dimColor> /mcp</Text>
            </>
          ),
          priority: 'medium',
        })
      }
    }
    deps = [addNotification, mcpClients]
    $[0] = addNotification
    $[1] = mcpClients
    $[2] = effect
    $[3] = deps
  } else {
    effect = $[2]
    deps = $[3]
  }
  useEffect(effect, deps)
}

function isNeedsAuthLegacyCloudServer(client: MCPServerConnection): boolean {
  return (
    client.type === 'needs-auth' &&
    client.config.type === LEGACY_CLOUD_MCP_TRANSPORT &&
    hasLegacyCloudMcpEverConnected(client.name)
  )
}

function isNeedsAuthLocalServer(client: MCPServerConnection): boolean {
  return (
    client.type === 'needs-auth' &&
    client.config.type !== LEGACY_CLOUD_MCP_TRANSPORT
  )
}

function isFailedLegacyCloudClient(client: MCPServerConnection): boolean {
  return (
    client.type === 'failed' &&
    client.config.type === LEGACY_CLOUD_MCP_TRANSPORT &&
    hasLegacyCloudMcpEverConnected(client.name)
  )
}

function isFailedLocalClient(client: MCPServerConnection): boolean {
  return (
    client.type === 'failed' &&
    client.config.type !== 'sse-ide' &&
    client.config.type !== 'ws-ide' &&
    client.config.type !== LEGACY_CLOUD_MCP_TRANSPORT
  )
}

// V14 lifecycle shim: usemcpconnectivitystatus
export function processUsemcpconnectivitystatusLifecycle(input) {
  void input
  const state = 'usemcpconnectivitystatus-state'
  const lifecycle = 'usemcpconnectivitystatus:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
