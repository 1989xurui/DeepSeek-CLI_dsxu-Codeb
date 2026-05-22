/**
 * Minimal module for firing macOS keychain reads in parallel with main.tsx
 * module evaluation, same pattern as startMdmRawRead() in settings/mdm/rawRead.ts.
 *
 * isRemoteManagedSettingsEligible() reads two separate keychain entries
 * sequentially via sync execSync during applySafeConfigEnvironmentVariables():
 *   1. "DSXU Code-credentials" (OAuth tokens), about 32ms.
 *   2. "DSXU Code" (provider-migration source API key), about 33ms.
 * Sequential cost: about 65ms on every macOS startup.
 *
 * Firing both here lets the subprocesses run in parallel with the main.tsx
 * import cost. ensureKeychainPrefetchCompleted() is awaited alongside
 * ensureMdmSettingsLoaded(), nearly free since subprocesses finish during
 * subprocesses finish during import evaluation. Sync read() and
 * getApiKeyFromConfigOrMacOSKeychain() then hit their caches.
 *
 * Imports stay minimal: child_process + macOsKeychainHelpers.ts, not
 * macOsKeychainStorage.ts, which pulls in execa, human-signals, and
 * cross-spawn, about 58ms of synchronous module init. The helpers file's own
 * import chain (envUtils, oauth constants, crypto) is already evaluated by
 * startupProfiler.ts at main.tsx:5, so no new module-init cost lands here.
 */

import { execFile } from 'child_process'
import {
  isBareMode,
  isDsxuRuntimeMode,
  isProviderMigrationServiceShellAllowed,
} from '../envUtils.js'
import {
  CREDENTIALS_SERVICE_SUFFIX,
  getMacOsKeychainStorageServiceName,
  getUsername,
  primeKeychainCacheFromPrefetch,
} from './macOsKeychainHelpers.js'

const KEYCHAIN_PREFETCH_TIMEOUT_MS = 10_000

// Shared with auth.ts getApiKeyFromConfigOrMacOSKeychain() so it can skip its
// sync spawn when the prefetch already landed. Distinguishing "not started" (null)
// from "completed with no key" ({ stdout: null }) lets the sync reader only
// trust a completed prefetch.
let providerMigrationApiKeyPrefetch: { stdout: string | null } | null = null

let prefetchPromise: Promise<void> | null = null

type SpawnResult = { stdout: string | null; timedOut: boolean }

function spawnSecurity(serviceName: string): Promise<SpawnResult> {
  return new Promise(resolve => {
    execFile(
      'security',
      ['find-generic-password', '-a', getUsername(), '-w', '-s', serviceName],
      { encoding: 'utf-8', timeout: KEYCHAIN_PREFETCH_TIMEOUT_MS },
      (err, stdout) => {
        // Exit 44 (entry not found) is a valid "no key" result and safe to
        // prime as null. But timeout (err.killed) means the keychain MAY have
        // a key we couldn't fetch; don't prime, let sync spawn retry.
        // biome-ignore lint/nursery/noFloatingPromises: resolve() is not a floating promise
        resolve({
          stdout: err ? null : stdout?.trim() || null,
          timedOut: Boolean(err && 'killed' in err && err.killed),
        })
      },
    )
  })
}

/**
 * Fire both keychain reads in parallel. Called at main.tsx top-level
 * immediately after startMdmRawRead(). Non-darwin is a no-op.
 */
export function startKeychainPrefetch(): void {
  if (
    process.platform !== 'darwin' ||
    prefetchPromise ||
    isBareMode() ||
    (isDsxuRuntimeMode() && !isProviderMigrationServiceShellAllowed())
  ) {
    return
  }

  // Fire both subprocesses immediately (non-blocking). They run in parallel
  // with each other AND with main.tsx imports. The await in Promise.all
  // happens later via ensureKeychainPrefetchCompleted().
  const oauthSpawn = spawnSecurity(
    getMacOsKeychainStorageServiceName(CREDENTIALS_SERVICE_SUFFIX),
  )
  const providerMigrationSpawn = spawnSecurity(
    getMacOsKeychainStorageServiceName(),
  )

  prefetchPromise = Promise.all([oauthSpawn, providerMigrationSpawn]).then(
    ([oauth, providerMigration]) => {
      // Timed-out prefetch: don't prime. Sync read/spawn will retry with its
      // own (longer) timeout. Priming null here would shadow a key that the
      // sync path might successfully fetch.
      if (!oauth.timedOut) primeKeychainCacheFromPrefetch(oauth.stdout)
      if (!providerMigration.timedOut) {
        providerMigrationApiKeyPrefetch = { stdout: providerMigration.stdout }
      }
    },
  )
}

/**
 * Await prefetch completion. Called in main.tsx preAction alongside
 * ensureMdmSettingsLoaded(), nearly free since subprocesses finish during
 * the ~65ms of main.tsx imports. Resolves immediately on non-darwin.
 */
export async function ensureKeychainPrefetchCompleted(): Promise<void> {
  if (prefetchPromise) await prefetchPromise
}

/**
 * Consumed by getApiKeyFromConfigOrMacOSKeychain() in auth.ts before it
 * falls through to sync execSync. Returns null if prefetch hasn't completed.
 */
export function getProviderMigrationApiKeyPrefetchResult(): {
  stdout: string | null
} | null {
  return providerMigrationApiKeyPrefetch
}

/**
 * Clear prefetch result. Called alongside getApiKeyFromConfigOrMacOSKeychain
 * cache invalidation so a stale prefetch doesn't shadow a fresh write.
 */
export function clearProviderMigrationApiKeyPrefetch(): void {
  providerMigrationApiKeyPrefetch = null
}
