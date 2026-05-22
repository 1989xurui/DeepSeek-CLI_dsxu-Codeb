import { c as _c } from 'react/compiler-runtime'
import { useEffect } from 'react'
import { useNotifications } from 'src/context/notifications.js'
import { getIsRemoteMode } from '../../bootstrap/state.js'
import {
  ARCHIVED_MCP_TRANSPORT,
} from '../../constants/providerMigrationProtocol.js'
import { Text } from '../../ink.js'
import { hasArchivedMcpEverConnected } from '../../services/mcp/providerConnectorMigration.js'
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
      const failedArchivedClients = mcpClients.filter(isFailedArchivedClient)
      const needsAuthLocalServers = mcpClients.filter(isNeedsAuthLocalServer)
      const needsAuthArchivedServers = mcpClients.filter(
        isNeedsAuthArchivedServer,
      )

      if (
        failedLocalClients.length === 0 &&
        failedArchivedClients.length === 0 &&
        needsAuthLocalServers.length === 0 &&
        needsAuthArchivedServers.length === 0
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

      if (failedArchivedClients.length > 0) {
        addNotification({
          key: 'mcp-archived-connector-failed',
          jsx: (
            <>
              <Text color="error">
                {failedArchivedClients.length} archived{' '}
                {failedArchivedClients.length === 1
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

      if (needsAuthArchivedServers.length > 0) {
        addNotification({
          key: 'mcp-archived-connector-needs-auth',
          jsx: (
            <>
              <Text color="warning">
                {needsAuthArchivedServers.length} archived{' '}
                {needsAuthArchivedServers.length === 1
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

function isNeedsAuthArchivedServer(client: MCPServerConnection): boolean {
  return (
    client.type === 'needs-auth' &&
    client.config.type === ARCHIVED_MCP_TRANSPORT &&
    hasArchivedMcpEverConnected(client.name)
  )
}

function isNeedsAuthLocalServer(client: MCPServerConnection): boolean {
  return (
    client.type === 'needs-auth' &&
    client.config.type !== ARCHIVED_MCP_TRANSPORT
  )
}

function isFailedArchivedClient(client: MCPServerConnection): boolean {
  return (
    client.type === 'failed' &&
    client.config.type === ARCHIVED_MCP_TRANSPORT &&
    hasArchivedMcpEverConnected(client.name)
  )
}

function isFailedLocalClient(client: MCPServerConnection): boolean {
  return (
    client.type === 'failed' &&
    client.config.type !== 'sse-ide' &&
    client.config.type !== 'ws-ide' &&
    client.config.type !== ARCHIVED_MCP_TRANSPORT
  )
}
