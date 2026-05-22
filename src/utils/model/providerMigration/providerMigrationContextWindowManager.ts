export function getArchivedContextWindowOverride(model: string): number | null {
  const m = model.toLowerCase()
  if (m.includes('[1m]') || m.includes('sonnet-4-6') || m.includes('opus-4-6')) {
    return 1_000_000
  }
  return null
}

export function getArchivedMaxOutputTokensOverride(
  model: string,
): { default: number; upperLimit: number } | null {
  const m = model.toLowerCase()
  if (m.includes('opus-4-6')) return { default: 64_000, upperLimit: 128_000 }
  if (m.includes('sonnet-4-6')) return { default: 32_000, upperLimit: 128_000 }
  if (m.includes('3-7-sonnet')) return { default: 32_000, upperLimit: 64_000 }
  return null
}

export const getProviderMigrationContextWindowOverride = getArchivedContextWindowOverride
export const getProviderMigrationMaxOutputTokensOverride = getArchivedMaxOutputTokensOverride
