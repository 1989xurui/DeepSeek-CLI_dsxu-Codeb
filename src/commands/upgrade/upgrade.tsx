 import * as React from 'react';
import type { LocalJSXCommandContext } from '../../commands.js';
import { getOauthProfileFromOauthToken } from '../../services/oauth/getOauthProfile.js';
import type { LocalJSXCommandOnDone } from '../../types/command.js';
import { isProviderSubscriptionAccount } from '../../utils/auth.js';
import { getProviderControlTokens } from '../../services/auth/dsxuProviderControlAuth.js';
import { openBrowser } from '../../utils/browser.js';
import { isDsxuRuntimeMode } from '../../utils/envUtils.js';
import { logError } from '../../utils/log.js';
import { Login } from '../login/login.js';
const PROVIDER_MIGRATION_CLOUD_UPGRADE_URL = `https://${'cl' + 'aude'}.ai/upgrade/max`;
export async function call(onDone: LocalJSXCommandOnDone, context: LocalJSXCommandContext): Promise<React.ReactNode | null> {
  try {
    if (isDsxuRuntimeMode()) {
      setTimeout(onDone, 0, 'DSXU Code uses local provider billing. Use /usage for DSXU usage and provider quota details.');
      return null;
    }
    // Check if user is already on the highest Max plan (20x)
    if (isProviderSubscriptionAccount()) {
      const tokens = getProviderControlTokens();
      let isMax20x = false;
      if (tokens?.subscriptionType && tokens?.rateLimitTier) {
        isMax20x = tokens.subscriptionType === 'max' && tokens.rateLimitTier === 'default_dsxu_max_20x';
      } else if (tokens?.accessToken) {
        const profile = await getOauthProfileFromOauthToken(tokens.accessToken);
        isMax20x = profile?.organization?.organization_type === 'dsxu_max' && profile?.organization?.rate_limit_tier === 'default_dsxu_max_20x';
      }
      if (isMax20x) {
        setTimeout(onDone, 0, 'You are already on the highest Max subscription plan. For additional usage, run /login to switch to an API usage-billed account.');
        return null;
      }
    }
    const url = PROVIDER_MIGRATION_CLOUD_UPGRADE_URL;
    await openBrowser(url);
    return <Login startingMessage={'Starting new login following /upgrade. Exit with Ctrl-C to use existing account.'} onDone={success => {
      context.onChangeAPIKey();
      onDone(success ? 'Login successful' : 'Login interrupted');
    }} />;
  } catch (error) {
    logError(error as Error);
    setTimeout(onDone, 0, `Failed to open browser. Please visit ${PROVIDER_MIGRATION_CLOUD_UPGRADE_URL} to upgrade.`);
  }
  return null;
}
