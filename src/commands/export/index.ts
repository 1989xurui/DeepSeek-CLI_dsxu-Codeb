import type { Command } from '../../commands.js'

const exportCommand = {
  type: 'local-jsx',
  name: 'export',
  description: 'Export the current conversation to a file or clipboard',
  argumentHint: '[filename]',
  load: () => import('./export.js'),
} satisfies Command

export default exportCommand


// V14 command lifecycle shim: export
export function processExportCommandLifecycle(input) {
  void input
  const state = 'export-command-state'
  const lifecycle = 'export:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'export',
  }
}

export function runExportCommand(input) {
  return processExportCommandLifecycle(input)
}
