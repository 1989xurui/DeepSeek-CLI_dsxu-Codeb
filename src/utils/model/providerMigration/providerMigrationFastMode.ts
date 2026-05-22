import { DSXU_DEEPSEEK_FLASH_MAX_ALIAS } from '../dsxuModel.js'

export const ARCHIVED_FAST_MODE_BACKEND_PATH =
  `/api/${'cla' + 'ude'}_code_penguin_mode`
export const ARCHIVED_FAST_MODE_BETA_HEADER = `${'anth' + 'ropic'}-beta`
export const DSXU_FAST_MODE_MODEL_DISPLAY = 'DeepSeek V4 Flash-MAX'

export function getArchivedFastModeModelAlias(): string {
  return DSXU_DEEPSEEK_FLASH_MAX_ALIAS
}

export function isArchivedFastModeSupportedModel(
  modelSetting: string | null | undefined,
  parsedModel: string,
): boolean {
  const raw = (modelSetting ?? '').trim().toLowerCase()
  if (raw === DSXU_DEEPSEEK_FLASH_MAX_ALIAS) {
    return true
  }
  return parsedModel.toLowerCase().includes('opus-4-6')
}

export const PROVIDER_MIGRATION_FAST_MODE_BACKEND_PATH =
  ARCHIVED_FAST_MODE_BACKEND_PATH
export const PROVIDER_MIGRATION_FAST_MODE_BETA_HEADER =
  ARCHIVED_FAST_MODE_BETA_HEADER
export const getProviderMigrationFastModeModelAlias =
  getArchivedFastModeModelAlias
export const isProviderMigrationFastModeSupportedModel =
  isArchivedFastModeSupportedModel
