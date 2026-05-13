export default { isEnabled: () => false, isHidden: true, name: 'stub' };


// V14 command lifecycle shim: break-cache
export function processBreakCacheCommandLifecycle(input) {
  void input
  const state = 'break-cache-command-state'
  const lifecycle = 'break-cache:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'break-cache',
  }
}

export function runBreakCacheCommand(input) {
  return processBreakCacheCommandLifecycle(input)
}
