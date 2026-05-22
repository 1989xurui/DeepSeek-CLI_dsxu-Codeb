export const ARCHIVED_MODEL_ALIASES = [
  'flash',
  'fast',
  'sonnet',
  'opus',
  'haiku',
  'best',
  'sonnet[1m]',
  'opus[1m]',
  'opusplan',
] as const

export const ARCHIVED_MODEL_FAMILY_ALIASES = [
  'sonnet',
  'opus',
  'haiku',
  'deepseek',
] as const

export const PROVIDER_MIGRATION_MODEL_ALIASES = ARCHIVED_MODEL_ALIASES
export const PROVIDER_MIGRATION_MODEL_FAMILY_ALIASES =
  ARCHIVED_MODEL_FAMILY_ALIASES

export function isArchivedPlanningRouteAlias(
  modelSetting: string | null | undefined,
): boolean {
  return modelSetting === 'opusplan'
}

export const isProviderMigrationPlanningRouteAlias =
  isArchivedPlanningRouteAlias
