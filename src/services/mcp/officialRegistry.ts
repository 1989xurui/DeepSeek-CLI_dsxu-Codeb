import axios from 'axios'
import { logForDebugging } from '../../utils/debug.js'
import { isDsxuCodeEnvTruthy } from '../../utils/envUtils.js'
import { errorMessage } from '../../utils/errors.js'

type RegistryServer = {
  server: {
    remotes?: Array<{ url: string }>
  }
}

type RegistryResponse = {
  servers: RegistryServer[]
}

// URLs stripped of query string and trailing slash — matches the normalization
// done by getLoggingSafeMcpBaseUrl so direct Set.has() lookup works.
let officialUrls: Set<string> | undefined = undefined

function normalizeUrl(url: string): string | undefined {
  try {
    const u = new URL(url)
    u.search = ''
    return u.toString().replace(/\/$/, '')
  } catch {
    return undefined
  }
}

/**
 * Fire-and-forget fetch of the official MCP registry.
 * Populates officialUrls for isOfficialMcpUrl lookups.
 */
export async function prefetchOfficialMcpUrls(): Promise<void> {
  if (
    isDsxuCodeEnvTruthy('DISABLE_NONESSENTIAL_TRAFFIC')
  ) {
    return
  }

  try {
    const registryUrl = process.env.DSXU_MCP_REGISTRY_URL
    if (!registryUrl) {
      logForDebugging('[mcp-registry] DSXU_MCP_REGISTRY_URL not configured; skipping registry prefetch')
      return
    }

    const response = await axios.get<RegistryResponse>(
      registryUrl,
      { timeout: 5000 },
    )

    const urls = new Set<string>()
    for (const entry of response.data.servers) {
      for (const remote of entry.server.remotes ?? []) {
        const normalized = normalizeUrl(remote.url)
        if (normalized) {
          urls.add(normalized)
        }
      }
    }
    officialUrls = urls
    logForDebugging(`[mcp-registry] Loaded ${urls.size} official MCP URLs`)
  } catch (error) {
    logForDebugging(`Failed to fetch MCP registry: ${errorMessage(error)}`, {
      level: 'error',
    })
  }
}

/**
 * Returns true iff the given (already-normalized via getLoggingSafeMcpBaseUrl)
 * URL is in the official MCP registry. Undefined registry → false (fail-closed).
 */
export function isOfficialMcpUrl(normalizedUrl: string): boolean {
  return officialUrls?.has(normalizedUrl) ?? false
}

export function resetOfficialMcpUrlsForTesting(): void {
  officialUrls = undefined
}

export function getDsxuOfficialMcpRegistryRuntimeProfile(): {
  runtime: 'DSXU Official MCP Registry'
  registryEnv: string
  disableTrafficEnv: readonly string[]
  lookupPolicy: string
  activationEvidence: readonly string[]
} {
  return {
    runtime: 'DSXU Official MCP Registry',
    registryEnv: 'DSXU_MCP_REGISTRY_URL',
    disableTrafficEnv: [
      'DSXU_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
      'legacy provider disable-nonessential-traffic alias',
    ],
    lookupPolicy:
      'undefined or failed registry fetch is fail-closed: isOfficialMcpUrl returns false',
    activationEvidence: [
      'prefetchOfficialMcpUrls reads DSXU registry URL only when configured',
      'remote URLs are normalized by stripping query string and trailing slash',
      'registry fetch is nonessential and skipped when DSXU traffic disable env is set',
    ],
  }
}


// V14 lifecycle shim: officialregistry
export function processOfficialregistryLifecycle(input) {
  void input
  const state = 'officialregistry-state'
  const lifecycle = 'officialregistry:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
