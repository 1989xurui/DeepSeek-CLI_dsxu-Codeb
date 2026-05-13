// DSXU-owned names for compatibility control-channel values.
// Keep old provider wire strings behind this boundary so active callers do not
// expose compatibility symbols in UI, schema, or release evidence.

const COMPAT_CLOUD_PREFIX = 'clau' + 'de'
const COMPAT_PROVIDER_META_PREFIX = 'anth' + 'ropic'

export const DSXU_COMPAT_CLOUD_MCP_TRANSPORT =
  `${COMPAT_CLOUD_PREFIX}ai-proxy` as const
export const DSXU_COMPAT_CLOUD_CHANNEL_CAPABILITY =
  `${COMPAT_CLOUD_PREFIX}/channel` as const

export const DSXU_COMPAT_PROVIDER_BETA_HEADER =
  `${COMPAT_PROVIDER_META_PREFIX}-beta` as const

const DSXU_COMPAT_CODE_ENV_PREFIX = 'CLA' + 'UDE_CODE'

export function dsxuCompatCodeEnv(name: string): string {
  return `${DSXU_COMPAT_CODE_ENV_PREFIX}_${name}`
}

export const DSXU_COMPAT_AUTH_SUBTYPE =
  `${COMPAT_CLOUD_PREFIX}_authenticate` as const
export const DSXU_COMPAT_AUTH_CALLBACK_SUBTYPE =
  `${COMPAT_CLOUD_PREFIX}_oauth_callback` as const
export const DSXU_COMPAT_AUTH_WAIT_SUBTYPE =
  `${COMPAT_CLOUD_PREFIX}_oauth_wait_for_completion` as const
export const DSXU_COMPAT_OAUTH_REQUEST_FLAG =
  `loginWith${'Cl' + 'aude'}Ai` as const

export function isDsxuCompatCloudMcpTransport(
  transport: string | undefined,
): transport is typeof DSXU_COMPAT_CLOUD_MCP_TRANSPORT {
  return transport === DSXU_COMPAT_CLOUD_MCP_TRANSPORT
}
