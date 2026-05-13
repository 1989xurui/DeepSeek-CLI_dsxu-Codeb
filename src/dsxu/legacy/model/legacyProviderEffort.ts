import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../../services/analytics/growthbook.js'
import type { EffortLevel } from '../../../entrypoints/sdk/runtimeTypes.js'
import { isMaxSubscriber, isProSubscriber, isTeamSubscriber } from '../../../utils/auth.js'
import { getAPIProvider } from '../../../utils/model/providers.js'
import { get3PModelCapabilityOverride } from '../../../utils/model/modelSupportOverrides.js'
import {
  getAntModelOverrideConfig,
  resolveAntModel,
} from '../../../utils/model/antModels.js'
import { parseUserSpecifiedModel } from './legacyProviderModel.js'

export type CompatEffortValue = EffortLevel | number

export type CompatDefaultEffortConfig = {
  enabled: boolean
  dialogTitle: string
  dialogDescription: string
}

const COMPAT_DEFAULT_EFFORT_CONFIG_DEFAULT: CompatDefaultEffortConfig = {
  enabled: true,
  dialogTitle: 'We recommend medium effort',
  dialogDescription:
    'Effort determines how long DSXU thinks for when completing your task. We recommend medium effort for most tasks to balance speed and intelligence and maximize rate limits. Use ultrathink to trigger high effort when needed.',
}

function normalizedModel(model: string): string {
  return model.toLowerCase()
}

export function isCompatInternalUser(): boolean {
  return process.env.USER_TYPE === 'ant'
}

export function getCompatModelEffortSupport(
  model: string,
): boolean | undefined {
  const supported3P = get3PModelCapabilityOverride(model, 'effort')
  if (supported3P !== undefined) {
    return supported3P
  }

  const m = normalizedModel(model)
  if (m.includes('opus-4-6') || m.includes('sonnet-4-6')) {
    return true
  }
  if (m.includes('haiku') || m.includes('sonnet') || m.includes('opus')) {
    return false
  }

  return undefined
}

export function getCompatDefaultModelEffortSupport(): boolean {
  return getAPIProvider() === 'firstParty'
}

export function getCompatModelMaxEffortSupport(
  model: string,
): boolean | undefined {
  const supported3P = get3PModelCapabilityOverride(model, 'max_effort')
  if (supported3P !== undefined) {
    return supported3P
  }
  if (normalizedModel(model).includes('opus-4-6')) {
    return true
  }
  if (isCompatInternalUser() && resolveAntModel(model)) {
    return true
  }
  return undefined
}

export function canPersistCompatMaxEffort(): boolean {
  return isCompatInternalUser()
}

export function convertCompatNumericEffortToLevel(
  value: number,
): EffortLevel | undefined {
  if (!isCompatInternalUser()) {
    return undefined
  }
  if (value <= 50) return 'low'
  if (value <= 85) return 'medium'
  if (value <= 100) return 'high'
  return 'max'
}

export function getCompatInternalNumericEffortDescription(
  value: number,
): string | undefined {
  if (!isCompatInternalUser()) {
    return undefined
  }
  return `[DSXU-INTERNAL] Numeric effort value of ${value}`
}

export function getCompatMaxEffortDescription(): string {
  return 'Maximum capability with deepest reasoning'
}

export function getCompatDefaultEffortConfig(): CompatDefaultEffortConfig {
  const config = getFeatureValue_CACHED_MAY_BE_STALE(
    'tengu_grey_step2',
    COMPAT_DEFAULT_EFFORT_CONFIG_DEFAULT,
  )
  return {
    ...COMPAT_DEFAULT_EFFORT_CONFIG_DEFAULT,
    ...config,
  }
}

export function getCompatDefaultEffortForInternalModel(
  model: string,
): CompatEffortValue | undefined {
  if (!isCompatInternalUser()) {
    return undefined
  }

  const config = getAntModelOverrideConfig()
  const isDefaultModel =
    config?.defaultModel !== undefined &&
    normalizedModel(model) === normalizedModel(config.defaultModel)
  if (isDefaultModel && config?.defaultModelEffortLevel) {
    return config.defaultModelEffortLevel
  }

  const antModel = resolveAntModel(model)
  if (antModel?.defaultEffortLevel) {
    return antModel.defaultEffortLevel
  }
  if (antModel?.defaultEffortValue !== undefined) {
    return antModel.defaultEffortValue
  }

  return undefined
}

export function getCompatDefaultEffortForKnownModel(
  model: string,
): CompatEffortValue | undefined {
  if (normalizedModel(model).includes('opus-4-6')) {
    if (isProSubscriber()) {
      return 'medium'
    }
    if (
      getCompatDefaultEffortConfig().enabled &&
      (isMaxSubscriber() || isTeamSubscriber())
    ) {
      return 'medium'
    }
  }
  return undefined
}

export function isCompatDefaultEffortCalloutModel(model: string): boolean {
  const parsed = parseUserSpecifiedModel(model)
  return normalizedModel(parsed).includes('opus-4-6')
}
