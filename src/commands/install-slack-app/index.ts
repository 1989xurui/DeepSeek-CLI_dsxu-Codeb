import { ARCHIVED_CLOUD_AVAILABILITY, type Command } from '../../types/command.js'
import { isDsxuRuntimeMode } from '../../utils/envUtils.js'

const installSlackApp = {
  type: 'local',
  name: 'install-slack-app',
  description:
    'Archived Slack app setup (DSXU connector provider preferred)',
  availability: [ARCHIVED_CLOUD_AVAILABILITY],
  isHidden: true,
  isEnabled: () => !isDsxuRuntimeMode(),
  supportsNonInteractive: false,
  load: () => import('./install-slack-app.js'),
} satisfies Command

export default installSlackApp
