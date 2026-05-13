const COMPAT_PROVIDER_MODEL_PREFIX = `${'cl' + 'aude'}-`

export function hasCompatProviderModelPrefix(entry: string): boolean {
  return entry.startsWith(COMPAT_PROVIDER_MODEL_PREFIX)
}

export function withCompatProviderModelPrefix(entry: string): string {
  return `${COMPAT_PROVIDER_MODEL_PREFIX}${entry}`
}
