import {
  PROVIDER_MIGRATION_MODEL_ALIASES,
  PROVIDER_MIGRATION_MODEL_FAMILY_ALIASES,
} from './providerMigration/providerMigrationAliases.js'

export const PROVIDER_MIGRATION_SOURCE_MODEL_ALIASES = PROVIDER_MIGRATION_MODEL_ALIASES

export const DSXU_PUBLIC_MODEL_ALIASES = [
  'flash',
  'flash-max',
  'pro',
  'coder',
  'planner',
  'reviewer',
  'recovery',
] as const

export const DSXU_AGENT_MODEL_ALIASES = [
  ...DSXU_PUBLIC_MODEL_ALIASES,
  'inherit',
] as const

export const MODEL_ALIASES = [
  ...PROVIDER_MIGRATION_SOURCE_MODEL_ALIASES,
  ...DSXU_PUBLIC_MODEL_ALIASES.filter(alias => alias !== 'flash'),
] as const
export type ModelAlias = (typeof MODEL_ALIASES)[number]
export type ProviderMigrationModelAlias = (typeof PROVIDER_MIGRATION_SOURCE_MODEL_ALIASES)[number]
export type DsxuPublicModelAlias = (typeof DSXU_PUBLIC_MODEL_ALIASES)[number]
export type DsxuAgentModelAlias = (typeof DSXU_AGENT_MODEL_ALIASES)[number]

export function isModelAlias(modelInput: string): modelInput is ModelAlias {
  return MODEL_ALIASES.includes(modelInput as ModelAlias)
}

export function isProviderMigrationModelAlias(modelInput: string): modelInput is ProviderMigrationModelAlias {
  return PROVIDER_MIGRATION_SOURCE_MODEL_ALIASES.includes(modelInput as ProviderMigrationModelAlias)
}

export function isDsxuPublicModelAlias(modelInput: string): modelInput is DsxuPublicModelAlias {
  return DSXU_PUBLIC_MODEL_ALIASES.includes(modelInput as DsxuPublicModelAlias)
}

/**
 * Bare model family aliases that act as wildcards in the availableModels allowlist.
 * When a family alias is in the allowlist, any model in that family is allowed.
 * When a specific model ID is in the allowlist, only that exact version is allowed.
 */
export const MODEL_FAMILY_ALIASES = PROVIDER_MIGRATION_MODEL_FAMILY_ALIASES

export function isModelFamilyAlias(model: string): boolean {
  return (MODEL_FAMILY_ALIASES as readonly string[]).includes(model)
}
