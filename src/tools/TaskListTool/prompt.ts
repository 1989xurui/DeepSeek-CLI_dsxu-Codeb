import { isAgentSwarmsEnabled } from '../../utils/agentSwarmsEnabled.js'

export const DESCRIPTION = 'List all tasks in the task list'

export function getPrompt(): string {
  const teammateUseCase = isAgentSwarmsEnabled()
    ? `- Before assigning tasks to teammates, to see what's available
`
    : ''

  const idDescription = isAgentSwarmsEnabled()
    ? '- **id**: Task identifier (use with TaskGet, TaskUpdate)'
    : '- **id**: Task identifier (use with TaskGet, TaskUpdate)'

  const teammateWorkflow = isAgentSwarmsEnabled()
    ? `
## Teammate Workflow

When working as a teammate:
1. After completing your current task, call TaskList to find available work
2. Look for tasks with status 'pending', no owner, and empty blockedBy
3. **Prefer tasks in ID order** (lowest ID first) when multiple tasks are available, as earlier tasks often set up context for later ones
4. Claim an available task using TaskUpdate (set \`owner\` to your name), or wait for leader assignment
5. If blocked, focus on unblocking tasks or notify the team lead
`
    : ''

  return `Use this tool to list all tasks in the task list.

## When to Use This Tool

- To see what tasks are available to work on (status: 'pending', no owner, not blocked)
- To check overall progress on the project
- To find tasks that are blocked and need dependencies resolved
${teammateUseCase}- After completing a task, to check for newly unblocked work or claim the next available task
- **Prefer working on tasks in ID order** (lowest ID first) when multiple tasks are available, as earlier tasks often set up context for later ones

## Output

Returns a summary of each task:
${idDescription}
- **subject**: Brief description of the task
- **status**: 'pending', 'in_progress', or 'completed'
- **owner**: Agent ID if assigned, empty if available
- **blockedBy**: List of open task IDs that must be resolved first (tasks with blockedBy cannot be claimed until dependencies resolve)

Use TaskGet with a specific task ID to view full details including description and comments.
${teammateWorkflow}

## DSXU weak-model discipline

- When to use: list tasks to choose available work, inspect blocked work, coordinate teammates, or check project progress.
- When not to use: do not use TaskList as proof that code changed, tests passed, or a worker result is true.
- Recovery after failure: if the list is empty, stale, or inconsistent, use TaskGet for exact tasks or create/update only the minimal missing task.
- Weak-model anti-pattern: do not claim the lowest ID blindly when blocked, do not duplicate an owned task, and do not treat idle teammates as failures.
- Verification / evidence: cite task IDs, status, owner, and blockedBy fields before acting; final PASS still needs source, command, or worker evidence.`
}


// V14 strict lifecycle shim: tools-TaskListTool-prompt
export function processToolsTaskListToolPromptStrictLifecycle(input) {
  void input
  const state = 'tools-TaskListTool-prompt-state'
  const lifecycle = 'tools-TaskListTool-prompt:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runToolsTaskListToolPromptStrict(input) {
  return processToolsTaskListToolPromptStrictLifecycle(input)
}
