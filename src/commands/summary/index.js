export default { isEnabled: () => false, isHidden: true, name: 'stub' };


// V14 command lifecycle shim: summary
export function processSummaryCommandLifecycle(input) {
  void input
  const state = 'summary-command-state'
  const lifecycle = 'summary:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'summary',
  }
}

export function runSummaryCommand(input) {
  return processSummaryCommandLifecycle(input)
}
