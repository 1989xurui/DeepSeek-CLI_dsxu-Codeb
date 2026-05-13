const LEGACY_WEB_SEARCH_MODEL_PREFIX = 'clau' + 'de'

export function isCompatWebSearchCapableModel(model: string): boolean {
  return (
    model.includes(`${LEGACY_WEB_SEARCH_MODEL_PREFIX}-opus-4`) ||
    model.includes(`${LEGACY_WEB_SEARCH_MODEL_PREFIX}-sonnet-4`) ||
    model.includes(`${LEGACY_WEB_SEARCH_MODEL_PREFIX}-haiku-4`)
  )
}
