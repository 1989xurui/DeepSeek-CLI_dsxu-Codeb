export const DESCRIPTION = 'Update a task in the task list'

export const PROMPT = `Use this tool to update a task in the task list.

## When to Use This Tool

**Mark tasks as resolved:**
- When you have completed the work described in a task
- When a task is no longer needed or has been superseded
- IMPORTANT: Always mark your assigned tasks as resolved when you finish them
- After resolving, call TaskList to find your next task

- ONLY mark a task as completed when you have FULLY accomplished it
- If you encounter errors, blockers, or cannot finish, keep the task as in_progress
- When blocked, create a new task describing what needs to be resolved
- Never mark a task as completed if:
  - Tests are failing
  - Implementation is partial
  - You encountered unresolved errors
  - You couldn't find necessary files or dependencies

**Delete tasks:**
- When a task is no longer relevant or was created in error
- Setting status to \`deleted\` permanently removes the task

**Update task details:**
- When requirements change or become clearer
- When establishing dependencies between tasks

## Fields You Can Update

- **status**: The task status (see Status Workflow below)
- **subject**: Change the task title (imperative form, e.g., "Run tests")
- **description**: Change the task description
- **activeForm**: Present continuous form shown in spinner when in_progress (e.g., "Running tests")
- **owner**: Change the task owner (agent name)
- **metadata**: Merge metadata keys into the task (set a key to null to delete it)
- **addBlocks**: Mark tasks that cannot start until this one completes
- **addBlockedBy**: Mark tasks that must complete before this one can start

## Status Workflow

Status progresses: \`pending\` -> \`in_progress\` -> \`completed\`

Use \`deleted\` to permanently remove a task.

## Staleness

Make sure to read a task's latest state using \`TaskGet\` before updating it.

## Examples

Mark task as in progress when starting work:
\`\`\`json
{"taskId": "1", "status": "in_progress"}
\`\`\`

Mark task as completed after finishing work:
\`\`\`json
{"taskId": "1", "status": "completed"}
\`\`\`

Delete a task:
\`\`\`json
{"taskId": "1", "status": "deleted"}
\`\`\`

Claim a task by setting owner:
\`\`\`json
{"taskId": "1", "owner": "my-name"}
\`\`\`

Set up task dependencies:
\`\`\`json
{"taskId": "2", "addBlockedBy": ["1"]}
\`\`\`

## DSXU Weak-Model Discipline

- When to use: update task status immediately when starting, blocking, completing, superseding, or reassigning work.
- When not to use: do not update stale tasks without TaskGet/TaskList evidence, and do not mark a task completed just because a tool call succeeded.
- Recovery after failure: if verification fails or permission is denied, keep the task in_progress or blocked, attach the failing command/evidence in metadata or description, and create the smallest follow-up task.
- Weak-model anti-pattern: do not batch all completions at the end, do not set multiple unrelated tasks in_progress, and do not turn PARTIAL/FAIL into completed.
- Verification / evidence: only mark completed when the relevant source, command, test, notification, or user answer proves the task's acceptance criteria.
`


// V14 strict lifecycle shim: tools-TaskUpdateTool-prompt
export function processToolsTaskUpdateToolPromptStrictLifecycle(input) {
  void input
  const state = 'tools-TaskUpdateTool-prompt-state'
  const lifecycle = 'tools-TaskUpdateTool-prompt:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runToolsTaskUpdateToolPromptStrict(input) {
  return processToolsTaskUpdateToolPromptStrictLifecycle(input)
}
