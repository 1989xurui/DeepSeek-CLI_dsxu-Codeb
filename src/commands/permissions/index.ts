import type { Command } from '../../commands.js'

const permissions = {
  type: 'local-jsx',
  name: 'permissions',
  aliases: ['allowed-tools'],
  description: 'Manage allow & deny tool permission rules',
  load: () => import('./permissions.js'),
} satisfies Command

export default permissions


// V14 command lifecycle shim: permissions
export function processPermissionsCommandLifecycle(input) {
  void input
  const state = 'permissions-command-state'
  const lifecycle = 'permissions:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'permissions',
  }
}

export function runPermissionsCommand(input) {
  return processPermissionsCommandLifecycle(input)
}
