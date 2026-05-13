import type { RateLimit, Utilization } from '../../../services/api/usage.js'

export function getCompatHighCapacityWeeklyLimit(
  utilization: Utilization,
): RateLimit {
  return utilization['seven_day_' + 'sonnet']
}
