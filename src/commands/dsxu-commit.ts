import type { Command } from '../types/command.js'
import { executeShellCommandsInPrompt } from '../utils/promptShellExecution.js'

const ALLOWED_TOOLS = [
  'Bash(git add:*)',
  'Bash(git status:*)',
  'Bash(git commit:*)',
]

function getPromptContent(): string {
  return `## DSXU Commit Workflow

You are running inside the DSXU coding control plane. Create one safe, reviewable git commit for the current workspace.

## Live Context

- Current git status: !\`git status\`
- Current git diff, staged and unstaged: !\`git diff HEAD\`
- Current branch: !\`git branch --show-current\`
- Recent commits: !\`git log --oneline -10\`

## Safety Rules

- Never use \`git commit --amend\` unless the user explicitly requested amend.
- Never skip hooks or signatures unless the user explicitly requested it.
- Never commit secrets such as \`.env\`, credentials, private keys, or API tokens.
- If nothing changed, do not create an empty commit.
- Do not use interactive git commands.
- Keep the commit message concise and explain why the change exists.

## Task

1. Inspect the staged and unstaged changes.
2. Stage only relevant files for this commit.
3. Create exactly one commit using heredoc syntax:

\`\`\`bash
git commit -m "$(cat <<'EOF'
<short commit message>
EOF
)"
\`\`\`

Return the final commit hash and a one-line summary.`
}

const command = {
  type: 'prompt',
  name: 'commit',
  description: 'Create a DSXU-governed git commit',
  allowedTools: ALLOWED_TOOLS,
  contentLength: 0,
  progressMessage: 'creating DSXU commit',
  source: 'builtin',
  async getPromptForCommand(_args, context) {
    const finalContent = await executeShellCommandsInPrompt(
      getPromptContent(),
      {
        ...context,
        getAppState() {
          const appState = context.getAppState()
          return {
            ...appState,
            toolPermissionContext: {
              ...appState.toolPermissionContext,
              alwaysAllowRules: {
                ...appState.toolPermissionContext.alwaysAllowRules,
                command: ALLOWED_TOOLS,
              },
            },
          }
        },
      },
      '/commit',
    )

    return [{ type: 'text', text: finalContent }]
  },
} satisfies Command

export default command
