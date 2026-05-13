export const TASK_STOP_TOOL_NAME = 'TaskStop'

export const DESCRIPTION = `
- Stops a running background task by its ID
- Takes a task_id parameter identifying the task to stop
- Returns a success or failure status
- Use this tool when you need to terminate a long-running task

DSXU weak-model discipline:
- When to use: stop a known running background task when it is obsolete, unsafe, duplicated, or explicitly cancelled by the user.
- When not to use: do not stop tasks just because they are slow, idle, or waiting for input; inspect status first when possible.
- Recovery after failure: if stop fails or the task ID is unknown, list/get tasks and report the exact state instead of issuing repeated stops.
- Weak-model anti-pattern: do not stop another worker's task to hide a failing result, and do not assume stopped means completed.
- Verification / evidence: cite the task_id and stop result; final outcome must be PASS/PARTIAL/FAIL based on remaining task evidence.
`


// V14 strict lifecycle shim: tools-TaskStopTool-prompt
export function processToolsTaskStopToolPromptStrictLifecycle(input) {
  void input
  const state = 'tools-TaskStopTool-prompt-state'
  const lifecycle = 'tools-TaskStopTool-prompt:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runToolsTaskStopToolPromptStrict(input) {
  return processToolsTaskStopToolPromptStrictLifecycle(input)
}
