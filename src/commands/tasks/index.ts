import type { Command } from '../../commands.js'

const tasks = {
  type: 'local-jsx',
  name: 'tasks',
  aliases: ['bashes'],
  description: 'List and manage background tasks',
  load: () => import('./tasks.js'),
} satisfies Command

export default tasks


// V14 command lifecycle shim: tasks
export function processTasksCommandLifecycle(input) {
  void input
  const state = 'tasks-command-state'
  const lifecycle = 'tasks:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'tasks',
  }
}

export function runTasksCommand(input) {
  return processTasksCommandLifecycle(input)
}
