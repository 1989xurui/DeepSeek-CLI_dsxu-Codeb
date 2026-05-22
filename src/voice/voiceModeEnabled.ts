import { feature } from 'bun:bundle'
import { getProviderControlTokens } from '../services/auth/dsxuProviderControlAuth.js'
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../services/analytics/featureFlags.js'
import { isProviderAuthEnabled } from '../utils/auth.js'

/**
 * Kill-switch check for voice mode. Returns true unless the
 * `tengu_amber_quartz_disabled` feature flag provider flag is flipped on (emergency
 * off). Default `false` means a missing/stale disk cache reads as "not
 * killed" ; so fresh installs get voice working immediately without
 * waiting for feature flag provider init. Use this for deciding whether voice mode
 * should be *visible* (e.g., command registration, config UI).
 */
export function isVoiceFeatureFlagEnabled(): boolean {
  // Positive ternary pattern ; see docs/feature-gating.md.
  // Negative pattern (if (!feature(...)) return) does not eliminate
  // inline string literals from external builds.
  return feature('VOICE_MODE')
    ? !getFeatureValue_CACHED_MAY_BE_STALE('tengu_amber_quartz_disabled', false)
    : false
}

/**
 * Auth-only check for voice mode. Returns true when the user has a valid
 * provider OAuth token. Backed by the memoized provider token reader;
 * first call spawns `security` on macOS (~20-50ms), subsequent calls are
 * cache hits. The memoize clears on token refresh (~once/hour), so one
 * cold spawn per refresh is expected. Cheap enough for usage-time checks.
 */
export function hasVoiceAuth(): boolean {
  // Voice mode requires archived OAuth; it uses the voice_stream
  // endpoint on the archived service which is not available with API keys,
  // Bedrock, Vertex, or Foundry.
  if (!isProviderAuthEnabled()) {
    return false
  }
  // isProviderAuthEnabled only checks the auth *provider*, not whether
  // a token exists. Without this check, the voice UI renders but
  // connectVoiceStream fails silently when the user isn't logged in.
  const tokens = getProviderControlTokens()
  return Boolean(tokens?.accessToken)
}

/**
 * Full runtime check: auth + feature flag provider kill-switch. Callers: `/voice`
 * (voice.ts, voice/index.ts), ConfigTool, VoiceModeNotice ; command-time
 * paths where a fresh keychain read is acceptable. For React render
 * paths use useVoiceEnabled() instead (memoizes the auth half).
 */
export function isVoiceModeEnabled(): boolean {
  return hasVoiceAuth() && isVoiceFeatureFlagEnabled()
}
