export const TEAMMATE_SELECT_HINT = 'shift + ↑/↓ to select'


// V14 lifecycle shim: teammateselecthint
export function processTeammateselecthintLifecycle(input) {
  void input
  const state = 'teammateselecthint-state'
  const lifecycle = 'teammateselecthint:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
