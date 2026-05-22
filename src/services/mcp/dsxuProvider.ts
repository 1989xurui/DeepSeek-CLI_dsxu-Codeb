// DSXU-owned MCP provider policy. Provider migration service shells are not part
// of the DSXU default runtime; they can only be enabled explicitly for migration.

export const DSXU_MCP_PROVIDER_SCOPE = 'dsxu-provider'
export const DSXU_MCP_CHANNEL_NOTIFICATION = 'notifications/dsxu/channel'
export const DSXU_MCP_CHANNEL_PERMISSION =
  'notifications/dsxu/channel/permission'

export function isDsxuMcpDefaultMode(): boolean {
  return process.env.DSXU_CODE_MODE === '1'
}

const PROVIDER_MIGRATION_MCP_ENV = 'DSXU_ENABLE_PROVIDER_MIGRATION_MCP'

export function isProviderMigrationMcpEnabled(): boolean {
  return process.env[PROVIDER_MIGRATION_MCP_ENV] === '1'
}

export function getProviderMigrationMcpDisabledReason(): string {
  return `Provider migration MCP provider is disabled in DSXU runtime; configure a DSXU MCP server or set ${PROVIDER_MIGRATION_MCP_ENV}=1 for migration only.`
}

export type DsxuMcpProviderRuntimePolicy = {
  provider: 'dsxu'
  defaultMainline: 'dsxu-mcp-configs-only' | 'provider-migration'
  identityProvider: 'DSXU Identity Provider'
  connectorProvider: 'DSXU MCP/Connector Provider'
  remoteSessionProvider: 'DSXU Remote Session Provider'
  providerMigrationConnectors: 'blocked' | 'migration-only'
}

export function getDsxuMcpProviderRuntimePolicy(): DsxuMcpProviderRuntimePolicy {
  return {
    provider: 'dsxu',
    defaultMainline:
      isDsxuMcpDefaultMode() && !isProviderMigrationMcpEnabled()
        ? 'dsxu-mcp-configs-only'
        : 'provider-migration',
    identityProvider: 'DSXU Identity Provider',
    connectorProvider: 'DSXU MCP/Connector Provider',
    remoteSessionProvider: 'DSXU Remote Session Provider',
    providerMigrationConnectors: isProviderMigrationMcpEnabled()
      ? 'migration-only'
      : 'blocked',
  }
}
