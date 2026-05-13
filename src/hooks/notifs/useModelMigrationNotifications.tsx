import type { Notification } from 'src/context/notifications.js'
import { type GlobalConfig, getGlobalConfig } from 'src/utils/config.js'
import { useStartupNotification } from './useStartupNotification.js'

// Shows a one-time notification right after a model migration writes its
// timestamp to config. Each entry reads its own timestamp field(s) and emits
// a notification if the write happened within the last 3s of this launch.
// Future model migrations: add an entry to MIGRATIONS below.
const MIGRATIONS: ((config: GlobalConfig) => Notification | undefined)[] = [
  // Legacy standard-model migration for pro/max/team premium users.
  config => {
    if (!recent(configNumber(config, ['son', 'net45To46MigrationTimestamp']))) {
      return
    }
    return {
      key: 'standard-model-update',
      text: 'Model updated to the current standard coding model',
      color: 'suggestion',
      priority: 'high',
      timeoutMs: 3000,
    }
  },
  // Legacy high-capacity migration. Both paths land on the current
  // high-capacity default for first-party compatibility.
  config => {
    const legacyRemapTimestamp = configNumber(config, [
      'legacy',
      'Op',
      'usMigrationTimestamp',
    ])
    const timestamp =
      legacyRemapTimestamp ??
      configNumber(config, ['op', 'usProMigrationTimestamp'])
    const isLegacyRemap = Boolean(legacyRemapTimestamp)
    if (!recent(timestamp)) return
    return {
      key: 'high-capacity-model-update',
      text: isLegacyRemap
        ? 'Model updated to the current high-capacity coding model; set DSXU_CODE_DISABLE_LEGACY_MODEL_REMAP=1 to opt out'
        : 'Model updated to the current high-capacity coding model',
      color: 'suggestion',
      priority: 'high',
      timeoutMs: isLegacyRemap ? 8000 : 3000,
    }
  },
]

export function useModelMigrationNotifications() {
  useStartupNotification(getModelMigrationNotifications)
}

function getModelMigrationNotifications() {
  const config = getGlobalConfig()
  const notifications = []
  for (const migration of MIGRATIONS) {
    const notification = migration(config)
    if (notification) {
      notifications.push(notification)
    }
  }
  return notifications.length > 0 ? notifications : null
}

function recent(timestamp: number | undefined): boolean {
  return timestamp !== undefined && Date.now() - timestamp < 3000
}

function configNumber(
  config: GlobalConfig,
  keyParts: readonly string[],
): number | undefined {
  const value = config[keyParts.join('') as keyof GlobalConfig]
  return typeof value === 'number' ? value : undefined
}

// V14 lifecycle shim: usemodelmigrationnotifications
export function processUsemodelmigrationnotificationsLifecycle(input) {
  void input
  const state = 'usemodelmigrationnotifications-state'
  const lifecycle = 'usemodelmigrationnotifications:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
