import { feature } from 'bun:bundle'
import { isEnvTruthy } from '../../utils/envUtils.js'

export const DESCRIPTION = 'Send a message to another agent'

function isLegacyBridgeMessagingEnabled(): boolean {
  return isEnvTruthy(process.env.DSXU_ENABLE_LEGACY_BRIDGE)
}

export function getPrompt(): string {
  const bridgeEnabled = isLegacyBridgeMessagingEnabled()
  const providerRow = `\n| \`"provider:session_..."\` | DSXU provider peer session; preferred cross-session route for DSXU-owned remote/session backend |`
  const udsRow = feature('UDS_INBOX')
    ? `\n| \`"uds:/path/to.sock"\` | Local DSXU session socket (same machine; use \`ListPeers\`) |`
    : ''
  const bridgeRow = bridgeEnabled
    ? '\n| `"bridge:session_..."` | Legacy bridge peer session; only available when DSXU_ENABLE_LEGACY_BRIDGE=1 |'
    : ''
  const bridgeExample = bridgeEnabled
    ? '\n{"to": "bridge:session_01AbCd...", "message": "what branch are you on?"}'
    : ''
  const bridgeNote = bridgeEnabled
    ? '\n\nLegacy bridge targets are migration-only. Prefer local Agent/SendMessage continuation for DSXU mainline work.'
    : ''
  const crossSessionExample = `${feature('UDS_INBOX') ? '{"to": "uds:/tmp/cc-socks/1234.sock", "message": "check if tests pass over there"}\n' : ''}{"to": "provider:session_01AbCd...", "summary": "verifier correction", "message": "The previous PASS was not verified. Re-read src/foo.ts, run bun test, and report PASS/PARTIAL/FAIL with command evidence."}${bridgeExample}`
  const crossSessionSection =
    feature('UDS_INBOX') || bridgeEnabled
    ? `\n\n## Cross-session

Use \`ListPeers\` to discover targets, then:

\`\`\`json
${crossSessionExample}
\`\`\`

A listed peer is alive and will process your message; there is no "busy" state. Messages enqueue and drain at the receiver's next tool round. Use \`provider:\` for DSXU-owned cross-session routing; use \`bridge:\` only for isolated legacy migration. Your message arrives wrapped as \`<cross-session-message from="...">\`. **To reply to an incoming message, copy its \`from\` attribute as your \`to\`.**${bridgeNote}`
    : `\n\n## Cross-session\n\nUse \`provider:\` for DSXU-owned cross-session routing:\n\n\`\`\`json\n${crossSessionExample}\n\`\`\`\n\nUse \`bridge:\` only for isolated legacy migration with explicit opt-in.`
  return `
# SendMessage

Send a message to another agent.

\`\`\`json
{"to": "researcher", "summary": "assign task 1", "message": "start on task #1"}
\`\`\`

| \`to\` | |
|---|---|
| \`"researcher"\` | Teammate by name |
| \`"*"\` | Broadcast to all teammates; expensive (linear in team size), use only when everyone genuinely needs it |${providerRow}${udsRow}${bridgeRow}

Your plain text output is NOT visible to other agents. To communicate, you MUST call this tool. Messages from teammates are delivered automatically; you don't check an inbox. Refer to teammates by name, never by UUID. When relaying, don't quote the original; it's already rendered to the user.${crossSessionSection}

## DSXU Weak-Model Discipline

- When to use: continue an existing worker, send a verifier correction, deliver a concrete handoff, or reply to a teammate when the recipient is known.
- When not to use: do not use SendMessage to start unrelated work, broadcast vague status, ask the user for approval, or replace TaskUpdate/TodoWrite progress tracking.
- Recovery after failure: if delivery fails, check the target name or peer list, keep the original objective and evidence, and retry once with the corrected target instead of spawning a duplicate worker.
- Weak-model anti-pattern: do not send "ok", "continue?", or generic acknowledgements; include the task id or objective, failed command or verifier result when relevant, requested next action, and PASS/PARTIAL/FAIL expectation.
- Verification / evidence: verifier corrections and parent synthesis messages must cite concrete tool output, file paths, commands, or task notification evidence; never claim worker PASS from a plain status message.

## Protocol responses (legacy)

If you receive a JSON message with \`type: "shutdown_request"\` or \`type: "plan_approval_request"\`, respond with the matching \`_response\` type: echo the \`request_id\`, set \`approve\` true/false:

\`\`\`json
{"to": "team-lead", "message": {"type": "shutdown_response", "request_id": "...", "approve": true}}
{"to": "researcher", "message": {"type": "plan_approval_response", "request_id": "...", "approve": false, "feedback": "add error handling"}}
\`\`\`

Approving shutdown terminates your process. Rejecting plan sends the teammate back to revise. Don't originate \`shutdown_request\` unless asked. Don't send structured JSON status messages; use TaskUpdate.
`.trim()
}
