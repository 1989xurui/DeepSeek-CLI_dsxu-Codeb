import {
  COMPAT_LEGACY_MODEL_ALIASES,
  COMPAT_MODEL_FAMILY_ALIASES,
} from '../../dsxu/legacy/model/legacyProviderAliases.js'

export const LEGACY_MODEL_COMPAT_ALIASES = COMPAT_LEGACY_MODEL_ALIASES

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
  ...LEGACY_MODEL_COMPAT_ALIASES,
  ...DSXU_PUBLIC_MODEL_ALIASES.filter(alias => alias !== 'flash'),
] as const
export type ModelAlias = (typeof MODEL_ALIASES)[number]
export type LegacyModelCompatAlias = (typeof LEGACY_MODEL_COMPAT_ALIASES)[number]
export type DsxuPublicModelAlias = (typeof DSXU_PUBLIC_MODEL_ALIASES)[number]
export type DsxuAgentModelAlias = (typeof DSXU_AGENT_MODEL_ALIASES)[number]

export function isModelAlias(modelInput: string): modelInput is ModelAlias {
  return MODEL_ALIASES.includes(modelInput as ModelAlias)
}

export function isLegacyModelCompatAlias(modelInput: string): modelInput is LegacyModelCompatAlias {
  return LEGACY_MODEL_COMPAT_ALIASES.includes(modelInput as LegacyModelCompatAlias)
}

export function isDsxuPublicModelAlias(modelInput: string): modelInput is DsxuPublicModelAlias {
  return DSXU_PUBLIC_MODEL_ALIASES.includes(modelInput as DsxuPublicModelAlias)
}

/**
 * Bare model family aliases that act as wildcards in the availableModels allowlist.
 * When a family alias is in the allowlist, any model in that family is allowed.
 * When a specific model ID is in the allowlist, only that exact version is allowed.
 */
export const MODEL_FAMILY_ALIASES = COMPAT_MODEL_FAMILY_ALIASES

export function isModelFamilyAlias(model: string): boolean {
  return (MODEL_FAMILY_ALIASES as readonly string[]).includes(model)
}


// V14 lifecycle shim: aliases
export function processAliasesLifecycle(input) {
  void input
  const state = 'aliases-state'
  const lifecycle = 'aliases:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
