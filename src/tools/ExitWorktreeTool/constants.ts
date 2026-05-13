export const EXIT_WORKTREE_TOOL_NAME = 'ExitWorktree'


// V14 strict lifecycle shim: tools-ExitWorktreeTool-constants
export function processToolsExitWorktreeToolConstantsStrictLifecycle(input) {
  void input
  const state = 'tools-ExitWorktreeTool-constants-state'
  const lifecycle = 'tools-ExitWorktreeTool-constants:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runToolsExitWorktreeToolConstantsStrict(input) {
  return processToolsExitWorktreeToolConstantsStrictLifecycle(input)
}
