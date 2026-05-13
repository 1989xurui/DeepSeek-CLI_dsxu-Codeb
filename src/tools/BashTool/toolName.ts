// Here to break circular dependency from prompt.ts
export const BASH_TOOL_NAME = 'Bash'


// V14 lifecycle shim: toolname
export function processToolnameLifecycle(input) {
  void input
  const state = 'toolname-state'
  const lifecycle = 'toolname:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
