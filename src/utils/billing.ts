import {
  getProviderApiKey,
  getAuthTokenSource,
  getSubscriptionType,
  isDSXUAISubscriber,
} from './auth.js'
import { getUsableApiKey } from './authPortable.js'
import { getGlobalConfig } from './config.js'
import { isEnvTruthy } from './envUtils.js'

export function hasConsoleBillingAccess(): boolean {
  // Check if cost reporting is disabled via environment variable
  if (isEnvTruthy(process.env.DISABLE_COST_WARNINGS)) {
    return false
  }

  const isSubscriber = isDSXUAISubscriber()

  // This might be wrong if user is signed into Max but also using an API key, but
  // we already show a warning on launch in that case
  if (isSubscriber) return false

  // Check if user has any form of authentication
  const authSource = getAuthTokenSource()
  const hasApiKey = getProviderApiKey() !== null

  // If user has no authentication at all (logged out), don't show costs
  if (!authSource.hasToken && !hasApiKey) {
    return false
  }

  const config = getGlobalConfig()
  const orgRole = config.oauthAccount?.organizationRole
  const workspaceRole = config.oauthAccount?.workspaceRole

  if (!orgRole || !workspaceRole) {
    return false // hide cost for grandfathered users who have not re-authed since we've added roles
  }

  // Users have billing access if they are admins or billing roles at either workspace or organization level
  return (
    ['admin', 'billing'].includes(orgRole) ||
    ['workspace_admin', 'workspace_billing'].includes(workspaceRole)
  )
}

// Mock billing access for /mock-limits testing (set by mockRateLimits.ts)
let mockBillingAccessOverride: boolean | null = null

export function setMockBillingAccessOverride(value: boolean | null): void {
  mockBillingAccessOverride = value
}

export function hasDSXUAiBillingAccess(): boolean {
  // Check for mock billing access first (for /mock-limits testing)
  if (mockBillingAccessOverride !== null) {
    return mockBillingAccessOverride
  }

  if (!isDSXUAISubscriber()) {
    return false
  }

  const subscriptionType = getSubscriptionType()

  // Consumer plans (Max/Pro) - individual users always have billing access
  if (subscriptionType === 'max' || subscriptionType === 'pro') {
    return true
  }

  // Team/Enterprise - check for admin or billing roles
  const config = getGlobalConfig()
  const orgRole = config.oauthAccount?.organizationRole

  return (
    !!orgRole &&
    ['admin', 'billing', 'owner', 'primary_owner'].includes(orgRole)
  )
}

export const hasLegacyCloudBillingAccess = hasDSXUAiBillingAccess

export function hasDsxuBillingAccess(): boolean {
  // DSXU can run with API-key providers, local gateways, or migrated account
  // state. Cost/limit recovery should not be gated on a legacy cloud subscription.
  if (mockBillingAccessOverride !== null) {
    return mockBillingAccessOverride
  }

  if (
    getUsableApiKey(
      process.env.DSXU_API_KEY,
      process.env.DSXU_DEEPSEEK_API_KEY,
      process.env.DEEPSEEK_API_KEY,
      process.env.LITELLM_API_KEY,
    ) ||
    process.env.LITELLM_BASE_URL
  ) {
    return true
  }

  return hasConsoleBillingAccess() || hasDSXUAiBillingAccess()
}
