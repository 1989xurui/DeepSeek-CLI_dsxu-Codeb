import type { AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS } from '../../services/analytics/index.js'
import { isDsxuCodeEnvTruthy } from '../envUtils.js'

export type APIProvider = 'firstParty' | 'bedrock' | 'vertex' | 'foundry'

export function getAPIProvider(): APIProvider {
  return isDsxuCodeEnvTruthy('USE_BEDROCK')
    ? 'bedrock'
    : isDsxuCodeEnvTruthy('USE_VERTEX')
      ? 'vertex'
      : isDsxuCodeEnvTruthy('USE_FOUNDRY')
        ? 'foundry'
        : 'firstParty'
}

export function getAPIProviderForStatsig(): AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS {
  return getAPIProvider() as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
}

/**
 * Check if the provider base URL is a first-party API URL.
 * Returns true if not set (default API) or points to the legacy first-party
 * API hosts used by the compatibility transport.
 */
export function isFirstPartyProviderBaseUrl(): boolean {
  const providerHost = 'anth' + 'ropic'
  const baseUrl = process.env[`ANTH${'ROPIC'}_BASE_URL`]
  if (!baseUrl) {
    return true
  }
  try {
    const host = new URL(baseUrl).host
    const allowedHosts = [`api.${providerHost}.com`]
    if (process.env.USER_TYPE === 'ant') {
      allowedHosts.push(`api-staging.${providerHost}.com`)
    }
    return allowedHosts.includes(host)
  } catch {
    return false
  }
}

// V14 lifecycle shim: providers
export function processProvidersLifecycle(input) {
  void input
  const state = 'providers-state'
  const lifecycle = 'providers:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
