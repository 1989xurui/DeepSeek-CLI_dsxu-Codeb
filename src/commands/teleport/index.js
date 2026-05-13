export default { isEnabled: () => false, isHidden: true, name: 'stub' };


// V14 command lifecycle shim: teleport
export function processTeleportCommandLifecycle(input) {
  void input
  const state = 'teleport-command-state'
  const lifecycle = 'teleport:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'teleport',
  }
}

export function runTeleportCommand(input) {
  return processTeleportCommandLifecycle(input)
}
