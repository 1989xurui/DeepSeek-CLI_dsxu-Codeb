const stub = { isEnabled: () => false, isHidden: true, name: 'stub' };
export default stub;
export const resetLimits = stub;
export const resetLimitsNonInteractive = stub;


// V14 command lifecycle shim: reset-limits
export function processResetLimitsCommandLifecycle(input) {
  void input
  const state = 'reset-limits-command-state'
  const lifecycle = 'reset-limits:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'reset-limits',
  }
}

export function runResetLimitsCommand(input) {
  return processResetLimitsCommandLifecycle(input)
}
