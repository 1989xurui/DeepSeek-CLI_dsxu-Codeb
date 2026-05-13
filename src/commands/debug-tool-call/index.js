export default { isEnabled: () => false, isHidden: true, name: 'stub' };


// V14 command lifecycle shim: debug-tool-call
export function processDebugToolCallCommandLifecycle(input) {
  void input
  const state = 'debug-tool-call-command-state'
  const lifecycle = 'debug-tool-call:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'debug-tool-call',
  }
}

export function runDebugToolCallCommand(input) {
  return processDebugToolCallCommandLifecycle(input)
}
