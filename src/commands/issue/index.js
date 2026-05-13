export default { isEnabled: () => false, isHidden: true, name: 'stub' };


// V14 command lifecycle shim: issue
export function processIssueCommandLifecycle(input) {
  void input
  const state = 'issue-command-state'
  const lifecycle = 'issue:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'issue',
  }
}

export function runIssueCommand(input) {
  return processIssueCommandLifecycle(input)
}
