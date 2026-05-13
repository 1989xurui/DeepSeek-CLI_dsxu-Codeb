export function getExitWorktreeToolPrompt(): string {
  return `Exit a worktree session created by EnterWorktree and return the session to the original working directory.

## Scope

This tool ONLY operates on worktrees created by EnterWorktree in this session. It will NOT touch:
- Worktrees you created manually with \`git worktree add\`
- Worktrees from a previous session (even if created by EnterWorktree then)
- The directory you're in if EnterWorktree was never called

If called outside an EnterWorktree session, the tool is a **no-op**: it reports that no worktree session is active and takes no action. Filesystem state is unchanged.

## When to Use

- The user explicitly asks to "exit the worktree", "leave the worktree", "go back", or otherwise end the worktree session
- Do NOT call this proactively — only when the user asks

## Parameters

- \`action\` (required): \`"keep"\` or \`"remove"\`
  - \`"keep"\` — leave the worktree directory and branch intact on disk. Use this if the user wants to come back to the work later, or if there are changes to preserve.
  - \`"remove"\` — delete the worktree directory and its branch. Use this for a clean exit when the work is done or abandoned.
- \`discard_changes\` (optional, default false): only meaningful with \`action: "remove"\`. If the worktree has uncommitted files or commits not on the original branch, the tool will REFUSE to remove it unless this is set to \`true\`. If the tool returns an error listing changes, confirm with the user before re-invoking with \`discard_changes: true\`.

## Behavior

- Restores the session's working directory to where it was before EnterWorktree
- Clears CWD-dependent caches (system prompt sections, memory files, plans directory) so the session state reflects the original directory
- If a tmux session was attached to the worktree: killed on \`remove\`, left running on \`keep\` (its name is returned so the user can reattach)
- Once exited, EnterWorktree can be called again to create a fresh worktree

## DSXU weak-model discipline

- When to use: exit a worktree only when the user asks to leave, keep, or remove the active worktree session.
- When not to use: do not call proactively, outside an EnterWorktree session, or to delete manually-created worktrees.
- Recovery after failure: if removal is refused because changes exist, ask the user before discarding and prefer keep when preserving work is safer.
- Weak-model anti-pattern: do not set discard_changes true without explicit user approval, and do not treat a no-op outside worktree as cleanup success.
- Verification / evidence: cite the action, restored cwd, and whether the worktree was kept or removed.
`
}


// V14 strict lifecycle shim: tools-ExitWorktreeTool-prompt
export function processToolsExitWorktreeToolPromptStrictLifecycle(input) {
  void input
  const state = 'tools-ExitWorktreeTool-prompt-state'
  const lifecycle = 'tools-ExitWorktreeTool-prompt:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runToolsExitWorktreeToolPromptStrict(input) {
  return processToolsExitWorktreeToolPromptStrictLifecycle(input)
}
