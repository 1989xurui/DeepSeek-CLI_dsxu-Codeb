import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../../services/analytics/featureFlags.js'
import type { EffortLevel } from '../../../entrypoints/sdk/runtimeTypes.js'
import { isMaxSubscriber, isProSubscriber, isTeamSubscriber } from '../../auth.js'
import { getAPIProvider } from '../providers.js'
import { get3PModelCapabilityOverride } from '../modelSupportOverrides.js'
import {
  getAntModelOverrideConfig,
  resolveAntModel,
} from '../antModels.js'
import { parseUserSpecifiedModel } from './providerMigrationModel.js'

export type ProviderMigrationEffortValue = EffortLevel | number

export type ProviderMigrationDefaultEffortConfig = {
  enabled: boolean
  dialogTitle: string
  dialogDescription: string
}

const PROVIDER_MIGRATION_DEFAULT_EFFORT_CONFIG_DEFAULT: ProviderMigrationDefaultEffortConfig = {
  enabled: true,
  dialogTitle: 'We recommend medium effort',
  dialogDescription:
    'Effort determines how long DSXU thinks for when completing your task. We recommend medium effort for most tasks to balance speed and intelligence and maximize rate limits. Use ultrathink to trigger high effort when needed.',
}

function normalizedModel(model: string): string {
  return model.toLowerCase()
}

export function isProviderMigrationInternalUser(): boolean {
  return process.env.USER_TYPE === 'ant'
}

export function getProviderMigrationModelEffortSupport(
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

export function getProviderMigrationDefaultModelEffortSupport(): boolean {
  return getAPIProvider() === 'firstParty'
}

export function getProviderMigrationModelMaxEffortSupport(
  model: string,
): boolean | undefined {
  const supported3P = get3PModelCapabilityOverride(model, 'max_effort')
  if (supported3P !== undefined) {
    return supported3P
  }
  if (normalizedModel(model).includes('opus-4-6')) {
    return true
  }
  if (isProviderMigrationInternalUser() && resolveAntModel(model)) {
    return true
  }
  return undefined
}

export function canPersistProviderMigrationMaxEffort(): boolean {
  return isProviderMigrationInternalUser()
}

export function convertProviderMigrationNumericEffortToLevel(
  value: number,
): EffortLevel | undefined {
  if (!isProviderMigrationInternalUser()) {
    return undefined
  }
  if (value <= 50) return 'low'
  if (value <= 85) return 'medium'
  if (value <= 100) return 'high'
  return 'max'
}

export function getProviderMigrationInternalNumericEffortDescription(
  value: number,
): string | undefined {
  if (!isProviderMigrationInternalUser()) {
    return undefined
  }
  return `[DSXU-INTERNAL] Numeric effort value of ${value}`
}

export function getProviderMigrationMaxEffortDescription(): string {
  return 'Maximum capability with deepest reasoning'
}

export function getProviderMigrationDefaultEffortConfig(): ProviderMigrationDefaultEffortConfig {
  const config = getFeatureValue_CACHED_MAY_BE_STALE(
    'tengu_grey_step2',
    PROVIDER_MIGRATION_DEFAULT_EFFORT_CONFIG_DEFAULT,
  )
  return {
    ...PROVIDER_MIGRATION_DEFAULT_EFFORT_CONFIG_DEFAULT,
    ...config,
  }
}

export function getProviderMigrationDefaultEffortForInternalModel(
  model: string,
): ProviderMigrationEffortValue | undefined {
  if (!isProviderMigrationInternalUser()) {
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

export function getProviderMigrationDefaultEffortForKnownModel(
  model: string,
): ProviderMigrationEffortValue | undefined {
  if (normalizedModel(model).includes('opus-4-6')) {
    if (isProSubscriber()) {
      return 'medium'
    }
    if (
      getProviderMigrationDefaultEffortConfig().enabled &&
      (isMaxSubscriber() || isTeamSubscriber())
    ) {
      return 'medium'
    }
  }
  return undefined
}

export function isProviderMigrationDefaultEffortCalloutModel(model: string): boolean {
  const parsed = parseUserSpecifiedModel(model)
  return normalizedModel(parsed).includes('opus-4-6')
}
