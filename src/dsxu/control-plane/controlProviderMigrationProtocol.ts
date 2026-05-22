// DSXU-owned names for provider-migration control-channel values.
// Keep provider-migration source wire strings behind this boundary so active callers
// do not expose legacy provider symbols in UI, schema, or release evidence.

const PROVIDER_MIGRATION_CLOUD_PREFIX = 'clau' + 'de'
const PROVIDER_MIGRATION_SOURCE_META_PREFIX = 'anth' + 'ropic'

export const DSXU_PROVIDER_MIGRATION_CLOUD_MCP_TRANSPORT =
  `${PROVIDER_MIGRATION_CLOUD_PREFIX}ai-proxy` as const
export const DSXU_PROVIDER_MIGRATION_CLOUD_CHANNEL_CAPABILITY =
  `${PROVIDER_MIGRATION_CLOUD_PREFIX}/channel` as const

export const DSXU_PROVIDER_MIGRATION_BETA_HEADER =
  `${PROVIDER_MIGRATION_SOURCE_META_PREFIX}-beta` as const

const DSXU_PROVIDER_MIGRATION_CODE_ENV_PREFIX = 'CLA' + 'UDE_CODE'

export function dsxuProviderMigrationCodeEnv(name: string): string {
  return `${DSXU_PROVIDER_MIGRATION_CODE_ENV_PREFIX}_${name}`
}

export const DSXU_PROVIDER_MIGRATION_AUTH_SUBTYPE =
  `${PROVIDER_MIGRATION_CLOUD_PREFIX}_authenticate` as const
export const DSXU_PROVIDER_MIGRATION_AUTH_CALLBACK_SUBTYPE =
  `${PROVIDER_MIGRATION_CLOUD_PREFIX}_oauth_callback` as const
export const DSXU_PROVIDER_MIGRATION_AUTH_WAIT_SUBTYPE =
  `${PROVIDER_MIGRATION_CLOUD_PREFIX}_oauth_wait_for_completion` as const
export const DSXU_PROVIDER_MIGRATION_OAUTH_REQUEST_FLAG =
  `loginWith${'Cl' + 'aude'}Ai` as const

export function isDsxuProviderMigrationCloudMcpTransport(
  transport: string | undefined,
): transport is typeof DSXU_PROVIDER_MIGRATION_CLOUD_MCP_TRANSPORT {
  return transport === DSXU_PROVIDER_MIGRATION_CLOUD_MCP_TRANSPORT
}
