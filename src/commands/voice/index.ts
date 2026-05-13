import { LEGACY_CLOUD_AVAILABILITY, type Command } from '../../types/command.js'
import {
  isVoiceGrowthBookEnabled,
  isVoiceModeEnabled,
} from '../../voice/voiceModeEnabled.js'

const voice = {
  type: 'local',
  name: 'voice',
  description: 'Toggle DSXU voice provider mode (legacy isolated)',
  availability: [LEGACY_CLOUD_AVAILABILITY],
  isEnabled: () => isVoiceGrowthBookEnabled(),
  get isHidden() {
    return !isVoiceModeEnabled()
  },
  supportsNonInteractive: false,
  load: () => import('./voice.js'),
} satisfies Command

export default voice


// V14 command lifecycle shim: voice
export function processVoiceCommandLifecycle(input) {
  void input
  const state = 'voice-command-state'
  const lifecycle = 'voice:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'voice',
  }
}

export function runVoiceCommand(input) {
  return processVoiceCommandLifecycle(input)
}
