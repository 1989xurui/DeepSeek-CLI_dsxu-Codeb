export const PRODUCT_URL = 'https://docs.dsxu.local/code'

// DSXU Code Remote session URLs. These defaults are local/product-owned
// placeholders; production deployments should set the DSXU_REMOTE_SESSION_* envs.
const envUrl = (name: string, fallback: string) =>
  process.env[name]?.replace(/\/$/, '') || fallback

export const REMOTE_SESSION_BASE_URL = envUrl(
  'DSXU_REMOTE_SESSION_BASE_URL',
  'https://remote.dsxu.local',
)
export const REMOTE_SESSION_STAGING_BASE_URL = envUrl(
  'DSXU_REMOTE_SESSION_STAGING_BASE_URL',
  'https://remote-staging.dsxu.local',
)
export const REMOTE_SESSION_LOCAL_BASE_URL = 'http://localhost:4000'

/**
 * Determine if we're in a staging environment for remote sessions.
 * Checks session ID format and ingress URL.
 */
export function isRemoteSessionStaging(
  sessionId?: string,
  ingressUrl?: string,
): boolean {
  return (
    sessionId?.includes('_staging_') === true ||
    ingressUrl?.includes('staging') === true
  )
}

/**
 * Determine if we're in a local-dev environment for remote sessions.
 * Checks session ID format (e.g. `session_local_...`) and ingress URL.
 */
export function isRemoteSessionLocal(
  sessionId?: string,
  ingressUrl?: string,
): boolean {
  return (
    sessionId?.includes('_local_') === true ||
    ingressUrl?.includes('localhost') === true
  )
}

/**
 * Get the base URL for a remote session based on environment.
 */
export function getRemoteSessionBaseUrl(
  sessionId?: string,
  ingressUrl?: string,
): string {
  if (isRemoteSessionLocal(sessionId, ingressUrl)) {
    return REMOTE_SESSION_LOCAL_BASE_URL
  }
  if (isRemoteSessionStaging(sessionId, ingressUrl)) {
    return REMOTE_SESSION_STAGING_BASE_URL
  }
  return REMOTE_SESSION_BASE_URL
}

/**
 * Get the full session URL for a remote session.
 *
 * The cse_ to session_ translation is a compatibility shim for older remote
 * session frontends. Same UUID body, different tag prefix. DSXU Control Plane
 * keeps this here so URL rendering stays product-owned and does not depend on
 * any old bridge runtime path.
 */
export function getRemoteSessionUrl(
  sessionId: string,
  ingressUrl?: string,
): string {
  const compatId = sessionId.startsWith('cse_')
    ? `session_${sessionId.slice('cse_'.length)}`
    : sessionId
  const baseUrl = getRemoteSessionBaseUrl(compatId, ingressUrl)
  return `${baseUrl}/code/${compatId}`
}
