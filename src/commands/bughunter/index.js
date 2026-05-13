export default { isEnabled: () => false, isHidden: true, name: 'stub' };


// V14 command lifecycle shim: bughunter
export function processBughunterCommandLifecycle(input) {
  void input
  const state = 'bughunter-command-state'
  const lifecycle = 'bughunter:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'bughunter',
  }
}

export function runBughunterCommand(input) {
  return processBughunterCommandLifecycle(input)
}
