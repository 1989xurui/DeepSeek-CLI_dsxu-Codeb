import { isPlanModeInterviewPhaseEnabled } from '../../utils/planModeV2.js'
import { ASK_USER_QUESTION_TOOL_NAME } from '../AskUserQuestionTool/prompt.js'

const WHAT_HAPPENS_SECTION = `## What Happens in Plan Mode

In plan mode, you'll:
1. Thoroughly explore the codebase using Glob, Grep, and Read tools
2. Keep the exploration read-only unless the plan file itself must be written
3. Define the task scope before implementation: allowed files/directories, denied files/directories, allowed tools, and denied tools
4. Decompose the task into bounded subtasks with ownership when Agent or multiple work areas are involved
5. Design an implementation approach with the exact files to edit and the expected change
6. Define checkpoint, verification, rollback, and acceptance criteria
7. Use ${ASK_USER_QUESTION_TOOL_NAME} only for concrete missing requirements or trade-offs, not for asking whether the plan is OK
8. Exit plan mode with ExitPlanMode when the plan is complete and ready for approval

`

const DSXU_SCOPE_FENCE_PLAN_CONTRACT = `## DSXU Plan Contract

Before calling ExitPlanMode, the plan must contain these sections:

0. Goal and assumptions
   - User goal in one sentence
   - Assumptions and constraints, including relevant workflow preferences

1. Scope fence
   - Allowed files/directories
   - Denied files/directories
   - Allowed tools
   - Denied tools

2. Read-only phase
   - What to inspect
   - Maximum reads/searches or the stopping rule for exploration

3. Task decomposition
   - Subtasks in execution order
   - Ownership boundaries when Agent or multiple work areas are involved

4. Implementation plan
   - Files to edit
   - Expected change in each file
   - Risk or rollback note when relevant

5. Checkpoint plan
   - When to verify or create a logical checkpoint
   - What source/test evidence proves the checkpoint

6. Verification plan
   - Command/test/check to run
   - PASS marker or observable success condition

7. Rollback trigger
   - When to forward-fix
   - When to rewind to the latest logical checkpoint

8. Acceptance
   - Command/test/check to run
   - PASS marker or observable success condition
   - What counts as PARTIAL or FAIL

Weak-model rule: PlanMode is a scope limiter. Do not use it to brainstorm endlessly. If the task scope expands beyond the scope fence, stop and update the plan instead of improvising.`

const DSXU_COMPLEX_TASK_DECOMPOSE_GATE = `## DSXU V12 Complex Task Decompose Gate

Complex tasks must be decomposed before implementation. Use EnterPlanMode when ANY condition applies:
- The work is expected to change more than one file.
- The work adds or changes tests.
- The work involves Agent, MCP, Workflow, permissions, compact, or resume.
- The user gives an open goal such as "fix this failure", "add a feature and tests", or "review and fix".

Interactive CLI waits for ExitPlanMode approval. Non-interactive print mode must still form an internal decompose plan before editing and should keep the plan shape visible in logs or benchmark evidence.

The required decompose shape is: Goal, Assumptions, Scope fence, Read-only discovery budget, Task decomposition, Checkpoint plan, Verification plan, Rollback trigger.`

const DSXU_PLANMODE_TOOL_DISCIPLINE = `## DSXU weak-model discipline

- When to use: use PlanMode when meaningful implementation scope, files, tools, or acceptance criteria need approval before editing.
- When not to use: do not use PlanMode for pure research, tiny obvious fixes, or asking "is this plan okay" through AskUserQuestion.
- Recovery after failure: if investigation changes the scope, update the scope fence and acceptance criteria before exiting plan mode.
- Weak-model anti-pattern: do not exit with a vague checklist. ExitPlanMode requires allowed/denied files, allowed/denied tools, read-only limit, edit list, tests/checks, PASS marker, and PARTIAL/FAIL rules.
- Verification / evidence: the plan must name the source files inspected, the files expected to change, and the command/test/check that will prove PASS or PARTIAL/FAIL.`

function getEnterPlanModeToolPromptExternal(): string {
  // When interview phase is enabled, omit the "What Happens" section;
  // detailed workflow instructions arrive via the plan_mode attachment (messages.ts).
  const whatHappens = isPlanModeInterviewPhaseEnabled()
    ? ''
    : WHAT_HAPPENS_SECTION

  return `Use this tool proactively when you're about to start a non-trivial implementation task. Getting user sign-off on your approach before writing code prevents wasted effort and ensures alignment. This tool transitions you into plan mode where you can explore the codebase and design an implementation approach for user approval.

## When to Use This Tool

**Prefer using EnterPlanMode** for implementation tasks unless they're simple. Use it when ANY of these conditions apply:

1. **New Feature Implementation**: Adding meaningful new functionality
   - Example: "Add a logout button" - where should it go? What should happen on click?
   - Example: "Add form validation" - what rules? What error messages?

2. **Multiple Valid Approaches**: The task can be solved in several different ways
   - Example: "Add caching to the API" - could use Redis, in-memory, file-based, etc.
   - Example: "Improve performance" - many optimization strategies possible

3. **Code Modifications**: Changes that affect existing behavior or structure
   - Example: "Update the login flow" - what exactly should change?
   - Example: "Refactor this component" - what's the target architecture?

4. **Architectural Decisions**: The task requires choosing between patterns or technologies
   - Example: "Add real-time updates" - WebSockets vs SSE vs polling
   - Example: "Implement state management" - Redux vs Context vs custom solution

5. **Multi-File Changes**: The task will likely touch more than 2-3 files
   - Example: "Refactor the authentication system"
   - Example: "Add a new API endpoint with tests"

6. **Tests Added or Modified**: The task includes new tests, changed assertions, or regression coverage
   - Example: "Add this feature and tests"
   - Example: "Fix this failing test and add regression coverage"

7. **Governed Capabilities**: The task involves Agent, MCP, Workflow, permissions, compact, or resume
   - Example: "Use Agent to split this repair"
   - Example: "Resume the previous long task and finish it"

8. **Open Goals**: The user gives a business goal without exact files or steps
   - Example: "This test failed, fix it"
   - Example: "Review this module and fix the real issue"

9. **Unclear Requirements**: You need to explore before understanding the full scope
   - Example: "Make the app faster" - need to profile and identify bottlenecks
   - Example: "Fix the bug in checkout" - need to investigate root cause

10. **User Preferences Matter**: The implementation could reasonably go multiple ways
   - If you would use ${ASK_USER_QUESTION_TOOL_NAME} to clarify the approach, use EnterPlanMode instead
   - Plan mode lets you explore first, then present options with context

## When NOT to Use This Tool

Only skip EnterPlanMode for simple tasks:
- Single-line or few-line fixes (typos, obvious bugs, small tweaks)
- Adding a single function with clear requirements
- Tasks where the user has given very specific, detailed instructions
- Pure research/exploration tasks (use the Agent tool with explore agent instead)

${whatHappens}${DSXU_COMPLEX_TASK_DECOMPOSE_GATE}

${DSXU_SCOPE_FENCE_PLAN_CONTRACT}

${DSXU_PLANMODE_TOOL_DISCIPLINE}

## Examples

### GOOD - Use EnterPlanMode:
User: "Add user authentication to the app"
- Requires architectural decisions (session vs JWT, where to store tokens, middleware structure)

User: "Optimize the database queries"
- Multiple approaches possible, need to profile first, significant impact

User: "Implement dark mode"
- Architectural decision on theme system, affects many components

User: "Add a delete button to the user profile"
- Seems simple but involves: where to place it, confirmation dialog, API call, error handling, state updates

User: "Update the error handling in the API"
- Affects multiple files, user should approve the approach

### BAD - Don't use EnterPlanMode:
User: "Fix the typo in the README"
- Straightforward, no planning needed

User: "Add a console.log to debug this function"
- Simple, obvious implementation

User: "What files handle routing?"
- Research task, not implementation planning

## Important Notes

- This tool REQUIRES user approval - they must consent to entering plan mode
- If unsure whether to use it, err on the side of planning - it's better to get alignment upfront than to redo work
- Users appreciate being consulted before significant changes are made to their codebase
- Do not call ExitPlanMode until the plan has Goal, Assumptions, Scope fence, Read-only discovery budget, Task decomposition, Checkpoint plan, Verification plan, Rollback trigger, and Acceptance sections
`
}

function getEnterPlanModeToolPromptAnt(): string {
  // When interview phase is enabled, omit the "What Happens" section;
  // detailed workflow instructions arrive via the plan_mode attachment (messages.ts).
  const whatHappens = isPlanModeInterviewPhaseEnabled()
    ? ''
    : WHAT_HAPPENS_SECTION

  return `Use this tool when a task has genuine ambiguity about the right approach and getting user input before coding would prevent significant rework. This tool transitions you into plan mode where you can explore the codebase and design an implementation approach for user approval.

## When to Use This Tool

Plan mode is valuable when the implementation approach is genuinely unclear or when DSXU V12 governance marks the task complex. Use it when:

1. **Significant Architectural Ambiguity**: Multiple reasonable approaches exist and the choice meaningfully affects the codebase
   - Example: "Add caching to the API" - Redis vs in-memory vs file-based
   - Example: "Add real-time updates" - WebSockets vs SSE vs polling

2. **Unclear Requirements**: You need to explore and clarify before you can make progress
   - Example: "Make the app faster" - need to profile and identify bottlenecks
   - Example: "Refactor this module" - need to understand what the target architecture should be

3. **High-Impact Restructuring**: The task will significantly restructure existing code and getting buy-in first reduces risk
   - Example: "Redesign the authentication system"
   - Example: "Migrate from one state management approach to another"

4. **DSXU V12 Complex Task**: The work likely changes more than one file, changes tests, involves Agent/MCP/Workflow/permission/compact/resume, or starts from an open goal such as "fix this failure" or "review and fix"

## When NOT to Use This Tool

Skip plan mode when you can reasonably infer the right approach:
- The task is straightforward even if it touches multiple files
- The user's request is specific enough that the implementation path is clear
- You're adding a feature with an obvious implementation pattern (e.g., adding a button, a new endpoint following existing conventions)
- Bug fixes where the fix is clear once you understand the bug and the work does not add tests, cross files, or involve governed capabilities
- Research/exploration tasks (use the Agent tool instead)
- The user says something like "can we work on X" or "let's do X" - just get started

When the task is complex under DSXU V12, prefer PlanMode. Use ${ASK_USER_QUESTION_TOOL_NAME} only for concrete missing requirements, not to ask whether the plan is okay.

${whatHappens}${DSXU_COMPLEX_TASK_DECOMPOSE_GATE}

${DSXU_SCOPE_FENCE_PLAN_CONTRACT}

${DSXU_PLANMODE_TOOL_DISCIPLINE}

## Examples

### GOOD - Use EnterPlanMode:
User: "Add user authentication to the app"
- Genuinely ambiguous: session vs JWT, where to store tokens, middleware structure

User: "Redesign the data pipeline"
- Major restructuring where the wrong approach wastes significant effort

### BAD - Don't use EnterPlanMode:
User: "Add a delete button to the user profile"
- Implementation path is clear; just do it

User: "Can we work on the search feature?"
- User wants to get started, not plan

User: "Update the error handling in the API"
- Start working; ask specific questions if needed

User: "Fix the typo in the README"
- Straightforward, no planning needed

## Important Notes

- This tool REQUIRES user approval - they must consent to entering plan mode
- Do not call ExitPlanMode until the plan has Goal, Assumptions, Scope fence, Read-only discovery budget, Task decomposition, Checkpoint plan, Verification plan, Rollback trigger, and Acceptance sections
`
}

export function getEnterPlanModeToolPrompt(): string {
  return process.env.USER_TYPE === 'ant'
    ? getEnterPlanModeToolPromptAnt()
    : getEnterPlanModeToolPromptExternal()
}
