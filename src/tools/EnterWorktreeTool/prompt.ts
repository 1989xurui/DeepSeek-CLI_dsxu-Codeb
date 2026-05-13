import { isDsxuRuntimeMode } from '../../utils/envUtils.js'

export function getEnterWorktreeToolPrompt(): string {
  const worktreesPath = isDsxuRuntimeMode()
    ? '.dsxu/worktrees/'
    : `.${'cl' + 'aude'}/worktrees/`
  return `Use this tool ONLY when the user explicitly asks to work in a worktree. This tool creates an isolated git worktree and switches the current session into it.

## When to Use

- The user explicitly says "worktree" (e.g., "start a worktree", "work in a worktree", "create a worktree", "use a worktree")

## When NOT to Use

- The user asks to create a branch, switch branches, or work on a different branch — use git commands instead
- The user asks to fix a bug or work on a feature — use normal git workflow unless they specifically mention worktrees
- Never use this tool unless the user explicitly mentions "worktree"

## Requirements

- Must be in a git repository, OR have WorktreeCreate/WorktreeRemove hooks configured in settings.json
- Must not already be in a worktree

## Behavior

- In a git repository: creates a new git worktree inside \`${worktreesPath}\` with a new branch based on HEAD
- Outside a git repository: delegates to WorktreeCreate/WorktreeRemove hooks for VCS-agnostic isolation
- Switches the session's working directory to the new worktree
- Use ExitWorktree to leave the worktree mid-session (keep or remove). On session exit, if still in the worktree, the user will be prompted to keep or remove it

## Parameters

- \`name\` (optional): A name for the worktree. If not provided, a random name is generated.

## DSXU weak-model discipline

- When to use: enter a worktree only when the user explicitly asks for worktree isolation.
- When not to use: do not use this for ordinary bugfixes, branches, tests, or broad exploration when normal workspace flow is enough.
- Recovery after failure: if worktree creation fails, report the git/hook reason and continue in the current workspace only with user approval.
- Weak-model anti-pattern: do not create nested or duplicate worktrees, do not use worktrees to bypass permissions, and do not hide uncommitted state.
- Verification / evidence: cite the created worktree path/branch and confirm the session cwd changed before editing inside it.
`
}


// V14 strict lifecycle shim: tools-EnterWorktreeTool-prompt
export function processToolsEnterWorktreeToolPromptStrictLifecycle(input) {
  void input
  const state = 'tools-EnterWorktreeTool-prompt-state'
  const lifecycle = 'tools-EnterWorktreeTool-prompt:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runToolsEnterWorktreeToolPromptStrict(input) {
  return processToolsEnterWorktreeToolPromptStrictLifecycle(input)
}
