import * as React from 'react';
import { clearTrustedDeviceTokenCache } from '../../services/bridge/dsxuRemoteBridgeFacade.js';
import { Text } from '../../ink.js';
import { refreshFeatureFlagsAfterAuthChange } from '../../services/analytics/featureFlags.js';
import { getGroveNoticeConfig, getGroveSettings } from '../../services/api/grove.js';
import { clearPolicyLimitsCache } from '../../services/policyLimits/index.js';
// flushTelemetry is loaded lazily to avoid pulling in ~1.1MB of OpenTelemetry at startup
import { clearRemoteManagedSettingsCache } from '../../services/remoteManagedSettings/index.js';
import { clearProviderControlTokenCache } from '../../services/auth/dsxuProviderControlAuth.js';
import { removeApiKey } from '../../utils/auth.js';
import { clearBetasCaches } from '../../utils/betas.js';
import { saveGlobalConfig } from '../../utils/config.js';
import { gracefulShutdownSync } from '../../utils/gracefulShutdown.js';
import { getSecureStorage } from '../../utils/secureStorage/index.js';
import { clearToolSchemaCache } from '../../utils/toolSchemaCache.js';
import { resetUserCache } from '../../utils/user.js';
export async function performLogout({
  clearOnboarding = false
}): Promise<void> {
  // Flush telemetry BEFORE clearing credentials to prevent org data leakage
  const {
    flushTelemetry
  } = await import('../../utils/telemetry/instrumentation.js');
  await flushTelemetry();
  await removeApiKey();

  // Wipe all secure storage data on logout
  const secureStorage = getSecureStorage();
  secureStorage.delete();
  await clearAuthRelatedCaches();
  saveGlobalConfig(current => {
    const updated = {
      ...current
    };
    if (clearOnboarding) {
      updated.hasCompletedOnboarding = false;
      updated.subscriptionNoticeCount = 0;
      if (updated.customApiKeyResponses?.approved) {
        updated.customApiKeyResponses = {
          ...updated.customApiKeyResponses,
          approved: []
        };
      }
    }
    updated.oauthAccount = undefined;
    return updated;
  });
}

// clearing anything memoized that must be invalidated when user/session/auth changes
export async function clearAuthRelatedCaches(): Promise<void> {
  // Clear the DSXU provider token cache
  clearProviderControlTokenCache();
  clearTrustedDeviceTokenCache();
  clearBetasCaches();
  clearToolSchemaCache();

  // Clear user data cache BEFORE feature flag provider refresh so it picks up fresh credentials
  resetUserCache();
  refreshFeatureFlagsAfterAuthChange();

  // Clear Grove config cache
  getGroveNoticeConfig.cache?.clear?.();
  getGroveSettings.cache?.clear?.();

  // Clear remotely managed settings cache
  await clearRemoteManagedSettingsCache();

  // Clear policy limits cache
  await clearPolicyLimitsCache();
}
export async function call(): Promise<React.ReactNode> {
  await performLogout({
    clearOnboarding: true
  });
  const message = <Text>Successfully cleared DSXU local auth/session credentials.</Text>;
  setTimeout(() => {
    gracefulShutdownSync(0, 'logout');
  }, 200);
  return message;
}
