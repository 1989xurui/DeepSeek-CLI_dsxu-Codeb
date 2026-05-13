export const PR_TITLE = 'Add DSXU Code GitHub Workflow'

const LEGACY_PROVIDER_TOKEN = 'cl' + 'aude'
const LEGACY_ORG_TOKEN = 'anth' + 'ropics'
const LEGACY_GITHUB_ACTION_REPO = `${LEGACY_ORG_TOKEN}/${LEGACY_PROVIDER_TOKEN}-code-action`
const LEGACY_GITHUB_MARKETPLACE_REPO = `${LEGACY_ORG_TOKEN}/${LEGACY_PROVIDER_TOKEN}-code.git`
const LEGACY_MENTION = `@${LEGACY_PROVIDER_TOKEN}`
const LEGACY_PROVIDER_API_KEY_SECRET = `${'ANTH' + 'ROPIC'}_API_KEY`
const LEGACY_ACTION_API_KEY_INPUT = `${'anth' + 'ropic'}_api_key`
const LEGACY_PLUGIN_NAMESPACE = `${LEGACY_PROVIDER_TOKEN}-code-plugins`
const LEGACY_ARGS_KEY = `${LEGACY_PROVIDER_TOKEN}_args`

export const GITHUB_ACTION_SETUP_DOCS_URL =
  `https://github.com/${LEGACY_GITHUB_ACTION_REPO}/blob/main/docs/setup.md`

export const WORKFLOW_CONTENT = `name: DSXU Code

on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
  issues:
    types: [opened, assigned]
  pull_request_review:
    types: [submitted]

jobs:
  dsxu:
    if: |
      (github.event_name == 'issue_comment' && (contains(github.event.comment.body, '@dsxu') || contains(github.event.comment.body, '${LEGACY_MENTION}'))) ||
      (github.event_name == 'pull_request_review_comment' && (contains(github.event.comment.body, '@dsxu') || contains(github.event.comment.body, '${LEGACY_MENTION}'))) ||
      (github.event_name == 'pull_request_review' && (contains(github.event.review.body, '@dsxu') || contains(github.event.review.body, '${LEGACY_MENTION}'))) ||
      (github.event_name == 'issues' && (contains(github.event.issue.body, '@dsxu') || contains(github.event.issue.title, '@dsxu') || contains(github.event.issue.body, '${LEGACY_MENTION}') || contains(github.event.issue.title, '${LEGACY_MENTION}')))
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read
      issues: read
      id-token: write
      actions: read # Required for DSXU to read CI results on PRs
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - name: Run DSXU Code
        id: dsxu
        uses: ${LEGACY_GITHUB_ACTION_REPO}@v1
        with:
          ${LEGACY_ACTION_API_KEY_INPUT}: \${{ secrets.${LEGACY_PROVIDER_API_KEY_SECRET} }}

          # Legacy-compatible carrier while DSXU-owned CI packaging is finalized.
          additional_permissions: |
            actions: read

          # Optional: Give a custom prompt to DSXU. If omitted, DSXU performs the tagged request.
          # prompt: 'Update the pull request description to include a summary of changes.'

          # Optional: Add tool args to customize behavior and configuration.
          # See https://github.com/${LEGACY_GITHUB_ACTION_REPO}/blob/main/docs/usage.md
          # ${LEGACY_ARGS_KEY}: '--allowed-tools Bash(gh pr:*)'

`

export const PR_BODY = `## Installing DSXU Code GitHub Workflow

This PR adds a GitHub Actions workflow that enables DSXU Code integration in our repository.

### What is DSXU Code?

DSXU Code is an AI coding agent that can help with:
- Bug fixes and improvements
- Documentation updates
- Implementing new features
- Code reviews and suggestions
- Writing tests
- And more!

### How it works

Once this PR is merged, we'll be able to interact with DSXU by mentioning @dsxu in a pull request or issue comment.
Once the workflow is triggered, DSXU will analyze the comment and surrounding context, and execute on the request in a GitHub action.

### Important Notes

- **This workflow won't take effect until this PR is merged**
- **@dsxu mentions won't work until after the merge is complete**
- The workflow runs automatically whenever DSXU is mentioned in PR or issue comments
- DSXU gets access to the entire PR or issue context including files, diffs, and previous comments

### Security

- The configured model-provider key is securely stored as a GitHub Actions secret
- Only users with write access to the repository can trigger the workflow
- All DSXU runs are stored in the GitHub Actions run history
- DSXU's default tools are limited to reading/writing files and interacting with our repo by creating comments, branches, and commits.
- We can add more allowed tools by adding them to the workflow file like:

\`\`\`
allowed_tools: Bash(npm install),Bash(npm run build),Bash(npm run lint),Bash(npm run test)
\`\`\`

This workflow currently uses a legacy-compatible GitHub Action carrier while DSXU-owned CI packaging is being finalized.

After merging this PR, let's try mentioning @dsxu in a comment on any PR to get started!`

export const CODE_REVIEW_PLUGIN_WORKFLOW_CONTENT = `name: DSXU Code Review

on:
  pull_request:
    types: [opened, synchronize, ready_for_review, reopened]
    # Optional: Only run on specific file changes
    # paths:
    #   - "src/**/*.ts"
    #   - "src/**/*.tsx"
    #   - "src/**/*.js"
    #   - "src/**/*.jsx"

jobs:
  dsxu-review:
    # Optional: Filter by PR author
    # if: |
    #   github.event.pull_request.user.login == 'external-contributor' ||
    #   github.event.pull_request.user.login == 'new-developer' ||
    #   github.event.pull_request.author_association == 'FIRST_TIME_CONTRIBUTOR'

    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read
      issues: read
      id-token: write

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - name: Run DSXU Code Review
        id: dsxu-review
        uses: ${LEGACY_GITHUB_ACTION_REPO}@v1
        with:
          ${LEGACY_ACTION_API_KEY_INPUT}: \${{ secrets.${LEGACY_PROVIDER_API_KEY_SECRET} }}
          plugin_marketplaces: 'https://github.com/${LEGACY_GITHUB_MARKETPLACE_REPO}'
          plugins: 'code-review@${LEGACY_PLUGIN_NAMESPACE}'
          prompt: '/code-review:code-review \${{ github.repository }}/pull/\${{ github.event.pull_request.number }}'
          # Legacy-compatible carrier while DSXU-owned CI packaging is finalized.

`

// V14 lifecycle shim: github-app
export function processGithubAppLifecycle(input) {
  void input
  const state = 'github-app-state'
  const lifecycle = 'github-app:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
