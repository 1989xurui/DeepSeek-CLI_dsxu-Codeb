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

export type ArchivedEffortValue = EffortLevel | number

export type ArchivedDefaultEffortConfig = {
  enabled: boolean
  dialogTitle: string
  dialogDescription: string
}

const ARCHIVED_DEFAULT_EFFORT_CONFIG_DEFAULT: ArchivedDefaultEffortConfig = {
  enabled: true,
  dialogTitle: 'We recommend medium effort',
  dialogDescription:
    'Effort determines how long DSXU thinks for when completing your task. We recommend medium effort for most tasks to balance speed and intelligence and maximize rate limits. Use ultrathink to trigger high effort when needed.',
}

function normalizedModel(model: string): string {
  return model.toLowerCase()
}

export function isArchivedInternalUser(): boolean {
  return process.env.USER_TYPE === 'ant'
}

export function getArchivedModelEffortSupport(
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

export function getArchivedDefaultModelEffortSupport(): boolean {
  return getAPIProvider() === 'firstParty'
}

export function getArchivedModelMaxEffortSupport(
  model: string,
): boolean | undefined {
  const supported3P = get3PModelCapabilityOverride(model, 'max_effort')
  if (supported3P !== undefined) {
    return supported3P
  }
  if (normalizedModel(model).includes('opus-4-6')) {
    return true
  }
  if (isArchivedInternalUser() && resolveAntModel(model)) {
    return true
  }
  return undefined
}

export function canPersistArchivedMaxEffort(): boolean {
  return isArchivedInternalUser()
}

export function convertArchivedNumericEffortToLevel(
  value: number,
): EffortLevel | undefined {
  if (!isArchivedInternalUser()) {
    return undefined
  }
  if (value <= 50) return 'low'
  if (value <= 85) return 'medium'
  if (value <= 100) return 'high'
  return 'max'
}

export function getArchivedInternalNumericEffortDescription(
  value: number,
): string | undefined {
  if (!isArchivedInternalUser()) {
    return undefined
  }
  return `[DSXU-INTERNAL] Numeric effort value of ${value}`
}

export function getArchivedMaxEffortDescription(): string {
  return 'Maximum capability with deepest reasoning'
}

export function getArchivedDefaultEffortConfig(): ArchivedDefaultEffortConfig {
  const config = getFeatureValue_CACHED_MAY_BE_STALE(
    'tengu_grey_step2',
    ARCHIVED_DEFAULT_EFFORT_CONFIG_DEFAULT,
  )
  return {
    ...ARCHIVED_DEFAULT_EFFORT_CONFIG_DEFAULT,
    ...config,
  }
}

export function getArchivedDefaultEffortForInternalModel(
  model: string,
): ArchivedEffortValue | undefined {
  if (!isArchivedInternalUser()) {
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

export function getArchivedDefaultEffortForKnownModel(
  model: string,
): ArchivedEffortValue | undefined {
  if (normalizedModel(model).includes('opus-4-6')) {
    if (isProSubscriber()) {
      return 'medium'
    }
    if (
      getArchivedDefaultEffortConfig().enabled &&
      (isMaxSubscriber() || isTeamSubscriber())
    ) {
      return 'medium'
    }
  }
  return undefined
}

export function isArchivedDefaultEffortCalloutModel(model: string): boolean {
  const parsed = parseUserSpecifiedModel(model)
  return normalizedModel(parsed).includes('opus-4-6')
}

export type ProviderMigrationEffortValue = ArchivedEffortValue
export type ProviderMigrationDefaultEffortConfig = ArchivedDefaultEffortConfig
export const isProviderMigrationInternalUser = isArchivedInternalUser
export const getProviderMigrationModelEffortSupport =
  getArchivedModelEffortSupport
export const getProviderMigrationDefaultModelEffortSupport =
  getArchivedDefaultModelEffortSupport
export const getProviderMigrationModelMaxEffortSupport =
  getArchivedModelMaxEffortSupport
export const canPersistProviderMigrationMaxEffort = canPersistArchivedMaxEffort
export const convertProviderMigrationNumericEffortToLevel =
  convertArchivedNumericEffortToLevel
export const getProviderMigrationInternalNumericEffortDescription =
  getArchivedInternalNumericEffortDescription
export const getProviderMigrationMaxEffortDescription =
  getArchivedMaxEffortDescription
export const getProviderMigrationDefaultEffortConfig =
  getArchivedDefaultEffortConfig
export const getProviderMigrationDefaultEffortForInternalModel =
  getArchivedDefaultEffortForInternalModel
export const getProviderMigrationDefaultEffortForKnownModel =
  getArchivedDefaultEffortForKnownModel
export const isProviderMigrationDefaultEffortCalloutModel =
  isArchivedDefaultEffortCalloutModel
