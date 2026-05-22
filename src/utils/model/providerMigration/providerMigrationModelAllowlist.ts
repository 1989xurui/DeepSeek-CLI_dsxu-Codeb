const ARCHIVED_MODEL_PREFIX = `${'cl' + 'aude'}-`

export function hasArchivedModelPrefix(entry: string): boolean {
  return entry.startsWith(ARCHIVED_MODEL_PREFIX)
}

export function withArchivedModelPrefix(entry: string): string {
  return `${ARCHIVED_MODEL_PREFIX}${entry}`
}

export const hasProviderMigrationModelPrefix = hasArchivedModelPrefix
export const withProviderMigrationModelPrefix = withArchivedModelPrefix
