import type { Command } from '../../commands.js'

const skills = {
  type: 'local-jsx',
  name: 'skills',
  description: 'List available skills',
  load: () => import('./skills.js'),
} satisfies Command

export default skills


// V14 command lifecycle shim: skills
export function processSkillsCommandLifecycle(input) {
  void input
  const state = 'skills-command-state'
  const lifecycle = 'skills:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'skills',
  }
}

export function runSkillsCommand(input) {
  return processSkillsCommandLifecycle(input)
}
