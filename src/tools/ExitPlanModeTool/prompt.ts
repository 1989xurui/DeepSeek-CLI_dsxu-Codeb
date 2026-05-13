// External stub for ExitPlanModeTool prompt - excludes Ant-only allowedPrompts section

// Hardcoded to avoid relative import issues in stub
const ASK_USER_QUESTION_TOOL_NAME = 'AskUserQuestion'

export const EXIT_PLAN_MODE_V2_TOOL_PROMPT = `Use this tool when you are in plan mode and have finished writing your plan to the plan file and are ready for user approval.

## How This Tool Works
- You should have already written your plan to the plan file specified in the plan mode system message
- This tool does NOT take the plan content as a parameter - it will read the plan from the file you wrote
- This tool simply signals that you're done planning and ready for the user to review and approve
- The user will see the contents of your plan file when they review it

## When to Use This Tool
IMPORTANT: Only use this tool when the task requires planning the implementation steps of a task that requires writing code. For research tasks where you're gathering information, searching files, reading files or in general trying to understand the codebase - do NOT use this tool.

## Before Using This Tool
Ensure your plan is complete and unambiguous:
- If you have unresolved questions about requirements or approach, use ${ASK_USER_QUESTION_TOOL_NAME} first (in earlier phases)
- Once your plan is finalized, use THIS tool to request approval
- The plan must include a Goal section and an Assumptions section, including relevant workflow preferences or constraints
- The plan must include a Scope fence section with allowed files/directories, denied files/directories, allowed tools, and denied tools
- The plan must include a Read-only discovery budget section that says what to inspect and the maximum reads/searches or stopping rule
- The plan must include a Task decomposition section with subtasks, order, and ownership boundaries when Agent or multiple work areas are involved
- The plan must include an Implementation plan section listing files to edit and the expected change
- The plan must include a Checkpoint plan section that says when verification or logical checkpointing occurs
- The plan must include a Verification plan section with the command/test/check to run and the PASS marker or observable success condition
- The plan must include a Rollback trigger section that says when to forward-fix versus rewind to the latest logical checkpoint
- The plan must include an Acceptance section with what counts as PASS, PARTIAL, or FAIL

**Important:** Do NOT use ${ASK_USER_QUESTION_TOOL_NAME} to ask "Is this plan okay?" or "Should I proceed?" - that's exactly what THIS tool does. ExitPlanMode inherently requests user approval of your plan.

## DSXU Scope Fence Contract
ExitPlanMode is the approval gate for implementation. Do not call it if the plan lacks a concrete scope fence, decompose plan, checkpoint plan, rollback trigger, or acceptance criteria. Weak-model execution must stay inside the approved scope. If later evidence shows the scope is wrong, update the plan or ask a concrete question instead of silently expanding the task.

## DSXU weak-model discipline
- When to use: use ExitPlanMode only after the plan has Goal, Assumptions, Scope fence, Read-only discovery budget, Task decomposition, Checkpoint plan, Verification plan, Rollback trigger, and Acceptance.
- When not to use: do not use it for pure research, open-ended brainstorming, or plans that lack files, tools, or verification criteria.
- Recovery after failure: if the plan is rejected or incomplete, revise the plan with concrete evidence, checkpoint/rollback changes, or ask one specific blocking question.
- Weak-model anti-pattern: do not use AskUserQuestion to ask whether the plan is okay, do not omit denied files/tools, do not skip rollback triggers, and do not expand scope after approval without updating the plan.
- Verification / evidence: the plan must name the command, test, or observable PASS marker that proves completion, when to checkpoint, and what counts as PARTIAL or FAIL.

## Examples

1. Initial task: "Search for and understand the implementation of vim mode in the codebase" - Do not use the exit plan mode tool because you are not planning the implementation steps of a task.
2. Initial task: "Help me implement yank mode for vim" - Use the exit plan mode tool after you have finished planning the implementation steps of the task.
3. Initial task: "Add a new feature to handle user authentication" - If unsure about auth method (OAuth, JWT, etc.), use ${ASK_USER_QUESTION_TOOL_NAME} first, then use exit plan mode tool after clarifying the approach.
`


// V14 strict lifecycle shim: tools-ExitPlanModeTool-prompt
export function processToolsExitPlanModeToolPromptStrictLifecycle(input) {
  void input
  const state = 'tools-ExitPlanModeTool-prompt-state'
  const lifecycle = 'tools-ExitPlanModeTool-prompt:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runToolsExitPlanModeToolPromptStrict(input) {
  return processToolsExitPlanModeToolPromptStrictLifecycle(input)
}
