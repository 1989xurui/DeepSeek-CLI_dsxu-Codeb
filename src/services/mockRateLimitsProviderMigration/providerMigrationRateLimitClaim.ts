export function isProviderMigrationHighTierRateLimitClaim(
  rateLimitType: string | undefined,
): boolean {
  return rateLimitType === 'seven_day_opus'
}
