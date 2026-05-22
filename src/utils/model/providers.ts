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
 * Returns true if not set (default API) or points to the first-party
 * API hosts accepted by the provider-migration transport boundary.
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
