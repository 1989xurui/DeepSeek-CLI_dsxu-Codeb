import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../services/analytics/featureFlags.js'
import { getSubscriptionType } from '../../utils/auth.js'
import { hasEmbeddedSearchTools } from '../../utils/embeddedTools.js'
import {
  getDsxuCodeEnv,
  isEnvDefinedFalsy,
  isEnvTruthy,
} from '../../utils/envUtils.js'
import { isTeammate } from '../../utils/teammate.js'
import { isInProcessTeammate } from '../../utils/teammateContext.js'
import { FILE_READ_TOOL_NAME } from '../FileReadTool/prompt.js'
import { FILE_WRITE_TOOL_NAME } from '../FileWriteTool/prompt.js'
import { GLOB_TOOL_NAME } from '../GlobTool/prompt.js'
import { SEND_MESSAGE_TOOL_NAME } from '../SendMessageTool/constants.js'
import { AGENT_TOOL_NAME } from './constants.js'
import { isForkSubagentEnabled } from './forkSubagent.js'
import type { AgentDefinition } from './loadAgentsDir.js'

function getToolsDescription(agent: AgentDefinition): string {
  const { tools, disallowedTools } = agent
  const hasAllowlist = tools && tools.length > 0
  const hasDenylist = disallowedTools && disallowedTools.length > 0

  if (hasAllowlist && hasDenylist) {
    // Both defined: filter allowlist by denylist to match runtime behavior
    const denySet = new Set(disallowedTools)
    const effectiveTools = tools.filter(t => !denySet.has(t))
    if (effectiveTools.length === 0) {
      return 'None'
    }
    return effectiveTools.join(', ')
  } else if (hasAllowlist) {
    // Allowlist only: show the specific tools available
    return tools.join(', ')
  } else if (hasDenylist) {
    // Denylist only: show "All tools except X, Y, Z"
    return `All tools except ${disallowedTools.join(', ')}`
  }
  // No restrictions
  return 'All tools'
}

/**
 * Format one agent line for the agent_listing_delta attachment message:
 * `- type: whenToUse (Tools: ...)`.
 */
export function formatAgentLine(agent: AgentDefinition): string {
  const toolsDescription = getToolsDescription(agent)
  return `- ${agent.agentType}: ${agent.whenToUse} (Tools: ${toolsDescription})`
}

/**
 * Whether the agent list should be injected as an attachment message instead
 * of embedded in the tool description. When true, getPrompt() returns a static
 * description and attachments.ts emits an agent_listing_delta attachment.
 *
 * The dynamic agent list was ~10.2% of fleet cache_creation tokens: MCP async
 * connect, /reload-plugins, or permission-mode changes mutate the list, then
 * description changes cause a full tool-schema cache bust.
 *
 * Override with DSXU_CODE_AGENT_LIST_IN_MESSAGES=true/false for testing.
 * The provider-migration source agent-list env remains a migration alias.
 */
export function shouldInjectAgentListInMessages(): boolean {
  const override = getDsxuCodeEnv('AGENT_LIST_IN_MESSAGES')
  if (isEnvTruthy(override)) return true
  if (isEnvDefinedFalsy(override))
    return false
  return getFeatureValue_CACHED_MAY_BE_STALE('tengu_agent_list_attach', false)
}

export function getDsxuAgentPromptRuntimeProfile(
  agentDefinitions: AgentDefinition[] = [],
): {
  runtime: 'DSXU Agent Prompt'
  agentListPolicy: string
  forkPolicy: string
  promptDiscipline: readonly string[]
  visibleOrchestrationModes: readonly string[]
  executionPlacements: readonly string[]
  activationEvidence: readonly string[]
} {
  return {
    runtime: 'DSXU Agent Prompt',
    agentListPolicy: shouldInjectAgentListInMessages()
      ? 'agent list is injected as cache-stable system-reminder attachments'
      : `agent list is inline with ${agentDefinitions.length} visible definitions`,
    forkPolicy: isForkSubagentEnabled()
      ? 'forks inherit parent context and prompt-cache state'
      : 'fresh subagents require complete task briefs',
    promptDiscipline: [
      'write complete context for fresh agents',
      'do not delegate understanding',
      'treat task notifications as internal signals, not user chat',
      'do not fabricate pending fork results',
      'prefer direct Read/Grep/Glob for narrow lookup',
      'worker discovery uses Glob/Grep/Read, not shell listing',
      'launch parallel agents in one message when independent',
      'continue failed workers when their error context matters',
      'write DSXU handoff packages with scope, evidence, permissions, recovery, and verification',
      'use only two visible orchestration modes: serial worker and parallel fanout',
      'treat execution placements as runtime routing, not extra planning modes',
    ],
    visibleOrchestrationModes: [
      'serial worker',
      'parallel fanout',
    ],
    executionPlacements: [
      'foreground',
      'background',
      'worktree isolation',
      'remote-gated isolation',
      'fork context inheritance',
      'SendMessage continuation',
    ],
    activationEvidence: [
      'getPrompt renders DSXU Agent tool instructions from runtime agent definitions',
      'shouldInjectAgentListInMessages supports DSXU env override before provider-migration source alias',
      'formatAgentLine exposes tool allow/deny scope to the model',
      'fork, background, worktree, remote, and continuation guidance control agent scheduling behavior',
    ],
  }
}

export async function getPrompt(
  agentDefinitions: AgentDefinition[],
  isCoordinator?: boolean,
  allowedAgentTypes?: string[],
): Promise<string> {
  // Filter agents by allowed types when Agent(x,y) restricts which agents can be spawned
  const effectiveAgents = allowedAgentTypes
    ? agentDefinitions.filter(a => allowedAgentTypes.includes(a.agentType))
    : agentDefinitions

  // Fork subagent feature: when enabled, insert the "When to fork" section
  // (fork semantics, directive-style prompts) and swap in fork-aware examples.
  const forkEnabled = isForkSubagentEnabled()

  const whenToForkSection = forkEnabled
    ? `

## When to fork

Fork yourself (omit \`subagent_type\`) when the intermediate tool output isn't worth keeping in your context. The criterion is qualitative \u2014 "will I need this output again" \u2014 not task size.
- **Research**: fork open-ended questions. If research can be broken into independent questions, launch parallel forks in one message. A fork beats a fresh subagent for this \u2014 it inherits context and shares your cache.
- **Implementation**: prefer to fork implementation work that requires more than a couple of edits. Do research before jumping to implementation.

Forks are cheap because they share your prompt cache. Don't set \`model\` on a fork \u2014 a different model can't reuse the parent's cache. Pass a short \`name\` (one or two words, lowercase) so the user can see the fork in the teams panel and steer it mid-run.

**Don't peek.** The tool result includes an \`output_file\` path - do not Read or tail it unless the user explicitly asks for a progress check. You get a completion notification; trust it. Reading the transcript mid-flight pulls the fork's tool noise into your context, which defeats the point of forking.

**Don't race.** After launching, you know nothing about what the fork found. Never fabricate or predict fork results in any format - not as prose, summary, or structured output. The notification arrives as a user-role message in a later turn; it is never something you write yourself. If the user asks a follow-up before the notification lands, tell them the fork is still running - give status, not a guess.

**Writing a fork prompt.** Since the fork inherits your context, the prompt is a *directive* - what to do, not what the situation is. Be specific about scope: what's in, what's out, what another agent is handling. Don't re-explain background.
`
    : ''

  const writingThePromptSection = `

## Writing the prompt

${forkEnabled ? 'When spawning a fresh agent (with a `subagent_type`), it starts with zero context. ' : ''}Brief the agent like a smart colleague who just walked into the room - it hasn't seen this conversation, doesn't know what you've tried, doesn't understand why this task matters.
- Explain what you're trying to accomplish and why.
- Describe what you've already learned or ruled out.
- Give enough context about the surrounding problem that the agent can make judgment calls rather than just following a narrow instruction.
- If you need a short response, say so ("report in under 200 words").
- Lookups: hand over the exact command. Investigations: hand over the question - prescribed steps become dead weight when the premise is wrong.

${forkEnabled ? 'For fresh agents, terse' : 'Terse'} command-style prompts produce shallow, generic work.

**Never delegate understanding.** Don't write "based on your findings, fix the bug" or "based on the research, implement it." Those phrases push synthesis onto the agent instead of doing it yourself. Write prompts that prove you understood: include file paths, line numbers, what specifically to change.
`

  const dsxuOrchestrationContractSection = `

## DSXU orchestration contract for DeepSeek

DeepSeek benefits from sharper boundaries than stronger native tool-use models. Use agents as a controlled execution system, not as a place to hide unclear thinking.

### Visible orchestration modes

DSXU exposes only two visible agent orchestration modes:
- serial worker: one scoped worker or verifier whose result is on the critical path. Wait for it, continue it with ${SEND_MESSAGE_TOOL_NAME} when its loaded context matters, or report PARTIAL if it cannot produce evidence.
- parallel fanout: independent research or verification workers launched in one message. They must have non-overlapping write scopes, and the parent synthesizes only after notification evidence arrives.

Do not invent extra modes such as swarm, recursive team tree, debate panel, manager mesh, autonomous background polling, or agent-of-agents. If a task seems to need another mode, reduce it to serial worker or parallel fanout with explicit ownership and verification evidence.

### Execution placements and lifecycle options

Foreground, background, worktree isolation, remote-gated isolation, fork context inheritance, and ${SEND_MESSAGE_TOOL_NAME} continuation are DSXU runtime routing/lifecycle options. They do not create new visible planning modes. First reduce the work to serial worker or parallel fanout, then choose the safest placement.

- Foreground: use when the result blocks your next local step.
- Background: use only for independent work where a later notification is enough. Do not poll, sleep, tail, or fabricate progress.
- Worktree isolation: use for risky or parallel write work so ownership boundaries stay clean.
- Remote-gated isolation: use only when remote capability is explicitly available and local gates are stable; otherwise keep work local.
- Fork context inheritance: use when inherited context/cache helps and you do not need raw intermediate output in the parent context.
- ${SEND_MESSAGE_TOOL_NAME} continuation: use to continue a worker when its loaded context, failed command output, or recent edits matter.

- Prefer direct Read, Grep, Glob, Bash, PowerShell, MCP, LSP, and Workflow tools for narrow lookups or single-step work. Use Agent only when the task is complex, multi-step, independent, or would flood the main context with raw output.
- Parallelize independent research in one message. Do not parallelize workers that may edit the same files or make conflicting project-wide changes.
- Never duplicate a worker's active task in the parent context. Either wait for the notification, continue unrelated work, or tell the user the worker is still running.
- Never fabricate pending agent results. Agent output arrives as a later notification; it is not something you write yourself.
- Always synthesize research before follow-up work. Include exact file paths, line numbers, failing commands, root-cause hypothesis, ownership boundaries, and the definition of done.
- Write a DSXU handoff package for every non-trivial worker: objective, scope, files owned, tools allowed, facts already verified, failed commands, permission constraints, recovery rule, and verification evidence required. A vague prompt creates vague work.
- Worker discovery discipline: when the worker needs to find files or code, instruct it to use Glob for file names, Grep for content, and Read for exact files. Do not ask workers to use shell listing commands such as ls, find, dir, Get-ChildItem, or shell cat/Get-Content for discovery or reads when DSXU tools are available.
- Worker discovery budget: the default worker discovery budget is max 2 Glob, max 3 Grep, and max 4 Read before the worker must report findings, ask for a narrower scope, or switch to implementation/verification. Increase the budget only when the handoff package gives a specific reason.
- Worker edit ownership budget: assign exact owned files or directories. A worker may edit only its owned scope, should keep edits to the smallest patch that proves the assigned objective, and must verify or report PARTIAL after 2 source Edits without a PASS.
- Verifier evidence before parent final: the parent may not report PASS from a worker-owned task until a task notification or verifier result includes command, diagnostic, source-inspection, or PASS-marker evidence. If evidence is missing, use SendMessage once to request evidence or report PARTIAL; do not invent a final PASS.
- Continue the same agent with ${SEND_MESSAGE_TOOL_NAME} when the next step depends on its loaded context, failed command output, or recent edits. Spawn a fresh agent when you need independent verification, a clean retry after a wrong approach, or an unrelated task.
- For implementation prompts, assign write scope and tell the agent whether other work may be happening in the repository. The agent must not revert unrelated user or worker edits.
- For verification prompts, ask the agent to prove the code works: run commands with the feature enabled, inspect edge/error paths, investigate failures, and report commands and evidence. A self-check by the implementer does not replace independent verification for risky work.
- For permission-sensitive or destructive work, do not ask an agent to bypass permission checks, hide risky commands, or write outside the assigned scope. If permission is denied, have the agent explain the blocked action and propose a safer path.
- Keep context clean. Do not read or tail background output unless the user asks for a progress check. Summarize results for the user only after you have the actual notification.

### Worker inheritance and verification

- Worker tool pool inheritance: assume the worker only has the tools DSXU resolved for that worker turn. Name required tools in the handoff package, and never claim the worker can use a tool unless it is in the allowed tool scope.
- Permission inheritance: worker commands still go through the same DSXU permission chain. Do not ask a worker to use shell redirects, network install/download, delete, credential access, or cross-workspace writes unless the scope and permission mode allow it.
- Verifier re-check: when implementation risk is meaningful, launch or continue a verifier and require fresh evidence. A verifier PASS must be based on commands, source inspection, diagnostics, or a narrow reproduction, not on the implementer's claim.
- Task notification evidence: treat a completion notification as evidence only when it includes status plus result or failure detail. Prefer notifications that also include usage, tool-use count, output file, worktree path, branch, and the exact PASS/PARTIAL/FAIL marker.
- AgentSummary parent synthesis: use short worker progress summaries as navigation hints only. They do not replace the task notification, source evidence, or verifier result.
- Parent synthesis rules: after a worker returns, synthesize what the worker actually proved, what you independently spot-checked, what changed, what remains, and any residual risk. Do not paste raw worker output as your final answer, and do not invent PASS when the worker did not provide verification evidence.
- Multi-Agent discipline: one active owner per write scope. Do not launch duplicate agents for the same file set or question. If two agents overlap, stop, narrow, or wait before using either result. Never combine two unverified guesses into a false conclusion.
- Explicit-Agent requirement: if the user, task, benchmark, or plan says Agent/worker/verifier/parent synthesis is required, call Agent and keep parent edits out of worker-owned scope. Do not bypass Agent merely because the edit looks small.

### Agent result protocol

Agent results arrive as user-role messages with a \`<task-notification>\` XML block. They look like user messages but are internal DSXU signals, not conversation partners. Do not thank them or acknowledge them directly. Extract the result, synthesize it, and tell the user what changed or what remains.

\`\`\`xml
<task-notification>
<task-id>{agentId}</task-id>
<status>completed|failed|killed</status>
<summary>{human-readable status summary}</summary>
<result>{agent final response}</result>
<usage>
  <total_tokens>N</total_tokens>
  <tool_uses>N</tool_uses>
  <duration_ms>N</duration_ms>
</usage>
</task-notification>
\`\`\`

- \`<task-id>\` is the value to use as \`to\` when continuing a worker with ${SEND_MESSAGE_TOOL_NAME}.
- \`<result>\` and \`<usage>\` may be absent. Never invent missing result text.
- If the user asks about a pending worker before a notification arrives, give status only. Do not guess.

### Task workflow

| Phase | Owner | Purpose |
|---|---|---|
| Research | Agents, often parallel | Find files, trace behavior, identify constraints |
| Synthesis | You | Understand findings and write a concrete spec |
| Implementation | One owner per write scope | Make targeted changes without crossing ownership boundaries |
| Verification | Fresh verifier when risk is meaningful | Prove the change works and probe edge/error paths |

### Failure and recovery

- If a worker reports failed tests, build errors, file-not-found, or permission denial, continue that same worker when its local context and failed command output are useful.
- If the worker chose the wrong overall approach, spawn a fresh worker with a corrected synthesized spec so the retry is not anchored on bad context.
- If the user changes requirements while a worker is still running, stop or supersede that worker if a stop/kill task tool is available; otherwise do not base new work on its pending result.
- Recovery prompts must include the exact failing command, relevant output, files touched, and the smallest next check that would prove the fix.

### DSXU handoff package

Use this structure inside the agent prompt when the task has more than one step or any write risk:

\`\`\`text
Objective: one sentence outcome.
Scope: exact files, modules, commands, or questions in scope.
Out of scope: what not to touch.
Known evidence: facts already verified, with file paths or commands.
Tool/permission boundaries: allowed tools, risky commands to avoid, required approval notes.
Discovery budget: exact Glob/Grep/Read limits; no shell listing or shell reads unless explicitly required.
Edit ownership budget: exact files or directories the worker may change, plus when to stop and verify.
Recovery rule: what to do if a command fails or permission is denied.
Verification evidence required: commands, assertions, screenshots, diagnostics, or PASS marker expected.
Return format: concise result with changed files, tests run, PASS/FAIL, and residual risk.
\`\`\`

### DSXU weak-model discipline

- When to use: use Agent for complex, multi-step, independent, or context-heavy work where a scoped worker or verifier materially improves success.
- When not to use: do not use Agent for a known file read, a simple Grep/Glob search, a single Edit, a direct test command, or work that would duplicate an active worker, unless the current task explicitly requires Agent governance.
- Recovery after failure: continue the same worker when its context and failing output are useful; spawn a fresh worker only for independent verification, a clean retry after a wrong approach, or unrelated work.
- Weak-model anti-pattern: do not hide unclear thinking inside an agent prompt, do not launch overlapping writers, do not poll background workers, and do not invent worker PASS/PARTIAL/FAIL before notification evidence arrives.
- Verification / evidence: parent synthesis must cite worker notification evidence, verifier commands, source inspection, or diagnostics before reporting PASS.
`

  const forkExamples = `Example usage:

<example>
user: "What's left on this branch before we can ship?"
assistant: <thinking>Forking this \u2014 it's a survey question. I want the punch list, not the git output in my context.</thinking>
${AGENT_TOOL_NAME}({
  name: "ship-audit",
  description: "Branch ship-readiness audit",
  prompt: "Audit what's left before this branch can ship. Check: uncommitted changes, commits ahead of main, whether tests exist, whether the feature flag provider gate is wired up, whether CI-relevant files changed. Report a punch list \u2014 done vs. missing. Under 200 words."
})
assistant: Ship-readiness audit running.
<commentary>
Turn ends here. The coordinator knows nothing about the findings yet. What follows is a SEPARATE turn \u2014 the notification arrives from outside, as a user-role message. It is not something the coordinator writes.
</commentary>
[later turn \u2014 notification arrives as user message]
assistant: Audit's back. Three blockers: no tests for the new prompt path, feature flag provider gate wired but not in build_flags.yaml, and one uncommitted file.
</example>

<example>
user: "so is the gate wired up or not"
<commentary>
User asks mid-wait. The audit fork was launched to answer exactly this, and it hasn't returned. The coordinator does not have this answer. Give status, not a fabricated result.
</commentary>
assistant: Still waiting on the audit \u2014 that's one of the things it's checking. Should land shortly.
</example>

<example>
user: "Can you get a second opinion on whether this migration is safe?"
assistant: <thinking>I'll ask the code-reviewer agent - it won't see my analysis, so it can give an independent read.</thinking>
<commentary>
A subagent_type is specified, so the agent starts fresh. It needs full context in the prompt. The briefing explains what to assess and why.
</commentary>
${AGENT_TOOL_NAME}({
  name: "migration-review",
  description: "Independent migration review",
  subagent_type: "code-reviewer",
  prompt: "Review migration 0042_user_schema.sql for safety. Context: we're adding a NOT NULL column to a 50M-row table. Existing rows get a backfill default. I want a second opinion on whether the backfill approach is safe under concurrent writes - I've checked locking behavior but want independent verification. Report: is this safe, and if not, what specifically breaks?"
})
</example>
`

  const currentExamples = `Example usage:

<example_agent_descriptions>
"test-runner": use this agent after you are done writing code to run tests
"greeting-responder": use this agent to respond to user greetings with a friendly joke
</example_agent_descriptions>

<example>
user: "Please write a function that checks if a number is prime"
assistant: I'm going to use the ${FILE_WRITE_TOOL_NAME} tool to write the following code:
<code>
function isPrime(n) {
  if (n <= 1) return false
  for (let i = 2; i * i <= n; i++) {
    if (n % i === 0) return false
  }
  return true
}
</code>
<commentary>
Since a significant piece of code was written and the task was completed, now use the test-runner agent to run the tests
</commentary>
assistant: Uses the ${AGENT_TOOL_NAME} tool to launch the test-runner agent
</example>

<example>
user: "Hello"
<commentary>
Since the user is greeting, use the greeting-responder agent to respond with a friendly joke
</commentary>
assistant: "I'm going to use the ${AGENT_TOOL_NAME} tool to launch the greeting-responder agent"
</example>
`

  // When the gate is on, the agent list lives in an agent_listing_delta
  // attachment (see attachments.ts) instead of inline here. This keeps the
  // tool description static across MCP/plugin/permission changes so the
  // tools-block prompt cache doesn't bust every time an agent loads.
  const listViaAttachment = shouldInjectAgentListInMessages()

  const agentListSection = listViaAttachment
    ? `Available agent types are listed in <system-reminder> messages in the conversation.`
    : `Available agent types and the tools they have access to:
${effectiveAgents.map(agent => formatAgentLine(agent)).join('\n')}`

  // Shared core prompt used by both coordinator and non-coordinator modes
  const shared = `Launch a new agent to handle complex, multi-step tasks autonomously.

The ${AGENT_TOOL_NAME} tool launches specialized agents (subprocesses) that autonomously handle complex tasks. Each agent type has specific capabilities and tools available to it.

${agentListSection}

${
  forkEnabled
    ? `When using the ${AGENT_TOOL_NAME} tool, specify a subagent_type to use a specialized agent, or omit it to fork yourself - a fork inherits your full conversation context.`
    : `When using the ${AGENT_TOOL_NAME} tool, specify a subagent_type parameter to select which agent type to use. If omitted, the general-purpose agent is used.`
}`

  // Coordinator mode gets the slim prompt -- the coordinator system prompt
  // already covers usage notes, examples, and when-not-to-use guidance.
  if (isCoordinator) {
    return shared
  }

  // Ant-native builds alias find/grep to embedded bfs/ugrep and remove the
  // dedicated Glob/Grep tools, so point at find via Bash instead.
  const embedded = hasEmbeddedSearchTools()
  const fileSearchHint = embedded
    ? '`find` via the Bash tool'
    : `the ${GLOB_TOOL_NAME} tool`
  // The "class Foo" example is about content search. Non-embedded stays Glob
  // (original intent: find-the-file-containing). Embedded gets grep because
  // find -name doesn't look at file contents.
  const contentSearchHint = embedded
    ? '`grep` via the Bash tool'
    : `the ${GLOB_TOOL_NAME} tool`
  const whenNotToUseSection = forkEnabled
    ? ''
    : `
When NOT to use the ${AGENT_TOOL_NAME} tool:
- If you want to read a specific file path, use the ${FILE_READ_TOOL_NAME} tool or ${fileSearchHint} instead of the ${AGENT_TOOL_NAME} tool, to find the match more quickly
- If you are searching for a specific class definition like "class Foo", use ${contentSearchHint} instead, to find the match more quickly
- If you are searching for code within a specific file or set of 2-3 files, use the ${FILE_READ_TOOL_NAME} tool instead of the ${AGENT_TOOL_NAME} tool, to find the match more quickly
- Other tasks that are not related to the agent descriptions above
`

  // When listing via attachment, the "launch multiple agents" note is in the
  // attachment message (conditioned on subscription there). When inline, keep
  // the existing per-call getSubscriptionType() check.
  const concurrencyNote =
    !listViaAttachment && getSubscriptionType() !== 'pro'
      ? `
- Launch multiple agents concurrently only when the subtasks are truly independent and have non-overlapping write scopes; to do that, use a single message with multiple tool uses`
      : ''

  // Non-coordinator gets the full prompt with all sections
  return `${shared}
${whenNotToUseSection}

Usage notes:
- Always include a short description (3-5 words) summarizing what the agent will do${concurrencyNote}
- When the agent is done, it will return a single message back to you. The result returned by the agent is not visible to the user. To show the user the result, you should send a text message back to the user with a concise summary of the result.${
    // eslint-disable-next-line custom-rules/no-process-env-top-level
    !isEnvTruthy(getDsxuCodeEnv('DISABLE_BACKGROUND_TASKS')) &&
    !isInProcessTeammate() &&
    !forkEnabled
      ? `
- You can optionally run agents in the background using the run_in_background parameter. When an agent runs in the background, you will be automatically notified when it completes - do NOT sleep, poll, or proactively check on its progress. Continue with other work or respond to the user instead.
- **Foreground vs background**: Use foreground (default) when you need the agent's results before you can proceed - e.g., research agents whose findings inform your next steps. Use background when you have genuinely independent work to do in parallel.`
      : ''
  }
- To continue a previously spawned agent, use ${SEND_MESSAGE_TOOL_NAME} with the agent's ID or name as the \`to\` field. The agent resumes with its full context preserved. ${forkEnabled ? 'Each fresh Agent invocation with a subagent_type starts without context - provide a complete task description.' : 'Each Agent invocation starts fresh - provide a complete task description.'}
- Treat the agent's output as useful evidence, then synthesize it with the task objective, any verifier results, and the current source state before reporting PASS
- Clearly tell the agent whether you expect it to write code or just to do research (search, file reads, web fetches, etc.)${forkEnabled ? '' : ", since it is not aware of the user's intent"}
- If the agent description mentions that it should be used proactively, then you should try your best to use it without the user having to ask for it first. Use your judgement.
- If the user specifies that they want you to run agents "in parallel", you MUST send a single message with multiple ${AGENT_TOOL_NAME} tool use content blocks. For example, if you need to launch both a build-validator agent and a test-runner agent in parallel, send a single message with both tool calls.
- You can optionally set \`isolation: "worktree"\` to run the agent in a temporary git worktree, giving it an isolated copy of the repository. The worktree is automatically cleaned up if the agent makes no changes; if changes are made, the worktree path and branch are returned in the result.${
    isInProcessTeammate()
      ? `
- The run_in_background, name, team_name, and mode parameters are not available in this context. Only synchronous subagents are supported.`
      : isTeammate()
        ? `
- The name, team_name, and mode parameters are not available in this context - teammates cannot spawn other teammates. Omit them to spawn a subagent.`
        : ''
  }${whenToForkSection}${writingThePromptSection}${dsxuOrchestrationContractSection}

${forkEnabled ? forkExamples : currentExamples}`
}
