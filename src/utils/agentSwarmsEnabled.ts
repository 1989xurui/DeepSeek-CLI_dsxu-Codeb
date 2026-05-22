import { getFeatureValue_CACHED_MAY_BE_STALE } from '../services/analytics/featureFlags.js'
import { getDsxuCodeEnv, isEnvTruthy } from './envUtils.js'

/**
 * Check if --agent-teams flag is provided via CLI.
 * Checks process.argv directly to avoid import cycles with bootstrap/state.
 * Note: The flag is only shown in help for ant users, but if external users
 * pass it anyway, it will work (subject to the killswitch).
 */
function isAgentTeamsFlagSet(): boolean {
  return process.argv.includes('--agent-teams')
}

/**
 * Centralized runtime check for agent teams/teammate features.
 * This is the single gate that should be checked everywhere teammates
 * are referenced (prompts, code, tools isEnabled, UI, etc.).
 *
 * Ant builds: always enabled.
 * External builds require both:
 * 1. Opt-in via DSXU_CODE_EXPERIMENTAL_AGENT_TEAMS env var, archived source
 *    migration alias, OR --agent-teams flag
 * 2. feature flag provider gate 'tengu_amber_flint' enabled (killswitch)
 */
export function isAgentSwarmsEnabled(): boolean {
  if (isEnvTruthy(process.env.DSXU_CODE_MODE)) {
    return true
  }
  // Ant: always on
  if (process.env.USER_TYPE === 'ant') {
    return true
  }

  // External: require opt-in via env var or --agent-teams flag
  if (
    !isEnvTruthy(getDsxuCodeEnv('EXPERIMENTAL_AGENT_TEAMS')) &&
    !isAgentTeamsFlagSet()
  ) {
    return false
  }

  // Killswitch ...always respected for external users
  if (!getFeatureValue_CACHED_MAY_BE_STALE('tengu_amber_flint', true)) {
    return false
  }

  return true
}

export function getDsxuAgentSwarmsRuntimeProfile(): {
  runtime: 'DSXU Agent Swarms Gate'
  primaryEnv: string
  archivedEnv: string
  cliFlag: string
  activationEvidence: readonly string[]
} {
  return {
    runtime: 'DSXU Agent Swarms Gate',
    primaryEnv: 'DSXU_CODE_EXPERIMENTAL_AGENT_TEAMS',
    archivedEnv: 'archived source migration alias',
    cliFlag: '--agent-teams',
    activationEvidence: [
      'DSXU env opt-in is checked before the archived alias',
      'external users still require the feature flag provider killswitch to be enabled',
      'ant/internal builds keep the historical always-on behavior',
    ],
  }
}
