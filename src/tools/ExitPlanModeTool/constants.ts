export const EXIT_PLAN_MODE_TOOL_NAME = 'ExitPlanMode'
export const EXIT_PLAN_MODE_V2_TOOL_NAME = 'ExitPlanMode'


// V14 strict lifecycle shim: tools-ExitPlanModeTool-constants
export function processToolsExitPlanModeToolConstantsStrictLifecycle(input) {
  void input
  const state = 'tools-ExitPlanModeTool-constants-state'
  const lifecycle = 'tools-ExitPlanModeTool-constants:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runToolsExitPlanModeToolConstantsStrict(input) {
  return processToolsExitPlanModeToolConstantsStrictLifecycle(input)
}
