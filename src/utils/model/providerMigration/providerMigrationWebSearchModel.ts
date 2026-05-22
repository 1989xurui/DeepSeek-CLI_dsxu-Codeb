const PROVIDER_MIGRATION_WEB_SEARCH_MODEL_PREFIX = 'clau' + 'de'

export function isProviderMigrationWebSearchCapableModel(model: string): boolean {
  return (
    model.includes(`${PROVIDER_MIGRATION_WEB_SEARCH_MODEL_PREFIX}-opus-4`) ||
    model.includes(`${PROVIDER_MIGRATION_WEB_SEARCH_MODEL_PREFIX}-sonnet-4`) ||
    model.includes(`${PROVIDER_MIGRATION_WEB_SEARCH_MODEL_PREFIX}-haiku-4`)
  )
}
