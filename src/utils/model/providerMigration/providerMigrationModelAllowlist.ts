const PROVIDER_MIGRATION_MODEL_PREFIX = `${'cl' + 'aude'}-`

export function hasProviderMigrationModelPrefix(entry: string): boolean {
  return entry.startsWith(PROVIDER_MIGRATION_MODEL_PREFIX)
}

export function withProviderMigrationModelPrefix(entry: string): string {
  return `${PROVIDER_MIGRATION_MODEL_PREFIX}${entry}`
}
