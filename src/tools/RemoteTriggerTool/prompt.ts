export const REMOTE_TRIGGER_TOOL_NAME = 'RemoteTrigger'

export const DESCRIPTION =
  'Manage scheduled DSXU Code agent triggers. In DSXU mode this uses the local DSXU Remote Session Provider; any archived trigger provider is isolated behind an explicit migration flag.'

export const PROMPT = `Call the DSXU remote-trigger provider. Use this instead of curl — credentials and provider state are handled in-process and never exposed to the shell.

Actions:
- list: list scheduled triggers
- get: fetch one scheduled trigger
- create: create a scheduled trigger (requires body)
- update: update a scheduled trigger (requires trigger_id and body)
- run: run a scheduled trigger now

The response is normalized JSON from the active DSXU provider.

DSXU weak-model discipline:
- When to use: manage DSXU provider triggers only when explicitly requested or when continuing an existing DSXU-owned remote workflow.
- When not to use: do not use RemoteTrigger for local tasks, cron reminders, shell commands, archived/OAuth paths, or as a shortcut around the provider contract.
- Recovery after failure: if the provider is unavailable or migration-only, report the blocked provider state and use local DSXU tools when possible.
- Weak-model anti-pattern: do not expose credentials, do not create persistent triggers without user intent, and do not run remote work to bypass permissions.
- Verification / evidence: cite the normalized provider response, trigger id, action, and whether the provider path was DSXU-owned or explicitly archived-gated.`

export function getDsxuRemoteTriggerPromptRuntimeProfile(): {
  tool: 'RemoteTrigger'
  runtime: 'DSXU Remote Trigger Prompt'
  activationEvidence: readonly string[]
} {
  return {
    tool: REMOTE_TRIGGER_TOOL_NAME,
    runtime: 'DSXU Remote Trigger Prompt',
    activationEvidence: [
      'prompt instructs the model to call DSXU remote-trigger provider instead of curl',
      'credentials and provider state are handled in-process',
      'normalized JSON response is returned from the active DSXU provider',
    ],
  }
}
