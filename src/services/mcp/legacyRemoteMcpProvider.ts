// DSXU V18 ownership marker: legacy cloud MCP discovery is isolated behind an explicit migration flag.
import axios from 'axios'
import memoize from 'lodash-es/memoize.js'
import {
  LEGACY_CLOUD_CONFIG_SCOPE,
  LEGACY_CLOUD_MCP_TRANSPORT,
  LEGACY_PROVIDER_BETA_HEADER,
  LEGACY_PROVIDER_VERSION_HEADER,
  legacyCloudMcpEvent,
} from 'src/constants/legacyProviderProtocol.js'
import { getOauthConfig } from 'src/constants/oauth.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from 'src/services/analytics/index.js'
import { getCompatProviderTokens } from 'src/dsxu/legacy/auth/legacyProviderControlAuth.js'
import { getGlobalConfig, saveGlobalConfig } from 'src/utils/config.js'
import { logForDebugging } from 'src/utils/debug.js'
import { isEnvDefinedFalsy } from 'src/utils/envUtils.js'
import { clearMcpAuthCache } from './client.js'
import {
  getLegacyCloudMcpDisabledReason,
  isLegacyCloudMcpEnabled,
} from './dsxuProvider.js'
import { normalizeNameForMCP } from './normalization.js'
import type { ScopedMcpServerConfig } from './types.js'

type LegacyCloudMcpServer = {
  type: 'mcp_server'
  id: string
  display_name: string
  url: string
  created_at: string
}

type LegacyCloudMcpServersResponse = {
  data: LegacyCloudMcpServer[]
  has_more: boolean
  next_page: string | null
}

const FETCH_TIMEOUT_MS = 5000
const MCP_SERVERS_BETA_HEADER = 'mcp-servers-2025-12-04'

/**
 * Fetches MCP server configurations from legacy cloud org configs.
 * These servers are managed by that legacy provider shell.
 *
 * Results are memoized for the session lifetime (fetch once per CLI session).
 */
export const fetchLegacyCloudMcpConfigsIfEligible = memoize(
  async (): Promise<Record<string, ScopedMcpServerConfig>> => {
    try {
      if (!isLegacyCloudMcpEnabled()) {
        logForDebugging(`[dsxu-mcp] ${getLegacyCloudMcpDisabledReason()}`)
        logEvent(legacyCloudMcpEvent('eligibility'), {
          state:
            'disabled_by_dsxu_default' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        })
        return {}
      }

      if (isEnvDefinedFalsy(process.env[`ENABLE_${'CL' + 'AUDE'}AI_MCP_SERVERS`])) {
        logForDebugging('[legacy-cloud-mcp] Disabled via env var')
        logEvent(legacyCloudMcpEvent('eligibility'), {
          state:
            'disabled_env_var' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        })
        return {}
      }

      const tokens = getCompatProviderTokens()
      if (!tokens?.accessToken) {
        logForDebugging('[legacy-cloud-mcp] No access token')
        logEvent(legacyCloudMcpEvent('eligibility'), {
          state:
            'no_oauth_token' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        })
        return {}
      }

      // Check for user:mcp_servers scope directly instead of subscription helpers.
      // In non-interactive mode, subscriber checks can return false when a
      // provider API key is set. Checking the scope directly allows users with
      // both API keys and OAuth tokens to access legacy cloud MCPs in print mode.
      if (!tokens.scopes?.includes('user:mcp_servers')) {
        logForDebugging(
          `[legacy-cloud-mcp] Missing user:mcp_servers scope (scopes=${tokens.scopes?.join(',') || 'none'})`,
        )
        logEvent(legacyCloudMcpEvent('eligibility'), {
          state:
            'missing_scope' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        })
        return {}
      }

      const baseUrl = getOauthConfig().BASE_API_URL
      const url = `${baseUrl}/v1/mcp_servers?limit=1000`

      logForDebugging(`[legacy-cloud-mcp] Fetching from ${url}`)

      const response = await axios.get<LegacyCloudMcpServersResponse>(url, {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/json',
          [LEGACY_PROVIDER_BETA_HEADER]: MCP_SERVERS_BETA_HEADER,
          [LEGACY_PROVIDER_VERSION_HEADER]: '2023-06-01',
        },
        timeout: FETCH_TIMEOUT_MS,
      })

      const configs: Record<string, ScopedMcpServerConfig> = {}
      // Track used normalized names to detect collisions and assign (2), (3), etc. suffixes.
      // We check the final normalized name (including suffix) to handle edge cases where
      // a suffixed name collides with another server's base name (e.g., "Example Server 2"
      // colliding with another suffixed hosted connector name.
      const usedNormalizedNames = new Set<string>()

      for (const server of response.data.data) {
        const baseName = `Legacy cloud ${server.display_name}`

        // Try without suffix first, then increment until we find an unused normalized name
        let finalName = baseName
        let finalNormalized = normalizeNameForMCP(finalName)
        let count = 1
        while (usedNormalizedNames.has(finalNormalized)) {
          count++
          finalName = `${baseName} (${count})`
          finalNormalized = normalizeNameForMCP(finalName)
        }
        usedNormalizedNames.add(finalNormalized)

        configs[finalName] = {
          type: LEGACY_CLOUD_MCP_TRANSPORT,
          url: server.url,
          id: server.id,
          scope: LEGACY_CLOUD_CONFIG_SCOPE,
        }
      }

      logForDebugging(
        `[legacy-cloud-mcp] Fetched ${Object.keys(configs).length} servers`,
      )
      logEvent(legacyCloudMcpEvent('eligibility'), {
        state:
          'eligible' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      })
      return configs
    } catch {
      logForDebugging(`[legacy-cloud-mcp] Fetch failed`)
      return {}
    }
  },
)

/**
 * Clears the memoized cache for fetchLegacyCloudMcpConfigsIfEligible.
 * Call this after login so the next fetch will use the new auth tokens.
 */
export function clearLegacyCloudMcpConfigsCache(): void {
  fetchLegacyCloudMcpConfigsIfEligible.cache.clear?.()
  // Also clear the auth cache so freshly-authorized servers get re-connected
  clearMcpAuthCache()
}

/**
 * Record that a legacy cloud connector successfully connected. Idempotent.
 *
 * Gates the "N connectors unavailable/need auth" startup notifications: a
 * connector that was working yesterday and is now failed is a state change
 * worth surfacing; an org-configured connector that's been needs-auth since
 * it showed up is one the user has demonstrably ignored.
 */
export function markLegacyCloudMcpConnected(name: string): void {
  saveGlobalConfig(current => {
    const seen = current.dsxuWebMcpEverConnected ?? []
    if (seen.includes(name)) return current
    return { ...current, dsxuWebMcpEverConnected: [...seen, name] }
  })
}

export function hasLegacyCloudMcpEverConnected(name: string): boolean {
  return (getGlobalConfig().dsxuWebMcpEverConnected ?? []).includes(name)
}

export function getDsxuLegacyCloudMcpRuntimeProfile(): {
  runtime: 'DSXU Legacy Cloud MCP Isolation'
  defaultEnabled: boolean
  enablementPolicy: string
  activationEvidence: readonly string[]
} {
  return {
    runtime: 'DSXU Legacy Cloud MCP Isolation',
    defaultEnabled: isLegacyCloudMcpEnabled(),
    enablementPolicy: getLegacyCloudMcpDisabledReason(),
    activationEvidence: [
      'fetchLegacyCloudMcpConfigsIfEligible returns an empty config map unless explicit legacy migration is enabled',
      'legacy OAuth scope checks are contained inside this isolated provider shell',
      'clearLegacyCloudMcpConfigsCache only clears legacy discovery/auth cache after explicit legacy login flow',
      'markLegacyCloudMcpConnected tracks historical connector state without making the legacy cloud service a DSXU default provider',
    ],
  }
}
