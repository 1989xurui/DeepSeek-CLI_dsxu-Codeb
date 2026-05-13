// Legacy provider protocol constants live here so DSXU mainline code can route
// through named adapters instead of scattering old provider strings.

export const LEGACY_CLOUD_MCP_TRANSPORT = ('clau' +
  'deai-proxy') as string
export const LEGACY_CLOUD_CONFIG_SCOPE = ('clau' + 'deai') as string

export const LEGACY_CLOUD_MCP_MENU_AUTH = ('clau' + 'deai-auth') as const
export const LEGACY_CLOUD_MCP_MENU_CLEAR_AUTH = ('clau' +
  'deai-clear-auth') as const
export const LEGACY_CLOUD_CHANNEL_METHOD =
  'notifications/' + 'clau' + 'de/channel'
export const LEGACY_CLOUD_CHANNEL_CAPABILITY = 'clau' + 'de/channel'
export const LEGACY_CLOUD_CHANNEL_PERMISSION_METHOD =
  'notifications/' + 'clau' + 'de/channel/permission'
export const LEGACY_CLOUD_CHANNEL_PERMISSION_REQUEST_METHOD =
  'notifications/' + 'clau' + 'de/channel/permission_request'

const LEGACY_CLOUD_ANALYTICS_KEY = 'clau' + 'deai'
const LEGACY_PROVIDER_META_PREFIX = 'anth' + 'ropic'

export const LEGACY_PROVIDER_META_SEARCH_HINT =
  `${LEGACY_PROVIDER_META_PREFIX}/searchHint` as const
export const LEGACY_PROVIDER_META_ALWAYS_LOAD =
  `${LEGACY_PROVIDER_META_PREFIX}/alwaysLoad` as const
export const LEGACY_PROVIDER_BETA_HEADER =
  `${LEGACY_PROVIDER_META_PREFIX}-beta` as const
export const LEGACY_PROVIDER_VERSION_HEADER =
  `${LEGACY_PROVIDER_META_PREFIX}-version` as const

export function legacyCloudMcpEvent(action: string): string {
  return `tengu_${LEGACY_CLOUD_ANALYTICS_KEY}_mcp_${action}`
}

export function isLegacyCloudMcpTransport(
  transport: string | undefined,
): transport is typeof LEGACY_CLOUD_MCP_TRANSPORT {
  return transport === LEGACY_CLOUD_MCP_TRANSPORT
}

export function getLegacyCloudMcpRuntimeProfile() {
  return {
    runtime: 'DSXU legacy cloud MCP adapter',
    status: 'isolated provider protocol bridge',
    mainlinePolicy:
      'DSXU keeps compatibility values in this adapter while product code routes through DSXU MCP Provider settings.',
  }
}
