export default { isEnabled: () => false, isHidden: true, name: 'stub' };


// V14 command lifecycle shim: env
export function processEnvCommandLifecycle(input) {
  void input
  const state = 'env-command-state'
  const lifecycle = 'env:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'env',
  }
}

export function runEnvCommand(input) {
  return processEnvCommandLifecycle(input)
}
