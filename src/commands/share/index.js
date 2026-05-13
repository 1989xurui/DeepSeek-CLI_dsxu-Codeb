export default { isEnabled: () => false, isHidden: true, name: 'stub' };


// V14 command lifecycle shim: share
export function processShareCommandLifecycle(input) {
  void input
  const state = 'share-command-state'
  const lifecycle = 'share:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'share',
  }
}

export function runShareCommand(input) {
  return processShareCommandLifecycle(input)
}
