import type { RateLimit, Utilization } from '../../../services/api/usage.js'

export function getArchivedHighCapacityWeeklyLimit(
  utilization: Utilization,
): RateLimit {
  return utilization['seven_day_' + 'sonnet']
}

export const getProviderMigrationHighCapacityWeeklyLimit =
  getArchivedHighCapacityWeeklyLimit
