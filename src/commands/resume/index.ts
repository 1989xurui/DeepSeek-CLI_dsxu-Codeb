import type { Command } from '../../commands.js'

const resume: Command = {
  type: 'local-jsx',
  name: 'resume',
  description: 'Resume a previous conversation',
  aliases: ['continue'],
  argumentHint: '[conversation id or search term]',
  load: () => import('./resume.js'),
}

export default resume


// V14 command lifecycle shim: resume
export function processResumeCommandLifecycle(input) {
  void input
  const state = 'resume-command-state'
  const lifecycle = 'resume:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'resume',
  }
}

export function runResumeCommand(input) {
  return processResumeCommandLifecycle(input)
}
