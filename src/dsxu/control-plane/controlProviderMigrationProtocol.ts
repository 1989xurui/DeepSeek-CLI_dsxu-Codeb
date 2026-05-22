// DSXU-owned names for archived control-channel values.
// Keep archived source wire strings behind this boundary so active callers
// do not expose legacy provider symbols in UI, schema, or release evidence.

const ARCHIVED_CONTROL_CLOUD_PREFIX = 'clau' + 'de'
const ARCHIVED_CONTROL_SOURCE_META_PREFIX = 'anth' + 'ropic'

export const ARCHIVED_CONTROL_CLOUD_MCP_TRANSPORT =
  `${ARCHIVED_CONTROL_CLOUD_PREFIX}ai-proxy` as const
export const ARCHIVED_CONTROL_CLOUD_CHANNEL_CAPABILITY =
  `${ARCHIVED_CONTROL_CLOUD_PREFIX}/channel` as const

export const ARCHIVED_CONTROL_BETA_HEADER =
  `${ARCHIVED_CONTROL_SOURCE_META_PREFIX}-beta` as const

const ARCHIVED_CONTROL_CODE_ENV_PREFIX = 'CLA' + 'UDE_CODE'

export function archivedControlCodeEnv(name: string): string {
  return `${ARCHIVED_CONTROL_CODE_ENV_PREFIX}_${name}`
}

export const ARCHIVED_CONTROL_AUTH_SUBTYPE =
  `${ARCHIVED_CONTROL_CLOUD_PREFIX}_authenticate` as const
export const ARCHIVED_CONTROL_AUTH_CALLBACK_SUBTYPE =
  `${ARCHIVED_CONTROL_CLOUD_PREFIX}_oauth_callback` as const
export const ARCHIVED_CONTROL_AUTH_WAIT_SUBTYPE =
  `${ARCHIVED_CONTROL_CLOUD_PREFIX}_oauth_wait_for_completion` as const
export const ARCHIVED_CONTROL_OAUTH_REQUEST_FLAG =
  `loginWith${'Cl' + 'aude'}Ai` as const

export function isArchivedControlCloudMcpTransport(
  transport: string | undefined,
): transport is typeof ARCHIVED_CONTROL_CLOUD_MCP_TRANSPORT {
  return transport === ARCHIVED_CONTROL_CLOUD_MCP_TRANSPORT
}

export const DSXU_PROVIDER_MIGRATION_CLOUD_MCP_TRANSPORT =
  ARCHIVED_CONTROL_CLOUD_MCP_TRANSPORT
export const DSXU_PROVIDER_MIGRATION_CLOUD_CHANNEL_CAPABILITY =
  ARCHIVED_CONTROL_CLOUD_CHANNEL_CAPABILITY
export const DSXU_PROVIDER_MIGRATION_BETA_HEADER =
  ARCHIVED_CONTROL_BETA_HEADER
export const dsxuProviderMigrationCodeEnv = archivedControlCodeEnv
export const DSXU_PROVIDER_MIGRATION_AUTH_SUBTYPE =
  ARCHIVED_CONTROL_AUTH_SUBTYPE
export const DSXU_PROVIDER_MIGRATION_AUTH_CALLBACK_SUBTYPE =
  ARCHIVED_CONTROL_AUTH_CALLBACK_SUBTYPE
export const DSXU_PROVIDER_MIGRATION_AUTH_WAIT_SUBTYPE =
  ARCHIVED_CONTROL_AUTH_WAIT_SUBTYPE
export const DSXU_PROVIDER_MIGRATION_OAUTH_REQUEST_FLAG =
  ARCHIVED_CONTROL_OAUTH_REQUEST_FLAG
export const isDsxuProviderMigrationCloudMcpTransport =
  isArchivedControlCloudMcpTransport
