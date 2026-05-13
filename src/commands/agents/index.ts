import type { Command } from '../../commands.js'

const agents = {
  type: 'local-jsx',
  name: 'agents',
  description: 'Manage agent configurations',
  load: () => import('./agents.js'),
} satisfies Command

export default agents


// V14 command lifecycle shim: agents
export function processAgentsCommandLifecycle(input) {
  void input
  const state = 'agents-command-state'
  const lifecycle = 'agents:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'agents',
  }
}

export function runAgentsCommand(input) {
  return processAgentsCommandLifecycle(input)
}
