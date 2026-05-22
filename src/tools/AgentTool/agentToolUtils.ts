import { feature } from 'bun:bundle'
import { z } from 'zod/v4'
import { clearInvokedSkillsForAgent } from '../../bootstrap/state.js'
import {
  ALL_AGENT_DISALLOWED_TOOLS,
  ASYNC_AGENT_ALLOWED_TOOLS,
  CUSTOM_AGENT_DISALLOWED_TOOLS,
  IN_PROCESS_TEAMMATE_ALLOWED_TOOLS,
} from '../../constants/tools.js'
import { startAgentSummarization } from '../../services/AgentSummary/agentSummary.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../../services/analytics/index.js'
import { clearDumpState } from '../../services/api/dumpPrompts.js'
import type { AppState } from '../../state/AppState.js'
import type {
  Tool,
  ToolPermissionContext,
  Tools,
  ToolUseContext,
} from '../../Tool.js'
import { toolMatchesName } from '../../Tool.js'
import {
  type AgentRuntimeEvidence,
  completeAgentTask as completeAsyncAgent,
  createActivityDescriptionResolver,
  createProgressTracker,
  enqueueAgentNotification,
  failAgentTask as failAsyncAgent,
  getProgressUpdate,
  getTokenCountFromTracker,
  isLocalAgentTask,
  killAsyncAgent,
  type ProgressTracker,
  updateAgentProgress as updateAsyncAgentProgress,
  updateProgressFromMessage,
} from '../../tasks/LocalAgentTask/LocalAgentTask.js'
import { asAgentId } from '../../types/ids.js'
import type { Message as MessageType } from '../../types/message.js'
import { isAgentSwarmsEnabled } from '../../utils/agentSwarmsEnabled.js'
import { logForDebugging } from '../../utils/debug.js'
import { isInProtectedNamespace } from '../../utils/envUtils.js'
import { AbortError, errorMessage } from '../../utils/errors.js'
import type { CacheSafeParams } from '../../utils/forkedAgent.js'
import { lazySchema } from '../../utils/lazySchema.js'
import {
  extractTextContent,
  getLastAssistantMessage,
} from '../../utils/messages.js'
import type { PermissionMode } from '../../utils/permissions/PermissionMode.js'
import { permissionRuleValueFromString } from '../../utils/permissions/permissionRuleParser.js'
import {
  buildTranscriptForClassifier,
  classifyYoloAction,
} from '../../utils/permissions/yoloClassifier.js'
import { emitTaskProgress as emitTaskProgressEvent } from '../../utils/task/sdkProgress.js'
import { isInProcessTeammate } from '../../utils/teammateContext.js'
import { getTokenCountFromUsage } from '../../utils/tokens.js'
import { EXIT_PLAN_MODE_V2_TOOL_NAME } from '../ExitPlanModeTool/constants.js'
import { AGENT_TOOL_NAME, SOURCE_AGENT_TOOL_ALIAS_NAME } from './constants.js'
import type { AgentDefinition } from './loadAgentsDir.js'
export type ResolvedAgentTools = {
  hasWildcard: boolean
  validTools: string[]
  invalidTools: string[]
  resolvedTools: Tools
  allowedAgentTypes?: string[]
}
export function filterToolsForAgent({
  tools,
  isBuiltIn,
  isAsync = false,
  permissionMode,
}: {
  tools: Tools
  isBuiltIn: boolean
  isAsync?: boolean
  permissionMode?: PermissionMode
}): Tools {
  return tools.filter(tool => {
    // Allow MCP tools for all agents
    if (tool.name.startsWith('mcp__')) {
      return true
    }
    // Allow ExitPlanMode for agents in plan mode (e.g., in-process teammates)
    // This bypasses both the ALL_AGENT_DISALLOWED_TOOLS and async tool filters
    if (
      toolMatchesName(tool, EXIT_PLAN_MODE_V2_TOOL_NAME) &&
      permissionMode === 'plan'
    ) {
      return true
    }
    if (ALL_AGENT_DISALLOWED_TOOLS.has(tool.name)) {
      return false
    }
    if (!isBuiltIn && CUSTOM_AGENT_DISALLOWED_TOOLS.has(tool.name)) {
      return false
    }
    if (isAsync && !ASYNC_AGENT_ALLOWED_TOOLS.has(tool.name)) {
      if (isAgentSwarmsEnabled() && isInProcessTeammate()) {
        // Allow AgentTool for in-process teammates to spawn sync subagents.
        // Validation in AgentTool.call() prevents background agents and teammate spawning.
        if (toolMatchesName(tool, AGENT_TOOL_NAME)) {
          return true
        }
        // Allow task tools for in-process teammates to coordinate via shared task list
        if (IN_PROCESS_TEAMMATE_ALLOWED_TOOLS.has(tool.name)) {
          return true
        }
      }
      return false
    }
    return true
  })
}
/**
 * Resolves and validates agent tools against available tools
 * Handles wildcard expansion and validation in one place
 */
export function resolveAgentTools(
  agentDefinition: Pick<
    AgentDefinition,
    'tools' | 'disallowedTools' | 'source' | 'permissionMode'
  >,
  availableTools: Tools,
  isAsync = false,
  isMainThread = false,
): ResolvedAgentTools {
  const {
    tools: agentTools,
    disallowedTools,
    source,
    permissionMode,
  } = agentDefinition
  // When isMainThread is true, skip filterToolsForAgent entirely ...the main
  // thread's tool pool is already properly assembled by useMergedTools(), so
  // the sub-agent disallow lists shouldn't apply.
  const filteredAvailableTools = isMainThread
    ? availableTools
    : filterToolsForAgent({
        tools: availableTools,
        isBuiltIn: source === 'built-in',
        isAsync,
        permissionMode,
      })
  // Create a set of disallowed tool names for quick lookup
  const disallowedToolSet = new Set(
    disallowedTools?.map(toolSpec => {
      const { toolName } = permissionRuleValueFromString(toolSpec)
      return toolName
    }) ?? [],
  )
  // Filter available tools based on disallowed list
  const allowedAvailableTools = filteredAvailableTools.filter(
    tool => !disallowedToolSet.has(tool.name),
  )
  // If tools is undefined or ['*'], allow all tools (after filtering disallowed)
  const hasWildcard =
    agentTools === undefined ||
    (agentTools.length === 1 && agentTools[0] === '*')
  if (hasWildcard) {
    return {
      hasWildcard: true,
      validTools: [],
      invalidTools: [],
      resolvedTools: allowedAvailableTools,
    }
  }
  const availableToolMap = new Map<string, Tool>()
  for (const tool of allowedAvailableTools) {
    availableToolMap.set(tool.name, tool)
  }
  const validTools: string[] = []
  const invalidTools: string[] = []
  const resolved: Tool[] = []
  const resolvedToolsSet = new Set<Tool>()
  let allowedAgentTypes: string[] | undefined
  for (const toolSpec of agentTools) {
    // Parse the tool spec to extract the base tool name and any permission pattern
    const { toolName, ruleContent } = permissionRuleValueFromString(toolSpec)
    // Special case: Agent tool carries allowedAgentTypes metadata in its spec
    if (toolName === AGENT_TOOL_NAME) {
      if (ruleContent) {
        // Parse comma-separated agent types: "worker, researcher"  -> ["worker", "researcher"]
        allowedAgentTypes = ruleContent.split(',').map(s => s.trim())
      }
      // For sub-agents, Agent is excluded by filterToolsForAgent ...mark the spec
      // valid for allowedAgentTypes tracking but skip tool resolution.
      if (!isMainThread) {
        validTools.push(toolSpec)
        continue
      }
      // For main thread, filtering was skipped so Agent is in availableToolMap ...      // fall through to normal resolution below.
    }
    const tool = availableToolMap.get(toolName)
    if (tool) {
      validTools.push(toolSpec)
      if (!resolvedToolsSet.has(tool)) {
        resolved.push(tool)
        resolvedToolsSet.add(tool)
      }
    } else {
      invalidTools.push(toolSpec)
    }
  }
  return {
    hasWildcard: false,
    validTools,
    invalidTools,
    resolvedTools: resolved,
    allowedAgentTypes,
  }
}
export const agentToolResultSchema = lazySchema(() =>
  z.object({
    agentId: z.string(),
    // Optional: older persisted sessions won't have this (resume replays
    // results verbatim without re-validation). Used to gate the sync
    // result trailer ...one-shot built-ins skip the SendMessage hint.
    agentType: z.string().optional(),
    content: z.array(z.object({ type: z.literal('text'), text: z.string() })),
    evidencePacket: agentEvidencePacketSchema().optional(),
    runtimeEvidence: z.object({
      taskId: z.string(),
      taskType: z.literal('local_agent'),
      owner: z.string(),
      writeScope: z.array(z.string()),
      cwd: z.string().optional(),
      isolation: z.enum(['none', 'cwd_override', 'worktree_isolation', 'remote_gated_isolation', 'fork_context_inheritance']),
      recoverPath: z.enum(['send_message_continuation', 'task_output_then_sendmessage', 'partial_result_notification']),
      lifecycleState: z.enum(['pending', 'running', 'completed', 'failed', 'killed']),
      placement: z.enum(['foreground', 'background']),
      outputPath: z.string(),
      progressEventCount: z.number(),
      canAbort: z.boolean(),
      canRecover: z.boolean(),
    }).optional(),
    totalToolUseCount: z.number(),
    totalDurationMs: z.number(),
    totalTokens: z.number(),
    usage: z.object({
      input_tokens: z.number(),
      output_tokens: z.number(),
      cache_creation_input_tokens: z.number().nullable(),
      cache_read_input_tokens: z.number().nullable(),
      server_tool_use: z
        .object({
          web_search_requests: z.number(),
          web_fetch_requests: z.number(),
        })
        .nullable(),
      service_tier: z.enum(['standard', 'priority', 'batch']).nullable(),
      cache_creation: z
        .object({
          ephemeral_1h_input_tokens: z.number(),
          ephemeral_5m_input_tokens: z.number(),
        })
        .nullable(),
    }),
  }),
)
export type AgentToolResult = z.input<ReturnType<typeof agentToolResultSchema>>
export const agentEvidencePacketSchema = lazySchema(() =>
  z.object({
    files_read: z.array(z.string()),
    files_changed: z.array(z.string()),
    commands_run: z.array(z.string()),
    tests_passed: z.array(z.string()),
    tests_failed: z.array(z.string()),
    unresolved_risks: z.array(z.string()),
    completion_claim: z.enum(['complete', 'partial', 'unknown']),
  }),
)
export type AgentEvidencePacket = z.input<
  ReturnType<typeof agentEvidencePacketSchema>
>
const AGENT_EVIDENCE_MAX_ITEMS = 8
const AGENT_EVIDENCE_MAX_TEXT = 180
function truncateEvidenceText(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= AGENT_EVIDENCE_MAX_TEXT) return normalized
  return `${normalized.slice(0, AGENT_EVIDENCE_MAX_TEXT - 3)}...`
}
function addEvidenceItem(items: string[], value: unknown): void {
  if (typeof value !== 'string') return
  const normalized = truncateEvidenceText(value)
  if (!normalized || items.includes(normalized)) return
  if (items.length >= AGENT_EVIDENCE_MAX_ITEMS) return
  items.push(normalized)
}
function extractToolResultText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map(block => {
      if (
        block &&
        typeof block === 'object' &&
        'type' in block &&
        block.type === 'text' &&
        'text' in block &&
        typeof block.text === 'string'
      ) {
        return block.text
      }
      return ''
    })
    .filter(Boolean)
    .join('\n')
}
function splitEvidenceList(text: string): string[] {
  return text
    .split(/[,;\n]/)
    .map(item => item.trim())
    .filter(Boolean)
}
function looksLikePassingTestOutput(text: string): boolean {
  const hasTestSignal =
    /\bbun test\b/i.test(text) ||
    /\b(vitest|jest|pytest|npm test|pnpm test|yarn test)\b/i.test(text) ||
    /\bRan\s+\d+\s+tests?\b/i.test(text) ||
    /\b\d+\s+pass\b/i.test(text)
  if (!hasTestSignal) return false
  const hasPass =
    /\b[1-9]\d*\s+pass\b/i.test(text) || /\btests?\s+passed\b/i.test(text)
  return hasPass && !hasExplicitTestFailure(text)
}
function looksLikeFailingTestOutput(text: string): boolean {
  const hasTestSignal =
    /\bbun test\b/i.test(text) ||
    /\b(vitest|jest|pytest|npm test|pnpm test|yarn test)\b/i.test(text) ||
    /\bRan\s+\d+\s+tests?\b/i.test(text) ||
    /\b\d+\s+fail\b/i.test(text)
  if (!hasTestSignal) return false
  return hasExplicitTestFailure(text)
}
function hasExplicitTestFailure(text: string): boolean {
  return (
    /\bexit code\s+[1-9]\b/i.test(text) ||
    /\b[1-9]\d*\s+(?:fail|fails|failed|failure|failures)\b/i.test(text) ||
    /^\s*(?:FAIL|FAILED)\b/im.test(text) ||
    /\b(?:tests?|test suites?|assertions?)\s+(?:failed|failing)\b/i.test(text) ||
    /\b(?:failed|failing)\s+(?:tests?|test suites?|assertions?)\b/i.test(text) ||
    /\bassertionerror\b|\berror:/i.test(text)
  )
}
function getStructuredMessageContent(message: MessageType): any[] | null {
  if (message.type !== 'assistant' && message.type !== 'user') return null
  const content = (message as { message?: { content?: unknown } }).message?.content
  return Array.isArray(content) ? content : null
}
function lineDeclaresNoUnresolvedRisk(line: string): boolean {
  if (
    !/\b(?:residual\s+risks?|risks?|unresolved|remaining|blockers?|blocked)\b/i.test(
      line,
    )
  ) {
    return false
  }
  return /\b(?:none|no|nothing|n\/a|not applicable)\b/i.test(line)
}
function lineDeclaresPassingStatus(line: string): boolean {
  return (
    /\bpass(?:ed|es)?\b/i.test(line) &&
    /\b0\s+(?:fail|failed|fails|failures?)\b/i.test(line)
  )
}
function lineDeclaresUnresolvedRisk(line: string): boolean {
  const trimmed = line.trim()
  if (
    /^\s*(?:residual\s+risks?|risks?|unresolved(?:\s+risks?)?|remaining|blockers?|blocked)\s*:/i.test(
      trimmed,
    )
  ) {
    return true
  }
  return /^\s*(?:PARTIAL|FAIL|FAILED|BLOCKED)\b/i.test(trimmed)
}
function isVerificationToolName(name: string): boolean {
  return ['Bash', 'PowerShell', 'bash', 'powershell'].includes(name)
}
export function buildAgentEvidencePacket(
  agentMessages: MessageType[],
  finalText: string,
): AgentEvidencePacket {
  const packet: AgentEvidencePacket = {
    files_read: [],
    files_changed: [],
    commands_run: [],
    tests_passed: [],
    tests_failed: [],
    unresolved_risks: [],
    completion_claim: 'unknown',
  }
  const toolCallById = new Map<string, { name: string; input: any }>()
  for (const message of agentMessages) {
    const content = getStructuredMessageContent(message)
    if (!content) continue
    if (message.type === 'assistant') {
      for (const block of content) {
        if (block.type !== 'tool_use') continue
        toolCallById.set(block.id, {
          name: block.name,
          input: block.input,
        })
        const input = block.input as Record<string, unknown>
        if (['Read', 'FileRead'].includes(block.name)) {
          addEvidenceItem(packet.files_read, input.file_path ?? input.path)
        }
        if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(block.name)) {
          addEvidenceItem(
            packet.files_changed,
            input.file_path ?? input.path ?? input.notebook_path,
          )
        }
        if (['Bash', 'PowerShell', 'bash', 'powershell'].includes(block.name)) {
          addEvidenceItem(packet.commands_run, input.command)
        }
      }
      continue
    }
    if (message.type !== 'user') continue
    for (const block of content) {
      if (block.type !== 'tool_result') continue
      const toolCall = toolCallById.get(block.tool_use_id)
      const text = extractToolResultText(block.content)
      if (!toolCall || !text) continue
      if (!isVerificationToolName(toolCall.name)) continue
      const command =
        typeof toolCall.input?.command === 'string'
          ? toolCall.input.command
          : toolCall.name
      if (looksLikePassingTestOutput(text)) {
        addEvidenceItem(packet.tests_passed, command)
      } else if (looksLikeFailingTestOutput(text)) {
        addEvidenceItem(packet.tests_failed, command)
      }
    }
  }
  for (const line of finalText.split(/\r?\n/)) {
    const changed = line.match(/^\s*(?:files?\s+changed|changed\s+files?)\s*:\s*(.+)$/i)
    if (changed) {
      for (const item of splitEvidenceList(changed[1]!)) {
        addEvidenceItem(packet.files_changed, item)
      }
    }
    const passed = line.match(/^\s*(?:tests?\s+passed|verification)\s*:\s*(.+)$/i)
    if (passed) {
      for (const item of splitEvidenceList(passed[1]!)) {
        addEvidenceItem(packet.tests_passed, item)
      }
    }
    if (
      lineDeclaresUnresolvedRisk(line) &&
      !lineDeclaresNoUnresolvedRisk(line) &&
      !lineDeclaresPassingStatus(line)
    ) {
      addEvidenceItem(packet.unresolved_risks, line)
    }
  }
  if (packet.tests_failed.length > 0 || packet.unresolved_risks.length > 0) {
    packet.completion_claim = 'partial'
  } else if (
    /\b(done|complete|completed|fixed|implemented|verified|pass(?:ed)?)\b/i.test(finalText) ||
    packet.tests_passed.length > 0
  ) {
    packet.completion_claim = 'complete'
  }
  return packet
}
export function renderAgentEvidencePacket(packet: AgentEvidencePacket): string {
  return [
    '<evidence>',
    `files_read: ${packet.files_read.join(', ') || 'none'}`,
    `files_changed: ${packet.files_changed.join(', ') || 'none'}`,
    `commands_run: ${packet.commands_run.join(', ') || 'none'}`,
    `tests_passed: ${packet.tests_passed.join(', ') || 'none'}`,
    `tests_failed: ${packet.tests_failed.join(', ') || 'none'}`,
    `unresolved_risks: ${packet.unresolved_risks.join(' | ') || 'none'}`,
    `completion_claim: ${packet.completion_claim}`,
    '</evidence>',
  ].join('\n')
}
export function countToolUses(messages: MessageType[]): number {
  let count = 0
  for (const m of messages) {
    if (m.type === 'assistant') {
      const content = getStructuredMessageContent(m)
      if (!content) continue
      for (const block of content) {
        if (block.type === 'tool_use') {
          count++
        }
      }
    }
  }
  return count
}
export function finalizeAgentTool(
  agentMessages: MessageType[],
  agentId: string,
  metadata: {
    prompt: string
    resolvedAgentModel: string
    isBuiltInAgent: boolean
    startTime: number
    agentType: string
    isAsync: boolean
    runtimeEvidence?: AgentRuntimeEvidence
  },
): AgentToolResult {
  const {
    prompt,
    resolvedAgentModel,
    isBuiltInAgent,
    startTime,
    agentType,
    isAsync,
  } = metadata
  const lastAssistantMessage = getLastAssistantMessage(agentMessages)
  const lastAssistantContent = lastAssistantMessage
    ? getStructuredMessageContent(lastAssistantMessage)
    : null
  if (lastAssistantMessage === undefined || lastAssistantContent === null) {
    throw new Error('No assistant messages found')
  }
  // Extract text content from the agent's response. If the final assistant
  // message is a pure tool_use block (loop exited mid-turn), fall back to
  // the most recent assistant message that has text content.
  let content = lastAssistantContent.filter(
    _ => _.type === 'text',
  )
  if (content.length === 0) {
    for (let i = agentMessages.length - 1; i >= 0; i--) {
      const m = agentMessages[i]!
      if (m.type !== 'assistant') continue
      const messageContent = getStructuredMessageContent(m)
      if (!messageContent) continue
      const textBlocks = messageContent.filter(_ => _.type === 'text')
      if (textBlocks.length > 0) {
        content = textBlocks
        break
      }
    }
  }
  const totalTokens = getTokenCountFromUsage(lastAssistantMessage.message.usage)
  const totalToolUseCount = countToolUses(agentMessages)
  const finalText = extractTextContent(content, '\n')
  const evidencePacket = buildAgentEvidencePacket(agentMessages, finalText)
  logEvent('tengu_agent_tool_completed', {
    agent_type:
      agentType as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    model:
      resolvedAgentModel as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    prompt_char_count: prompt.length,
    response_char_count: content.length,
    assistant_message_count: agentMessages.length,
    total_tool_uses: totalToolUseCount,
    duration_ms: Date.now() - startTime,
    total_tokens: totalTokens,
    is_built_in_agent: isBuiltInAgent,
    is_async: isAsync,
  })
  // Signal to inference that this subagent's cache chain can be evicted.
  const lastRequestId = lastAssistantMessage.requestId
  if (lastRequestId) {
    logEvent('tengu_cache_eviction_hint', {
      scope:
        'subagent_end' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      last_request_id:
        lastRequestId as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
  }
  return {
    agentId,
    agentType,
    content,
    evidencePacket,
    runtimeEvidence: metadata.runtimeEvidence,
    totalDurationMs: Date.now() - startTime,
    totalTokens,
    totalToolUseCount,
    usage: lastAssistantMessage.message.usage,
  }
}
/**
 * Returns the name of the last tool_use block in an assistant message,
 * or undefined if the message is not an assistant message with tool_use.
 */
export function getLastToolUseName(message: MessageType): string | undefined {
  if (message.type !== 'assistant') return undefined
  const content = getStructuredMessageContent(message)
  if (!content) return undefined
  const block = content.findLast(b => b.type === 'tool_use')
  return block?.type === 'tool_use' ? block.name : undefined
}
export function emitTaskProgress(
  tracker: ProgressTracker,
  taskId: string,
  toolUseId: string | undefined,
  description: string,
  startTime: number,
  lastToolName: string,
): void {
  const progress = getProgressUpdate(tracker)
  emitTaskProgressEvent({
    taskId,
    toolUseId,
    description: progress.lastActivity?.activityDescription ?? description,
    startTime,
    totalTokens: progress.tokenCount,
    toolUses: progress.toolUseCount,
    lastToolName,
  })
}
export async function classifyHandoffIfNeeded({
  agentMessages,
  tools,
  toolPermissionContext,
  abortSignal,
  subagentType,
  totalToolUseCount,
}: {
  agentMessages: MessageType[]
  tools: Tools
  toolPermissionContext: AppState['toolPermissionContext']
  abortSignal: AbortSignal
  subagentType: string
  totalToolUseCount: number
}): Promise<string | null> {
  if (feature('TRANSCRIPT_CLASSIFIER')) {
    if (toolPermissionContext.mode !== 'auto') return null
    const agentTranscript = buildTranscriptForClassifier(agentMessages, tools)
    if (!agentTranscript) return null
    const classifierResult = await classifyYoloAction(
      agentMessages,
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: "Sub-agent has finished and is handing back control to the main agent. Review the sub-agent's work based on the block rules and let the main agent know if any file is dangerous (the main agent will see the reason).",
          },
        ],
      },
      tools,
      toolPermissionContext as ToolPermissionContext,
      abortSignal,
    )
    const handoffDecision = classifierResult.unavailable
      ? 'unavailable'
      : classifierResult.shouldBlock
        ? 'blocked'
        : 'allowed'
    logEvent('tengu_auto_mode_decision', {
      decision:
        handoffDecision as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      toolName:
        // Use the provider-migration source wire alias for analytics continuity across the Task -> Agent rename.
        SOURCE_AGENT_TOOL_ALIAS_NAME as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      inProtectedNamespace: isInProtectedNamespace(),
      classifierModel:
        classifierResult.model as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      agentType:
        subagentType as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      toolUseCount: totalToolUseCount,
      isHandoff: true,
      // For handoff, the relevant agent completion is the subagent's final
      // assistant message ...the last thing the classifier transcript shows
      // before the handoff review prompt.
      agentMsgId: getLastAssistantMessage(agentMessages)?.message
        .id as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      classifierStage:
        classifierResult.stage as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      classifierStage1RequestId:
        classifierResult.stage1RequestId as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      classifierStage1MsgId:
        classifierResult.stage1MsgId as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      classifierStage2RequestId:
        classifierResult.stage2RequestId as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      classifierStage2MsgId:
        classifierResult.stage2MsgId as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
    if (classifierResult.shouldBlock) {
      // When classifier is unavailable, still propagate the sub-agent's
      // results but with a warning so the parent agent can verify the work.
      if (classifierResult.unavailable) {
        logForDebugging(
          'Handoff classifier unavailable, allowing sub-agent output with warning',
          { level: 'warn' },
        )
        return `Note: The safety classifier was unavailable when reviewing this sub-agent's work. Please carefully verify the sub-agent's actions and output before acting on them.`
      }
      logForDebugging(
        `Handoff classifier flagged sub-agent output: ${classifierResult.reason}`,
        { level: 'warn' },
      )
      return `SECURITY WARNING: This sub-agent performed actions that may violate security policy. Reason: ${classifierResult.reason}. Review the sub-agent's actions carefully before acting on its output.`
    }
  }
  return null
}
/**
 * Extract a partial result string from an agent's accumulated messages.
 * Used when an async agent is killed to preserve what it accomplished.
 * Returns undefined if no text content is found.
 */
export function extractPartialResult(
  messages: MessageType[],
): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!
    if (m.type !== 'assistant') continue
    const content = getStructuredMessageContent(m)
    if (!content) continue
    const text = extractTextContent(content, '\n')
    if (text) {
      return text
    }
  }
  return undefined
}
type SetAppState = (f: (prev: AppState) => AppState) => void
/**
 * Drives a background agent from spawn to terminal notification.
 * Shared between AgentTool's async-from-start path and resumeAgentBackground.
 */
export async function runAsyncAgentLifecycle({
  taskId,
  abortController,
  makeStream,
  metadata,
  description,
  toolUseContext,
  rootSetAppState,
  agentIdForCleanup,
  enableSummarization,
  getWorktreeResult,
}: {
  taskId: string
  abortController: AbortController
  makeStream: (
    onCacheSafeParams: ((p: CacheSafeParams) => void) | undefined,
  ) => AsyncGenerator<MessageType, void>
  metadata: Parameters<typeof finalizeAgentTool>[2]
  description: string
  toolUseContext: ToolUseContext
  rootSetAppState: SetAppState
  agentIdForCleanup: string
  enableSummarization: boolean
  getWorktreeResult: () => Promise<{
    worktreePath?: string
    worktreeBranch?: string
  }>
}): Promise<void> {
  let stopSummarization: (() => void) | undefined
  const agentMessages: MessageType[] = []
  try {
    const tracker = createProgressTracker()
    const resolveActivity = createActivityDescriptionResolver(
      toolUseContext.options.tools,
    )
    const onCacheSafeParams = enableSummarization
      ? (params: CacheSafeParams) => {
          const { stop } = startAgentSummarization(
            taskId,
            asAgentId(taskId),
            params,
            rootSetAppState,
          )
          stopSummarization = stop
        }
      : undefined
    for await (const message of makeStream(onCacheSafeParams)) {
      agentMessages.push(message)
      // Append immediately when UI holds the task (retain). Bootstrap reads
      // disk in parallel and UUID-merges the prefix ...disk-write-before-yield
      // means live is always a suffix of disk, so merge is order-correct.
      rootSetAppState(prev => {
        const t = prev.tasks[taskId]
        if (!isLocalAgentTask(t) || !t.retain) return prev
        const base = t.messages ?? []
        return {
          ...prev,
          tasks: {
            ...prev.tasks,
            [taskId]: { ...t, messages: [...base, message] },
          },
        }
      })
      updateProgressFromMessage(
        tracker,
        message,
        resolveActivity,
        toolUseContext.options.tools,
      )
      updateAsyncAgentProgress(
        taskId,
        getProgressUpdate(tracker),
        rootSetAppState,
      )
      const lastToolName = getLastToolUseName(message)
      if (lastToolName) {
        emitTaskProgress(
          tracker,
          taskId,
          toolUseContext.toolUseId,
          description,
          metadata.startTime,
          lastToolName,
        )
      }
    }
    stopSummarization?.()
    const finalProgress = getProgressUpdate(tracker)
    const agentResult = finalizeAgentTool(agentMessages, taskId, {
      ...metadata,
      runtimeEvidence: metadata.runtimeEvidence
        ? {
            ...metadata.runtimeEvidence,
            lifecycleState: 'completed',
            progressEventCount: finalProgress.toolUseCount,
            canAbort: false,
            canRecover: true,
          }
        : undefined,
    })
    // Mark task completed FIRST so TaskOutput(block=true) unblocks
    // immediately. classifyHandoffIfNeeded (API call) and getWorktreeResult
    // (git exec) are notification embellishments that can hang ...they must
    // not gate the status transition (gh-20236).
    completeAsyncAgent(agentResult, rootSetAppState)
    let finalMessage = extractTextContent(agentResult.content, '\n')
    if (feature('TRANSCRIPT_CLASSIFIER')) {
      const handoffWarning = await classifyHandoffIfNeeded({
        agentMessages,
        tools: toolUseContext.options.tools,
        toolPermissionContext:
          toolUseContext.getAppState().toolPermissionContext,
        abortSignal: abortController.signal,
        subagentType: metadata.agentType,
        totalToolUseCount: agentResult.totalToolUseCount,
      })
      if (handoffWarning) {
        finalMessage = `${handoffWarning}\n\n${finalMessage}`
      }
    }
    const worktreeResult = await getWorktreeResult()
    enqueueAgentNotification({
      taskId,
      description,
      status: 'completed',
      setAppState: rootSetAppState,
      finalMessage,
      usage: {
        totalTokens: getTokenCountFromTracker(tracker),
        toolUses: agentResult.totalToolUseCount,
        durationMs: agentResult.totalDurationMs,
      },
      toolUseId: toolUseContext.toolUseId,
      ...worktreeResult,
    })
  } catch (error) {
    stopSummarization?.()
    if (error instanceof AbortError) {
      // killAsyncAgent is a no-op if TaskStop already set status='killed' ...      // but only this catch handler has agentMessages, so the notification
      // must fire unconditionally. Transition status BEFORE worktree cleanup
      // so TaskOutput unblocks even if git hangs (gh-20236).
      killAsyncAgent(taskId, rootSetAppState)
      logEvent('tengu_agent_tool_terminated', {
        agent_type:
          metadata.agentType as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        model:
          metadata.resolvedAgentModel as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        duration_ms: Date.now() - metadata.startTime,
        is_async: true,
        is_built_in_agent: metadata.isBuiltInAgent,
        reason:
          'user_kill_async' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      })
      const worktreeResult = await getWorktreeResult()
      const partialResult = extractPartialResult(agentMessages)
      enqueueAgentNotification({
        taskId,
        description,
        status: 'killed',
        setAppState: rootSetAppState,
        toolUseId: toolUseContext.toolUseId,
        finalMessage: partialResult,
        ...worktreeResult,
      })
      return
    }
    const msg = errorMessage(error)
    failAsyncAgent(taskId, msg, rootSetAppState)
    const worktreeResult = await getWorktreeResult()
    enqueueAgentNotification({
      taskId,
      description,
      status: 'failed',
      error: msg,
      setAppState: rootSetAppState,
      toolUseId: toolUseContext.toolUseId,
      ...worktreeResult,
    })
  } finally {
    clearInvokedSkillsForAgent(agentIdForCleanup)
    clearDumpState(agentIdForCleanup)
  }
}
