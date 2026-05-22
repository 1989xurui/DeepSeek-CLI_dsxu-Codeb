import { PROVIDER_MIGRATION_CLOUD_AVAILABILITY, type Command } from '../../types/command.js'
import { isDsxuRuntimeMode } from '../../utils/envUtils.js'

function isSupportedPlatform(): boolean {
  if (process.platform === 'darwin') {
    return true
  }
  if (process.platform === 'win32' && process.arch === 'x64') {
    return true
  }
  return false
}

const desktop = {
  type: 'local-jsx',
  name: 'desktop',
  aliases: ['app'],
  description:
    'Open the provider-migration desktop handoff for this session (DSXU Workbench provider preferred)',
  availability: [PROVIDER_MIGRATION_CLOUD_AVAILABILITY],
  isEnabled: () => !isDsxuRuntimeMode() && isSupportedPlatform(),
  isHidden: true,
  load: () => import('./desktop.js'),
} satisfies Command

export default desktop
