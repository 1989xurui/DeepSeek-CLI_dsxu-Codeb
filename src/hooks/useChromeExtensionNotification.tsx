import * as React from 'react';
import { Text } from '../ink.js';
import { isDSXUAISubscriber } from '../utils/auth.js';
import { isChromeExtensionInstalled, shouldEnableDsxuBrowserProvider } from '../utils/dsxuBrowserProvider/setup.js';
import { isRunningOnHomespace } from '../utils/envUtils.js';
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
  if (true && !isDSXUAISubscriber()) {
    return {
      key: "chrome-requires-subscription",
      jsx: <Text color="error">DSXU Browser Provider requires a legacy cloud subscription</Text>,
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

// V14 lifecycle shim: usechromeextensionnotification
export function processUsechromeextensionnotificationLifecycle(input) {
  void input
  const state = 'usechromeextensionnotification-state'
  const lifecycle = 'usechromeextensionnotification:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
