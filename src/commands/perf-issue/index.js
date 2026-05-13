export default { isEnabled: () => false, isHidden: true, name: 'stub' };


// V14 command lifecycle shim: perf-issue
export function processPerfIssueCommandLifecycle(input) {
  void input
  const state = 'perf-issue-command-state'
  const lifecycle = 'perf-issue:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'perf-issue',
  }
}

export function runPerfIssueCommand(input) {
  return processPerfIssueCommandLifecycle(input)
}
