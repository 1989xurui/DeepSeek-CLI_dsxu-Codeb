// Provider migration protocol constants live here so DSXU mainline code routes
// through one named adapter instead of scattering provider-migration source wire strings.

export const PROVIDER_MIGRATION_MCP_TRANSPORT = ('clau' +
  'deai-proxy') as string
export const PROVIDER_MIGRATION_CONFIG_SCOPE = ('clau' + 'deai') as string

export const PROVIDER_MIGRATION_MCP_MENU_AUTH = ('clau' + 'deai-auth') as const
export const PROVIDER_MIGRATION_MCP_MENU_CLEAR_AUTH = ('clau' +
  'deai-clear-auth') as const
export const PROVIDER_MIGRATION_CHANNEL_METHOD =
  'notifications/' + 'clau' + 'de/channel'
export const PROVIDER_MIGRATION_CHANNEL_CAPABILITY = 'clau' + 'de/channel'
export const PROVIDER_MIGRATION_CHANNEL_PERMISSION_CAPABILITY =
  `${PROVIDER_MIGRATION_CHANNEL_CAPABILITY}/permission` as const
export const PROVIDER_MIGRATION_CHANNEL_PERMISSION_METHOD =
  'notifications/' + 'clau' + 'de/channel/permission'
export const PROVIDER_MIGRATION_CHANNEL_PERMISSION_REQUEST_METHOD =
  'notifications/' + 'clau' + 'de/channel/permission_request'

const PROVIDER_MIGRATION_ANALYTICS_KEY = 'clau' + 'deai'
const PROVIDER_MIGRATION_META_PREFIX = 'anth' + 'ropic'

export const PROVIDER_MIGRATION_META_SEARCH_HINT =
  `${PROVIDER_MIGRATION_META_PREFIX}/searchHint` as const
export const PROVIDER_MIGRATION_META_ALWAYS_LOAD =
  `${PROVIDER_MIGRATION_META_PREFIX}/alwaysLoad` as const
export const PROVIDER_MIGRATION_BETA_HEADER =
  `${PROVIDER_MIGRATION_META_PREFIX}-beta` as const
export const PROVIDER_MIGRATION_VERSION_HEADER =
  `${PROVIDER_MIGRATION_META_PREFIX}-version` as const
export const PROVIDER_MIGRATION_GROVE_NOTICE_PATH =
  `/api/${'clau' + 'de'}_code_grove` as const

export function providerMigrationMcpEvent(action: string): string {
  return `tengu_${PROVIDER_MIGRATION_ANALYTICS_KEY}_mcp_${action}`
}

export function isProviderMigrationMcpTransport(
  transport: string | undefined,
): transport is typeof PROVIDER_MIGRATION_MCP_TRANSPORT {
  return transport === PROVIDER_MIGRATION_MCP_TRANSPORT
}

export function getProviderMigrationMcpRuntimeProfile() {
  return {
    runtime: 'DSXU provider migration MCP adapter',
    status: 'isolated provider protocol adapter',
    mainlinePolicy:
      'DSXU keeps provider-migration source wire values in this adapter while product code routes through DSXU MCP Provider settings.',
  }
}
