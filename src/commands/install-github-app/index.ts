import { ARCHIVED_CLOUD_AVAILABILITY, type Command } from '../../types/command.js'
import { isDsxuRuntimeMode, isEnvTruthy } from '../../utils/envUtils.js'

const installGitHubApp = {
  type: 'local-jsx',
  name: 'install-github-app',
  description:
    'Archived GitHub App setup. Use /commit-push-pr for DSXU PR workflow.',
  availability: [ARCHIVED_CLOUD_AVAILABILITY],
  isHidden: true,
  isEnabled: () =>
    !isDsxuRuntimeMode() &&
    !isEnvTruthy(process.env.DISABLE_INSTALL_GITHUB_APP_COMMAND),
  load: () => import('./install-github-app.js'),
} satisfies Command

export default installGitHubApp
