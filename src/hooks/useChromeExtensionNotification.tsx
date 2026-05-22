import * as React from 'react';
import { Text } from '../ink.js';
import { isProviderSubscriptionAccount } from '../utils/auth.js';
import { isChromeExtensionInstalled, shouldEnableDsxuBrowserProvider } from '../utils/dsxuBrowserProvider/setup.js';
import { isDsxuRuntimeMode, isRunningOnHomespace } from '../utils/envUtils.js';
import { useStartupNotification } from './notifs/useStartupNotification.js';
function getChromeFlag(): boolean | undefined {
  if (process.argv.includes('--chrome')) {
    return true;
  }
  if (process.argv.includes('--no-chrome')) {
    return false;
  }
  return undefined;
}
export function useChromeExtensionNotification() {
  useStartupNotification(_temp);
}
async function _temp() {
  const chromeFlag = getChromeFlag();
  if (!shouldEnableDsxuBrowserProvider(chromeFlag)) {
    return null;
  }
  if (!isDsxuRuntimeMode() && !isProviderSubscriptionAccount()) {
    return {
      key: "chrome-requires-subscription",
      jsx: <Text color="error">DSXU Browser Provider requires DSXU cloud credentials</Text>,
      priority: "immediate",
      timeoutMs: 5000
    };
  }
  const installed = await isChromeExtensionInstalled();
  if (!installed && !isRunningOnHomespace()) {
    return {
      key: "chrome-extension-not-detected",
      jsx: <Text color="warning">Chrome extension not detected 路 https://dsxu.ai/chrome to install</Text>,
      priority: "immediate",
      timeoutMs: 3000
    };
  }
  if (chromeFlag === undefined) {
    return {
      key: "dsxu-in-chrome-default-enabled",
      text: "DSXU Browser Provider enabled \xB7 /chrome",
      priority: "low"
    };
  }
  return null;
}
