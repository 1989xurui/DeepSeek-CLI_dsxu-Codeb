import { ARCHIVED_CLOUD_AVAILABILITY, type Command } from '../../types/command.js'
import { isDsxuRuntimeMode } from '../../utils/envUtils.js'
import {
  isVoiceFeatureFlagEnabled,
  isVoiceModeEnabled,
} from '../../voice/voiceModeEnabled.js'

const voice = {
  type: 'local',
  name: 'voice',
  description: 'Toggle DSXU voice provider mode (archived cloud isolated)',
  availability: [ARCHIVED_CLOUD_AVAILABILITY],
  isEnabled: () => !isDsxuRuntimeMode() && isVoiceFeatureFlagEnabled(),
  get isHidden() {
    if (isDsxuRuntimeMode()) return true
    return !isVoiceModeEnabled()
  },
  supportsNonInteractive: false,
  load: () => import('./voice.js'),
} satisfies Command

export default voice
