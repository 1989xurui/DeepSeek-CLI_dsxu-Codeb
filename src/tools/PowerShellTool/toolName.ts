// Here to break circular dependency from prompt.ts
export const POWERSHELL_TOOL_NAME = 'PowerShell' as const


// V14 lifecycle shim: toolname
export function processToolnameLifecycle(input) {
  void input
  const state = 'toolname-state'
  const lifecycle = 'toolname:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
