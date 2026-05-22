import type { Command } from '../types/command.js'
import { executeShellCommandsInPrompt } from '../utils/promptShellExecution.js'

const ALLOWED_TOOLS = [
  'Bash(git checkout --branch:*)',
  'Bash(git checkout -b:*)',
  'Bash(git add:*)',
  'Bash(git status:*)',
  'Bash(git push:*)',
  'Bash(git commit:*)',
  'Bash(gh pr create:*)',
  'Bash(gh pr edit:*)',
  'Bash(gh pr view:*)',
  'Bash(gh pr merge:*)',
  'ToolSearch',
]

function getPromptContent(args?: string): string {
  const extra = args?.trim() ? `\n\n## User Instructions\n\n${args.trim()}` : ''
  return `## DSXU Commit And PR Workflow

You are running inside the DSXU coding control plane. Prepare a safe branch, commit, push, and pull request for the current workspace.

## Live Context

- Current user: !\`whoami\`
- Current branch: !\`git branch --show-current\`
- Current git status: !\`git status\`
- Current diff against HEAD: !\`git diff HEAD\`
- Current PR, if any: !\`gh pr view --json number,title,url 2>/dev/null || true\`
- Recent commits: !\`git log --oneline -10\`

## Safety Rules

- Never force-push or reset hard unless the user explicitly requested it.
- Never skip hooks or signatures unless explicitly requested.
- Never commit secrets.
- Create a new branch if currently on the repository default branch.
- Do not use interactive git commands.
- Keep PR title under 70 characters.
- Include a concise test plan in the PR body.

## Task

1. Inspect all changed files.
2. Stage only relevant files.
3. Create exactly one commit using heredoc syntax.
4. Push the branch.
5. If a PR already exists, update it; otherwise create a PR.
6. Return the PR URL and the commit hash.

Use heredoc syntax for commit and PR body. Do not mention archived source names; this is a DSXU workflow.${extra}`
}

const command = {
  type: 'prompt',
  name: 'commit-push-pr',
  description: 'Create a DSXU-governed commit, push, and pull request',
  allowedTools: ALLOWED_TOOLS,
  get contentLength() {
    return getPromptContent().length
  },
  progressMessage: 'creating DSXU commit and PR',
  source: 'builtin',
  async getPromptForCommand(args, context) {
    const finalContent = await executeShellCommandsInPrompt(
      getPromptContent(args),
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
      '/commit-push-pr',
    )

    return [{ type: 'text', text: finalContent }]
  },
} satisfies Command

export default command
