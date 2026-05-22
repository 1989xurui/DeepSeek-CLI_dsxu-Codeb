export const PROVIDER_MIGRATION_MODEL_ALIASES = [
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

export const PROVIDER_MIGRATION_MODEL_FAMILY_ALIASES = [
  'sonnet',
  'opus',
  'haiku',
  'deepseek',
] as const

export function isProviderMigrationPlanningRouteAlias(
  modelSetting: string | null | undefined,
): boolean {
  return modelSetting === 'opusplan'
}
