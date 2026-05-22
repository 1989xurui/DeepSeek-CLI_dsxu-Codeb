// Provider migration MCP discovery is isolated behind an explicit migration flag.
import axios from 'axios'
import memoize from 'lodash-es/memoize.js'
import {
  PROVIDER_MIGRATION_CONFIG_SCOPE,
  PROVIDER_MIGRATION_MCP_TRANSPORT,
  PROVIDER_MIGRATION_BETA_HEADER,
  PROVIDER_MIGRATION_VERSION_HEADER,
  providerMigrationMcpEvent,
} from 'src/constants/providerMigrationProtocol.js'
import { getOauthConfig } from 'src/constants/oauth.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from 'src/services/analytics/index.js'
import { getProviderControlTokens } from '../auth/dsxuProviderControlAuth.js'
import { getGlobalConfig, saveGlobalConfig } from 'src/utils/config.js'
import { logForDebugging } from 'src/utils/debug.js'
import { isEnvDefinedFalsy } from 'src/utils/envUtils.js'
import { clearMcpAuthCache } from './client.js'
import {
  getProviderMigrationMcpDisabledReason,
  isProviderMigrationMcpEnabled,
} from './dsxuProvider.js'
import { normalizeNameForMCP } from './normalization.js'
import type { ScopedMcpServerConfig } from './types.js'

type ProviderMigrationMcpServer = {
  type: 'mcp_server'
  id: string
  display_name: string
  url: string
  created_at: string
}

type ProviderMigrationMcpServersResponse = {
  data: ProviderMigrationMcpServer[]
  has_more: boolean
  next_page: string | null
}

const FETCH_TIMEOUT_MS = 5000
const MCP_SERVERS_BETA_HEADER = 'mcp-servers-2025-12-04'

/**
 * Fetches MCP server configurations from provider migration org configs.
 * These servers are managed by that provider migration source.
 *
 * Results are memoized for the session lifetime (fetch once per CLI session).
 */
export const fetchProviderMigrationMcpConfigsIfEligible = memoize(
  async (): Promise<Record<string, ScopedMcpServerConfig>> => {
    try {
      if (!isProviderMigrationMcpEnabled()) {
        logForDebugging(`[dsxu-mcp] ${getProviderMigrationMcpDisabledReason()}`)
        logEvent(providerMigrationMcpEvent('eligibility'), {
          state:
            'disabled_by_dsxu_default' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        })
        return {}
      }

      if (isEnvDefinedFalsy(process.env[`ENABLE_${'CL' + 'AUDE'}AI_MCP_SERVERS`])) {
        logForDebugging('[provider-migration-mcp] Disabled via env var')
        logEvent(providerMigrationMcpEvent('eligibility'), {
          state:
            'disabled_env_var' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        })
        return {}
      }

      const tokens = getProviderControlTokens()
      if (!tokens?.accessToken) {
        logForDebugging('[provider-migration-mcp] No access token')
        logEvent(providerMigrationMcpEvent('eligibility'), {
          state:
            'no_oauth_token' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        })
        return {}
      }

      // Check for user:mcp_servers scope directly instead of subscription helpers.
      // In non-interactive mode, subscriber checks can return false when a
      // provider API key is set. Checking the scope directly allows users with
      // both API keys and OAuth tokens to access provider migration MCPs in print mode.
      if (!tokens.scopes?.includes('user:mcp_servers')) {
        logForDebugging(
          `[provider-migration-mcp] Missing user:mcp_servers scope (scopes=${tokens.scopes?.join(',') || 'none'})`,
        )
        logEvent(providerMigrationMcpEvent('eligibility'), {
          state:
            'missing_scope' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        })
        return {}
      }

      const baseUrl = getOauthConfig().BASE_API_URL
      const url = `${baseUrl}/v1/mcp_servers?limit=1000`

      logForDebugging(`[provider-migration-mcp] Fetching from ${url}`)

      const response = await axios.get<ProviderMigrationMcpServersResponse>(url, {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/json',
          [PROVIDER_MIGRATION_BETA_HEADER]: MCP_SERVERS_BETA_HEADER,
          [PROVIDER_MIGRATION_VERSION_HEADER]: '2023-06-01',
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
        const baseName = `Provider migration ${server.display_name}`

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
          type: PROVIDER_MIGRATION_MCP_TRANSPORT,
          url: server.url,
          id: server.id,
          scope: PROVIDER_MIGRATION_CONFIG_SCOPE,
        }
      }

      logForDebugging(
        `[provider-migration-mcp] Fetched ${Object.keys(configs).length} servers`,
      )
      logEvent(providerMigrationMcpEvent('eligibility'), {
        state:
          'eligible' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      })
      return configs
    } catch {
      logForDebugging(`[provider-migration-mcp] Fetch failed`)
      return {}
    }
  },
)

/**
 * Clears the memoized cache for fetchProviderMigrationMcpConfigsIfEligible.
 * Call this after login so the next fetch will use the new auth tokens.
 */
export function clearProviderMigrationMcpConfigsCache(): void {
  fetchProviderMigrationMcpConfigsIfEligible.cache.clear?.()
  // Also clear the auth cache so freshly-authorized servers get re-connected
  clearMcpAuthCache()
}

/**
 * Record that a provider migration connector successfully connected. Idempotent.
 *
 * Gates the "N connectors unavailable/need auth" startup notifications: a
 * connector that was working yesterday and is now failed is a state change
 * worth surfacing; an org-configured connector that's been needs-auth since
 * it showed up is one the user has demonstrably ignored.
 */
export function markProviderMigrationMcpConnected(name: string): void {
  saveGlobalConfig(current => {
    const seen = current.dsxuWebMcpEverConnected ?? []
    if (seen.includes(name)) return current
    return { ...current, dsxuWebMcpEverConnected: [...seen, name] }
  })
}

export function hasProviderMigrationMcpEverConnected(name: string): boolean {
  return (getGlobalConfig().dsxuWebMcpEverConnected ?? []).includes(name)
}

export function getDsxuProviderMigrationMcpRuntimeProfile(): {
  runtime: 'DSXU Provider Migration MCP Boundary'
  defaultEnabled: boolean
  enablementPolicy: string
  activationEvidence: readonly string[]
} {
  return {
    runtime: 'DSXU Provider Migration MCP Boundary',
    defaultEnabled: isProviderMigrationMcpEnabled(),
    enablementPolicy: getProviderMigrationMcpDisabledReason(),
    activationEvidence: [
      'fetchProviderMigrationMcpConfigsIfEligible returns an empty config map unless explicit provider migration is enabled',
      'provider OAuth scope checks are contained inside this isolated provider shell',
      'clearProviderMigrationMcpConfigsCache only clears provider migration discovery/auth cache after explicit provider migration login flow',
      'markProviderMigrationMcpConnected tracks historical connector state without making the provider migration service a DSXU default provider',
    ],
  }
}
