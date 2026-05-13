export const ENTER_WORKTREE_TOOL_NAME = 'EnterWorktree'


// V14 strict lifecycle shim: tools-EnterWorktreeTool-constants
export function processToolsEnterWorktreeToolConstantsStrictLifecycle(input) {
  void input
  const state = 'tools-EnterWorktreeTool-constants-state'
  const lifecycle = 'tools-EnterWorktreeTool-constants:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runToolsEnterWorktreeToolConstantsStrict(input) {
  return processToolsEnterWorktreeToolConstantsStrictLifecycle(input)
}
