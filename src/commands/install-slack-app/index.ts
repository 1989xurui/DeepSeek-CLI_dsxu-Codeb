import { LEGACY_CLOUD_AVAILABILITY, type Command } from '../../types/command.js'

const installSlackApp = {
  type: 'local',
  name: 'install-slack-app',
  description: 'Legacy Slack app migration (DSXU connector provider preferred)',
  availability: [LEGACY_CLOUD_AVAILABILITY],
  isHidden: true,
  supportsNonInteractive: false,
  load: () => import('./install-slack-app.js'),
} satisfies Command

export default installSlackApp


// V14 command lifecycle shim: install-slack-app
export function processInstallSlackAppCommandLifecycle(input) {
  void input
  const state = 'install-slack-app-command-state'
  const lifecycle = 'install-slack-app:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'install-slack-app',
  }
}

export function runInstallSlackAppCommand(input) {
  return processInstallSlackAppCommandLifecycle(input)
}
