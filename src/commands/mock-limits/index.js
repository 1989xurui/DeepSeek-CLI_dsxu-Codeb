export default { isEnabled: () => false, isHidden: true, name: 'stub' };


// V14 command lifecycle shim: mock-limits
export function processMockLimitsCommandLifecycle(input) {
  void input
  const state = 'mock-limits-command-state'
  const lifecycle = 'mock-limits:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'mock-limits',
  }
}

export function runMockLimitsCommand(input) {
  return processMockLimitsCommandLifecycle(input)
}
