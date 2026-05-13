export default { isEnabled: () => false, isHidden: true, name: 'stub' };


// V14 command lifecycle shim: autofix-pr
export function processAutofixPrCommandLifecycle(input) {
  void input
  const state = 'autofix-pr-command-state'
  const lifecycle = 'autofix-pr:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'autofix-pr',
  }
}

export function runAutofixPrCommand(input) {
  return processAutofixPrCommandLifecycle(input)
}
