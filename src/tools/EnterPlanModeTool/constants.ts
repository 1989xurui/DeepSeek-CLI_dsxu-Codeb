export const ENTER_PLAN_MODE_TOOL_NAME = 'EnterPlanMode'


// V14 strict lifecycle shim: tools-EnterPlanModeTool-constants
export function processToolsEnterPlanModeToolConstantsStrictLifecycle(input) {
  void input
  const state = 'tools-EnterPlanModeTool-constants-state'
  const lifecycle = 'tools-EnterPlanModeTool-constants:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runToolsEnterPlanModeToolConstantsStrict(input) {
  return processToolsEnterPlanModeToolConstantsStrictLifecycle(input)
}
