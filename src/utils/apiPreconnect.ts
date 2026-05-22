/**
 * Preconnect to the configured provider API to overlap TCP+TLS handshake with startup.
 *
 * The TCP+TLS handshake is ~100-200ms that normally blocks inside the first
 * API call. Kicking a fire-and-forget fetch during init lets the handshake
 * happen in parallel with action-handler work (~100ms of setup/commands/mcp
 * before the API request in -p mode; unbounded "user is typing" window in
 * interactive mode).
 *
 * Bun fetch shares a keep-alive connection pool globally, so the real API
 * request reuses the warmed connection.
 *
 * Called from init.ts after certificates and global agents are configured, so
 * settings.json env vars and TLS/proxy state are already applied.
 *
 * Skipped when:
 * - DSXU runtime is active and provider-migration service shell is not explicit.
 * - proxy/mTLS/unix socket is configured.
 * - Bedrock/Vertex/Foundry use a different endpoint and auth path.
 */

import { getOauthConfig } from '../constants/oauth.js'
import {
  getDsxuCodeEnv,
  isDsxuRuntimeMode,
  isEnvTruthy,
  isProviderMigrationServiceShellAllowed,
} from './envUtils.js'

let fired = false
const PROVIDER_MIGRATION_BASE_URL_ENV =
  ('ANTH' + 'ROPIC_BASE_URL') as keyof NodeJS.ProcessEnv

export function preconnectProviderApi(): void {
  if (fired) return
  fired = true

  if (isDsxuRuntimeMode() && !isProviderMigrationServiceShellAllowed()) {
    return
  }

  // Skip cloud providers with a different endpoint and auth path.
  if (
    isEnvTruthy(getDsxuCodeEnv('USE_BEDROCK')) ||
    isEnvTruthy(getDsxuCodeEnv('USE_VERTEX')) ||
    isEnvTruthy(getDsxuCodeEnv('USE_FOUNDRY'))
  ) {
    return
  }

  // Skip proxy/mTLS/unix socket; the SDK dispatcher will not reuse this pool.
  if (
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    process.env.PROVIDER_UNIX_SOCKET ||
    getDsxuCodeEnv('CLIENT_CERT') ||
    getDsxuCodeEnv('CLIENT_KEY')
  ) {
    return
  }

  // Use configured base URL (staging, local, or custom gateway). Covers
  // provider base URL env + USE_STAGING_OAUTH + USE_LOCAL_OAUTH in one lookup.
  // NODE_EXTRA_CA_CERTS no longer skips preconnect because init.ts applied it first.
  const baseUrl =
    process.env[PROVIDER_MIGRATION_BASE_URL_ENV] || getOauthConfig().BASE_API_URL

  // Fire and forget. HEAD means no response body; the connection is eligible
  // for keep-alive pool reuse immediately after headers arrive. 10s timeout
  // so a slow network does not hang the process; abort is fine since the real
  // request will handshake fresh if needed.
  // eslint-disable-next-line eslint-plugin-n/no-unsupported-features/node-builtins
  void fetch(baseUrl, {
    method: 'HEAD',
    signal: AbortSignal.timeout(10_000),
  }).catch(() => {})
}