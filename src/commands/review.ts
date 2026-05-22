import type { ContentBlockParam } from 'src/types/providerSdk.js'
import type { Command } from '../commands.js'
import { isDsxuRuntimeMode } from '../utils/envUtils.js'
import { isUltrareviewEnabled } from './review/ultrareviewEnabled.js'

// Legal wants an explicit remote workflow name plus a docs link visible before
// the user triggers the provider-migration remote review path.
const CCR_TERMS_URL = 'https://docs.dsxu.local/dsxu-code-workflow'

const LOCAL_REVIEW_PROMPT = (args: string) => `
      You are an expert code reviewer. Follow these steps:

      1. If no PR number is provided in the args, run \`gh pr list\` to show open PRs
      2. If a PR number is provided, run \`gh pr view <number>\` to get PR details
      3. Run \`gh pr diff <number>\` to get the diff
      4. Analyze the changes and provide a thorough code review that includes:
         - Overview of what the PR does
         - Analysis of code quality and style
         - Specific suggestions for improvements
         - Any potential issues or risks

      Keep your review concise but thorough. Focus on:
      - Code correctness
      - Following project conventions
      - Performance implications
      - Test coverage
      - Security considerations

      Format your review with clear sections and bullet points.

      PR number: ${args}
    `

const review: Command = {
  type: 'prompt',
  name: 'review',
  description: 'Review a pull request',
  progressMessage: 'reviewing pull request',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args): Promise<ContentBlockParam[]> {
    return [{ type: 'text', text: LOCAL_REVIEW_PROMPT(args) }]
  },
}

// /ultrareview is the ONLY entry point to the remote bughunter path —
// /review stays purely local. local-jsx type renders the overage permission
// dialog when free reviews are exhausted.
const ultrareview: Command = {
  type: 'local-jsx',
  name: 'ultrareview',
  description: isDsxuRuntimeMode()
    ? '~10-30 min - Finds and verifies bugs in your branch. Runs through DSXU review workflow.'
    : `~10–20 min · Finds and verifies bugs in your branch. Runs through provider-migration remote review workflow. See ${CCR_TERMS_URL}`,
  isEnabled: () => isUltrareviewEnabled(),
  load: () => import('./review/ultrareviewCommand.js'),
}

export default review
export { ultrareview }

export function getDsxuReviewCommandRuntimeProfile(): {
  runtime: 'DSXU Review Commands'
  localCommand: string
  remoteCommand: string
  activationEvidence: readonly string[]
  providerMigrationPolicy: string
} {
  return {
    runtime: 'DSXU Review Commands',
    localCommand: '/review uses local gh pr list/view/diff and model review prompt',
    remoteCommand: '/ultrareview is reworded to DSXU review workflow in DSXU mode',
    activationEvidence: [
      'local review command remains prompt-based and does not require cloud login',
      'DSXU runtime mode avoids old web product copy',
      'ultrareview is still separately gated by isUltrareviewEnabled',
    ],
    providerMigrationPolicy:
      'remote workflow terms URL remains only for non-DSXU provider-migration path',
  }
}
