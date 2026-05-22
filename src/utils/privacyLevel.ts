/**
 * Privacy level controls how much nonessential network traffic and telemetry
 * DSXU Code generates.
 *
 * Levels are ordered by restrictiveness:
 *   default < no-telemetry < essential-traffic
 *
 * - default:            Everything enabled.
 * - no-telemetry:       Analytics/telemetry disabled (Datadog, 1P events, feedback survey).
 * - essential-traffic:  ALL nonessential network traffic disabled
 *                       (telemetry + auto-updates, grove, release notes, model capabilities, etc.).
 *
 * The resolved level is the most restrictive signal from:
 *   DSXU_CODE_DISABLE_NONESSENTIAL_TRAFFIC   ->  essential-traffic
 *   provider-migration disable-nonessential alias -> essential-traffic
 *   DISABLE_TELEMETRY                         →  no-telemetry
 */

import { getDsxuCodeEnv, isDsxuCodeEnvTruthy } from './envUtils.js'

type PrivacyLevel = 'default' | 'no-telemetry' | 'essential-traffic'

export function getPrivacyLevel(): PrivacyLevel {
  if (isDsxuCodeEnvTruthy('DISABLE_NONESSENTIAL_TRAFFIC')) {
    return 'essential-traffic'
  }
  if (process.env.DISABLE_TELEMETRY) {
    return 'no-telemetry'
  }
  return 'default'
}

/**
 * True when all nonessential network traffic should be suppressed.
 * Equivalent to the old nonessential-traffic guard, with DSXU env taking
 * precedence over the provider-migration alias.
 */
export function isEssentialTrafficOnly(): boolean {
  return getPrivacyLevel() === 'essential-traffic'
}

/**
 * True when telemetry/analytics should be suppressed.
 * True at both `no-telemetry` and `essential-traffic` levels.
 */
export function isTelemetryDisabled(): boolean {
  return getPrivacyLevel() !== 'default'
}

/**
 * Returns the env var name responsible for the current essential-traffic restriction,
 * or null if unrestricted. Used for user-facing "unset X to re-enable" messages.
 */
export function getEssentialTrafficOnlyReason(): string | null {
  if (getDsxuCodeEnv('DISABLE_NONESSENTIAL_TRAFFIC')) {
    return 'DSXU_CODE_DISABLE_NONESSENTIAL_TRAFFIC'
  }
  return null
}
