import type { Command } from '../../commands.js'
import { isConsumerSubscriber } from '../../utils/auth.js'

const privacySettings = {
  type: 'local-jsx',
  name: 'privacy-settings',
  description: 'View and update your privacy settings',
  isEnabled: () => {
    return isConsumerSubscriber()
  },
  load: () => import('./privacy-settings.js'),
} satisfies Command

export default privacySettings


// V14 command lifecycle shim: privacy-settings
export function processPrivacySettingsCommandLifecycle(input) {
  void input
  const state = 'privacy-settings-command-state'
  const lifecycle = 'privacy-settings:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'privacy-settings',
  }
}

export function runPrivacySettingsCommand(input) {
  return processPrivacySettingsCommandLifecycle(input)
}
