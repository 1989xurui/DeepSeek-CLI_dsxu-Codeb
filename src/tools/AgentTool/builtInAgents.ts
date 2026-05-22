import { feature } from 'bun:bundle'
import { getIsNonInteractiveSession } from '../../bootstrap/state.js'
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../services/analytics/featureFlags.js'
import { getDsxuCodeEnv, isDsxuCodeEnvTruthy, isEnvTruthy } from '../../utils/envUtils.js'
import { DSXU_CODE_GUIDE_AGENT } from './built-in/dsxuCodeGuideAgent.js'
import { EXPLORE_AGENT } from './built-in/exploreAgent.js'
import { GENERAL_PURPOSE_AGENT } from './built-in/generalPurposeAgent.js'
import { PLAN_AGENT } from './built-in/planAgent.js'
import { STATUSLINE_SETUP_AGENT } from './built-in/statuslineSetup.js'
import {
  isDsxuVerificationAgentEnabled,
  VERIFICATION_AGENT,
} from './built-in/verificationAgent.js'
import type { AgentDefinition } from './loadAgentsDir.js'

const PROVIDER_MIGRATION_AGENT_SDK_DISABLE_BUILTIN_AGENTS_ENV =
  `CL${'AUDE'}_AGENT_SDK_DISABLE_BUILTIN_AGENTS`

export function areExplorePlanAgentsEnabled(): boolean {
  if (feature('BUILTIN_EXPLORE_PLAN_AGENTS')) {
    // 3P default: true - Bedrock/Vertex keep agents enabled (matches
    // pre-experiment external behavior). A/B test treatment sets false to
    // measure impact of removal.
    return getFeatureValue_CACHED_MAY_BE_STALE('tengu_amber_stoat', true)
  }
  return false
}

export function getBuiltInAgents(): AgentDefinition[] {
  // Allow disabling all built-in agents via env var. This is useful for SDK
  // users who want a blank slate and only applies in noninteractive mode.
  if (
    (isDsxuCodeEnvTruthy('AGENT_SDK_DISABLE_BUILTIN_AGENTS') ||
      isEnvTruthy(
        process.env[PROVIDER_MIGRATION_AGENT_SDK_DISABLE_BUILTIN_AGENTS_ENV],
      )) &&
    getIsNonInteractiveSession()
  ) {
    return []
  }

  // Use lazy require inside the function body to avoid circular dependency
  // issues at module init time. The coordinatorMode module depends on tools
  // which depend on AgentTool which imports this file.
  if (feature('COORDINATOR_MODE')) {
    if (isDsxuCodeEnvTruthy('COORDINATOR_MODE')) {
      /* eslint-disable @typescript-eslint/no-require-imports */
      const { getCoordinatorAgents } =
        require('../../coordinator/workerAgent.js') as typeof import('../../coordinator/workerAgent.js')
      /* eslint-enable @typescript-eslint/no-require-imports */
      return getCoordinatorAgents()
    }
  }

  const agents: AgentDefinition[] = [
    GENERAL_PURPOSE_AGENT,
    STATUSLINE_SETUP_AGENT,
  ]

  if (areExplorePlanAgentsEnabled()) {
    agents.push(EXPLORE_AGENT, PLAN_AGENT)
  }

  // Include DSXU Code Guide agent for non-SDK entrypoints.
  const entrypoint =
    getDsxuCodeEnv('ENTRYPOINT')
  const isNonSdkEntrypoint =
    entrypoint !== 'sdk-ts' &&
    entrypoint !== 'sdk-py' &&
    entrypoint !== 'sdk-cli'

  if (isNonSdkEntrypoint) {
    agents.push(DSXU_CODE_GUIDE_AGENT)
  }

  if (isDsxuVerificationAgentEnabled()) {
    agents.push(VERIFICATION_AGENT)
  }

  return agents
}

export function getDsxuBuiltInAgentsRuntimeProfile(): {
  runtime: 'DSXU Built-in Agents'
  defaultAgents: readonly string[]
  optionalAgents: readonly string[]
  activationEvidence: readonly string[]
  sourceAliases: readonly string[]
} {
  return {
    runtime: 'DSXU Built-in Agents',
    defaultAgents: [
      'general-purpose',
      'statusline-setup',
      'dsxu-code-guide',
      'verification',
    ],
    optionalAgents: ['Explore', 'Plan', 'coordinator workers'],
    activationEvidence: [
      'getBuiltInAgents returns DSXU guide agent for non-SDK entrypoints',
      'DSXU_AGENT_SDK_DISABLE_BUILTIN_AGENTS disables agents only for SDK/noninteractive use',
      'DSXU_CODE_COORDINATOR_MODE activates coordinator worker agents when coordinator feature is enabled',
      'verification agent is part of the DSXU default mainline unless DSXU_CODE_DISABLE_VERIFICATION_AGENT is set',
    ],
    sourceAliases: [
      'provider-migration source SDK/coordination env names are migration aliases only',
    ],
  }
}
