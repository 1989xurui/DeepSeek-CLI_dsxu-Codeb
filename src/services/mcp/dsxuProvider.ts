// DSXU-owned MCP provider policy. Archived service shells are not part
// of the DSXU default runtime; they can only be enabled explicitly as archived overrides.

export const DSXU_MCP_PROVIDER_SCOPE = 'dsxu-provider'
export const DSXU_MCP_CHANNEL_NOTIFICATION = 'notifications/dsxu/channel'
export const DSXU_MCP_CHANNEL_PERMISSION =
  'notifications/dsxu/channel/permission'

export function isDsxuMcpDefaultMode(): boolean {
  return process.env.DSXU_CODE_MODE === '1'
}

const ARCHIVED_MCP_ENV = 'DSXU_ENABLE_PROVIDER_MIGRATION_MCP'

export function isArchivedMcpEnabled(): boolean {
  return process.env[ARCHIVED_MCP_ENV] === '1'
}

export function getArchivedMcpDisabledReason(): string {
  return `Archived MCP provider is disabled in DSXU runtime; configure a DSXU MCP server or set ${ARCHIVED_MCP_ENV}=1 for archived override work only.`
}

export type DsxuMcpProviderRuntimePolicy = {
  provider: 'dsxu'
  defaultMainline: 'dsxu-mcp-configs-only' | 'archived-override'
  identityProvider: 'DSXU Identity Provider'
  connectorProvider: 'DSXU MCP/Connector Provider'
  remoteSessionProvider: 'DSXU Remote Session Provider'
  archivedConnectors: 'blocked' | 'archived-override-only'
}

export function getDsxuMcpProviderRuntimePolicy(): DsxuMcpProviderRuntimePolicy {
  return {
    provider: 'dsxu',
    defaultMainline:
      isDsxuMcpDefaultMode() && !isArchivedMcpEnabled()
        ? 'dsxu-mcp-configs-only'
        : 'archived-override',
    identityProvider: 'DSXU Identity Provider',
    connectorProvider: 'DSXU MCP/Connector Provider',
    remoteSessionProvider: 'DSXU Remote Session Provider',
    archivedConnectors: isArchivedMcpEnabled()
      ? 'archived-override-only'
      : 'blocked',
  }
}
