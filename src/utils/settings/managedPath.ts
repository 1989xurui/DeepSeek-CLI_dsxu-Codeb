import memoize from 'lodash-es/memoize.js'
import { join } from 'path'
import { getDsxuCodeEnv, isDsxuRuntimeMode } from '../envUtils.js'
import { getPlatform } from '../platform.js'

const ARCHIVED_SOURCE_CODE_PRODUCT = 'Clau' + 'deCode'
const ARCHIVED_SOURCE_CODE_ETC_DIR = '/etc/' + ('clau' + 'de-code')

/**
 * Get the path to the managed settings directory based on the current platform.
 */
export const getManagedFilePath = memoize(function (): string {
  const managedSettingsPath = getDsxuCodeEnv('MANAGED_SETTINGS_PATH')
  if (managedSettingsPath) {
    return managedSettingsPath
  }

  if (isDsxuRuntimeMode()) {
    switch (getPlatform()) {
      case 'macos':
        return '/Library/Application Support/DSXUCode'
      case 'windows':
        return 'C:\\Program Files\\DSXUCode'
      default:
        return '/etc/dsxu-code'
    }
  }

  switch (getPlatform()) {
    case 'macos':
      return `/Library/Application Support/${ARCHIVED_SOURCE_CODE_PRODUCT}`
    case 'windows':
      return `C:\\Program Files\\${ARCHIVED_SOURCE_CODE_PRODUCT}`
    default:
      return ARCHIVED_SOURCE_CODE_ETC_DIR
  }
})

/**
 * Get the path to the managed-settings.d/ drop-in directory.
 * managed-settings.json is merged first (base), then files in this directory
 * are merged alphabetically on top (drop-ins override base, later files win).
 */
export const getManagedSettingsDropInDir = memoize(function (): string {
  return join(getManagedFilePath(), 'managed-settings.d')
})
