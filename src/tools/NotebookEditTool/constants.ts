// In its own file to avoid circular dependencies
export const NOTEBOOK_EDIT_TOOL_NAME = 'NotebookEdit'


// V14 strict lifecycle shim: tools-NotebookEditTool-constants
export function processToolsNotebookEditToolConstantsStrictLifecycle(input) {
  void input
  const state = 'tools-NotebookEditTool-constants-state'
  const lifecycle = 'tools-NotebookEditTool-constants:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runToolsNotebookEditToolConstantsStrict(input) {
  return processToolsNotebookEditToolConstantsStrictLifecycle(input)
}
