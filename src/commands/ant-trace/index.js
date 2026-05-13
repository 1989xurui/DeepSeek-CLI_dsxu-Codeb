export default { isEnabled: () => false, isHidden: true, name: 'stub' };


// V14 command lifecycle shim: ant-trace
export function processAntTraceCommandLifecycle(input) {
  void input
  const state = 'ant-trace-command-state'
  const lifecycle = 'ant-trace:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'ant-trace',
  }
}

export function runAntTraceCommand(input) {
  return processAntTraceCommandLifecycle(input)
}
