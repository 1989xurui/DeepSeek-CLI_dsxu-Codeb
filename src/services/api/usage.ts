import axios from 'axios'
import { getOauthConfig } from '../../constants/oauth.js'
import {
  hasProfileScope,
  isProviderSubscriptionAccount,
} from '../../utils/auth.js'
import { getProviderControlTokens } from '../auth/dsxuProviderControlAuth.js'
import { getAuthHeaders } from '../../utils/http.js'
import { getDSXUCodeUserAgent } from '../../utils/userAgent.js'
import { isOAuthTokenExpired } from '../oauth/client.js'
import {
  isDsxuRuntimeMode,
  isArchivedServiceShellAllowed,
} from '../../utils/envUtils.js'

export type RateLimit = {
  utilization: number | null // a percentage from 0 to 100
  resets_at: string | null // ISO 8601 timestamp
}

export type ExtraUsage = {
  is_enabled: boolean
  monthly_limit: number | null
  used_credits: number | null
  utilization: number | null
}

export type Utilization = {
  five_hour?: RateLimit | null
  seven_day?: RateLimit | null
  seven_day_oauth_apps?: RateLimit | null
  seven_day_opus?: RateLimit | null
  seven_day_sonnet?: RateLimit | null
  extra_usage?: ExtraUsage | null
}

function isArchivedAccountApiAllowed(): boolean {
  return !isDsxuRuntimeMode() || isArchivedServiceShellAllowed()
}

export async function fetchUtilization(): Promise<Utilization | null> {
  if (!isArchivedAccountApiAllowed()) {
    return {}
  }

  if (!isProviderSubscriptionAccount() || !hasProfileScope()) {
    return {}
  }

  // Skip API call if OAuth token is expired to avoid 401 errors
  const tokens = getProviderControlTokens()
  if (tokens && isOAuthTokenExpired(tokens.expiresAt)) {
    return null
  }

  const authResult = getAuthHeaders()
  if (authResult.error) {
    throw new Error(`Auth error: ${authResult.error}`)
  }

  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': getDSXUCodeUserAgent(),
    ...authResult.headers,
  }

  const url = `${getOauthConfig().BASE_API_URL}/api/oauth/usage`

  const response = await axios.get<Utilization>(url, {
    headers,
    timeout: 5000, // 5 second timeout
  })

  return response.data
}

export async function processUsageLifecycle(): Promise<{
  state: 'available' | 'unavailable'
  lifecycle: string
  usage: Utilization | null
}> {
  const usage = await fetchUtilization()
  const state = usage === null ? 'unavailable' : 'available'
  return {
    state,
    lifecycle: `usage:${state}`,
    usage,
  }
}
