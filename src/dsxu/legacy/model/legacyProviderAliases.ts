export const COMPAT_LEGACY_MODEL_ALIASES = [
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

export const COMPAT_MODEL_FAMILY_ALIASES = [
  'sonnet',
  'opus',
  'haiku',
  'deepseek',
] as const

export function isCompatPlanningRouteAlias(
  modelSetting: string | null | undefined,
): boolean {
  return modelSetting === 'opusplan'
}
