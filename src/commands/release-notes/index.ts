import type { Command } from '../../commands.js'

const releaseNotes: Command = {
  description: 'View release notes',
  name: 'release-notes',
  type: 'local',
  supportsNonInteractive: true,
  load: () => import('./release-notes.js'),
}

export default releaseNotes


// V14 command lifecycle shim: release-notes
export function processReleaseNotesCommandLifecycle(input) {
  void input
  const state = 'release-notes-command-state'
  const lifecycle = 'release-notes:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'release-notes',
  }
}

export function runReleaseNotesCommand(input) {
  return processReleaseNotesCommandLifecycle(input)
}
