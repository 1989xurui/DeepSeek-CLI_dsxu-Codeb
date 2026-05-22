const ARCHIVED_WEB_SEARCH_MODEL_PREFIX = 'clau' + 'de'

export function isArchivedWebSearchCapableModel(model: string): boolean {
  return (
    model.includes(`${ARCHIVED_WEB_SEARCH_MODEL_PREFIX}-opus-4`) ||
    model.includes(`${ARCHIVED_WEB_SEARCH_MODEL_PREFIX}-sonnet-4`) ||
    model.includes(`${ARCHIVED_WEB_SEARCH_MODEL_PREFIX}-haiku-4`)
  )
}

export const isProviderMigrationWebSearchCapableModel = isArchivedWebSearchCapableModel
