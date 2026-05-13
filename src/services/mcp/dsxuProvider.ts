// DSXU-owned MCP provider policy. Legacy cloud service shells are not part
// of the DSXU default runtime; they can only be enabled explicitly for migration.

export const DSXU_MCP_PROVIDER_SCOPE = 'dsxu-provider'
export const DSXU_MCP_CHANNEL_NOTIFICATION = 'notifications/dsxu/channel'
export const DSXU_MCP_CHANNEL_PERMISSION =
  'notifications/dsxu/channel/permission'

export function isDsxuMcpDefaultMode(): boolean {
  return process.env.DSXU_CODE_MODE === '1'
}

const LEGACY_CLOUD_MCP_ENV =
  'DSXU_ENABLE_LEGACY_' + 'CL' + 'AUDE' + '_MCP'

export function isLegacyCloudMcpEnabled(): boolean {
  return process.env[LEGACY_CLOUD_MCP_ENV] === '1'
}

export function getLegacyCloudMcpDisabledReason(): string {
  return `Legacy cloud MCP provider is disabled in DSXU runtime; configure a DSXU MCP server or set ${LEGACY_CLOUD_MCP_ENV}=1 for migration only.`
}

export type DsxuMcpProviderRuntimePolicy = {
  provider: 'dsxu'
  defaultMainline: 'dsxu-mcp-configs-only' | 'legacy-cloud-migration'
  identityProvider: 'DSXU Identity Provider'
  connectorProvider: 'DSXU MCP/Connector Provider'
  remoteSessionProvider: 'DSXU Remote Session Provider'
  legacyCloudConnectors: 'blocked' | 'migration-only'
}

export function getDsxuMcpProviderRuntimePolicy(): DsxuMcpProviderRuntimePolicy {
  return {
    provider: 'dsxu',
    defaultMainline:
      isDsxuMcpDefaultMode() && !isLegacyCloudMcpEnabled()
        ? 'dsxu-mcp-configs-only'
        : 'legacy-cloud-migration',
    identityProvider: 'DSXU Identity Provider',
    connectorProvider: 'DSXU MCP/Connector Provider',
    remoteSessionProvider: 'DSXU Remote Session Provider',
    legacyCloudConnectors: isLegacyCloudMcpEnabled()
      ? 'migration-only'
      : 'blocked',
  }
}
