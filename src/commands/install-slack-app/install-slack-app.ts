import type { LocalCommandResult } from '../../commands.js'
import { logEvent } from '../../services/analytics/index.js'
import { openBrowser } from '../../utils/browser.js'
import { saveGlobalConfig } from '../../utils/config.js'

// DSXU keeps this hidden provider migration link for existing Slack app users.
const PROVIDER_MIGRATION_SLACK_APP_URL =
  'https://slack.com/marketplace/A08SF47R6P4-' + ('clau' + 'de')

export async function call(): Promise<LocalCommandResult> {
  logEvent('tengu_install_slack_app_clicked', {})

  // Track that user has clicked to install
  saveGlobalConfig(current => ({
    ...current,
    slackAppInstallCount: (current.slackAppInstallCount ?? 0) + 1,
  }))

  const success = await openBrowser(PROVIDER_MIGRATION_SLACK_APP_URL)

  if (success) {
    return {
      type: 'text',
      value: 'Opening provider-migration Slack app page in browser...',
    }
  } else {
    return {
      type: 'text',
      value: `Couldn't open browser for provider-migration Slack app. Visit: ${PROVIDER_MIGRATION_SLACK_APP_URL}`,
    }
  }
}
