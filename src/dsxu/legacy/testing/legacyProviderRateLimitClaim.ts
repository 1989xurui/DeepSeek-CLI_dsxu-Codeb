export function isCompatHighTierRateLimitClaim(
  rateLimitType: string | undefined,
): boolean {
  return rateLimitType === 'seven_day_opus'
}
