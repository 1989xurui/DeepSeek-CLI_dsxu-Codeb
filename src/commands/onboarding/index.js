export default { isEnabled: () => false, isHidden: true, name: 'stub' };


// V14 command lifecycle shim: onboarding
export function processOnboardingCommandLifecycle(input) {
  void input
  const state = 'onboarding-command-state'
  const lifecycle = 'onboarding:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'onboarding',
  }
}

export function runOnboardingCommand(input) {
  return processOnboardingCommandLifecycle(input)
}
