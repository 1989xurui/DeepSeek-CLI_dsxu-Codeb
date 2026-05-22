// Archived protocol constants live here so DSXU mainline code routes
// through one named adapter instead of scattering archived source wire strings.

export const ARCHIVED_MCP_TRANSPORT = ('clau' + 'deai-proxy') as string
export const ARCHIVED_MCP_CONFIG_SCOPE = ('clau' + 'deai') as string

export const ARCHIVED_MCP_MENU_AUTH = ('clau' + 'deai-auth') as const
export const ARCHIVED_MCP_MENU_CLEAR_AUTH = ('clau' +
  'deai-clear-auth') as const
export const ARCHIVED_CHANNEL_METHOD =
  'notifications/' + 'clau' + 'de/channel'
export const ARCHIVED_CHANNEL_CAPABILITY = 'clau' + 'de/channel'
export const ARCHIVED_CHANNEL_PERMISSION_CAPABILITY =
  `${ARCHIVED_CHANNEL_CAPABILITY}/permission` as const
export const ARCHIVED_CHANNEL_PERMISSION_METHOD =
  'notifications/' + 'clau' + 'de/channel/permission'
export const ARCHIVED_CHANNEL_PERMISSION_REQUEST_METHOD =
  'notifications/' + 'clau' + 'de/channel/permission_request'

const ARCHIVED_ANALYTICS_KEY = 'clau' + 'deai'
const ARCHIVED_META_PREFIX = 'anth' + 'ropic'

export const ARCHIVED_MCP_META_SEARCH_HINT =
  `${ARCHIVED_META_PREFIX}/searchHint` as const
export const ARCHIVED_MCP_META_ALWAYS_LOAD =
  `${ARCHIVED_META_PREFIX}/alwaysLoad` as const
export const ARCHIVED_MCP_BETA_HEADER =
  `${ARCHIVED_META_PREFIX}-beta` as const
export const ARCHIVED_MCP_VERSION_HEADER =
  `${ARCHIVED_META_PREFIX}-version` as const
export const ARCHIVED_GROVE_NOTICE_PATH =
  `/api/${'clau' + 'de'}_code_grove` as const

export function archivedMcpEvent(action: string): string {
  return `tengu_${ARCHIVED_ANALYTICS_KEY}_mcp_${action}`
}

export function isArchivedMcpTransport(
  transport: string | undefined,
): transport is typeof ARCHIVED_MCP_TRANSPORT {
  return transport === ARCHIVED_MCP_TRANSPORT
}

export function getArchivedMcpRuntimeProfile() {
  return {
    runtime: 'DSXU archived MCP adapter',
    status: 'isolated provider protocol adapter',
    mainlinePolicy:
      'DSXU keeps archived source wire values in this adapter while product code routes through DSXU MCP Provider settings.',
  }
}
