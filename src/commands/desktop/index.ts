import { LEGACY_CLOUD_AVAILABILITY, type Command } from '../../types/command.js'

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
  description: 'Open the legacy desktop handoff for this session (DSXU Workbench provider preferred)',
  availability: [LEGACY_CLOUD_AVAILABILITY],
  isEnabled: isSupportedPlatform,
  isHidden: true,
  load: () => import('./desktop.js'),
} satisfies Command

export default desktop
