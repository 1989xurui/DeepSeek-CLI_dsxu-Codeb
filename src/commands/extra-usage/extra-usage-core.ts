import {
  checkAdminRequestEligibility,
  createAdminRequest,
  getMyAdminRequests,
} from '../../services/api/adminRequests.js'
import { invalidateOverageCreditGrantCache } from '../../services/api/overageCreditGrant.js'
import { type ExtraUsage, fetchUtilization } from '../../services/api/usage.js'
import { getSubscriptionType } from '../../utils/auth.js'
import { hasProviderSubscriptionBillingAccess } from '../../services/auth/dsxuBillingAccess.js'
import { openBrowser } from '../../utils/browser.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'
import { isDsxuRuntimeMode } from '../../utils/envUtils.js'
import { logError } from '../../utils/log.js'

type ExtraUsageResult =
  | { type: 'message'; value: string }
  | { type: 'browser-opened'; url: string; opened: boolean }

export async function runExtraUsage(): Promise<ExtraUsageResult> {
  if (!getGlobalConfig().hasVisitedExtraUsage) {
    saveGlobalConfig(prev => ({ ...prev, hasVisitedExtraUsage: true }))
  }
  // Invalidate only the current org's entry so a follow-up read refetches
  // the granted state. Separate from the visited flag since users may run
  // /extra-usage more than once while iterating on the claim flow.
  invalidateOverageCreditGrantCache()

  if (isDsxuRuntimeMode()) {
    return {
      type: 'message',
      value:
        'DSXU Code usage is managed by the local DSXU cost ledger and provider billing settings. Use /cost for this session, and configure DeepSeek/provider limits in DSXU model settings.',
    }
  }

  const subscriptionType = getSubscriptionType()
  const isTeamOrEnterprise =
    subscriptionType === 'team' || subscriptionType === 'enterprise'
  const hasBillingAccess = hasProviderSubscriptionBillingAccess()

  if (!hasBillingAccess && isTeamOrEnterprise) {
    // Mirror apps/dsxu-ai useHasUnlimitedOverage(): if overage is enabled
    // with no monthly cap, there is nothing to request. On fetch error, fall
    // through and let the user ask (matching web's "err toward show" behavior).
    let extraUsage: ExtraUsage | null | undefined
    try {
      const utilization = await fetchUtilization()
      extraUsage = utilization?.extra_usage
    } catch (error) {
      logError(error as Error)
    }

    if (extraUsage?.is_enabled && extraUsage.monthly_limit === null) {
      return {
        type: 'message',
        value:
          'Your organization already has unlimited extra usage. No request needed.',
      }
    }

    try {
      const eligibility = await checkAdminRequestEligibility('limit_increase')
      if (eligibility?.is_allowed === false) {
        return {
          type: 'message',
          value: 'Please contact your admin to manage extra usage settings.',
        }
      }
    } catch (error) {
      logError(error as Error)
      // If eligibility check fails, continue — the create endpoint will enforce if necessary
    }

    try {
      const pendingOrDismissedRequests = await getMyAdminRequests(
        'limit_increase',
        ['pending', 'dismissed'],
      )
      if (pendingOrDismissedRequests && pendingOrDismissedRequests.length > 0) {
        return {
          type: 'message',
          value:
            'You have already submitted a request for extra usage to your admin.',
        }
      }
    } catch (error) {
      logError(error as Error)
      // Fall through to creating a new request below
    }

    try {
      await createAdminRequest({
        request_type: 'limit_increase',
        details: null,
      })
      return {
        type: 'message',
        value: extraUsage?.is_enabled
          ? 'Request sent to your admin to increase extra usage.'
          : 'Request sent to your admin to enable extra usage.',
      }
    } catch (error) {
      logError(error as Error)
      // Fall through to generic message below
    }

    return {
      type: 'message',
      value: 'Please contact your admin to manage extra usage settings.',
    }
  }

  const url = isTeamOrEnterprise
    ? 'https://docs.dsxu.local/admin/usage'
    : 'https://docs.dsxu.local/usage'

  try {
    const opened = await openBrowser(url)
    return { type: 'browser-opened', url, opened }
  } catch (error) {
    logError(error as Error)
    return {
      type: 'message',
      value: `Failed to open browser. Please visit ${url} to manage extra usage.`,
    }
  }
}

export function getDsxuExtraUsageRuntimeProfile(): {
  command: '/extra-usage'
  runtime: 'DSXU Provider Usage Guard'
  activationEvidence: readonly string[]
  archivedIsolation: readonly string[]
} {
  return {
    command: '/extra-usage',
    runtime: 'DSXU Provider Usage Guard',
    activationEvidence: [
      'DSXU_CODE_MODE returns local provider-usage guidance before provider billing checks',
      'DSXU users are directed to /cost and DSXU model settings',
      'no provider usage URL is opened in DSXU runtime',
    ],
    archivedIsolation: [
      'provider admin/settings usage URLs are runtime-gated outside DSXU mode',
      'provider admin request APIs are bypassed in DSXU runtime',
    ],
  }
}
