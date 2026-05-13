import type { Command } from '../../commands.js'

const files = {
  type: 'local',
  name: 'files',
  description: 'List all files currently in context',
  isEnabled: () => process.env.USER_TYPE === 'ant',
  supportsNonInteractive: true,
  load: () => import('./files.js'),
} satisfies Command

export default files


// V14 command lifecycle shim: files
export function processFilesCommandLifecycle(input) {
  void input
  const state = 'files-command-state'
  const lifecycle = 'files:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'files',
  }
}

export function runFilesCommand(input) {
  return processFilesCommandLifecycle(input)
}
