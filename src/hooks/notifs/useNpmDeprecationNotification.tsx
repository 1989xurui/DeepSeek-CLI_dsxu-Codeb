import { isInBundledMode } from 'src/utils/bundledMode.js';
import { getCurrentInstallationType } from 'src/utils/doctorDiagnostic.js';
import { isEnvTruthy } from 'src/utils/envUtils.js';
import { useStartupNotification } from './useStartupNotification.js';
const NPM_DEPRECATION_MESSAGE = 'DSXU Code has switched from npm to native installer. Run the DSXU installer command or see DSXU setup docs for more options.';
export function useNpmDeprecationNotification() {
  useStartupNotification(_temp);
}
async function _temp() {
  if (isInBundledMode() || isEnvTruthy(process.env.DISABLE_INSTALLATION_CHECKS)) {
    return null;
  }
  const installationType = await getCurrentInstallationType();
  if (installationType === "development") {
    return null;
  }
  return {
    timeoutMs: 15000,
    key: "npm-deprecation-warning",
    text: NPM_DEPRECATION_MESSAGE,
    color: "warning",
    priority: "high"
  };
}

// V14 lifecycle shim: usenpmdeprecationnotification
export function processUsenpmdeprecationnotificationLifecycle(input) {
  void input
  const state = 'usenpmdeprecationnotification-state'
  const lifecycle = 'usenpmdeprecationnotification:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
