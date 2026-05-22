import type { Notification } from 'src/context/notifications.js'
import { type GlobalConfig, getGlobalConfig } from 'src/utils/config.js'
import { useStartupNotification } from './useStartupNotification.js'

// Shows a one-time notification right after a model migration writes its
// timestamp to config. Each entry reads its own timestamp field(s) and emits
// a notification if the write happened within the last 3s of this launch.
// Future model migrations: add an entry to MIGRATIONS below.
const MIGRATIONS: ((config: GlobalConfig) => Notification | undefined)[] = [
  // Provider-migration standard-model migration for premium users.
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
  // Provider-migration high-capacity migration. Both paths land on the current
  // high-capacity default for first-party compatibility.
  config => {
    const providerMigrationRemapTimestamp = configNumber(config, [
      'legacy',
      'Op',
      'usMigrationTimestamp',
    ])
    const timestamp =
      providerMigrationRemapTimestamp ??
      configNumber(config, ['op', 'usProMigrationTimestamp'])
    const isProviderMigrationRemap = Boolean(providerMigrationRemapTimestamp)
    if (!recent(timestamp)) return
    return {
      key: 'high-capacity-model-update',
      text: isProviderMigrationRemap
        ? 'Model updated to the current high-capacity coding model; set DSXU_CODE_DISABLE_PROVIDER_MIGRATION_MODEL_REMAP=1 to opt out'
        : 'Model updated to the current high-capacity coding model',
      color: 'suggestion',
      priority: 'high',
      timeoutMs: isProviderMigrationRemap ? 8000 : 3000,
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
