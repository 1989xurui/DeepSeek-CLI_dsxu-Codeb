import { LEGACY_CLOUD_AVAILABILITY, type Command } from '../../types/command.js'
import { isEnvTruthy } from '../../utils/envUtils.js'

const installGitHubApp = {
  type: 'local-jsx',
  name: 'install-github-app',
  description: 'Legacy migration only: old GitHub App setup. Use /commit-push-pr for DSXU PR workflow.',
  availability: [LEGACY_CLOUD_AVAILABILITY],
  isHidden: true,
  isEnabled: () => !isEnvTruthy(process.env.DISABLE_INSTALL_GITHUB_APP_COMMAND),
  load: () => import('./install-github-app.js'),
} satisfies Command

export default installGitHubApp


// V14 command lifecycle shim: install-github-app
export function processInstallGithubAppCommandLifecycle(input) {
  void input
  const state = 'install-github-app-command-state'
  const lifecycle = 'install-github-app:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'install-github-app',
  }
}

export function runInstallGithubAppCommand(input) {
  return processInstallGithubAppCommandLifecycle(input)
}
