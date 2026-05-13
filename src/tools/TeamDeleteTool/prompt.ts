export function getPrompt(): string {
  return `
# TeamDelete

Remove team and task directories when the swarm work is complete.

This operation:
- Removes the team directory (\`~/.dsxu/teams/{team-name}/\`)
- Removes the task directory (\`~/.dsxu/tasks/{team-name}/\`)
- Clears team context from the current session

**IMPORTANT**: TeamDelete will fail if the team still has active members. Gracefully terminate teammates first, then call TeamDelete after all teammates have shut down.

Use this when all teammates have finished their work and you want to clean up the team resources. The team name is automatically determined from the current session's team context.

## DSXU weak-model discipline

- When to use: delete a team only after all teammates are shut down and team work is complete or explicitly abandoned.
- When not to use: do not delete a team with active members, unresolved tasks, or unverified worker results.
- Recovery after failure: if deletion fails, inspect active members/tasks and shut down or resolve them before retrying.
- Weak-model anti-pattern: do not use TeamDelete to hide failed Agent work, clear evidence, or force a fake PASS.
- Verification / evidence: cite shutdown confirmations, remaining task state, and the deletion result.
`.trim()
}
