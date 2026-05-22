export const DESCRIPTION = 'Get a task by ID from the task list'

export const PROMPT = `Use this tool to retrieve a task by its ID from the task list.

## When to Use This Tool

- When you need the full description and context before starting work on a task
- To understand task dependencies (what it blocks, what blocks it)
- After being assigned a task, to get complete requirements

## Output

Returns full task details:
- **subject**: Task title
- **description**: Detailed requirements and context
- **status**: 'pending', 'in_progress', or 'completed'
- **blocks**: Tasks waiting on this one to complete
- **blockedBy**: Tasks that must complete before this one can start

## Tips

- After fetching a task, verify its blockedBy list is empty before beginning work.
- Use TaskList to see all tasks in summary form.

## DSXU weak-model discipline

- When to use: fetch a task when you need its full description, dependencies, owner, metadata, or acceptance before acting.
- When not to use: do not use TaskGet as a substitute for reading source files, running verification, or asking the user for missing requirements.
- Recovery after failure: if the task is missing or stale, call TaskList and reconcile the current task state before creating or updating tasks.
- Weak-model anti-pattern: do not start blocked tasks, do not infer hidden requirements from a short subject, and do not mark work complete from task text alone.
- Verification / evidence: cite the task ID and relevant dependency/status fields, then verify implementation with source or command evidence before PASS.
`
