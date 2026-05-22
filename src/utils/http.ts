/**
 * HTTP utility constants and helpers
 */

import axios from 'axios'
import {
  getProviderApiKey,
  isProviderSubscriptionAccount,
} from './auth.js'
import {
  getProviderControlAccessToken,
  getProviderControlBearerHeaders,
  handleProviderControlAuth401Error,
} from '../services/auth/dsxuProviderControlAuth.js'
import { getDsxuCodeEnv } from './envUtils.js'
import { getDSXUCodeUserAgent } from './userAgent.js'
import { getWorkload } from './workloadContext.js'

const ARCHIVED_AGENT_SDK_VERSION_ENV = 'CL' + 'AUDE_AGENT_SDK_VERSION'
const ARCHIVED_AGENT_SDK_CLIENT_APP_ENV = 'CL' + 'AUDE_AGENT_SDK_CLIENT_APP'

// WARNING: downstream logs rely on the product token in this user agent.
// Please do NOT change this without making sure that logging also gets updated!
export function getUserAgent(): string {
  const sdkVersion =
    process.env.DSXU_AGENT_SDK_VERSION ??
    process.env[ARCHIVED_AGENT_SDK_VERSION_ENV]
  const agentSdkVersion = sdkVersion ? `, agent-sdk/${sdkVersion}` : ''
  // SDK consumers can identify their app/library via DSXU_AGENT_SDK_CLIENT_APP
  const sdkClientApp =
    process.env.DSXU_AGENT_SDK_CLIENT_APP ??
    process.env[ARCHIVED_AGENT_SDK_CLIENT_APP_ENV]
  const clientApp = sdkClientApp
    ? `, client-app/${sdkClientApp}`
    : ''
  // Turn-/process-scoped workload tag for cron-initiated requests. First-party
  // observability proxies strip HTTP headers; QoS routing uses cc_workload
  // in the billing-header attribution block instead (see constants/system.ts).
  // get provider client (client.ts:98) calls this per-request inside withRetry,
  // so the read picks up the same setWorkload() value as getAttributionHeader.
  const workload = getWorkload()
  const workloadSuffix = workload ? `, workload/${workload}` : ''
  return `dsxu-code/${MACRO.VERSION} (${process.env.USER_TYPE}, ${getDsxuCodeEnv('ENTRYPOINT') ?? 'cli'}${agentSdkVersion}${clientApp}${workloadSuffix})`
}

export function getMCPUserAgent(): string {
  const parts: string[] = []
  const entrypoint = getDsxuCodeEnv('ENTRYPOINT')
  if (entrypoint) {
    parts.push(entrypoint)
  }
  const sdkVersion =
    process.env.DSXU_AGENT_SDK_VERSION ??
    process.env[ARCHIVED_AGENT_SDK_VERSION_ENV]
  if (sdkVersion) {
    parts.push(`agent-sdk/${sdkVersion}`)
  }
  const sdkClientApp =
    process.env.DSXU_AGENT_SDK_CLIENT_APP ??
    process.env[ARCHIVED_AGENT_SDK_CLIENT_APP_ENV]
  if (sdkClientApp) {
    parts.push(`client-app/${sdkClientApp}`)
  }
  const suffix = parts.length > 0 ? ` (${parts.join(', ')})` : ''
  return `dsxu-code/${MACRO.VERSION}${suffix}`
}

// User-Agent for WebFetch requests to arbitrary sites.
export function getWebFetchUserAgent(): string {
  return `DSXU-User (${getDSXUCodeUserAgent()}; +https://dsxu.local/support)`
}

export type AuthHeaders = {
  headers: Record<string, string>
  error?: string
}

/**
 * Get authentication headers for API requests
 * Returns either OAuth headers for Max/Pro users or API key headers for regular users
 */
export function getAuthHeaders(): AuthHeaders {
  if (isProviderSubscriptionAccount()) {
    const accessToken = getProviderControlAccessToken()
    if (!accessToken) {
      return {
        headers: {},
        error: 'No OAuth token available',
      }
    }
    return {
      headers: getProviderControlBearerHeaders(accessToken),
    }
  }
  // TODO: this will fail if the API key is being set to an LLM Gateway key
  // should we try to query keychain / credentials for a valid provider key?
  const apiKey = getProviderApiKey()
  if (!apiKey) {
    return {
      headers: {},
      error: 'No API key available',
    }
  }
  return {
    headers: {
      'x-api-key': apiKey,
    },
  }
}

/**
 * Wrapper that handles OAuth 401 errors by force-refreshing the token and
 * retrying once. Addresses clock drift scenarios where the local expiration
 * check disagrees with the server.
 *
 * The request closure is called again on retry, so it should re-read auth
 * (e.g., via getAuthHeaders()) to pick up the refreshed token.
 *
 * Note: bridgeApi.ts has its own DI-injected version; auth refresh handling
 * transitively pulls in config.ts (~1300 modules), which breaks the SDK bundle.
 *
 * @param opts.also403Revoked - Also retry on 403 with "OAuth token has been
 *   revoked" body (some endpoints signal revocation this way instead of 401).
 */
export async function withOAuth401Retry<T>(
  request: () => Promise<T>,
  opts?: { also403Revoked?: boolean },
): Promise<T> {
  try {
    return await request()
  } catch (err) {
    if (!axios.isAxiosError(err)) throw err
    const status = err.response?.status
    const isAuthError =
      status === 401 ||
      (opts?.also403Revoked &&
        status === 403 &&
        typeof err.response?.data === 'string' &&
        err.response.data.includes('OAuth token has been revoked'))
    if (!isAuthError) throw err
    const failedAccessToken = getProviderControlAccessToken()
    if (!failedAccessToken) throw err
    await handleProviderControlAuth401Error(failedAccessToken)
    return await request()
  }
}
