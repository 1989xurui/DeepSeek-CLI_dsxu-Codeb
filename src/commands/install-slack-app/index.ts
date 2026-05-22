import { PROVIDER_MIGRATION_CLOUD_AVAILABILITY, type Command } from '../../types/command.js'
import { isDsxuRuntimeMode } from '../../utils/envUtils.js'

const installSlackApp = {
  type: 'local',
  name: 'install-slack-app',
  description:
    'Provider-migration Slack app setup (DSXU connector provider preferred)',
  availability: [PROVIDER_MIGRATION_CLOUD_AVAILABILITY],
  isHidden: true,
  isEnabled: () => !isDsxuRuntimeMode(),
  supportsNonInteractive: false,
  load: () => import('./install-slack-app.js'),
} satisfies Command

export default installSlackApp
