import { getDsxuCodeEnv, isEnvTruthy } from 'src/utils/envUtils.js'

// Default to prod config, override with test/staging if enabled
type OauthConfigType = 'prod' | 'staging' | 'local'

const DSXU_CLI_APP_ID = 'dsxu-code'
const DSXU_CLI_API_PATH = 'dsxu_cli'
const DSXU_API_BASE_URL = 'https://api.dsxu.local'
const DSXU_CONSOLE_BASE_URL = 'https://console.dsxu.local'
const DSXU_REMOTE_BASE_URL = 'https://remote.dsxu.local'
const DSXU_MCP_PROXY_BASE_URL = 'https://mcp-proxy.dsxu.local'

const httpsUrl = (host: string, path = '') => `https://${host}${path}`
const apiOauthPath = (path: string) =>
  `/api/oauth/${DSXU_CLI_API_PATH}/${path}`
const appSuccessQuery = `app=${DSXU_CLI_APP_ID}`
const oauthSuccessPath = `/oauth/code/success?${appSuccessQuery}`

function getDsxuOauthUrl(envName: string, fallback: string): string {
  return (
    getDsxuCodeEnv(envName)?.replace(/\/$/, '') ??
    process.env[`DSXU_${envName}`]?.replace(/\/$/, '') ??
    fallback
  )
}

function getCustomOauthBaseUrl(): string | undefined {
  return getDsxuCodeEnv('CUSTOM_OAUTH_URL')
}

function getOauthClientIdOverride(): string | undefined {
  return getDsxuCodeEnv('OAUTH_CLIENT_ID')
}

function getLocalOauthEnv(name: 'API_BASE' | 'APPS_BASE' | 'CONSOLE_BASE') {
  return process.env[`DSXU_LOCAL_OAUTH_${name}`]
}

function getOauthConfigType(): OauthConfigType {
  const explicit = process.env.DSXU_OAUTH_CONFIG?.toLowerCase()
  if (explicit === 'local' || explicit === 'staging' || explicit === 'prod') {
    return explicit
  }
  if (isEnvTruthy(process.env.USE_LOCAL_OAUTH)) {
    return 'local'
  }
  if (isEnvTruthy(process.env.USE_STAGING_OAUTH)) {
    return 'staging'
  }
  return 'prod'
}

export function fileSuffixForOauthConfig(): string {
  if (getCustomOauthBaseUrl()) {
    return '-custom-oauth'
  }
  switch (getOauthConfigType()) {
    case 'local':
      return '-local-oauth'
    case 'staging':
      return '-staging-oauth'
    case 'prod':
      // No suffix for production config
      return ''
  }
}

export const REMOTE_SESSION_INFERENCE_SCOPE = 'user:inference' as const
export const REMOTE_SESSION_PROFILE_SCOPE = 'user:profile' as const
const CONSOLE_SCOPE = 'org:create_api_key' as const
export const DSXU_CONTROL_AUTH_BETA_HEADER = 'oauth-2025-04-20' as const

// Console OAuth scopes - for API key creation via Console
export const CONSOLE_OAUTH_SCOPES = [
  CONSOLE_SCOPE,
  REMOTE_SESSION_PROFILE_SCOPE,
] as const

// Remote-session OAuth scopes for archived subscriber sessions.
export const REMOTE_SESSION_OAUTH_SCOPES = [
  REMOTE_SESSION_PROFILE_SCOPE,
  REMOTE_SESSION_INFERENCE_SCOPE,
  `user:sessions:${DSXU_CLI_APP_ID}`,
  'user:mcp_servers',
  'user:file_upload',
] as const

// All OAuth scopes used by the compatibility login flow.
// Request all scopes to handle both Console and remote-session redirects.
// Ensure that `OAuthConsentPage` in apps repo is kept in sync with this list.
export const ALL_OAUTH_SCOPES = Array.from(
  new Set([...CONSOLE_OAUTH_SCOPES, ...REMOTE_SESSION_OAUTH_SCOPES]),
)

type OauthConfig = {
  BASE_API_URL: string
  CONSOLE_AUTHORIZE_URL: string
  REMOTE_CLOUD_AUTHORIZE_URL: string
  /**
   * The DSXU remote web origin. Separate from REMOTE_CLOUD_AUTHORIZE_URL
   * because deployments may route authorize traffic and /code links through
   * different hosts.
   */
  REMOTE_CLOUD_ORIGIN: string
  TOKEN_URL: string
  API_KEY_URL: string
  ROLES_URL: string
  CONSOLE_SUCCESS_URL: string
  REMOTE_CLOUD_SUCCESS_URL: string
  MANUAL_REDIRECT_URL: string
  CLIENT_ID: string
  OAUTH_FILE_SUFFIX: string
  MCP_PROXY_URL: string
  MCP_PROXY_PATH: string
}

// Production OAuth configuration - Used in normal operation.
// Defaults are DSXU-owned placeholders. Commercial deployments should set
// DSXU_OAUTH_* or DSXU_CODE_* environment variables for their real control plane.
const PROD_OAUTH_CONFIG = {
  BASE_API_URL: getDsxuOauthUrl('OAUTH_API_BASE_URL', DSXU_API_BASE_URL),
  CONSOLE_AUTHORIZE_URL: `${getDsxuOauthUrl('OAUTH_CONSOLE_BASE_URL', DSXU_CONSOLE_BASE_URL)}/oauth/authorize`,
  REMOTE_CLOUD_AUTHORIZE_URL: `${getDsxuOauthUrl('OAUTH_REMOTE_BASE_URL', DSXU_REMOTE_BASE_URL)}/oauth/authorize`,
  REMOTE_CLOUD_ORIGIN: getDsxuOauthUrl('OAUTH_REMOTE_BASE_URL', DSXU_REMOTE_BASE_URL),
  TOKEN_URL: `${getDsxuOauthUrl('OAUTH_CONSOLE_BASE_URL', DSXU_CONSOLE_BASE_URL)}/v1/oauth/token`,
  API_KEY_URL: `${getDsxuOauthUrl('OAUTH_API_BASE_URL', DSXU_API_BASE_URL)}${apiOauthPath('create_api_key')}`,
  ROLES_URL: `${getDsxuOauthUrl('OAUTH_API_BASE_URL', DSXU_API_BASE_URL)}${apiOauthPath('roles')}`,
  CONSOLE_SUCCESS_URL:
    `${getDsxuOauthUrl('OAUTH_CONSOLE_BASE_URL', DSXU_CONSOLE_BASE_URL)}/buy_credits?returnUrl=/oauth/code/success%3F${appSuccessQuery}`,
  REMOTE_CLOUD_SUCCESS_URL:
    `${getDsxuOauthUrl('OAUTH_CONSOLE_BASE_URL', DSXU_CONSOLE_BASE_URL)}${oauthSuccessPath}`,
  MANUAL_REDIRECT_URL: `${getDsxuOauthUrl('OAUTH_CONSOLE_BASE_URL', DSXU_CONSOLE_BASE_URL)}/oauth/code/callback`,
  CLIENT_ID: getDsxuCodeEnv('OAUTH_CLIENT_ID') ?? 'dsxu-code-local-client',
  // No suffix for production config
  OAUTH_FILE_SUFFIX: '',
  MCP_PROXY_URL: getDsxuOauthUrl('MCP_PROXY_BASE_URL', DSXU_MCP_PROXY_BASE_URL),
  MCP_PROXY_PATH: '/v1/mcp/{server_id}',
} as const

/**
 * Client ID Metadata Document URL for MCP OAuth (CIMD / SEP-991).
 * When an MCP auth server advertises client_id_metadata_document_supported: true,
 * DSXU Code uses this URL as its client_id instead of Dynamic Client Registration.
 * The URL must point to the DSXU remote/control metadata document.
 * See: https://datatracker.ietf.org/doc/html/draft-ietf-oauth-client-id-metadata-document-00
 */
export const MCP_CLIENT_METADATA_URL =
  `${getDsxuOauthUrl('OAUTH_REMOTE_BASE_URL', DSXU_REMOTE_BASE_URL)}/oauth/${DSXU_CLI_APP_ID}-client-metadata`

// Staging OAuth configuration - only included in ant builds with staging flag
// Uses literal check for dead code elimination
const STAGING_OAUTH_CONFIG =
  process.env.USER_TYPE === 'ant'
    ? ({
        BASE_API_URL: getDsxuOauthUrl(
          'OAUTH_STAGING_API_BASE_URL',
          'https://api-staging.dsxu.local',
        ),
        CONSOLE_AUTHORIZE_URL:
          `${getDsxuOauthUrl('OAUTH_STAGING_CONSOLE_BASE_URL', 'https://console-staging.dsxu.local')}/oauth/authorize`,
        REMOTE_CLOUD_AUTHORIZE_URL:
          `${getDsxuOauthUrl('OAUTH_STAGING_REMOTE_BASE_URL', 'https://remote-staging.dsxu.local')}/oauth/authorize`,
        REMOTE_CLOUD_ORIGIN: getDsxuOauthUrl(
          'OAUTH_STAGING_REMOTE_BASE_URL',
          'https://remote-staging.dsxu.local',
        ),
        TOKEN_URL: `${getDsxuOauthUrl('OAUTH_STAGING_CONSOLE_BASE_URL', 'https://console-staging.dsxu.local')}/v1/oauth/token`,
        API_KEY_URL:
          `${getDsxuOauthUrl('OAUTH_STAGING_API_BASE_URL', 'https://api-staging.dsxu.local')}${apiOauthPath('create_api_key')}`,
        ROLES_URL:
          `${getDsxuOauthUrl('OAUTH_STAGING_API_BASE_URL', 'https://api-staging.dsxu.local')}${apiOauthPath('roles')}`,
        CONSOLE_SUCCESS_URL:
          `${getDsxuOauthUrl('OAUTH_STAGING_CONSOLE_BASE_URL', 'https://console-staging.dsxu.local')}/buy_credits?returnUrl=/oauth/code/success%3F${appSuccessQuery}`,
        REMOTE_CLOUD_SUCCESS_URL:
          `${getDsxuOauthUrl('OAUTH_STAGING_CONSOLE_BASE_URL', 'https://console-staging.dsxu.local')}${oauthSuccessPath}`,
        MANUAL_REDIRECT_URL:
          `${getDsxuOauthUrl('OAUTH_STAGING_CONSOLE_BASE_URL', 'https://console-staging.dsxu.local')}/oauth/code/callback`,
        CLIENT_ID:
          getDsxuCodeEnv('OAUTH_STAGING_CLIENT_ID') ?? 'dsxu-code-staging-client',
        OAUTH_FILE_SUFFIX: '-staging-oauth',
        MCP_PROXY_URL: getDsxuOauthUrl(
          'MCP_STAGING_PROXY_BASE_URL',
          'https://mcp-proxy-staging.dsxu.local',
        ),
        MCP_PROXY_PATH: '/v1/mcp/{server_id}',
      } as const)
    : undefined

// Three local dev servers: :8000 api-proxy, :4000 remote-session frontend,
// :3000 Console frontend. Env vars let local overrides match the dev layout.
function getLocalOauthConfig(): OauthConfig {
  const api =
    getLocalOauthEnv('API_BASE')?.replace(/\/$/, '') ??
    'http://localhost:8000'
  const apps =
    getLocalOauthEnv('APPS_BASE')?.replace(/\/$/, '') ??
    'http://localhost:4000'
  const consoleBase =
    getLocalOauthEnv('CONSOLE_BASE')?.replace(/\/$/, '') ??
    'http://localhost:3000'
  return {
    BASE_API_URL: api,
    CONSOLE_AUTHORIZE_URL: `${consoleBase}/oauth/authorize`,
    REMOTE_CLOUD_AUTHORIZE_URL: `${apps}/oauth/authorize`,
    REMOTE_CLOUD_ORIGIN: apps,
    TOKEN_URL: `${api}/v1/oauth/token`,
    API_KEY_URL: `${api}${apiOauthPath('create_api_key')}`,
    ROLES_URL: `${api}${apiOauthPath('roles')}`,
    CONSOLE_SUCCESS_URL: `${consoleBase}/buy_credits?returnUrl=/oauth/code/success%3F${appSuccessQuery}`,
    REMOTE_CLOUD_SUCCESS_URL: `${consoleBase}${oauthSuccessPath}`,
    MANUAL_REDIRECT_URL: `${consoleBase}/oauth/code/callback`,
    CLIENT_ID: getDsxuCodeEnv('OAUTH_LOCAL_CLIENT_ID') ?? 'dsxu-code-local-client',
    OAUTH_FILE_SUFFIX: '-local-oauth',
    MCP_PROXY_URL: 'http://localhost:8205',
    MCP_PROXY_PATH: '/v1/toolbox/shttp/mcp/{server_id}',
  }
}

// Allowed base URLs for the custom OAuth override. Deployments can add
// comma-separated DSXU_ALLOWED_OAUTH_BASE_URLS. Defaults are DSXU-owned local
// placeholders so tokens are never sent to historical vendor endpoints.
function getAllowedOauthBaseUrls(): readonly string[] {
  const configured = process.env.DSXU_ALLOWED_OAUTH_BASE_URLS
    ?.split(',')
    .map(url => url.trim().replace(/\/$/, ''))
    .filter(Boolean)
  if (configured?.length) return configured
  return [
    DSXU_API_BASE_URL,
    DSXU_CONSOLE_BASE_URL,
    DSXU_REMOTE_BASE_URL,
    'http://localhost:8000',
    'http://localhost:3000',
    'http://localhost:4000',
  ]
}

// Default to prod config, override with test/staging if enabled
export function getOauthConfig(): OauthConfig {
  let config: OauthConfig = (() => {
    switch (getOauthConfigType()) {
      case 'local':
        return getLocalOauthConfig()
      case 'staging':
        return STAGING_OAUTH_CONFIG ?? PROD_OAUTH_CONFIG
      case 'prod':
        return PROD_OAUTH_CONFIG
    }
  })()

  // Allow overriding all OAuth URLs to point to an approved FedStart deployment.
  // Only allowlisted base URLs are accepted to prevent credential leakage.
  const oauthBaseUrl = getCustomOauthBaseUrl()
  if (oauthBaseUrl) {
    const base = oauthBaseUrl.replace(/\/$/, '')
    if (!getAllowedOauthBaseUrls().includes(base)) {
      throw new Error(
        'DSXU_CODE_CUSTOM_OAUTH_URL is not an approved endpoint.',
      )
    }
    config = {
      ...config,
      BASE_API_URL: base,
      CONSOLE_AUTHORIZE_URL: `${base}/oauth/authorize`,
      REMOTE_CLOUD_AUTHORIZE_URL: `${base}/oauth/authorize`,
      REMOTE_CLOUD_ORIGIN: base,
      TOKEN_URL: `${base}/v1/oauth/token`,
      API_KEY_URL: `${base}${apiOauthPath('create_api_key')}`,
      ROLES_URL: `${base}${apiOauthPath('roles')}`,
      CONSOLE_SUCCESS_URL: `${base}${oauthSuccessPath}`,
      REMOTE_CLOUD_SUCCESS_URL: `${base}${oauthSuccessPath}`,
      MANUAL_REDIRECT_URL: `${base}/oauth/code/callback`,
      OAUTH_FILE_SUFFIX: '-custom-oauth',
    }
  }

  // Allow CLIENT_ID override via environment variable (e.g., for Xcode integration)
  const clientIdOverride = getOauthClientIdOverride()
  if (clientIdOverride) {
    config = {
      ...config,
      CLIENT_ID: clientIdOverride,
    }
  }

  return config
}

export function getProviderCloudOrigin(): string {
  return getOauthConfig().REMOTE_CLOUD_ORIGIN
}
