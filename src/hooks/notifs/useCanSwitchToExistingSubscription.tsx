import * as React from 'react';
import { getOauthProfileFromApiKey } from 'src/services/oauth/getOauthProfile.js';
import { isProviderSubscriptionAccount } from 'src/utils/auth.js';
import { isDsxuRuntimeMode } from 'src/utils/envUtils.js';
import { Text } from '../../ink.js';
import { logEvent } from '../../services/analytics/index.js';
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js';
import { useStartupNotification } from './useStartupNotification.js';
const MAX_SHOW_COUNT = 3;

/**
 * Hook to check if the user has an archived subscription on Console
 * but is not logged into it.
 */
export function useCanSwitchToExistingSubscription() {
  useStartupNotification(_temp2);
}

/**
 * Checks whether an archived account can switch to a subscription
 * login. DSXU runtime owns identity through the DSXU Provider and never shows
 * this migration hint.
 */
async function _temp2() {
  if (isDsxuRuntimeMode()) {
    return null;
  }
  if ((getGlobalConfig().subscriptionNoticeCount ?? 0) >= MAX_SHOW_COUNT) {
    return null;
  }
  const subscriptionType = await getExistingDSXUSubscription();
  if (subscriptionType === null) {
    return null;
  }
  saveGlobalConfig(_temp);
  logEvent("tengu_switch_to_subscription_notice_shown", {});
  return {
    key: "switch-to-subscription",
    jsx: <Text color="suggestion">Use your existing DSXU {subscriptionType} plan with DSXU Code<Text color="text" dimColor={true}>{" "}· /login to activate</Text></Text>,
    priority: "low"
  };
}
function _temp(current) {
  return {
    ...current,
    subscriptionNoticeCount: (current.subscriptionNoticeCount ?? 0) + 1
  };
}
async function getExistingDSXUSubscription(): Promise<'Max' | 'Pro' | null> {
  // If already using subscription auth, there is nothing to switch to
  if (isProviderSubscriptionAccount()) {
    return null;
  }
  const profile = await getOauthProfileFromApiKey();
  if (!profile) {
    return null;
  }
  if (profile.account.has_dsxu_max) {
    return 'Max';
  }
  if (profile.account.has_dsxu_pro) {
    return 'Pro';
  }
  return null;
}
