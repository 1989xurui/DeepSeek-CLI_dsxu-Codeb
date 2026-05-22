// biome-ignore-all assist/source/organizeImports: DSXU import-order markers must not be reordered
import type {
  ToolResultBlockParam,
  ToolUseBlock,
} from 'src/types/providerSdk.js'
import type { CanUseToolFn } from './hooks/useCanUseTool.js'
import { FallbackTriggeredError } from './services/api/withRetry.js'
import {
  calculateTokenWarningState,
  getEffectiveContextWindowSize,
  isAutoCompactEnabled,
  type AutoCompactTrackingState,
} from './services/compact/autoCompact.js'
import { buildPostCompactMessages } from './services/compact/compact.js'
/* eslint-disable @typescript-eslint/no-require-imports */
const reactiveCompact = feature('REACTIVE_COMPACT')
  ? (require('./services/compact/reactiveCompact.js') as typeof import('./services/compact/reactiveCompact.js'))
  : null
const contextCollapse = feature('CONTEXT_COLLAPSE')
  ? (require('./services/contextCollapse/index.js') as typeof import('./services/contextCollapse/index.js'))
  : null
/* eslint-enable @typescript-eslint/no-require-imports */
import {
  logEvent,
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
} from 'src/services/analytics/index.js'
import { ImageSizeError } from './utils/imageValidation.js'
import { ImageResizeError } from './utils/imageResizer.js'
import { findToolByName, type ToolUseContext } from './Tool.js'
import { asSystemPrompt, type SystemPrompt } from './utils/systemPromptType.js'
import type {
  AssistantMessage,
  AttachmentMessage,
  Message,
  RequestStartEvent,
  StreamEvent,
  ToolUseSummaryMessage,
  UserMessage,
  TombstoneMessage,
} from './types/message.js'
import { logError } from './utils/log.js'
import {
  PROMPT_TOO_LONG_ERROR_MESSAGE,
  isPromptTooLongMessage,
} from './services/api/errors.js'
import { logAntError, logForDebugging } from './utils/debug.js'
import {
  decideDeepSeekV4Route,
  decideDeepSeekV4RuntimeModelOverride,
  estimateDeepSeekV4Cost,
  formatDeepSeekV4ModelEvidence,
  inferDeepSeekV4RouteInput,
  normalizeDeepSeekV4Model,
} from './utils/model/deepseekV4Control.js'
import {
  createUserMessage,
  createUserInterruptionMessage,
  normalizeMessagesForAPI,
  createSystemMessage,
  createAssistantMessage,
  createAssistantAPIErrorMessage,
  getMessagesAfterCompactBoundary,
  createToolUseSummaryMessage,
  createMicrocompactBoundaryMessage,
  stripSignatureBlocks,
} from './utils/messages.js'
import { generateToolUseSummary } from './services/toolUseSummary/toolUseSummaryGenerator.js'
import { prependUserContext, appendSystemContext } from './utils/api.js'
import {
  createAttachmentMessage,
  filterDuplicateMemoryAttachments,
  getAttachmentMessages,
  startRelevantMemoryPrefetch,
} from './utils/attachments.js'
/* eslint-disable @typescript-eslint/no-require-imports */
const skillPrefetch = feature('EXPERIMENTAL_SKILL_SEARCH')
  ? (require('./services/skillSearch/prefetch.js') as typeof import('./services/skillSearch/prefetch.js'))
  : null
const jobClassifier = feature('TEMPLATES')
  ? (require('./jobs/classifier.js') as typeof import('./jobs/classifier.js'))
  : null
/* eslint-enable @typescript-eslint/no-require-imports */
import {
  remove as removeFromQueue,
  getCommandsByMaxPriority,
  selectQueuedCommandsForQueryTurn,
} from './utils/messageQueueManager.js'
import { notifyCommandLifecycle } from './utils/commandLifecycle.js'
import { headlessProfilerCheckpoint } from './utils/headlessProfiler.js'
import {
  getRuntimeMainLoopModel,
  renderModelName,
} from './utils/model/model.js'
import {
  doesMostRecentAssistantMessageExceed200k,
  finalContextTokensFromLastResponse,
  tokenCountWithEstimation,
} from './utils/tokens.js'
import { ESCALATED_MAX_TOKENS } from './utils/context.js'
import { getFeatureValue_CACHED_MAY_BE_STALE } from './services/analytics/featureFlags.js'
import { SLEEP_TOOL_NAME } from './tools/SleepTool/prompt.js'
import { drainPendingAgentContinuationMessages } from './tasks/LocalAgentTask/LocalAgentTask.js'
import { isBackgroundTask, type TaskState } from './tasks/types.js'
import { executePostSamplingHooks } from './utils/hooks/postSamplingHooks.js'
import { executeStopFailureHooks } from './utils/hooks.js'
import type { QuerySource } from './constants/querySource.js'
import { createDumpPromptsFetch } from './services/api/dumpPrompts.js'
import { StreamingToolExecutor } from './services/tools/StreamingToolExecutor.js'
import { hasDsxuPendingRequiredEditAfterBaselinePass } from './services/tools/dsxuToolBatchGate.js'
import { queryCheckpoint } from './utils/queryProfiler.js'
import { runTools } from './services/tools/toolOrchestration.js'
import { applyToolResultBudget } from './utils/toolResultStorage.js'
import { recordContentReplacement } from './utils/sessionStorage.js'
import { handleStopHooks } from './query/stopHooks.js'
import { buildQueryConfig } from './query/config.js'
import { productionDeps, type QueryDeps } from './query/deps.js'
import type { Terminal, Continue } from './query/transitions.js'
import { feature } from 'bun:bundle'
import {
  getCurrentTurnTokenBudget,
  getMainLoopModelOverride,
  getTurnOutputTokens,
  incrementBudgetContinuationCount,
} from './bootstrap/state.js'
import { createBudgetTracker, checkTokenBudget } from './query/tokenBudget.js'
import { count } from './utils/array.js'
import { traceDsxuLifecycle } from './utils/dsxuLifecycleTrace.js'
import { expandPath } from './utils/path.js'
import { recordDSXUQueryPromptPrefixCacheEvidence } from './dsxu/engine/v18-prompt-prefix-cache-evidence.js'
import {
  DSXU_TOOL_RESULT_AUTO_CONTINUE_GATE_STATE,
  buildDsxuFinalGateState,
  buildDsxuPostPassFinalizationGateState,
  buildDsxuRecoveryGateState,
  type DsxuQueryLoopGateState,
} from './dsxu/engine/query-loop-gate-state-v1.js'

export {
  DSXU_TOOL_RESULT_AUTO_CONTINUE_GATE_STATE,
  buildDsxuRecoveryGateState,
} from './dsxu/engine/query-loop-gate-state-v1.js'
export type { DsxuQueryLoopGateState } from './dsxu/engine/query-loop-gate-state-v1.js'

/* eslint-disable @typescript-eslint/no-require-imports */
const snipModule = feature('HISTORY_SNIP')
  ? (require('./services/compact/snipCompact.js') as typeof import('./services/compact/snipCompact.js'))
  : null
const taskSummaryModule = feature('BG_SESSIONS')
  ? (require('./utils/taskSummary.js') as typeof import('./utils/taskSummary.js'))
  : null
/* eslint-enable @typescript-eslint/no-require-imports */

function* yieldMissingToolResultBlocks(
  assistantMessages: AssistantMessage[],
  errorMessage: string,
) {
  for (const assistantMessage of assistantMessages) {
    // Extract all tool use blocks from this assistant message
    const toolUseBlocks = collectToolUseBlocksFromMessage(assistantMessage)

    // Emit an interruption message for each tool use
    for (const toolUse of toolUseBlocks) {
      yield createUserMessage({
        content: [
          {
            type: 'tool_result',
            content: errorMessage,
            is_error: true,
            tool_use_id: toolUse.id,
          },
        ],
        toolUseResult: errorMessage,
        sourceToolAssistantUUID: assistantMessage.uuid,
      })
    }
  }
}

const DSXU_MISSING_TOOL_RESULT_ERROR = [
  '<tool_use_error>',
  'DSXU tool state: tool_result_missing_internal_error',
  'blocked=orphan_tool_use',
  'next=do_not_assume_tool_succeeded; verify_or_retry_with_evidence',
  '</tool_use_error>',
].join('\n')

const DSXU_MODEL_WAIT_TRACE_INTERVAL_MS = 30_000

function getDsxuMessageContentArray(message: unknown): unknown[] {
  const content = (message as { message?: { content?: unknown } } | undefined)
    ?.message?.content
  return Array.isArray(content) ? content : []
}

function isDsxuToolUseBlock(block: unknown): block is ToolUseBlock {
  return (
    !!block &&
    typeof block === 'object' &&
    (block as { type?: unknown }).type === 'tool_use' &&
    typeof (block as { id?: unknown }).id === 'string' &&
    typeof (block as { name?: unknown }).name === 'string'
  )
}

function collectToolUseBlocksFromMessage(message: unknown): ToolUseBlock[] {
  return getDsxuMessageContentArray(message).filter(isDsxuToolUseBlock)
}

function isDsxuLifecycleTraceRequested(): boolean {
  if (process.env.DSXU_CODE_LIFECYCLE_TRACE === '0') return false
  return (
    process.env.DSXU_CODE_LIFECYCLE_TRACE === '1' ||
    process.env.DSXU_CODE_MODE === '1'
  )
}

export function getLatestDsxuToolStateForTrace(
  messages: readonly Message[],
): string | undefined {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex--) {
    const message = messages[messageIndex]
    if (message?.type !== 'user') {
      continue
    }
    const content = getDsxuMessageContentArray(message)
    for (
      let blockIndex = content.length - 1;
      blockIndex >= 0;
      blockIndex--
    ) {
      const block = content[blockIndex] as
        | { type?: unknown; content?: unknown }
        | undefined
      if (block?.type !== 'tool_result') continue
      const toolResultText =
        typeof block.content === 'string'
          ? block.content
          : Array.isArray(block.content)
            ? block.content.map(item => JSON.stringify(item)).join('\n')
            : ''
      const match = toolResultText.match(/DSXU tool state:\s*([a-z0-9_]+)/i)
      if (match?.[1]) return match[1]
    }
  }
  return undefined
}

function startDsxuModelWaitTrace(data: Record<string, unknown>): (
  completion?: Record<string, unknown>,
) => void {
  if (!isDsxuLifecycleTraceRequested()) return () => {}
  const startedAt = Date.now()
  let ticks = 0
  traceDsxuLifecycle('query_model_wait_start', data)
  const timer = setInterval(() => {
    ticks += 1
    traceDsxuLifecycle('query_model_wait_heartbeat', {
      ...data,
      elapsedMs: Date.now() - startedAt,
      ticks,
    })
  }, DSXU_MODEL_WAIT_TRACE_INTERVAL_MS)
  ;(timer as { unref?: () => void }).unref?.()
  return (completion: Record<string, unknown> = {}) => {
    clearInterval(timer)
    traceDsxuLifecycle('query_model_wait_end', {
      ...data,
      ...completion,
      elapsedMs: Date.now() - startedAt,
      ticks,
    })
  }
}

function collectToolResultIDs(
  messages: readonly (UserMessage | AttachmentMessage)[],
): Set<string> {
  const ids = new Set<string>()
  for (const message of messages) {
    if (message.type !== 'user') {
      continue
    }
    for (const block of getDsxuMessageContentArray(message)) {
      if (
        block &&
        typeof block === 'object' &&
        (block as { type?: unknown }).type === 'tool_result' &&
        typeof (block as { tool_use_id?: unknown }).tool_use_id === 'string'
      ) {
        ids.add((block as { tool_use_id: string }).tool_use_id)
      }
    }
  }
  return ids
}

function getMessageContentForDeepSeekRoute(message: Message): unknown {
  if ((message as { type?: unknown }).type !== 'user') return undefined
  if ((message as { isMeta?: unknown }).isMeta === true) return undefined
  const directContent = (message as { content?: unknown }).content
  if (directContent !== undefined) return directContent
  return (message as { message?: { content?: unknown } }).message?.content
}

function stringifyContentForDeepSeekRoute(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map(block => {
        if (
          block &&
          typeof block === 'object' &&
          (block as { type?: unknown }).type === 'text' &&
          typeof (block as { text?: unknown }).text === 'string'
        ) {
          return (block as { text: string }).text
        }
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }
  return ''
}

export function buildDeepSeekRouteText(messages: readonly Message[]): string {
  for (let index = messages.length - 1; index >= 0; index--) {
    const routeText = stringifyContentForDeepSeekRoute(
      getMessageContentForDeepSeekRoute(messages[index]!),
    ).trim()
    if (routeText) return routeText
  }
  return ''
}

function usageNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : 0
}

function buildDsxuFinalUsageEvidenceSystemMessage({
  assistantMessages,
  model,
  routeReason,
  workflowKind,
  role,
}: {
  assistantMessages: readonly AssistantMessage[]
  model: string
  routeReason: string
  workflowKind?: string
  role?: string
}): string {
  const usage = assistantMessages.at(-1)?.message.usage as
    | (Record<string, unknown> & {
        dsxu?: {
          model?: string
          route_reason?: string
          estimated_cost_usd?: number
        }
      })
    | undefined
  const evidenceModel = normalizeDeepSeekV4Model(
    usage?.dsxu?.model ?? model,
  )
  const evidenceRouteReason = usage?.dsxu?.route_reason ?? routeReason

  const inputTokens = usageNumber(usage?.input_tokens)
  const outputTokens = usageNumber(usage?.output_tokens)
  const cacheHitInputTokens = usageNumber(usage?.cache_read_input_tokens)
  const explicitCacheMiss = usage?.cache_creation_input_tokens
  const cacheMissInputTokens =
    typeof explicitCacheMiss === 'number'
      ? usageNumber(explicitCacheMiss)
      : Math.max(0, inputTokens - cacheHitInputTokens)

  if (!usage || inputTokens + outputTokens + cacheHitInputTokens + cacheMissInputTokens === 0) {
    return [
      `DSXU final usage evidence: model=${evidenceModel}`,
      `route=${evidenceRouteReason}`,
      `workflow=${workflowKind ?? 'generic_chat'}`,
      `role=${role ?? 'none'}`,
      'usage=unavailable',
      `missing=${usage ? 'zero_token_usage' : 'assistant_message_usage'}`,
      'cost=unavailable',
    ].join('; ')
  }

  const estimatedCostUsd =
    typeof usage.dsxu?.estimated_cost_usd === 'number'
      ? usage.dsxu.estimated_cost_usd
      : estimateDeepSeekV4Cost({
          model: evidenceModel,
          cacheHitInputTokens,
          cacheMissInputTokens,
          outputTokens,
        })

  return [
    `DSXU final usage evidence: model=${evidenceModel}`,
    `route=${evidenceRouteReason}`,
    `workflow=${workflowKind ?? 'generic_chat'}`,
    `role=${role ?? 'none'}`,
    `input_tokens=${inputTokens}`,
    `output_tokens=${outputTokens}`,
    `cache_hit_input_tokens=${cacheHitInputTokens}`,
    `cache_miss_input_tokens=${cacheMissInputTokens}`,
    `estimated_cost_usd=${estimatedCostUsd.toFixed(6)}`,
    'source=assistant_message_usage',
  ].join('; ')
}

function collectAssistantToolUseBlocks(
  assistantMessages: readonly AssistantMessage[],
): ToolUseBlock[] {
  return assistantMessages.flatMap(message =>
    collectToolUseBlocksFromMessage(message),
  )
}

function createMissingToolResultMessagesForBatch(
  toolUseBlocks: readonly ToolUseBlock[],
  assistantMessages: readonly AssistantMessage[],
  existingResults: readonly (UserMessage | AttachmentMessage)[],
): UserMessage[] {
  const existingToolResultIDs = collectToolResultIDs(existingResults)
  const messages: UserMessage[] = []
  for (const toolUse of toolUseBlocks) {
    if (existingToolResultIDs.has(toolUse.id)) {
      continue
    }
    const assistantMessage = assistantMessages.find(message =>
      collectToolUseBlocksFromMessage(message).some(
        block => block.id === toolUse.id,
      ),
    )
    messages.push(
      createUserMessage({
        content: [
          {
            type: 'tool_result',
            content: DSXU_MISSING_TOOL_RESULT_ERROR,
            is_error: true,
            tool_use_id: toolUse.id,
          },
        ],
        toolUseResult: DSXU_MISSING_TOOL_RESULT_ERROR,
        sourceToolAssistantUUID: assistantMessage?.uuid,
      }),
    )
  }
  return messages
}

function normalizeToolUpdateUserResults(
  message: Message,
  toolUseContext: ToolUseContext,
): UserMessage[] {
  // Progress and other display-only events are valid UI messages but do not
  // have the provider message shape expected by normalizeMessagesForAPI().
  if (!('message' in message)) {
    traceDsxuLifecycle('query_skip_non_api_tool_update', {
      messageType: message.type,
    })
    return []
  }
  return normalizeMessagesForAPI(
    [message],
    toolUseContext.options.tools,
  ).filter((m): m is UserMessage => m.type === 'user')
}

/**
 * The rules of thinking are lengthy and fortuitous. They require plenty of thinking
 * of most long duration and deep meditation for a wizard to wrap one's noggin around.
 *
 * The rules follow:
 * 1. A message that contains a thinking or redacted_thinking block must be part of a query whose max_thinking_length > 0
 * 2. A thinking block may not be the last message in a block
 * 3. Thinking blocks must be preserved for the duration of an assistant trajectory (a single turn, or if that turn includes a tool_use block then also its subsequent tool_result and the following assistant message)
 *
 * Heed these rules well, young wizard. For they are the rules of thinking, and
 * the rules of thinking are the rules of the universe. If ye does not heed these
 * rules, ye will be punished with an entire day of debugging and hair pulling.
 */
const MAX_OUTPUT_TOKENS_RECOVERY_LIMIT = 3

/**
 * Is this a max_output_tokens error message? If so, the streaming loop should
 * withhold it from SDK callers until we know whether the recovery loop can
 * continue. Yielding early leaks an intermediate error to SDK callers (e.g.
 * cowork/desktop) that terminate the session on any `error` field -?the
 * recovery loop keeps running but nobody is listening.
 *
 * Mirrors reactiveCompact.isWithheldPromptTooLong.
 */
function isWithheldMaxOutputTokens(
  msg: Message | StreamEvent | undefined,
): msg is AssistantMessage {
  return msg?.type === 'assistant' && msg.apiError === 'max_output_tokens'
}

export type QueryParams = {
  messages: Message[]
  systemPrompt: SystemPrompt
  userContext: { [k: string]: string }
  systemContext: { [k: string]: string }
  canUseTool: CanUseToolFn
  toolUseContext: ToolUseContext
  fallbackModel?: string
  querySource: QuerySource
  maxOutputTokensOverride?: number
  maxTurns?: number
  skipCacheWrite?: boolean
  // API task_budget (output_config.task_budget, beta task-budgets-2026-03-13).
  // Distinct from the tokenBudget +500k auto-continue feature. `total` is the
  // budget for the whole agentic turn; `remaining` is computed per iteration
  // from cumulative API usage. See configureTaskBudgetParams in dsxu.ts.
  taskBudget?: { total: number }
  deps?: QueryDeps
}

export function getDsxuQueryRecoveryAndPromptCacheContract(): {
  runtime: 'DSXU Query Recovery and Prompt Cache Contract'
  recoveryOrder: readonly string[]
  cacheStabilityRules: readonly string[]
  weakModelGuards: readonly string[]
} {
  return {
    runtime: 'DSXU Query Recovery and Prompt Cache Contract',
    recoveryOrder: [
      'apply aggregate tool-result budget before microcompact',
      'apply history snip before microcompact when enabled',
      'microcompact before autocompact',
      'context collapse before autocompact so granular context survives when possible',
      'withhold recoverable prompt-too-long/media/max-output errors until recovery is attempted',
      'try context-collapse drain before reactive compact for prompt-too-long',
      'try reactive compact with cache-safe params before surfacing unrecoverable context errors',
      'retry max-output once with escalated output tokens before multi-turn recovery',
      'preserve stop-hook/reactive-compact guards to avoid infinite retry loops',
      'drain addressed local Agent continuations before the next model turn',
    ],
    cacheStabilityRules: [
      'system prompt static prefix is separated from dynamic sections by SYSTEM_PROMPT_DYNAMIC_BOUNDARY',
      'tool-use summary generation runs after a completed tool batch and is passed to the next turn',
      'cached microcompact boundary is emitted after API usage exposes actual cache-deleted tokens',
      'MCP instruction deltas avoid cache busts from late MCP connect where enabled',
      'prompt-cache-sensitive fork context reuses rendered parent prompt instead of recomputing',
    ],
    weakModelGuards: [
      'missing tool_result blocks are synthesized so the provider never sees orphan tool_use blocks',
      'pending streaming tool results are discarded when a streaming attempt fails before retry',
      'fallback model retry strips failed assistant messages before resubmission',
      'maxTurns emits an explicit max_turns attachment instead of silently stopping',
      'local Agent SendMessage continuations are injected as DSXU-owned user messages, not bridge traffic',
    ],
  }
}

export function buildDsxuContextBudgetSystemContext({
  tokenUsage,
  model,
  postCompact,
}: {
  tokenUsage: number
  model: string
  postCompact: boolean
}): string {
  const effectiveWindow = Math.max(1, getEffectiveContextWindowSize(model))
  const contextUsedPercent = Math.min(
    100,
    Math.max(0, Math.round((tokenUsage / effectiveWindow) * 100)),
  )
  const estimatedTurnsRemaining = Math.max(
    0,
    Math.floor((effectiveWindow - tokenUsage) / 12_000),
  )
  const compactionRisk =
    contextUsedPercent >= 85 ? 'high' : contextUsedPercent >= 70 ? 'medium' : 'low'
  const recommendedAction =
    contextUsedPercent >= 85
      ? 'snapshot_then_context_hygiene'
      : contextUsedPercent >= 70
        ? 'checkpoint_and_trim_dynamic_tail'
        : 'continue'
  const contextHygieneAction =
    contextUsedPercent >= 85
      ? 'snapshot_before_compact_if_route_cache_or_recovery_requires'
      : contextUsedPercent >= 70
        ? 'compress_long_logs_and_repeated_tool_output_only'
        : 'none'
  const contextWindowClass = getDsxuContextWindowClass(effectiveWindow)
  const contextUsedBucket =
    contextUsedPercent >= 85
      ? '>=85'
      : contextUsedPercent >= 70
        ? '70-84'
        : '<70'
  const estimatedTurnsBucket =
    estimatedTurnsRemaining <= 2
      ? '0-2'
      : estimatedTurnsRemaining <= 9
        ? '3-9'
        : '>=10'
  const warnings = [
    contextUsedPercent >= 70
      ? 'Medium context pressure: checkpoint the current step and keep volatile discovery/logs out of the dynamic tail.'
      : null,
    contextUsedPercent >= 85
      ? 'High context pressure: update the task snapshot first; compact only when route, context-window, cache, or recovery risk requires it.'
      : null,
    postCompact
      ? 'Post-compact/resume turn: memory and summaries are hints; re-read source truth before editing or claiming PASS.'
      : null,
  ].filter(Boolean)

  return [
    'contextPolicy: route-aware/context-window-aware/cache-aware',
    `contextWindowClass: ${contextWindowClass}`,
    `contextUsedPercent: ${contextUsedBucket}`,
    `estimatedTurnsRemaining: ${estimatedTurnsBucket}`,
    `contextRisk: ${compactionRisk}`,
    `contextHygieneAction: ${contextHygieneAction}`,
    `recommendedAction: ${recommendedAction}`,
    'sourceTruthReread: required-before-edit-or-pass',
    ...warnings,
  ].join('\n')
}

function getDsxuContextWindowClass(effectiveWindow: number): 'standard' | 'extended' | 'large' | 'one-million' {
  if (effectiveWindow >= 900_000) return 'one-million'
  if (effectiveWindow >= 256_000) return 'large'
  if (effectiveWindow >= 128_000) return 'extended'
  return 'standard'
}

export type DsxuQueryBlockAuditDisposition =
  | 'absorbed'
  | 'dsxu-extension'
  | 'needs-live-evidence'

export type DsxuQueryBlockAuditItem = {
  block: string
  referenceBehavior: string
  dsxuCurrent: string
  gap: string
  disposition: DsxuQueryBlockAuditDisposition
  testEvidence: string
}

export function getDsxuQueryBlockAuditContract(): {
  runtime: 'DSXU Query Block Audit Contract'
  source: 'D:/DSXU-code/reference/query.ts'
  target: 'D:/DSXU-code/src/query.ts'
  blocks: readonly DsxuQueryBlockAuditItem[]
} {
  return {
    runtime: 'DSXU Query Block Audit Contract',
    source: 'D:/DSXU-code/reference/query.ts',
    target: 'D:/DSXU-code/src/query.ts',
    blocks: [
      {
        block: 'tool-result pairing',
        referenceBehavior:
          'yieldMissingToolResultBlocks synthesizes tool_result blocks for assistant tool_use blocks when a provider/runtime failure interrupts the loop.',
        dsxuCurrent:
          'DSXU keeps the same orphan tool_use guard and also clears pending streaming tool execution state before retry/error propagation.',
        gap:
          'No structural gap found in static audit; keep this as a required provider wire-shape invariant.',
        disposition: 'absorbed',
        testEvidence:
          'direct-connect-and-query-contract-v1 locks the weak-model guard; mainline adapter tests prove parser -> registry -> permission -> real tool result loops.',
      },
      {
        block: 'fallback retry',
        referenceBehavior:
          'FallbackTriggeredError switches to fallbackModel, strips failed assistant messages, discards partial streaming tool state, and retries the whole request.',
        dsxuCurrent:
          'DSXU keeps the fallback retry shape through providerSdk blocks and DeepSeek-compatible message normalization.',
        gap:
          'Forced query harness evidence exists; a full external provider live benchmark can still be added later.',
        disposition: 'absorbed',
        testEvidence:
          'direct-connect-and-query-contract-v1 forces FallbackTriggeredError after an assistant tool_use, proves synthetic tool_result pairing, fallback switch, and clean retry.',
      },
      {
        block: 'max-output recovery',
        referenceBehavior:
          'Recoverable max_output_tokens errors are withheld, retried once with escalated output tokens, then resumed through bounded recovery messages.',
        dsxuCurrent:
          'DSXU keeps the recovery ladder and uses DSXU_CODE_MAX_OUTPUT_TOKENS as the DSXU-owned override gate.',
        gap:
          'Forced query harness evidence exists for bounded resume; escalation remains feature-gated by tengu_otk_slot_v1.',
        disposition: 'absorbed',
        testEvidence:
          'direct-connect-and-query-contract-v1 forces max_output_tokens and proves the next provider call receives the DSXU resume instruction before final completion.',
      },
      {
        block: 'prompt-too-long / compact recovery',
        referenceBehavior:
          'When prompt-too-long is withheld, the mature reference flow drains staged context collapse first, then falls back to reactive compact and media strip retry.',
        dsxuCurrent:
          'DSXU preserves context-collapse drain before reactive compact and layers DSXU compact/recovery schema requirements on the summary payload.',
        gap:
          'Controlled overflow evidence exists through DSXU compact schema; external provider 413 can be added later without re-enabling a second compact runtime.',
        disposition: 'absorbed',
        testEvidence:
          'direct-connect-and-query-contract-v1 feeds an oversized prompt, forces DSXU autocompact to emit dsxu.compact-recovery.v1, and proves the next provider call receives the compact recovery snapshot instead of the giant source text.',
      },
      {
        block: 'stop hooks loop guard',
        referenceBehavior:
          'Stop hooks do not run for API-error assistant messages, and the reactive-compact guard is preserved across stop-hook retry to avoid infinite loops.',
        dsxuCurrent:
          'DSXU keeps API-error early return, executeStopFailureHooks, stopHookActive, and hasAttemptedReactiveCompact preservation.',
        gap:
          'No static gap found; a future stop-hook regression should force API-error plus blocking hook to prove no retry spiral.',
        disposition: 'absorbed',
        testEvidence:
          'Contract coverage names the stop-hook/reactive-compact guard; no live stop-hook spiral case yet.',
      },
      {
        block: 'Agent continuation',
        referenceBehavior:
          'Original query loop has no DSXU local SendMessage drain because local Agent continuation is DSXU-owned behavior.',
        dsxuCurrent:
          'DSXU drains addressed local Agent continuation messages through drainPendingAgentContinuationMessages and injects DSXU-owned user messages before the next worker model turn.',
        gap:
          'This is an intentional DSXU extension, not a reference gap to copy.',
        disposition: 'dsxu-extension',
        testEvidence:
          'mainline-tool-adapter-v1 proves Agent worker notification, SendMessage correction, and verifier PASS evidence.',
      },
      {
        block: 'tool-use summary',
        referenceBehavior:
          'After a completed tool batch, the mature reference flow starts a non-blocking tool-use summary and yields it into the next turn.',
        dsxuCurrent:
          'DSXU keeps non-blocking summary generation and adds credential redaction plus deterministic fallback summaries when the summary model fails.',
        gap:
          'Needs a live benchmark that asserts summary insertion improves recovery without leaking credentials.',
        disposition: 'dsxu-extension',
        testEvidence:
          'tool-use summary redaction tests and MCP credential redaction tests cover the deterministic fallback path.',
      },
      {
        block: 'prompt cache mutation points',
        referenceBehavior:
          'The mature reference flow avoids mutating cache-sensitive assistant history on backfill, strips failed signatures on fallback, and keeps cacheable prompt prefixes stable.',
        dsxuCurrent:
          'DSXU preserves the cache-sensitive rules and adds a static DeepSeek tool-use contract before SYSTEM_PROMPT_DYNAMIC_BOUNDARY.',
        gap:
          'Static prompt layout is tested; more live cases should verify prompt-cache stability during MCP/dynamic tool changes.',
        disposition: 'absorbed',
        testEvidence:
          'prompt-cache-layout live benchmark PASS and cache-stable prompt layout unit test.',
      },
      {
        block: 'maxTurns / PARTIAL signaling',
        referenceBehavior:
          'When maxTurns is reached, the mature reference flow emits a max_turns attachment instead of silently stopping.',
        dsxuCurrent:
          'DSXU keeps explicit max_turns attachments on normal continuation and aborted-tool paths.',
        gap:
          'Five-smoke bugfix previously exposed this as PARTIAL; post Edit anti-repeat fix now has live PASS, but maxTurns reporting should stay in benchmark coverage.',
        disposition: 'absorbed',
        testEvidence:
          'five-smoke bugfix after-edit-fix live PASS; contract asserts explicit maxTurns behavior.',
      },
      {
        block: 'failed assistant cleanup',
        referenceBehavior:
          'Failed assistant messages and partial streaming artifacts are removed before fallback/retry so the next provider request is well-formed.',
        dsxuCurrent:
          'DSXU keeps failed assistant cleanup and maps it through providerSdk/DeepSeek normalization.',
        gap:
          'Forced query harness evidence exists; a future provider live benchmark can add external API failure evidence.',
        disposition: 'absorbed',
        testEvidence:
          'direct-connect-and-query-contract-v1 forces a thrown provider stream failure after assistant tool_use and proves synthetic tool_result plus model_error surfacing.',
      },
    ],
  }
}

const DSXU_VERIFICATION_PASS_NUDGE =
  'DSXU verified-pass hard final gate: the latest verification command passed and no failing assertion remains. DSXU query-loop cursor state: recovery_state=verified_passed_ready_final; required_action=final_answer; can_claim_complete=true; verification_required=false. Do not call any tool, do not rerun the same command, and do not repeat Edit/Read. Reply with the requested PASS marker or final answer now. Continue only for an explicit new user task after this verified PASS.'

const DSXU_BENCH_PASS_MARKER_RE = /\bDSXU_BENCH_[A-Z0-9_]+_PASS\b/g

const DSXU_TOOL_STATE_CURSOR_PREFIX = 'DSXU query-loop cursor state:'

const DSXU_VERIFICATION_TOOL_NAMES = new Set([
  'Bash',
  'bash',
  'PowerShell',
  'powershell',
  'TaskOutput',
])

const DSXU_MUTATION_TOOL_NAMES = new Set([
  'Edit',
  'Write',
  'NotebookEdit',
  'MultiEdit',
])

const DSXU_DISCOVERY_TOOL_NAMES = new Set([
  'Read',
  'Grep',
  'Glob',
])

const DSXU_DISCOVERY_NARROWING_THRESHOLD = 8
const DSXU_FILE_LOOKUP_MISS_THRESHOLD = 2
const DSXU_FAILED_VERIFICATION_RECOVERY_THRESHOLD = 2
const DSXU_PARALLEL_VISIBILITY_TOOL_THRESHOLD = 4

function getToolResultText(message: Message): Array<{
  toolUseId: string
  text: string
  isError: boolean
}> {
  if (message.type !== 'user') return []
  return getDsxuMessageContentArray(message)
    .filter(
      (block): block is ToolResultBlockParam =>
        !!block &&
        typeof block === 'object' &&
        (block as { type?: unknown }).type === 'tool_result' &&
        typeof (block as { tool_use_id?: unknown }).tool_use_id === 'string' &&
        typeof (block as { content?: unknown }).content === 'string',
    )
    .map(block => ({
      toolUseId: block.tool_use_id,
      text: block.content,
      isError: !!block.is_error,
    }))
}

export function looksLikeDsxuVerifiedPassingTest(text: string): boolean {
  const hasTestSignal =
    /\bbun test\b/i.test(text) ||
    /\b(vitest|jest|pytest|npm test|pnpm test|yarn test)\b/i.test(text) ||
    /\bRan\s+\d+\s+tests?\b/i.test(text) ||
    /\b\d+\s+pass\b/i.test(text)
  if (!hasTestSignal) return false

  const hasPass =
    /\b[1-9]\d*\s+pass\b/i.test(text) || /\btests?\s+passed\b/i.test(text)
  const hasZeroFail =
    /\b0\s+fail\b/i.test(text) || !/\b[1-9]\d*\s+fail\b/i.test(text)
  const hasFailure =
    /\bexit code\s+[1-9]\b/i.test(text) ||
    /\b[1-9]\d*\s+fail\b/i.test(text) ||
    /\b(assertionerror|error:|failed|failures?)\b/i.test(text)

  return hasPass && hasZeroFail && !hasFailure
}

export function looksLikeDsxuFailingVerification(text: string): boolean {
  if (/DSXU tool state:\s*verification_failed/i.test(text)) return true
  const hasTestSignal =
    /\bbun test\b/i.test(text) ||
    /\b(vitest|jest|pytest|npm test|pnpm test|yarn test)\b/i.test(text) ||
    /\bRan\s+\d+\s+tests?\b/i.test(text) ||
    /\b\d+\s+fail\b/i.test(text)
  if (!hasTestSignal) return false
  const hasFailure =
    /\bexit code\s+[1-9]\b/i.test(text) ||
    /\b[1-9]\d*\s+fail\b/i.test(text) ||
    /\b(assertionerror|error:|failed|failures?)\b/i.test(text)
  return hasFailure && !looksLikeDsxuVerifiedPassingTest(text)
}

export function hasDsxuVerificationFailure(messages: Message[]): boolean {
  let sawMutation = false
  let unresolvedFailure = false
  for (const message of messages) {
    for (const result of getToolResultText(message)) {
      if (
        /DSXU tool state:\s*(?:edit_applied|edit_already_applied|verification_blocked_unsafe_batch)\b/i.test(result.text)
      ) {
        sawMutation = true
        unresolvedFailure = false
        continue
      }
      if (
        /DSXU tool state:\s*verification_passed\b/i.test(result.text) ||
        (
          /DSXU tool state:\s*evidence_collected\b/i.test(result.text) &&
          /\b(?:CollectEvidence\s+status|status)\s*:\s*PASS\b/i.test(result.text)
        ) ||
        looksLikeDsxuVerifiedPassingTest(result.text)
      ) {
        unresolvedFailure = false
        continue
      }
      if (sawMutation && looksLikeDsxuFailingVerification(result.text)) {
        unresolvedFailure = true
      }
    }
  }
  return unresolvedFailure
}

export function getLatestRequestedDsxuBenchPassMarker(
  messages: readonly Message[],
): string | null {
  let latest: string | null = null
  for (const message of messages) {
    const text = extractDsxuMessageText(
      (message as { message?: { content?: unknown } }).message?.content,
    )
    const matches = text.match(DSXU_BENCH_PASS_MARKER_RE)
    if (!matches || matches.length === 0) continue
    latest = matches[matches.length - 1] ?? latest
  }
  return latest
}

export function buildDsxuVerificationPassNudge(
  messages: readonly Message[],
): string {
  const marker = getLatestRequestedDsxuBenchPassMarker(messages)
  if (!marker) return DSXU_VERIFICATION_PASS_NUDGE
  return [
    DSXU_VERIFICATION_PASS_NUDGE,
    `Requested benchmark PASS marker detected: ${marker}. Your next assistant response must be exactly ${marker} and nothing else: no explanation, no Markdown, no file summary, no test summary, no prefix, and no suffix.`,
  ].join(' ')
}

export function buildDsxuPostPassToolBlockHardStopFinal(
  messages: readonly Message[],
): string | null {
  const text = messages
    .flatMap(message =>
      extractDsxuMessageText(
        (message as { message?: { content?: unknown } }).message?.content,
      ),
    )
    .join('\n')
  if (
    !/DSXU tool state:\s*tool_blocked_after_pass(?:_marker)?\b/i.test(text)
  ) {
    return null
  }

  const marker = getLatestRequestedDsxuBenchPassMarker(messages)
  if (marker) return marker

  return [
    'DSXU task is already at a verified final state.',
    'No further tools were run after the stop-on-pass gate.',
  ].join('\n')
}

function hasDsxuMutationAwaitingVerification(messages: Message[]): boolean {
  return messages.some(message =>
    getToolResultText(message).some(result =>
      /DSXU tool state:\s*(?:edit_applied|edit_already_applied|verification_blocked_unsafe_batch)\b/i.test(result.text),
    ),
  )
}

function looksLikeSuccessfulPostMutationVerificationResult(result: {
  text: string
  isError: boolean
}): boolean {
  const text = result.text.trim()
  if (result.isError || text.length === 0) return false
  if (/<tool_use_error>|Command was aborted before completion/i.test(text)) return false
  if (/\bexit code\s+[1-9]\b/i.test(text)) return false
  if (/DSXU tool state:\s*(?:verification_failed|verification_blocked_)/i.test(text)) {
    return false
  }
  return !looksLikeDsxuFailingVerification(text)
}

function shouldInjectVerifiedPassNudge(
  toolResults: Message[],
  toolUseBlocks: ToolUseBlock[],
  conversationMessages: Message[] = [],
): boolean {
  if (
    hasDsxuPendingRequiredEditAfterBaselinePass([
      ...conversationMessages,
      ...toolResults,
    ])
  ) {
    return false
  }
  const toolNameById = new Map(toolUseBlocks.map(block => [block.id, block.name]))
  for (const resultMessage of toolResults) {
    for (const result of getToolResultText(resultMessage)) {
      const toolName = toolNameById.get(result.toolUseId)
      if (!toolName || !DSXU_VERIFICATION_TOOL_NAMES.has(toolName)) continue
      if (looksLikeDsxuVerifiedPassingTest(result.text)) return true
    }
  }
  return false
}

function hasIncompleteAgentEvidence(text: string): boolean {
  if (!/<evidence>[\s\S]*<\/evidence>/i.test(text)) return false
  if (/completion_claim:\s*(?:partial|unknown)\b/i.test(text)) return true
  if (/tests_failed:\s*(?!none\b).+/i.test(text)) return true
  if (/unresolved_risks:\s*(?!none\b).+/i.test(text)) return true
  return false
}

type DsxuAgentEvidenceForFinalGate = {
  filesRead: string[]
  filesChanged: string[]
  commandsRun: string[]
  testsPassed: string[]
  testsFailed: string[]
  unresolvedRisks: string[]
  completionClaim: 'complete' | 'partial' | 'unknown'
}

function splitDsxuEvidenceField(value: string): string[] {
  const trimmed = value.trim()
  if (trimmed.length === 0 || /^none$/i.test(trimmed)) return []
  return trimmed
    .split(/\s*(?:,|\|)\s*/)
    .map(item => item.trim())
    .filter(Boolean)
}

function getDsxuEvidenceField(block: string, field: string): string[] {
  const match = new RegExp(`^${field}:\\s*(.+)$`, 'im').exec(block)
  return match ? splitDsxuEvidenceField(match[1] ?? '') : []
}

function parseDsxuAgentEvidenceForFinalGate(
  text: string,
): DsxuAgentEvidenceForFinalGate | null {
  const match = /<evidence>([\s\S]*?)<\/evidence>/i.exec(text)
  if (!match) return null
  const block = match[1] ?? ''
  const completionClaimMatch = /^completion_claim:\s*(complete|partial|unknown)\b/im.exec(block)
  return {
    filesRead: getDsxuEvidenceField(block, 'files_read'),
    filesChanged: getDsxuEvidenceField(block, 'files_changed'),
    commandsRun: getDsxuEvidenceField(block, 'commands_run'),
    testsPassed: getDsxuEvidenceField(block, 'tests_passed'),
    testsFailed: getDsxuEvidenceField(block, 'tests_failed'),
    unresolvedRisks: getDsxuEvidenceField(block, 'unresolved_risks'),
    completionClaim: (completionClaimMatch?.[1]?.toLowerCase() ??
      'unknown') as DsxuAgentEvidenceForFinalGate['completionClaim'],
  }
}

function extractDsxuMessageText(value: unknown): string {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return ''
  return value
    .map(block => {
      if (typeof block === 'string') return block
      if (block && typeof block === 'object' && 'text' in block) {
        return String((block as { text?: unknown }).text ?? '')
      }
      if (block && typeof block === 'object' && 'content' in block) {
        return extractDsxuMessageText((block as { content?: unknown }).content)
      }
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

function hasDsxuPostCompactResumeSnapshot(messages: readonly Message[]): boolean {
  return messages.some(message => {
    if ((message as { isCompactSummary?: boolean }).isCompactSummary) return true
    const text = extractDsxuMessageText(
      (message as { message?: { content?: unknown } }).message?.content,
    )
    return /(?:dsxu\.compact-recovery\.v1|<dsxu_compact_recovery_snapshot>|DSXU compact recovery boundary|Post-compact\/resume turn)/i.test(
      text,
    )
  })
}

function buildDsxuProviderResumeReplayPreflightTrace(
  messages: readonly Message[],
  querySource: QuerySource,
  model: string,
): Record<string, unknown> | null {
  if (!hasDsxuPostCompactResumeSnapshot(messages)) return null

  const replayText = messages
    .map(message =>
      extractDsxuMessageText(
        (message as { message?: { content?: unknown } }).message?.content,
      ),
    )
    .filter(Boolean)
    .join('\n')

  return {
    owner: 'query_loop',
    boundary: 'provider_request_preflight',
    schemaVersion: /dsxu\.compact-recovery\.v1/i.test(replayText)
      ? 'dsxu.compact-recovery.v1'
      : 'unknown',
    querySource,
    model,
    providerMessageCount: messages.length,
    sourceTruthRefreshRequired:
      /(?:read_source_truth|read source truth|source truth|sourceRefreshFiles)/i.test(
        replayText,
      ),
    failedCommandPreserved:
      /(?:failedCommands|failed command|provider returned prompt-too-long|bun test src\/cart\.test\.ts)/i.test(
        replayText,
      ),
    verificationStatePreserved:
      /(?:verificationStatus|verification status|verificationStatus:\s*(?:failed|partial)|verification failed)/i.test(
        replayText,
      ),
    nextActionPreserved:
      /(?:nextAction|next=read_source_truth|read_source_truth_before_edit)/i.test(
        replayText,
      ),
    experienceStorePackPreserved:
      /(?:ExperienceStore Planning Pack|failurePatterns|verificationCommands|sourceRefreshFiles)/i.test(
        replayText,
      ),
  }
}

function getLatestDsxuAgentEvidenceForFinalGate(
  messages: Message[],
): DsxuAgentEvidenceForFinalGate | null {
  let latest: DsxuAgentEvidenceForFinalGate | null = null
  for (const message of messages) {
    if (message.type !== 'user') continue
    const content = (message as { message?: { content?: unknown } }).message?.content
    if (!Array.isArray(content)) continue
    for (const block of content) {
      if (
        !block ||
        typeof block !== 'object' ||
        !('type' in block) ||
        block.type !== 'tool_result'
      ) {
        continue
      }
      const text = extractDsxuMessageText((block as { content?: unknown }).content)
      const packet = parseDsxuAgentEvidenceForFinalGate(text)
      if (packet) latest = packet
    }
  }
  return latest
}

function getAssistantFinalTextForGate(
  assistantMessages: AssistantMessage[],
): string {
  const lastAssistant = assistantMessages.at(-1)
  if (!lastAssistant) return ''
  const content = getDsxuMessageContentArray(lastAssistant)
  if (content.some(isDsxuToolUseBlock)) {
    return ''
  }
  return extractDsxuMessageText(content)
}

function getAssistantCompletionClaimTextsForGate(
  assistantMessages: AssistantMessage[],
): string[] {
  return assistantMessages
    .flatMap(assistant => {
      const content = getDsxuMessageContentArray(assistant)
      if (content.length === 0) return []
      if (content.some(isDsxuToolUseBlock)) return []
      const text = extractDsxuMessageText(content).trim()
      if (!text || !dsxuFinalTextClaimsCompletion(text)) return []
      return [text]
    })
}

function getLatestAssistantVisibleTextForGate(
  assistantMessages: AssistantMessage[],
): string {
  return assistantMessages
    .flatMap(assistant => {
      const content = getDsxuMessageContentArray(assistant)
      if (content.length === 0) return []
      return content.flatMap(block => {
        if (
          block &&
          typeof block === 'object' &&
          (block as { type?: unknown }).type === 'text' &&
          typeof (block as { text?: unknown }).text === 'string'
        ) {
          return [(block as { text: string }).text]
        }
        return []
      })
    })
    .join('\n')
    .trim()
}

export function buildDsxuExecutionVisibilityNudge(
  toolUseBlocks: ToolUseBlock[],
  assistantMessages: AssistantMessage[],
): string | null {
  if (toolUseBlocks.length < DSXU_PARALLEL_VISIBILITY_TOOL_THRESHOLD) {
    return null
  }

  const visibleText = getLatestAssistantVisibleTextForGate(assistantMessages)
  if (visibleText.length >= 24) return null

  const toolNames = Array.from(new Set(toolUseBlocks.map(block => block.name)))
    .slice(0, 8)
    .join(', ')

  return [
    'DSXU execution-visibility gate:',
    `- blocked_tool_batch: ${toolUseBlocks.length} tool calls${toolNames ? ` (${toolNames})` : ''} were emitted without a visible intent brief.`,
    '- required_next: before re-issuing tools, write one visible sentence naming the 3-5 dimensions you are checking and why they can run in parallel; then call only the necessary tools.',
    '- user_experience: do not silently fan out broad parallel tool batches. Long-running commands must stay owned with task id, output path, and current status.',
  ].join('\n')
}

export function clearDsxuReadCacheForBlockedExecutionVisibility(
  toolUseBlocks: readonly ToolUseBlock[],
  readFileState: ToolUseContext['readFileState'],
): string[] {
  const cleared: string[] = []
  for (const block of toolUseBlocks) {
    if (block.name !== 'Read') continue
    const filePath = (block.input as { file_path?: unknown } | undefined)?.file_path
    if (typeof filePath !== 'string' || filePath.trim().length === 0) continue
    const normalizedPath = expandPath(filePath)
    if (readFileState.delete(normalizedPath)) {
      cleared.push(normalizedPath)
    }
  }
  return cleared
}

function createDsxuExecutionVisibilityBlockedToolResultMessage({
  toolUseBlocks,
  assistantMessages,
  nudge,
}: {
  toolUseBlocks: ToolUseBlock[]
  assistantMessages: AssistantMessage[]
  nudge: string
}): UserMessage {
  return createUserMessage({
    content: toolUseBlocks.map(block => ({
      type: 'tool_result' as const,
      tool_use_id: block.id,
      is_error: true,
      content: `<tool_use_error>${nudge}</tool_use_error>`,
    })),
    toolUseResult: nudge,
    sourceToolAssistantUUID: assistantMessages.at(-1)?.uuid,
  })
}

function dsxuFinalTextClaimsCompletion(text: string): boolean {
  return (
    /\b(done|complete|completed|fixed|implemented|resolved|verified|passes?|passing|ready|all set)\b/i.test(text) ||
    /(?:\u5df2\u5b8c\u6210|\u5b8c\u6210\u4e86|\u4fee\u590d|\u5df2\u4fee\u590d|\u9a8c\u8bc1\u901a\u8fc7|\u6d4b\u8bd5\u901a\u8fc7|\u901a\u8fc7\u4e86)/.test(text)
  )
}

function dsxuFinalTextDisclosesPartial(text: string): boolean {
  return (
    /\b(PARTIAL|partial|incomplete|missing evidence|unresolved risks?|not complete|cannot claim complete|failed tests?|tests failed)\b/i.test(text) ||
    /(?:\u90e8\u5206\u5b8c\u6210|\u672a\u5b8c\u6210|\u7f3a\u5c11\u8bc1\u636e|\u4ecd\u6709\u98ce\u9669|\u6d4b\u8bd5\u5931\u8d25|\u4e0d\u80fd\u58f0\u79f0\u5b8c\u6210)/.test(text)
  )
}

export function hasDsxuUnverifiedMutationSinceVerification(
  messages: Message[],
): boolean {
  let mutationAwaitingVerification = false
  for (const message of messages) {
    for (const result of getToolResultText(message)) {
      if (
        /DSXU tool state:\s*(?:edit_applied|edit_already_applied)\b/i.test(
          result.text,
        )
      ) {
        mutationAwaitingVerification = true
        continue
      }
      if (!mutationAwaitingVerification) continue
      if (
        /DSXU tool state:\s*verification_(?:passed|failed)\b/i.test(
          result.text,
        ) ||
        looksLikeDsxuVerifiedPassingTest(result.text) ||
        looksLikeDsxuFailingVerification(result.text)
      ) {
        mutationAwaitingVerification = false
      }
    }
  }
  return mutationAwaitingVerification
}

export function buildDsxuUnverifiedMutationFinalGateNudge(
  conversationMessages: Message[],
  assistantMessages: AssistantMessage[],
  verificationToolAvailable = true,
): string | null {
  const finalText = getAssistantFinalTextForGate(assistantMessages)
  if (finalText.trim().length === 0) return null
  if (!hasDsxuUnverifiedMutationSinceVerification(conversationMessages)) {
    return null
  }
  if (!verificationToolAvailable && dsxuFinalTextDisclosesPartial(finalText)) {
    return null
  }

  return [
    'DSXU post-edit verification final gate:',
    '- blocked_final: a source Edit succeeded, but no post-edit verification result exists.',
    '- required_next: run the smallest relevant verification command now. Do not claim PASS/FAIL/PARTIAL from pre-edit output, read-cache hits, or edit-cache contradictions.',
    '- fallback: if no verification tool is available, answer PARTIAL with that exact blocker and evidence.',
  ].join('\n')
}

function dsxuEvidenceAnchors(
  packet: DsxuAgentEvidenceForFinalGate,
): string[] {
  return [
    ...packet.testsPassed,
    ...packet.filesChanged,
    ...packet.commandsRun,
    ...packet.filesRead,
  ].filter(anchor => anchor.length > 0)
}

function dsxuFinalTextCitesEvidence(
  text: string,
  packet: DsxuAgentEvidenceForFinalGate,
): boolean {
  const normalizedText = text.toLowerCase()
  return dsxuEvidenceAnchors(packet).some(anchor => {
    const normalizedAnchor = anchor.toLowerCase()
    const basename = normalizedAnchor.split(/[\\/]/).at(-1) ?? normalizedAnchor
    return (
      normalizedAnchor.length > 0 &&
      (normalizedText.includes(normalizedAnchor) ||
        (basename.length >= 4 && normalizedText.includes(basename)))
    )
  })
}

function dsxuFinalTextHasBareCompletionPrelude(
  text: string,
  packet: DsxuAgentEvidenceForFinalGate,
): boolean {
  const firstLine = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(Boolean)
  if (!firstLine) return false
  if (dsxuFinalTextCitesEvidence(firstLine, packet)) return false
  return (
    /^(?:done|complete|completed|fixed|implemented|resolved|verified|ready|all set)\.?\s*(?:$|DSXU_[A-Z0-9_]+|PASS\b|passed\b)/i.test(firstLine) ||
    /^(?:\u5df2\u5b8c\u6210|\u5b8c\u6210\u4e86|\u4fee\u590d|\u5df2\u4fee\u590d|\u9a8c\u8bc1\u901a\u8fc7|\u6d4b\u8bd5\u901a\u8fc7|\u901a\u8fc7\u4e86)[\u3002.!]?\s*(?:$|DSXU_[A-Z0-9_]+|PASS\b|\u901a\u8fc7\b)/.test(firstLine)
  )
}

export function buildDsxuAgentFinalGateNudge(
  conversationMessages: Message[],
  assistantMessages: AssistantMessage[],
): string | null {
  const finalTexts = getAssistantCompletionClaimTextsForGate(assistantMessages)
  if (finalTexts.length === 0) return null

  const latestEvidence = getLatestDsxuAgentEvidenceForFinalGate(conversationMessages)
  if (!latestEvidence) return null

  const hasIncompleteEvidence =
    latestEvidence.completionClaim !== 'complete' ||
    latestEvidence.testsFailed.length > 0 ||
    latestEvidence.unresolvedRisks.length > 0
  for (const finalText of finalTexts) {
    if (hasIncompleteEvidence && !dsxuFinalTextDisclosesPartial(finalText)) {
      return [
        'DSXU parent-final evidence gate:',
        '- blocked_final: the final answer claims completion, but the latest Agent evidence is partial, unknown, has failed tests, or lists unresolved risks.',
        '- required_next: do not claim complete. Use SendMessage once to request focused worker evidence, run the smallest in-scope verification yourself, or answer PARTIAL with the exact missing evidence and unresolved risk.',
      ].join('\n')
    }
  }

  for (const finalText of finalTexts) {
    if (
      latestEvidence.completionClaim === 'complete' &&
      dsxuEvidenceAnchors(latestEvidence).length > 0 &&
      (dsxuFinalTextHasBareCompletionPrelude(finalText, latestEvidence) ||
        !dsxuFinalTextCitesEvidence(finalText, latestEvidence))
    ) {
      return [
        'DSXU parent-final evidence gate:',
        '- blocked_final: the parent final claims completion after Agent work but does not cite concrete worker evidence.',
        '- required_next: produce the final answer again and cite at least one concrete worker evidence item, such as a changed/read file path or verification command from the Agent evidence packet.',
      ].join('\n')
    }
  }

  return null
}

export function buildDsxuEmptyFinalAnswerNudge(
  assistantMessages: AssistantMessage[],
): string | null {
  const latestAssistant = assistantMessages.at(-1)
  if (!latestAssistant) return null
  const content = getDsxuMessageContentArray(latestAssistant)
  if (content.length === 0) return null
  if (content.some(isDsxuToolUseBlock)) return null
  const visibleText = content
    .flatMap(block => {
      if (
        block &&
        typeof block === 'object' &&
        (block as { type?: unknown }).type === 'text' &&
        typeof (block as { text?: unknown }).text === 'string'
      ) {
        return [(block as { text: string }).text]
      }
      return []
    })
    .join('\n')
    .trim()
  if (visibleText.length > 0) return null
  return 'DSXU final-answer visibility gate: the previous assistant response had no user-visible text. Do not call tools. Emit the requested PASS marker or final answer now as a visible text response.'
}

function dsxuFinalTextPromisesFollowupAction(text: string): boolean {
  const normalized = text.trim()
  if (!normalized) return false
  if (
    /\b(?:PARTIAL|FAIL|FAILED|BLOCKED|DONE|PASS)\b/.test(normalized) ||
    /\b(?:verified|completed|finished)\b/i.test(normalized)
  ) {
    return false
  }

  return (
    /^\s*(?:step|phase)\s*\d+(?:\s*\/\s*\d+)?\s*[:.)-]?\s*(?:read|edit|write|run|verify|test|execute|inspect|check|create|add|patch|modify|update|fix)\b/im.test(normalized) ||
    /\b(?:now|next)\s+(?:running|verifying|testing|reading|editing|writing|executing|checking|inspecting|creating|adding|patching|modifying|updating|fixing)\b/i.test(normalized) ||
    /\b(?:running|verifying|testing|reading|editing|writing|executing|checking|inspecting|creating|adding|patching|modifying|updating|fixing)\s+(?:now|next)\b/i.test(normalized) ||
    /\b(?:running|verifying|testing|reading|editing|writing|executing|checking|inspecting|creating|adding|patching|modifying|updating|fixing)\s+(?:the\s+)?(?:verification|test|command|read|edit|write|file|server|build|function|helper)\s+now\b/i.test(normalized) ||
    /\b(?:running|verifying|testing|executing)\s+`?[\w./\\:-]+`?.*\b(?:to\s+)?(?:verify|test|check)\b/i.test(normalized) ||
    /\b(?:let me|i(?:'ll| will| am going to)|i'm going to)\s+(?:now\s+)?(?:check|inspect|read|run|start|begin|implement|edit|write|create|add|patch|modify|update|verify|test|fix|continue|look|do)\b/i.test(normalized) ||
    /\b(?:starting|beginning)\s+(?:now|with|the)\b/i.test(normalized) ||
    /(?:我(?:现在|马上|来|会|将)|现在我|接下来我|让我)(?:先)?(?:直接)?(?:开始|确认|检查|查看|读取|运行|执行|创建|写|修改|修复|实现|优化|验证|测试|处理|做)/.test(normalized) ||
    /(?:直接开始|开始做|马上处理|马上实际测试|现在直接)(?:做|实现|修改|验证|测试|处理|优化)?/.test(normalized)
  )
}

export function buildDsxuIntentOnlyFinalNudge(
  assistantMessages: AssistantMessage[],
): string | null {
  const latestAssistant = assistantMessages.at(-1)
  if (!latestAssistant) return null
  const content = getDsxuMessageContentArray(latestAssistant)
  if (content.length === 0) return null
  if (content.some(isDsxuToolUseBlock)) return null

  const visibleText = content
    .flatMap(block => {
      if (
        block &&
        typeof block === 'object' &&
        (block as { type?: unknown }).type === 'text' &&
        typeof (block as { text?: unknown }).text === 'string'
      ) {
        return [(block as { text: string }).text]
      }
      return []
    })
    .join('\n')
    .trim()

  if (!dsxuFinalTextPromisesFollowupAction(visibleText)) return null

  return [
    'DSXU intent-only final gate:',
    '- blocked_final: the assistant ended the turn with a promise to inspect, edit, run, verify, or continue, but emitted no tool call and no explicit final/blocked status.',
    '- required_next: perform the promised next action now with the smallest necessary tool call, or replace the response with a truthful final status explaining that no action was taken. Do not wait for the user to type continue.',
  ].join('\n')
}

export type DsxuBackgroundTaskSnapshot = {
  id: string
  type: string
  status: string
  description: string
  outputFile?: string
  toolUseId?: string
}

function collectDsxuActiveBackgroundTasks(
  tasks: Record<string, unknown> | undefined,
): DsxuBackgroundTaskSnapshot[] {
  if (!tasks) return []
  const snapshots: DsxuBackgroundTaskSnapshot[] = []
  for (const [taskId, task] of Object.entries(tasks)) {
    if (!isBackgroundTask(task as TaskState)) continue
    const taskRecord = task as TaskState & {
      id?: string
      outputFile?: string
      description?: string
      type?: string
      status?: string
      toolUseId?: string
    }
    snapshots.push({
      id: String(taskRecord.id ?? taskId),
      type: String(taskRecord.type ?? 'unknown'),
      status: String(taskRecord.status ?? 'unknown'),
      description: String(taskRecord.description ?? ''),
      outputFile:
        typeof taskRecord.outputFile === 'string'
          ? taskRecord.outputFile
          : undefined,
      toolUseId:
        typeof taskRecord.toolUseId === 'string'
          ? taskRecord.toolUseId
          : undefined,
    })
  }
  return snapshots
}

function dsxuFinalTextReportsActiveBackgroundTask(
  text: string,
  snapshots: DsxuBackgroundTaskSnapshot[],
): boolean {
  const normalized = text.toLowerCase()
  const mentionsKnownTask = snapshots.some(snapshot =>
    [snapshot.id, snapshot.outputFile, snapshot.toolUseId]
      .filter((value): value is string => Boolean(value))
      .some(value => normalized.includes(value.toLowerCase())),
  )
  if (!mentionsKnownTask) return false
  const mentionsBackground =
    /\b(background|backgrounded|still running|running task|active task|task id|output file|shell task)\b/i.test(text) ||
    /(?:\u540e\u53f0|\u4ecd\u5728\u8fd0\u884c|\u8fd8\u5728\u8fd0\u884c|\u4efb\u52a1|\u8f93\u51fa\u6587\u4ef6)/.test(text)
  const mentionsStatus =
    /\b(running|pending|active|output|task|status)\b/i.test(text) ||
    /(?:\u8fd0\u884c|\u7b49\u5f85|\u72b6\u6001|\u8f93\u51fa|\u4efb\u52a1)/.test(text)
  return mentionsBackground && mentionsStatus
}

function renderDsxuBackgroundTaskFinalGateEvidence(
  snapshots: DsxuBackgroundTaskSnapshot[],
): string {
  return snapshots
    .slice(0, 5)
    .map(snapshot => {
      const parts = [
        `id=${snapshot.id}`,
        `type=${snapshot.type}`,
        `status=${snapshot.status}`,
        snapshot.description ? `description=${snapshot.description}` : null,
        snapshot.outputFile ? `output=${snapshot.outputFile}` : null,
      ].filter(Boolean)
      return `- ${parts.join('; ')}`
    })
    .join('\n')
}

export function buildDsxuBackgroundTaskFinalGateNudge(
  assistantMessages: AssistantMessage[],
  tasks: Record<string, unknown> | undefined,
): string | null {
  const activeTasks = collectDsxuActiveBackgroundTasks(tasks)
  if (activeTasks.length === 0) return null

  const finalText = getAssistantFinalTextForGate(assistantMessages)
  if (finalText.trim().length === 0) return null
  if (dsxuFinalTextReportsActiveBackgroundTask(finalText, activeTasks)) {
    return null
  }

  return [
    'DSXU background-task final gate:',
    `- blocked_final: ${activeTasks.length} background task(s) are still running or pending, but the final answer does not report their status.`,
    '- required_next: do not claim completion silently. If the task is needed for acceptance, inspect it with TaskOutput/TaskStop or wait for its notification. If it is intentionally left running, answer with its task id, output path, current status, and what remains pending.',
    renderDsxuBackgroundTaskFinalGateEvidence(activeTasks),
  ].join('\n')
}

type DsxuObservedToolState = {
  toolUseId: string
  text: string
  isError: boolean
  toolName: string
}

type DsxuRecoverySignals = {
  sawEditApplied: string[]
  sawAlreadyApplied: string[]
  sawVerificationPassed: string[]
  sawVerificationBlockedUnsafeBatch: string[]
  sawEditPreflightRequired: string[]
  sawEditPreflightFailed: string[]
  sawVerificationFailed: string[]
  sawPostMutationVerificationResult: string[]
  sawIncompleteAgentEvidence: string[]
  sawPermissionDenied: string[]
  sawToolUnavailable: string[]
  sawPostCompactResumeSnapshot: boolean
  unsafeMutationVerificationBatch: boolean
  baselinePassPendingRequiredEdit: boolean
  unverifiedEditStreak: number
  discoveryStreak: number
  fileLookupMissStreak: number
  failedVerificationStreak: number
}

export type DsxuRecoveryStateName =
  | 'idle'
  | 'verified_passed_ready_final'
  | 'baseline_pass_pending_required_edit'
  | 'agent_evidence_incomplete'
  | 'post_compact_source_truth_required'
  | 'edit_preflight_source_truth'
  | 'failed_verification_loop'
  | 'verification_failed_needs_repair'
  | 'post_mutation_verification_ready_final'
  | 'unsafe_batch_wait_for_mutation'
  | 'mutation_budget_high'
  | 'file_lookup_boundary_required'
  | 'permission_denied_replan'
  | 'tool_unavailable_replan'
  | 'discovery_narrowing_required'
  | 'edit_applied_needs_verification'

export type DsxuRecoveryAction =
  | 'none'
  | 'final_answer'
  | 'agent_evidence_or_partial'
  | 'read_source_truth'
  | 'source_repair'
  | 'wait_for_mutation_result'
  | 'verify'
  | 'answer_with_current_filesystem_evidence'
  | 'permission_safe_replan'
  | 'available_tool_replan'
  | 'narrow_discovery'

export type DsxuRecoveryState = {
  state: DsxuRecoveryStateName
  requiredAction: DsxuRecoveryAction
  canClaimComplete: boolean
  sourceTruthRequired: boolean
  verificationRequired: boolean
  reason: string
}

function collectDsxuRecoverySignals(
  toolResults: Message[],
  toolUseBlocks: ToolUseBlock[],
  conversationMessages: Message[] = [],
): DsxuRecoverySignals {
  const toolNameById = new Map(toolUseBlocks.map(block => [block.id, block.name]))
  const sawEditApplied: string[] = []
  const sawAlreadyApplied: string[] = []
  const sawVerificationPassed: string[] = []
  const sawVerificationBlockedUnsafeBatch: string[] = []
  const sawEditPreflightRequired: string[] = []
  const sawEditPreflightFailed: string[] = []
  const sawVerificationFailed: string[] = []
  const sawPostMutationVerificationResult: string[] = []
  const sawIncompleteAgentEvidence: string[] = []
  const sawPermissionDenied: string[] = []
  const sawToolUnavailable: string[] = []
  const sawPostCompactResumeSnapshot = hasDsxuPostCompactResumeSnapshot([
    ...conversationMessages,
    ...toolResults,
  ])
  const sawToolState: DsxuObservedToolState[] = toolResults.flatMap(message =>
    getToolResultText(message).map(result => ({
      ...result,
      toolName: toolNameById.get(result.toolUseId) ?? 'unknown',
    })),
  )

  const conversationHasMutationAwaitingVerification =
    hasDsxuMutationAwaitingVerification(conversationMessages)

  for (const result of sawToolState) {
    if (/DSXU tool state:\s*edit_already_applied/i.test(result.text)) {
      sawAlreadyApplied.push(result.toolName)
    } else if (/DSXU tool state:\s*edit_applied/i.test(result.text)) {
      sawEditApplied.push(result.toolName)
    } else if (/DSXU tool state:\s*verification_passed/i.test(result.text)) {
      sawVerificationPassed.push(result.toolName)
    } else if (/DSXU tool state:\s*verification_blocked_unsafe_batch/i.test(result.text)) {
      sawVerificationBlockedUnsafeBatch.push(result.toolName)
    } else if (/DSXU tool state:\s*verification_failed/i.test(result.text)) {
      sawVerificationFailed.push(result.toolName)
    } else if (/DSXU tool state:\s*edit_preflight_required/i.test(result.text)) {
      sawEditPreflightRequired.push(result.toolName)
    } else if (/DSXU tool state:\s*edit_preflight_failed/i.test(result.text)) {
      sawEditPreflightFailed.push(result.toolName)
    }
    if ((result.toolName === 'Agent' || result.toolName === 'Task') && hasIncompleteAgentEvidence(result.text)) {
      sawIncompleteAgentEvidence.push(result.toolName)
    }
    if (
      result.isError &&
      /(?:Permission for this (?:action|tool use) has been denied|tool use was rejected|permission denied|denied by permission|cannot be used for local file writes)/i.test(
        result.text,
      )
    ) {
      sawPermissionDenied.push(result.toolName)
    }
    if (
      result.isError &&
      /(?:No such tool available|Available tools in this turn|Do not call unavailable tools)/i.test(
        result.text,
      )
    ) {
      sawToolUnavailable.push(result.toolName)
    }
    if (
      conversationHasMutationAwaitingVerification &&
      DSXU_VERIFICATION_TOOL_NAMES.has(result.toolName) &&
      looksLikeSuccessfulPostMutationVerificationResult(result)
    ) {
      sawPostMutationVerificationResult.push(result.toolName)
    }
  }

  const mutationToolCalls = toolUseBlocks.filter(block =>
    DSXU_MUTATION_TOOL_NAMES.has(block.name),
  )
  const verificationCalls = toolUseBlocks.filter(block =>
    DSXU_VERIFICATION_TOOL_NAMES.has(block.name),
  )
  const unsafeMutationVerificationBatch =
    mutationToolCalls.length > 0 &&
    verificationCalls.length > 0 &&
    toolUseBlocks.length > 1
  const unverifiedEditStreak = getDsxuUnverifiedEditStreak([
    ...conversationMessages,
    ...toolResults,
  ])
  const discoveryStreak = getDsxuDiscoveryStreakSinceProgress(
    conversationMessages,
    sawToolState,
  )
  const fileLookupMissStreak = getDsxuFileLookupMissStreakSinceProgress(
    conversationMessages,
    sawToolState,
  )
  const failedVerificationStreak = getDsxuFailedVerificationStreakSinceEdit(
    conversationMessages,
    sawToolState,
  )
  const baselinePassPendingRequiredEdit =
    sawVerificationPassed.length > 0 &&
    hasDsxuPendingRequiredEditAfterBaselinePass([
      ...conversationMessages,
      ...toolResults,
    ])

  return {
    sawEditApplied,
    sawAlreadyApplied,
    sawVerificationPassed,
    sawVerificationBlockedUnsafeBatch,
    sawEditPreflightRequired,
    sawEditPreflightFailed,
    sawVerificationFailed,
    sawPostMutationVerificationResult,
    sawIncompleteAgentEvidence,
    sawPermissionDenied,
    sawToolUnavailable,
    sawPostCompactResumeSnapshot,
    unsafeMutationVerificationBatch,
    baselinePassPendingRequiredEdit,
    unverifiedEditStreak,
    discoveryStreak,
    fileLookupMissStreak,
    failedVerificationStreak,
  }
}

function classifyDsxuRecoveryState(signals: DsxuRecoverySignals): DsxuRecoveryState {
  if (signals.baselinePassPendingRequiredEdit) {
    return {
      state: 'baseline_pass_pending_required_edit',
      requiredAction: 'read_source_truth',
      canClaimComplete: false,
      sourceTruthRequired: true,
      verificationRequired: true,
      reason: 'baseline verification passed but explicit source/test edits remain',
    }
  }
  if (signals.sawVerificationPassed.length > 0) {
    return {
      state: 'verified_passed_ready_final',
      requiredAction: 'final_answer',
      canClaimComplete: true,
      sourceTruthRequired: false,
      verificationRequired: false,
      reason: 'latest verification passed',
    }
  }
  if (signals.sawIncompleteAgentEvidence.length > 0) {
    return {
      state: 'agent_evidence_incomplete',
      requiredAction: 'agent_evidence_or_partial',
      canClaimComplete: false,
      sourceTruthRequired: false,
      verificationRequired: false,
      reason: 'Agent evidence is partial, unknown, failed, or risk-bearing',
    }
  }
  if (signals.sawPermissionDenied.length > 0) {
    return {
      state: 'permission_denied_replan',
      requiredAction: 'permission_safe_replan',
      canClaimComplete: false,
      sourceTruthRequired: false,
      verificationRequired: false,
      reason: 'latest tool result denied permission or rejected the tool use',
    }
  }
  if (signals.sawToolUnavailable.length > 0) {
    return {
      state: 'tool_unavailable_replan',
      requiredAction: 'available_tool_replan',
      canClaimComplete: false,
      sourceTruthRequired: false,
      verificationRequired: false,
      reason: 'latest tool result reported an unavailable tool',
    }
  }
  if (
    signals.sawPostCompactResumeSnapshot &&
    (
      signals.sawEditPreflightRequired.length > 0 ||
      signals.sawEditPreflightFailed.length > 0
    )
  ) {
    return {
      state: 'post_compact_source_truth_required',
      requiredAction: 'read_source_truth',
      canClaimComplete: false,
      sourceTruthRequired: true,
      verificationRequired: true,
      reason: 'post-compact/resume edit attempt requires fresh source truth before edit or PASS',
    }
  }
  if (
    signals.sawEditPreflightRequired.length > 0 ||
    signals.sawEditPreflightFailed.length > 0
  ) {
    return {
      state: 'edit_preflight_source_truth',
      requiredAction: 'read_source_truth',
      canClaimComplete: false,
      sourceTruthRequired: true,
      verificationRequired: false,
      reason: 'Edit did not bind to current source truth',
    }
  }
  if (signals.fileLookupMissStreak >= DSXU_FILE_LOOKUP_MISS_THRESHOLD) {
    return {
      state: 'file_lookup_boundary_required',
      requiredAction: 'answer_with_current_filesystem_evidence',
      canClaimComplete: false,
      sourceTruthRequired: true,
      verificationRequired: false,
      reason: `${signals.fileLookupMissStreak} file lookup misses since the last filesystem progress`,
    }
  }
  if (signals.failedVerificationStreak >= DSXU_FAILED_VERIFICATION_RECOVERY_THRESHOLD) {
    return {
      state: 'failed_verification_loop',
      requiredAction: 'source_repair',
      canClaimComplete: false,
      sourceTruthRequired: true,
      verificationRequired: false,
      reason: `${signals.failedVerificationStreak} failed verification results since the last source Edit`,
    }
  }
  if (signals.sawVerificationFailed.length > 0) {
    return {
      state: 'verification_failed_needs_repair',
      requiredAction: 'source_repair',
      canClaimComplete: false,
      sourceTruthRequired: true,
      verificationRequired: false,
      reason: 'latest verification failed',
    }
  }
  if (signals.sawPostMutationVerificationResult.length > 0) {
    return {
      state: 'post_mutation_verification_ready_final',
      requiredAction: 'final_answer',
      canClaimComplete: true,
      sourceTruthRequired: false,
      verificationRequired: false,
      reason: 'successful post-mutation verification result is available',
    }
  }
  if (signals.unsafeMutationVerificationBatch) {
    return {
      state: 'unsafe_batch_wait_for_mutation',
      requiredAction: 'wait_for_mutation_result',
      canClaimComplete: false,
      sourceTruthRequired: false,
      verificationRequired: true,
      reason: 'mutation and verification were requested in the same tool batch',
    }
  }
  if (signals.unverifiedEditStreak >= 4) {
    return {
      state: 'mutation_budget_high',
      requiredAction: 'verify',
      canClaimComplete: false,
      sourceTruthRequired: false,
      verificationRequired: true,
      reason: `${signals.unverifiedEditStreak} successful edits without verified PASS`,
    }
  }
  if (signals.discoveryStreak >= DSXU_DISCOVERY_NARROWING_THRESHOLD) {
    return {
      state: 'discovery_narrowing_required',
      requiredAction: 'narrow_discovery',
      canClaimComplete: false,
      sourceTruthRequired: true,
      verificationRequired: false,
      reason: `${signals.discoveryStreak} discovery results without edit or verification progress`,
    }
  }
  if (signals.sawEditApplied.length > 0 || signals.sawAlreadyApplied.length > 0) {
    return {
      state: 'edit_applied_needs_verification',
      requiredAction: 'verify',
      canClaimComplete: false,
      sourceTruthRequired: false,
      verificationRequired: true,
      reason: 'source edit completed and needs verification',
    }
  }
  return {
    state: 'idle',
    requiredAction: 'none',
    canClaimComplete: false,
    sourceTruthRequired: false,
    verificationRequired: false,
    reason: 'no DSXU recovery condition detected',
  }
}

export function buildDsxuRecoveryState({
  toolResults,
  toolUseBlocks,
  conversationMessages = [],
}: {
  toolResults: Message[]
  toolUseBlocks: ToolUseBlock[]
  conversationMessages?: Message[]
}): DsxuRecoveryState {
  return classifyDsxuRecoveryState(
    collectDsxuRecoverySignals(toolResults, toolUseBlocks, conversationMessages),
  )
}

export function buildDsxuToolStateCursorNudge(
  toolResults: Message[],
  toolUseBlocks: ToolUseBlock[],
  conversationMessages: Message[] = [],
): string | null {
  const signals = collectDsxuRecoverySignals(
    toolResults,
    toolUseBlocks,
    conversationMessages,
  )
  const recoveryState = classifyDsxuRecoveryState(signals)
  const {
    sawEditApplied,
    sawAlreadyApplied,
    sawVerificationPassed,
    sawVerificationBlockedUnsafeBatch,
    sawEditPreflightRequired,
    sawEditPreflightFailed,
    sawVerificationFailed,
    sawPostMutationVerificationResult,
    sawIncompleteAgentEvidence,
    sawPermissionDenied,
    sawToolUnavailable,
    sawPostCompactResumeSnapshot,
    unsafeMutationVerificationBatch,
    baselinePassPendingRequiredEdit,
    unverifiedEditStreak,
    discoveryStreak,
    fileLookupMissStreak,
    failedVerificationStreak,
  } = signals

  if (
    sawAlreadyApplied.length === 0 &&
    sawEditApplied.length === 0 &&
    sawVerificationPassed.length === 0 &&
    sawVerificationBlockedUnsafeBatch.length === 0 &&
    sawVerificationFailed.length === 0 &&
    sawPostMutationVerificationResult.length === 0 &&
    sawEditPreflightRequired.length === 0 &&
    sawEditPreflightFailed.length === 0 &&
    sawIncompleteAgentEvidence.length === 0 &&
    sawPermissionDenied.length === 0 &&
    sawToolUnavailable.length === 0 &&
    !(
      sawPostCompactResumeSnapshot &&
      (
        sawEditPreflightRequired.length > 0 ||
        sawEditPreflightFailed.length > 0
      )
    ) &&
    !unsafeMutationVerificationBatch &&
    !baselinePassPendingRequiredEdit &&
    unverifiedEditStreak < 4 &&
    discoveryStreak < DSXU_DISCOVERY_NARROWING_THRESHOLD &&
    fileLookupMissStreak < DSXU_FILE_LOOKUP_MISS_THRESHOLD &&
    failedVerificationStreak < DSXU_FAILED_VERIFICATION_RECOVERY_THRESHOLD
  ) {
    return null
  }

  const lines = [DSXU_TOOL_STATE_CURSOR_PREFIX]
  lines.push(
    `- recovery_state: ${recoveryState.state}; required_action=${recoveryState.requiredAction}; can_claim_complete=${recoveryState.canClaimComplete}; source_truth_required=${recoveryState.sourceTruthRequired}; verification_required=${recoveryState.verificationRequired}; reason=${recoveryState.reason}.`,
  )
  if (sawAlreadyApplied.length > 0) {
    lines.push(
      '- edit_already_applied: treat the repeated Edit as a completed no-op, not as a failure. Do not retry it and do not Read the just-edited file merely to confirm the diff. Continue with the next planned file edit, or verify if no source edit remains.',
    )
  }
  if (sawEditApplied.length > 0) {
    lines.push(
      '- edit_applied: do not repeat the same file edit and do not Read the just-edited file merely to confirm the diff. Continue only to another planned edit in a different file or run the smallest verification command.',
    )
  }
  if (sawVerificationPassed.length > 0) {
    if (baselinePassPendingRequiredEdit) {
      lines.push(
        '- baseline_verification_passed: this pass is only baseline evidence because explicit source/test edits remain. Continue with the planned Read/Edit steps, then run one fresh verification after those edits.',
      )
    } else {
      lines.push(
        '- verification_passed: stop calling tools if the acceptance criteria are satisfied. Produce the required PASS marker or final answer.',
      )
    }
  }
  if (sawVerificationBlockedUnsafeBatch.length > 0) {
    lines.push(
      '- verification_blocked_unsafe_batch: this same-message verification was not run and is not PASS/FAIL evidence. Wait for the mutation result, then issue one fresh verification command in the next turn.',
    )
  }
  if (sawVerificationFailed.length > 0) {
    lines.push(
      '- verification_failed: do not rerun the same verification command unchanged. Extract the concrete failing assertion from the latest output, then perform one precise source Edit that changes that behavior, or report PARTIAL/FAIL with the exact blocker.',
    )
  }
  if (sawPostMutationVerificationResult.length > 0) {
    lines.push(
      '- post_mutation_verification_result: the latest verification command completed after source mutation. Stop calling tools now. Produce the requested PASS/final answer if the latest output satisfies acceptance criteria; otherwise report PARTIAL/FAIL with the exact mismatch. Do not repeat this verification command unchanged.',
    )
  }
  if (sawEditPreflightRequired.length > 0) {
    if (sawPostCompactResumeSnapshot) {
      lines.push(
        '- post_compact_source_truth_required: compact/resume memory is only a recovery snapshot. Re-read the exact source file before retrying Edit, bind old_string to that current Read, then run fresh verification before any PASS/final claim.',
      )
    }
    lines.push(
      '- edit_preflight_required: the Edit was not attempted because source truth is missing or stale. Read the exact selected file first, then bind old_string to the latest Read result before editing. Do not switch to shell writes.',
    )
  }
  if (sawEditPreflightFailed.length > 0) {
    if (sawPostCompactResumeSnapshot) {
      lines.push(
        '- post_compact_source_truth_required: compact/resume memory is only a recovery snapshot. Re-read the exact source file before retrying Edit, bind old_string to that current Read, then run fresh verification before any PASS/final claim.',
      )
    }
    lines.push(
      '- edit_preflight_failed: the Edit did not bind to current source truth. Do not retry the same old_string. Reread the selected candidate or choose a narrower candidate string, then run one precise Edit or report PARTIAL with the missing fact.',
    )
  }
  if (sawIncompleteAgentEvidence.length > 0) {
    lines.push(
      '- agent_evidence_incomplete: the latest Agent evidence is partial, unknown, has failed tests, or lists unresolved risks. Do not claim complete from this worker result. Continue that same worker once with SendMessage when its loaded context, failed command output, or recent edits matter; otherwise run your own smallest in-scope verification or report PARTIAL with the exact missing evidence.',
    )
  }
  if (sawPermissionDenied.length > 0) {
    lines.push(
      '- permission_denied: the latest tool result denied permission or rejected the tool use. Do not wait silently and do not retry the same denied action unchanged. Replan with an allowed, read-only, or scope-safe alternative; ask for explicit permission only if essential; otherwise report BLOCKED/PARTIAL with the exact denied action and reason.',
    )
  }
  if (sawToolUnavailable.length > 0) {
    lines.push(
      '- tool_unavailable: the latest tool result says the requested tool is not available in this turn. Do not keep searching for that tool and do not invent that it succeeded. Continue only with listed available tools and exact task paths, or report PARTIAL/BLOCKED with the unavailable tool name and missing capability.',
    )
  }
  if (unsafeMutationVerificationBatch) {
    lines.push(
      '- unsafe_batch_detected: an Edit/Write and verification were requested in the same tool batch. Treat verification from that batch as possibly stale; after mutation results settle, run at most one fresh verification before final PASS.',
    )
  }
  if (unverifiedEditStreak >= 4) {
    lines.push(
      `- mutation_budget_high: ${unverifiedEditStreak} successful Edit results have occurred since the last verified PASS. Stop expanding the patch. Run the smallest relevant verification command now, or output PARTIAL with the exact remaining uncertainty if verification cannot run. Continue editing only for one clearly named failing assertion from fresh verification evidence.`,
    )
  }
  if (discoveryStreak >= DSXU_DISCOVERY_NARROWING_THRESHOLD) {
    lines.push(
      `- discovery_budget_pressure: ${discoveryStreak} Read/Grep/Glob results have occurred since the last edit or verification progress. Do not continue broad discovery. Produce a short candidate-selection contract internally before editing: candidate_files, evidence_for_each_candidate, selected_candidate, latest_source_truth_to_read_or_reuse, smallest_safe_edit, verification_command, and why other candidates are lower priority. Then choose one candidate and Edit, verify, or output PARTIAL with the exact missing fact. Do not bypass this with shell listing, shell reads, or shell writes.`,
    )
  }
  if (fileLookupMissStreak >= DSXU_FILE_LOOKUP_MISS_THRESHOLD) {
    lines.push(
      `- file_lookup_boundary: ${fileLookupMissStreak} file lookup misses have occurred since the last filesystem progress. Do not keep expanding directory or repository searches. Do not claim a path exists unless the latest tool result names that exact path. Answer with the exact checked path(s), the latest filesystem evidence, and the next concrete action: create the requested file in the user-approved location, inspect a single user-named location, or report PARTIAL/BLOCKED if the location is unclear.`,
    )
  }
  if (failedVerificationStreak >= DSXU_FAILED_VERIFICATION_RECOVERY_THRESHOLD) {
    lines.push(
      `- failed_verification_repeat: ${failedVerificationStreak} failed verification results have occurred since the last source Edit. Stop rerunning the same command. Choose one source-repair action from the latest failing assertion, or output PARTIAL/FAIL if the safe edit is not identifiable. Do not analyze tool-cache contradictions or repeat verification without a strategy-changing Edit.`,
    )
  }
  lines.push(
    '- source truth rule: after compact/resume, memory is only a hint; use current tool results and this cursor state to avoid restarting discovery or repeating completed work.',
  )
  return lines.join('\n')
}

function buildDsxuTailToolResultRecoveryCursor(
  messages: Message[],
): { gateState: DsxuQueryLoopGateState; nudge: UserMessage } | null {
  const latestToolResultIndex = messages.findLastIndex(message =>
    getToolResultText(message).length > 0,
  )
  if (latestToolResultIndex < 0) return null
  const alreadyNudged = messages
    .slice(latestToolResultIndex + 1)
    .some(message =>
      extractDsxuMessageText(
        (message as { message?: { content?: unknown } }).message?.content,
      ).includes(DSXU_TOOL_STATE_CURSOR_PREFIX),
    )
  if (alreadyNudged) return null

  const toolResults = messages
    .slice(latestToolResultIndex)
    .filter(
      (message): message is UserMessage =>
        message.type === 'user' && getToolResultText(message).length > 0,
    )
  if (toolResults.length === 0) return null

  const conversationMessages = messages.slice(0, latestToolResultIndex)
  const toolUseBlocks = conversationMessages.flatMap(collectToolUseBlocksFromMessage)
  const recoveryState = buildDsxuRecoveryState({
    toolResults,
    toolUseBlocks,
    conversationMessages,
  })
  const gateState = buildDsxuRecoveryGateState(recoveryState)
  if (!gateState) return null

  const nudgeText = buildDsxuToolStateCursorNudge(
    toolResults,
    toolUseBlocks,
    conversationMessages,
  )
  if (!nudgeText) return null

  return {
    gateState,
    nudge: createUserMessage({
      content: nudgeText,
      isMeta: true,
    }),
  }
}

export function getDsxuFailedVerificationStreakSinceEdit(
  messages: Message[],
  currentToolStates: Array<{ toolName: string; text: string }> = [],
): number {
  const toolNameById = new Map<string, string>()
  let streak = 0
  for (const message of messages) {
    const content = getDsxuMessageContentArray(message)
    if (content.length === 0) continue
    if (message.type === 'assistant') {
      for (const block of content.filter(isDsxuToolUseBlock)) {
        toolNameById.set(block.id, block.name)
      }
      continue
    }
    if (message.type !== 'user') continue
    for (const block of content) {
      if (
        !block ||
        typeof block !== 'object' ||
        (block as { type?: unknown }).type !== 'tool_result' ||
        typeof (block as { content?: unknown }).content !== 'string'
      ) {
        continue
      }
      const toolResult = block as { content: string; tool_use_id?: string }
      if (
        /DSXU tool state:\s*(?:edit_applied|edit_already_applied|verification_passed|edit_preflight_required|edit_preflight_failed)/i.test(toolResult.content)
      ) {
        streak = 0
        continue
      }
      const toolName = toolResult.tool_use_id
        ? toolNameById.get(toolResult.tool_use_id)
        : undefined
      if (toolName && DSXU_VERIFICATION_TOOL_NAMES.has(toolName) && looksLikeDsxuFailingVerification(toolResult.content)) {
        streak++
      }
    }
  }
  for (const result of currentToolStates) {
    if (
      /DSXU tool state:\s*(?:edit_applied|edit_already_applied|verification_passed|edit_preflight_required|edit_preflight_failed)/i.test(result.text)
    ) {
      streak = 0
      continue
    }
    if (DSXU_VERIFICATION_TOOL_NAMES.has(result.toolName) && looksLikeDsxuFailingVerification(result.text)) {
      streak++
    }
  }
  return streak
}

export function getDsxuDiscoveryStreakSinceProgress(
  messages: Message[],
  currentToolStates: Array<{ toolName: string; text: string }> = [],
): number {
  const toolNameById = new Map<string, string>()
  let streak = 0
  for (const message of messages) {
    const content = getDsxuMessageContentArray(message)
    if (content.length === 0) continue
    if (message.type === 'assistant') {
      for (const block of content.filter(isDsxuToolUseBlock)) {
        toolNameById.set(block.id, block.name)
      }
      continue
    }
    if (message.type !== 'user') continue
    for (const block of content) {
      if (
        !block ||
        typeof block !== 'object' ||
        (block as { type?: unknown }).type !== 'tool_result'
      ) continue
      const toolResult = block as { content?: unknown; tool_use_id?: string }
      if (typeof toolResult.content === 'string' && isDsxuProgressToolState(toolResult.content)) {
        streak = 0
        continue
      }
      const toolName = toolResult.tool_use_id
        ? toolNameById.get(toolResult.tool_use_id)
        : undefined
      if (toolName && DSXU_DISCOVERY_TOOL_NAMES.has(toolName)) {
        streak++
      }
    }
  }
  for (const result of currentToolStates) {
    if (isDsxuProgressToolState(result.text)) {
      streak = 0
      continue
    }
    if (DSXU_DISCOVERY_TOOL_NAMES.has(result.toolName)) {
      streak++
    }
  }
  return streak
}

function looksLikeDsxuFileLookupMiss(text: string): boolean {
  const normalized = text.trim()
  if (!normalized) return false
  return (
    /\b(?:No files found|No matches found|Path does not exist|Directory does not exist|File does not exist|file not found|cannot stat|cannot access|No such file or directory|Cannot find path|Could not find file|Could not find a part of the path)\b/i.test(normalized) ||
    /(?:cp|mv|ls|dir|Get-ChildItem|Test-Path|stat|find).*?\b(?:cannot stat|cannot access|No such file or directory|file not found)\b/i.test(normalized) ||
    /^total\s+0$/im.test(normalized)
  )
}

function looksLikeDsxuFileLookupProgress(text: string): boolean {
  const normalized = text.trim()
  if (!normalized) return false
  if (looksLikeDsxuFileLookupMiss(normalized)) return false
  return (
    /\bFound\s+[1-9]\d*\s+files?\b/i.test(normalized) ||
    /\b(?:Directory:|Mode\s+LastWriteTime\s+Length\s+Name)\b/i.test(normalized) ||
    /^[-d][rwx-]{9}\s+/m.test(normalized) ||
    /^[A-Za-z]:[\\/].+/m.test(normalized) ||
    /^\/[^:\n]+/m.test(normalized)
  )
}

export function getDsxuFileLookupMissStreakSinceProgress(
  messages: Message[],
  currentToolStates: Array<{ toolName: string; text: string }> = [],
): number {
  const toolNameById = new Map<string, string>()
  let streak = 0
  const visitResult = (toolName: string | undefined, text: string) => {
    if (isDsxuProgressToolState(text) || looksLikeDsxuFileLookupProgress(text)) {
      streak = 0
      return
    }
    if (
      looksLikeDsxuFileLookupMiss(text) &&
      (!toolName ||
        DSXU_DISCOVERY_TOOL_NAMES.has(toolName) ||
        DSXU_VERIFICATION_TOOL_NAMES.has(toolName))
    ) {
      streak++
    }
  }

  for (const message of messages) {
    const content = getDsxuMessageContentArray(message)
    if (content.length === 0) continue
    if (message.type === 'assistant') {
      for (const block of content.filter(isDsxuToolUseBlock)) {
        toolNameById.set(block.id, block.name)
      }
      continue
    }
    if (message.type !== 'user') continue
    for (const block of content) {
      if (
        !block ||
        typeof block !== 'object' ||
        (block as { type?: unknown }).type !== 'tool_result'
      ) continue
      const toolResult = block as { content?: unknown; tool_use_id?: string }
      if (typeof toolResult.content !== 'string') continue
      visitResult(
        toolResult.tool_use_id
          ? toolNameById.get(toolResult.tool_use_id)
          : undefined,
        toolResult.content,
      )
    }
  }
  for (const result of currentToolStates) {
    visitResult(result.toolName, result.text)
  }
  return streak
}

function isDsxuProgressToolState(text: string): boolean {
  return (
    /DSXU tool state:\s*verification_passed/i.test(text) ||
    /DSXU tool state:\s*edit_applied/i.test(text) ||
    /DSXU tool state:\s*edit_already_applied/i.test(text)
  )
}

export function getDsxuUnverifiedEditStreak(messages: Message[]): number {
  let streak = 0
  for (const message of messages) {
    for (const result of getToolResultText(message)) {
      if (/DSXU tool state:\s*verification_passed/i.test(result.text)) {
        streak = 0
        continue
      }
      if (
        /DSXU tool state:\s*edit_applied/i.test(result.text) ||
        /DSXU tool state:\s*edit_already_applied/i.test(result.text)
      ) {
        streak++
      }
    }
  }
  return streak
}

// -- query loop state

// Mutable state carried between loop iterations
type State = {
  messages: Message[]
  toolUseContext: ToolUseContext
  autoCompactTracking: AutoCompactTrackingState | undefined
  maxOutputTokensRecoveryCount: number
  hasAttemptedReactiveCompact: boolean
  maxOutputTokensOverride: number | undefined
  pendingToolUseSummary: Promise<ToolUseSummaryMessage | null> | undefined
  stopHookActive: boolean | undefined
  turnCount: number
  // Why the previous iteration continued. Undefined on first iteration.
  // Lets tests assert recovery paths fired without inspecting message contents.
  transition: Continue | undefined
}

export type DsxuQueryLoopStateTraceSnapshot = {
  turnId: string
  turnCount: number
  transitionReason: string | null
  lastEvent: string
  lastEventTime: string
  pendingToolUseSummary: boolean
  pendingToolUseIDs: string[]
  permissionState: {
    mode: string
    waiting: boolean
  }
  backgroundTaskState: {
    activeCount: number
    activeTaskIDs: string[]
    activeTasks: DsxuBackgroundTaskSnapshot[]
  }
  finalGateState: string | null
  gateState: DsxuQueryLoopGateState | null
}

export const DSXU_TOOL_RESULT_AUTO_CONTINUE_PROMPT =
  'DSXU auto-continue: the previous turn ended after tool results without a visible final answer. Continue from the latest tool results, do not repeat completed tools, and either take the next necessary step or give the final answer now.'

function collectDsxuPendingToolUseIDs(messages: readonly Message[]): string[] {
  const completedToolUseIDs = collectToolResultIDs(
    messages.filter(
      (message): message is UserMessage | AttachmentMessage =>
        message.type === 'user' || message.type === 'attachment',
    ),
  )
  const pendingIDs: string[] = []
  for (const message of messages) {
    if (message.type !== 'assistant') continue
    for (const toolUse of collectToolUseBlocksFromMessage(message)) {
      if (!completedToolUseIDs.has(toolUse.id)) {
        pendingIDs.push(toolUse.id)
      }
    }
  }
  return pendingIDs
}

export function buildDsxuQueryLoopStateTraceSnapshot({
  turnId,
  turnCount,
  transition,
  lastEvent,
  lastEventTime,
  pendingToolUseSummary,
  messages,
  permissionMode,
  tasks,
  finalGateState = null,
  gateState,
}: {
  turnId: string
  turnCount: number
  transition: Continue | undefined
  lastEvent: string
  lastEventTime: string
  pendingToolUseSummary: Promise<ToolUseSummaryMessage | null> | undefined
  messages: readonly Message[]
  permissionMode: unknown
  tasks: Record<string, unknown> | undefined
  finalGateState?: string | null
  gateState?: DsxuQueryLoopGateState | null
}): DsxuQueryLoopStateTraceSnapshot {
  const activeBackgroundTasks = collectDsxuActiveBackgroundTasks(tasks)
  return {
    turnId,
    turnCount,
    transitionReason: transition?.reason ?? null,
    lastEvent,
    lastEventTime,
    pendingToolUseSummary: pendingToolUseSummary !== undefined,
    pendingToolUseIDs: collectDsxuPendingToolUseIDs(messages),
    permissionState: {
      mode: typeof permissionMode === 'string' ? permissionMode : 'unknown',
      waiting: typeof permissionMode === 'string' && permissionMode !== 'default',
    },
    backgroundTaskState: {
      activeCount: activeBackgroundTasks.length,
      activeTaskIDs: activeBackgroundTasks.map(task => task.id),
      activeTasks: activeBackgroundTasks,
    },
    finalGateState,
    gateState:
      gateState === undefined
        ? buildDsxuFinalGateState(finalGateState)
        : gateState,
  }
}

function getMessageContentText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map(block => {
        if (
          block &&
          typeof block === 'object' &&
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
  return ''
}

function getLatestRealUserPromptText(messages: readonly Message[]): string | null {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]
    const content =
      (message as { message?: { content?: unknown } })?.message?.content ??
      (message as { content?: unknown })?.content
    if (
      message?.type === 'user' &&
      !message.isMeta &&
      !message.toolUseResult
    ) {
      return getMessageContentText(content)
    }
  }
  return null
}

export function shouldAllowSystemQueuedCommandDrainForTurn(
  messages: readonly Message[],
): boolean {
  const latestHumanPrompt = getLatestRealUserPromptText(messages)
  if (!latestHumanPrompt) return true
  return (
    /\b(continue|status|progress|background|task|agent|output|result|resume|wait|finish|notification)\b/i.test(
      latestHumanPrompt,
    ) ||
    /(?:继续|状态|进度|后台|任务|智能体|输出|结果|恢复|等待|完成|通知|看一下|查看)/.test(
      latestHumanPrompt,
    )
  )
}

const DSXU_PRO_RECOVERY_TRANSITION_REASONS = new Set<string>([
  'collapse_drain_retry',
  'reactive_compact_retry',
  'max_output_tokens_escalate',
  'max_output_tokens_recovery',
  'stop_hook_blocking',
  'dsxu_agent_final_gate',
])

export function shouldEscalateDeepSeekRouteAfterTransition(
  transition: Continue | undefined,
): boolean {
  return transition
    ? DSXU_PRO_RECOVERY_TRANSITION_REASONS.has(transition.reason)
    : false
}

export async function* query(
  params: QueryParams,
): AsyncGenerator<
  | StreamEvent
  | RequestStartEvent
  | Message
  | TombstoneMessage
  | ToolUseSummaryMessage,
  Terminal
> {
  const consumedCommandUuids: string[] = []
  const terminal = yield* queryLoop(params, consumedCommandUuids)
  traceDsxuLifecycle('query_terminal', {
    reason: terminal.reason,
    consumedCommandCount: consumedCommandUuids.length,
  })
  // Only reached if queryLoop returned normally. Skipped on throw (error
  // propagates through yield*) and on .return() (Return completion closes
  // both generators). This gives the same asymmetric started-without-completed
  // signal as print.ts's drainCommandQueue when the turn fails.
  for (const uuid of consumedCommandUuids) {
    notifyCommandLifecycle(uuid, 'completed')
  }
  return terminal
}

async function* queryLoop(
  params: QueryParams,
  consumedCommandUuids: string[],
): AsyncGenerator<
  | StreamEvent
  | RequestStartEvent
  | Message
  | TombstoneMessage
  | ToolUseSummaryMessage,
  Terminal
> {
  // Immutable params -?never reassigned during the query loop.
  const {
    systemPrompt,
    userContext,
    systemContext,
    canUseTool,
    fallbackModel,
    querySource,
    maxTurns,
    skipCacheWrite,
  } = params
  const deps = params.deps ?? productionDeps()

  // Mutable cross-iteration state. The loop body destructures this at the top
  // of each iteration so reads stay bare-name (`messages`, `toolUseContext`).
  // Continue sites write `state = { ... }` instead of 9 separate assignments.
  let state: State = {
    messages: params.messages,
    toolUseContext: params.toolUseContext,
    maxOutputTokensOverride: params.maxOutputTokensOverride,
    autoCompactTracking: undefined,
    stopHookActive: undefined,
    maxOutputTokensRecoveryCount: 0,
    hasAttemptedReactiveCompact: false,
    turnCount: 1,
    pendingToolUseSummary: undefined,
    transition: undefined,
  }
  const budgetTracker = feature('TOKEN_BUDGET') ? createBudgetTracker() : null

  // task_budget.remaining tracking across compaction boundaries. Undefined
  // until first compact fires -?while context is uncompacted the server can
  // see the full history and handles the countdown from {total} itself (see
  // api/api/sampling/prompt/renderer.py:292). After a compact, the server sees
  // only the summary and would under-count spend; remaining tells it the
  // pre-compact final window that got summarized away. Cumulative across
  // multiple compacts: each subtracts the final context at that compact's
  // trigger point. Loop-local (not on State) to avoid touching the 7 continue
  // sites.
  let taskBudgetRemaining: number | undefined = undefined

  // Snapshot immutable env/statsig/session state once at entry. See QueryConfig
  // for what's included and why feature() gates are intentionally excluded.
  const config = buildQueryConfig()

  // Fired once per user turn -?the prompt is invariant across loop iterations,
  // so per-iteration firing would ask sideQuery the same question N times.
  // Consume point polls settledAt (never blocks). `using` disposes on all
  // generator exit paths -?see MemoryPrefetch for dispose/telemetry semantics.
  using pendingMemoryPrefetch = startRelevantMemoryPrefetch(
    state.messages,
    state.toolUseContext,
  )

  const modelRouteEvidence: string[] = []
  let dsxuRouteModelOverrideActive = false

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Destructure state at the top of each iteration. toolUseContext alone
    // is reassigned within an iteration (queryTracking, messages updates);
    // the rest are read-only between continue sites.
    let { toolUseContext } = state
    const {
      messages,
      autoCompactTracking,
      maxOutputTokensRecoveryCount,
      hasAttemptedReactiveCompact,
      maxOutputTokensOverride,
      pendingToolUseSummary,
      stopHookActive,
      turnCount,
    } = state
    const routeText = buildDeepSeekRouteText(messages)
    const routeInput = {
      ...inferDeepSeekV4RouteInput(routeText, {
        initialPlanningTurn: turnCount === 1 && state.transition === undefined,
      }),
      retryAfterFailure: shouldEscalateDeepSeekRouteAfterTransition(
        state.transition,
      ),
      failedVerification: hasDsxuVerificationFailure(messages),
      complexAgentTask: !!toolUseContext.agentId,
    }
    const routeDecision = decideDeepSeekV4Route(routeInput)
    const routeModelOverride = decideDeepSeekV4RuntimeModelOverride({
      currentModel: toolUseContext.options.mainLoopModel,
      routeDecision,
      autoOverrideActive: dsxuRouteModelOverrideActive,
      explicitModelOverride: getMainLoopModelOverride(),
      disableModelUpgrade: process.env.DSXU_ROUTE_MODEL_UPGRADE_DISABLED === '1',
    })
    if (routeModelOverride.action === 'upgrade_to_pro') {
      toolUseContext = {
        ...toolUseContext,
        options: {
          ...toolUseContext.options,
          mainLoopModel: routeModelOverride.model,
          thinkingConfig: routeModelOverride.thinkingConfig ?? toolUseContext.options.thinkingConfig,
        },
      }
      dsxuRouteModelOverrideActive = routeModelOverride.nextAutoOverrideActive
      modelRouteEvidence.push(formatDeepSeekV4ModelEvidence(routeDecision))
    } else if (routeModelOverride.action === 'downgrade_to_flash') {
      toolUseContext = {
        ...toolUseContext,
        options: {
          ...toolUseContext.options,
          mainLoopModel: routeModelOverride.model,
          thinkingConfig: routeModelOverride.thinkingConfig ?? toolUseContext.options.thinkingConfig,
        },
      }
      dsxuRouteModelOverrideActive = routeModelOverride.nextAutoOverrideActive
    } else {
      if (routeModelOverride.thinkingConfig) {
        toolUseContext = {
          ...toolUseContext,
          options: {
            ...toolUseContext.options,
            thinkingConfig: routeModelOverride.thinkingConfig,
          },
        }
      }
      if (routeModelOverride.shouldRecordEvidence) {
      modelRouteEvidence.push(formatDeepSeekV4ModelEvidence(routeDecision))
      }
    }

    // Skill discovery prefetch -?per-iteration (uses findWritePivot guard
    // that returns early on non-write iterations). Discovery runs while the
    // model streams and tools execute; awaited post-tools alongside the
    // memory prefetch consume. Replaces the blocking assistant_turn path
    // that ran inside getAttachmentMessages (97% of those calls found
    // nothing in prod). Turn-0 user-input discovery still blocks in
    // userInputAttachments -?that's the one signal where there's no prior
    // work to hide under.
    const pendingSkillPrefetch = skillPrefetch?.startSkillDiscoveryPrefetch(
      null,
      messages,
      toolUseContext,
    )

    yield { type: 'stream_request_start' }

    queryCheckpoint('query_fn_entry')

    // Record query start for headless latency tracking (skip for subagents)
    if (!toolUseContext.agentId) {
      headlessProfilerCheckpoint('query_started')
    }

    // Initialize or increment query chain tracking
    const queryTracking = toolUseContext.queryTracking
      ? {
          chainId: toolUseContext.queryTracking.chainId,
          depth: toolUseContext.queryTracking.depth + 1,
        }
      : {
          chainId: deps.uuid(),
          depth: 0,
        }

    const queryChainIdForAnalytics =
      queryTracking.chainId as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS

    toolUseContext = {
      ...toolUseContext,
      queryTracking,
    }
    const traceQueryLoopStateSnapshot = ({
      lastEvent,
      snapshotMessages = messages,
      finalGateState = null,
      gateState,
    }: {
      lastEvent: string
      snapshotMessages?: readonly Message[]
      finalGateState?: string | null
      gateState?: DsxuQueryLoopGateState | null
    }) => {
      const loopAppState = toolUseContext.getAppState()
      traceDsxuLifecycle(
        'query_loop_state_snapshot',
        buildDsxuQueryLoopStateTraceSnapshot({
          turnId: queryTracking.chainId,
          turnCount,
          transition: state.transition,
          lastEvent,
          lastEventTime: new Date().toISOString(),
          pendingToolUseSummary,
          messages: snapshotMessages,
          permissionMode: loopAppState.toolPermissionContext?.mode,
          tasks: loopAppState.tasks as Record<string, unknown> | undefined,
          finalGateState,
          gateState,
        }),
      )
    }
    traceQueryLoopStateSnapshot({
      lastEvent: 'iteration_start',
    })

    let messagesForQuery = [...getMessagesAfterCompactBoundary(messages)]

    let tracking = autoCompactTracking

    // Enforce per-message budget on aggregate tool result size. Runs BEFORE
    // microcompact -?cached MC operates purely by tool_use_id (never inspects
    // content), so content replacement is invisible to it and the two compose
    // cleanly. No-ops when contentReplacementState is undefined (feature off).
    // Persist only for querySources that read records back on resume: agentId
    // routes to sidechain file (AgentTool resume) or session file (/resume).
    // Ephemeral runForkedAgent callers (agent_summary etc.) don't persist.
    const persistReplacements =
      querySource.startsWith('agent:') ||
      querySource.startsWith('repl_main_thread')
    messagesForQuery = await applyToolResultBudget(
      messagesForQuery,
      toolUseContext.contentReplacementState,
      persistReplacements
        ? records =>
            void recordContentReplacement(
              records,
              toolUseContext.agentId,
            ).catch(logError)
        : undefined,
      new Set(
        toolUseContext.options.tools
          .filter(t => !Number.isFinite(t.maxResultSizeChars))
          .map(t => t.name),
      ),
    )

    // Apply snip before microcompact (both may run -?they are not mutually exclusive).
    // snipTokensFreed is plumbed to autocompact so its threshold check reflects
    // what snip removed; tokenCountWithEstimation alone can't see it (reads usage
    // from the protected-tail assistant, which survives snip unchanged).
    let snipTokensFreed = 0
    if (feature('HISTORY_SNIP')) {
      queryCheckpoint('query_snip_start')
      const snipResult = snipModule!.snipCompactIfNeeded(messagesForQuery)
      messagesForQuery = snipResult.messages
      snipTokensFreed = snipResult.tokensFreed
      if (snipResult.boundaryMessage) {
        yield snipResult.boundaryMessage
      }
      queryCheckpoint('query_snip_end')
    }

    // Apply microcompact before autocompact
    queryCheckpoint('query_microcompact_start')
    const microcompactResult = await deps.microcompact(
      messagesForQuery,
      toolUseContext,
      querySource,
    )
    messagesForQuery = microcompactResult.messages
    // For cached microcompact (cache editing), defer boundary message until after
    // the API response so we can use actual cache_deleted_input_tokens.
    // Gated behind feature() so the string is eliminated from external builds.
    const pendingCacheEdits = feature('CACHED_MICROCOMPACT')
      ? microcompactResult.compactionInfo?.pendingCacheEdits
      : undefined
    queryCheckpoint('query_microcompact_end')

    // Project the collapsed context view and maybe commit more collapses.
    // Runs BEFORE autocompact so that if collapse gets us under the
    // autocompact threshold, autocompact is a no-op and we keep granular
    // context instead of a single summary.
    //
    // Nothing is yielded -?the collapsed view is a read-time projection
    // over the REPL's full history. Summary messages live in the collapse
    // store, not the REPL array. This is what makes collapses persist
    // across turns: projectView() replays the commit log on every entry.
    // Within a turn, the view flows forward via state.messages at the
    // continue site (query.ts:1192), and the next projectView() no-ops
    // because the archived messages are already gone from its input.
    if (feature('CONTEXT_COLLAPSE') && contextCollapse) {
      const collapseResult = await contextCollapse.applyCollapsesIfNeeded(
        messagesForQuery,
        toolUseContext,
        querySource,
      )
      messagesForQuery = collapseResult.messages
    }

    const contextBudgetContext = buildDsxuContextBudgetSystemContext({
      tokenUsage: Math.max(0, tokenCountWithEstimation(messagesForQuery) - snipTokensFreed),
      model: toolUseContext.options.mainLoopModel,
      postCompact: tracking?.compacted === true,
    })
    const fullSystemPrompt = asSystemPrompt(
      appendSystemContext(systemPrompt, {
        ...systemContext,
        'Context Window & Hygiene': contextBudgetContext,
        ...(modelRouteEvidence.length > 0
          ? { 'DSXU Model Route Evidence': modelRouteEvidence[modelRouteEvidence.length - 1] }
          : {}),
      }),
    )

    queryCheckpoint('query_autocompact_start')
    const { compactionResult, consecutiveFailures } = await deps.autocompact(
      messagesForQuery,
      toolUseContext,
      {
        systemPrompt,
        userContext,
        systemContext,
        toolUseContext,
        forkContextMessages: messagesForQuery,
      },
      querySource,
      tracking,
      snipTokensFreed,
    )
    queryCheckpoint('query_autocompact_end')

    if (compactionResult) {
      const {
        preCompactTokenCount,
        postCompactTokenCount,
        truePostCompactTokenCount,
        compactionUsage,
      } = compactionResult

      logEvent('tengu_auto_compact_succeeded', {
        originalMessageCount: messages.length,
        compactedMessageCount:
          compactionResult.summaryMessages.length +
          compactionResult.attachments.length +
          compactionResult.hookResults.length,
        preCompactTokenCount,
        postCompactTokenCount,
        truePostCompactTokenCount,
        compactionInputTokens: compactionUsage?.input_tokens,
        compactionOutputTokens: compactionUsage?.output_tokens,
        compactionCacheReadTokens:
          compactionUsage?.cache_read_input_tokens ?? 0,
        compactionCacheCreationTokens:
          compactionUsage?.cache_creation_input_tokens ?? 0,
        compactionTotalTokens: compactionUsage
          ? compactionUsage.input_tokens +
            (compactionUsage.cache_creation_input_tokens ?? 0) +
            (compactionUsage.cache_read_input_tokens ?? 0) +
            compactionUsage.output_tokens
          : 0,

        queryChainId: queryChainIdForAnalytics,
        queryDepth: queryTracking.depth,
      })

      // task_budget: capture pre-compact final context window before
      // messagesForQuery is replaced with postCompactMessages below.
      // iterations[-1] is the authoritative final window (post server tool
      // loops); see #304930.
      if (params.taskBudget) {
        const preCompactContext =
          finalContextTokensFromLastResponse(messagesForQuery)
        taskBudgetRemaining = Math.max(
          0,
          (taskBudgetRemaining ?? params.taskBudget.total) - preCompactContext,
        )
      }

      // Reset on every compact so turnCounter/turnId reflect the MOST RECENT
      // compact. recompactionInfo (autoCompact.ts:190) already captured the
      // old values for turnsSincePreviousCompact/previousCompactTurnId before
      // the call, so this reset doesn't lose those.
      tracking = {
        compacted: true,
        turnId: deps.uuid(),
        turnCounter: 0,
        consecutiveFailures: 0,
      }

      const postCompactMessages = buildPostCompactMessages(compactionResult)

      for (const message of postCompactMessages) {
        yield message
      }
      traceQueryLoopStateSnapshot({
        lastEvent: 'recovery_gate_advisory',
        snapshotMessages: postCompactMessages,
        gateState: {
          owner: 'query_loop',
          gateId: 'dsxu_autocompact_recovery_snapshot',
          gateKind: 'recovery',
          gateClass: 'RECOVERY_BLOCK',
          blocked: false,
          completionBlocked: true,
          nextAction: 'continue_with_compact_recovery_snapshot',
        },
      })

      // Continue on with the current query call using the post compact messages
      messagesForQuery = postCompactMessages
    } else if (consecutiveFailures !== undefined) {
      // Autocompact failed -?propagate failure count so the circuit breaker
      // can stop retrying on the next iteration.
      tracking = {
        ...(tracking ?? { compacted: false, turnId: '', turnCounter: 0 }),
        consecutiveFailures,
      }
    }

    //TODO: no need to set toolUseContext.messages during set-up since it is updated here
    const tailToolResultRecoveryCursor =
      buildDsxuTailToolResultRecoveryCursor(messagesForQuery)
    if (tailToolResultRecoveryCursor) {
      messagesForQuery = [
        ...messagesForQuery,
        tailToolResultRecoveryCursor.nudge,
      ]
      traceQueryLoopStateSnapshot({
        lastEvent: 'recovery_gate_advisory',
        snapshotMessages: messagesForQuery,
        gateState: tailToolResultRecoveryCursor.gateState,
      })
    }

    toolUseContext = {
      ...toolUseContext,
      messages: messagesForQuery,
    }

    const assistantMessages: AssistantMessage[] = []
    const toolResults: (UserMessage | AttachmentMessage)[] = []
    // @see https://docs.dsxu.com/en/docs/build-with-dsxu/tool-use
    // Note: stop_reason === 'tool_use' is unreliable -- it's not always set correctly.
    // Set during streaming whenever a tool_use block arrives -?the sole
    // loop-exit signal. If false after streaming, we're done (modulo stop-hook retry).
    const toolUseBlocks: ToolUseBlock[] = []
    let needsFollowUp = false

    queryCheckpoint('query_setup_start')
    const useStreamingToolExecution = config.gates.streamingToolExecution
    let streamingToolExecutor = useStreamingToolExecution
      ? new StreamingToolExecutor(
          toolUseContext.options.tools,
          canUseTool,
          toolUseContext,
        )
      : null

    const appState = toolUseContext.getAppState()
    const permissionMode = appState.toolPermissionContext.mode
    let currentModel = getRuntimeMainLoopModel({
      permissionMode,
      mainLoopModel: toolUseContext.options.mainLoopModel,
      exceeds200kTokens:
        permissionMode === 'plan' &&
        doesMostRecentAssistantMessageExceed200k(messagesForQuery),
    })
    try {
      recordDSXUQueryPromptPrefixCacheEvidence({
        systemPrompt: fullSystemPrompt,
        workflowKind: routeInput.workflowKind,
        routeReason: routeDecision.reason,
        model: currentModel,
        querySource,
        turnCount,
        traceLifecycle: traceDsxuLifecycle,
      })
    } catch (error) {
      traceDsxuLifecycle('prompt_prefix_cache_evidence_failed', {
        error: error instanceof Error ? error.message : String(error),
        querySource,
        turnCount,
      })
    }

    queryCheckpoint('query_setup_end')

    // Create fetch wrapper once per query session to avoid memory retention.
    // Each call to createDumpPromptsFetch creates a closure that captures the request body.
    // Creating it once means only the latest request body is retained (~700KB),
    // instead of all request bodies from the session (~500MB for long sessions).
    // Note: agentId is effectively constant during a query() call - it only changes
    // between queries (e.g., /clear command or session resume).
    const dumpPromptsFetch = config.gates.isAnt
      ? createDumpPromptsFetch(toolUseContext.agentId ?? config.sessionId)
      : undefined

    // Block if we've hit the hard blocking limit (only applies when auto-compact is OFF)
    // This reserves space so users can still run /compact manually
    // Skip this check if compaction just happened - the compaction result is already
    // validated to be under the threshold, and tokenCountWithEstimation would use
    // stale input_tokens from kept messages that reflect pre-compaction context size.
    // Same staleness applies to snip: subtract snipTokensFreed (otherwise we'd
    // falsely block in the window where snip brought us under autocompact threshold
    // but the stale usage is still above blocking limit -?before this PR that
    // window never existed because autocompact always fired on the stale count).
    // Also skip for compact/session_memory queries -?these are forked agents that
    // inherit the full conversation and would deadlock if blocked here (the compact
    // agent needs to run to REDUCE the token count).
    // Also skip when reactive compact is enabled and automatic compaction is
    // allowed -?the preempt's synthetic error returns before the API call,
    // so reactive compact would never see a prompt-too-long to react to.
    // Widened to walrus so RC can act as fallback when proactive fails.
    //
    // Same skip for context-collapse: its recoverFromOverflow drains
    // staged collapses on a REAL API 413, then falls through to
    // reactiveCompact. A synthetic preempt here would return before the
    // API call and starve both recovery paths. The isAutoCompactEnabled()
    // conjunct preserves the user's explicit "no automatic anything"
    // config -?if they set DISABLE_AUTO_COMPACT, they get the preempt.
    let collapseOwnsIt = false
    if (feature('CONTEXT_COLLAPSE')) {
      collapseOwnsIt =
        (contextCollapse?.isContextCollapseEnabled() ?? false) &&
        isAutoCompactEnabled()
    }
    // Hoist media-recovery gate once per turn. Withholding (inside the
    // stream loop) and recovery (after) must agree; CACHED_MAY_BE_STALE can
    // flip during the 5-30s stream, and withhold-without-recover would eat
    // the message. PTL doesn't hoist because its withholding is ungated -?    // it predates the experiment and is already the control-arm baseline.
    const mediaRecoveryEnabled =
      reactiveCompact?.isReactiveCompactEnabled() ?? false
    if (
      !compactionResult &&
      querySource !== 'compact' &&
      querySource !== 'session_memory' &&
      !(
        reactiveCompact?.isReactiveCompactEnabled() && isAutoCompactEnabled()
      ) &&
      !collapseOwnsIt
    ) {
      const { isAtBlockingLimit } = calculateTokenWarningState(
        tokenCountWithEstimation(messagesForQuery) - snipTokensFreed,
        toolUseContext.options.mainLoopModel,
      )
      if (isAtBlockingLimit) {
        yield createAssistantAPIErrorMessage({
          content: PROMPT_TOO_LONG_ERROR_MESSAGE,
          error: 'invalid_request',
        })
        return { reason: 'blocking_limit' }
      }
    }

    let attemptWithFallback = true

    queryCheckpoint('query_api_loop_start')
    try {
      while (attemptWithFallback) {
        attemptWithFallback = false
        try {
          let streamingFallbackOccured = false
          queryCheckpoint('query_api_streaming_start')
          const stopModelWaitTrace = startDsxuModelWaitTrace({
            model: currentModel,
            queryDepth: queryTracking.depth,
            querySource,
            turnCount,
            transitionReason: state.transition?.reason,
            latestToolState: getLatestDsxuToolStateForTrace(messagesForQuery),
            messagesForQuery: messagesForQuery.length,
          })
          const providerResumeReplayPreflight =
            buildDsxuProviderResumeReplayPreflightTrace(
              messagesForQuery,
              querySource,
              currentModel,
            )
          if (providerResumeReplayPreflight) {
            traceDsxuLifecycle(
              'provider_resume_replay_preflight',
              providerResumeReplayPreflight,
            )
          }
          try {
            for await (const message of deps.callModel({
              messages: prependUserContext(messagesForQuery, userContext),
              systemPrompt: fullSystemPrompt,
              thinkingConfig: toolUseContext.options.thinkingConfig,
              tools: toolUseContext.options.tools,
              signal: toolUseContext.abortController.signal,
              options: {
                async getToolPermissionContext() {
                  const appState = toolUseContext.getAppState()
                  return appState.toolPermissionContext
                },
                model: currentModel,
                ...(config.gates.fastModeEnabled && {
                  fastMode: appState.fastMode,
                }),
                toolChoice: undefined,
                isNonInteractiveSession:
                  toolUseContext.options.isNonInteractiveSession,
                fallbackModel,
                onStreamingFallback: () => {
                  streamingFallbackOccured = true
                },
                querySource,
                agents: toolUseContext.options.agentDefinitions.activeAgents,
                allowedAgentTypes:
                  toolUseContext.options.agentDefinitions.allowedAgentTypes,
                hasAppendSystemPrompt:
                  !!toolUseContext.options.appendSystemPrompt,
                maxOutputTokensOverride,
                fetchOverride: dumpPromptsFetch,
                mcpTools: appState.mcp.tools,
                hasPendingMcpServers: appState.mcp.clients.some(
                  c => c.type === 'pending',
                ),
                queryTracking,
                effortValue: appState.effortValue,
                advisorModel: appState.advisorModel,
                skipCacheWrite,
                agentId: toolUseContext.agentId,
                dsxuRouteInput: routeInput,
                addNotification: toolUseContext.addNotification,
                ...(params.taskBudget && {
                  taskBudget: {
                    total: params.taskBudget.total,
                    ...(taskBudgetRemaining !== undefined && {
                      remaining: taskBudgetRemaining,
                    }),
                  },
                }),
              },
            })) {
            // We won't use the tool_calls from the first attempt
            // We could.. but then we'd have to merge assistant messages
            // with different ids and double up on full the tool_results
            if (streamingFallbackOccured) {
              // Yield tombstones for orphaned messages so they're removed from UI and transcript.
              // These partial messages (especially thinking blocks) have invalid signatures
              // that would cause "thinking blocks cannot be modified" API errors.
              for (const msg of assistantMessages) {
                yield { type: 'tombstone' as const, message: msg }
              }
              logEvent('tengu_orphaned_messages_tombstoned', {
                orphanedMessageCount: assistantMessages.length,
                queryChainId: queryChainIdForAnalytics,
                queryDepth: queryTracking.depth,
              })

              assistantMessages.length = 0
              toolResults.length = 0
              toolUseBlocks.length = 0
              needsFollowUp = false

              // Discard pending results from the failed streaming attempt and create
              // a fresh executor. This prevents orphan tool_results (with old tool_use_ids)
              // from being yielded after the fallback response arrives.
              if (streamingToolExecutor) {
                streamingToolExecutor.discard()
                streamingToolExecutor = new StreamingToolExecutor(
                  toolUseContext.options.tools,
                  canUseTool,
                  toolUseContext,
                )
              }
            }
            // Backfill tool_use inputs on a cloned message before yield so
            // SDK stream output and transcript serialization see legacy/derived
            // fields. The original `message` is left untouched for
            // assistantMessages.push below -?it flows back to the API and
            // mutating it would break prompt caching (byte mismatch).
            let yieldMessage: typeof message = message
            if (message.type === 'assistant') {
              const content = getDsxuMessageContentArray(message)
              let clonedContent: typeof message.message.content | undefined
              for (let i = 0; i < content.length; i++) {
                const block = content[i]
                if (
                  isDsxuToolUseBlock(block) &&
                  typeof block.input === 'object' &&
                  block.input !== null
                ) {
                  const tool = findToolByName(
                    toolUseContext.options.tools,
                    block.name,
                  )
                  if (tool?.backfillObservableInput) {
                    const originalInput = block.input as Record<string, unknown>
                    const inputCopy = { ...originalInput }
                    tool.backfillObservableInput(inputCopy)
                    // Only yield a clone when backfill ADDED fields; skip if
                    // it only OVERWROTE existing ones (e.g. file tools
                    // expanding file_path). Overwrites change the serialized
                    // transcript and break VCR fixture hashes on resume,
                    // while adding nothing the SDK stream needs -?hooks get
                    // the expanded path via toolExecution.ts separately.
                    const addedFields = Object.keys(inputCopy).some(
                      k => !(k in originalInput),
                    )
                    if (addedFields) {
                      clonedContent ??= [...message.message.content]
                      clonedContent[i] = { ...block, input: inputCopy }
                    }
                  }
                }
              }
              if (clonedContent) {
                yieldMessage = {
                  ...message,
                  message: { ...message.message, content: clonedContent },
                }
              }
            }
            // Withhold recoverable errors (prompt-too-long, max-output-tokens)
            // until we know whether recovery (collapse drain / reactive
            // compact / truncation retry) can succeed. Still pushed to
            // assistantMessages so the recovery checks below find them.
            // Either subsystem's withhold is sufficient -?they're
            // independent so turning one off doesn't break the other's
            // recovery path.
            //
            // feature() only works in if/ternary conditions (bun:bundle
            // tree-shaking constraint), so the collapse check is nested
            // rather than composed.
            let withheld = false
            if (feature('CONTEXT_COLLAPSE')) {
              if (
                contextCollapse?.isWithheldPromptTooLong(
                  message,
                  isPromptTooLongMessage,
                  querySource,
                )
              ) {
                withheld = true
              }
            }
            if (reactiveCompact?.isWithheldPromptTooLong(message)) {
              withheld = true
            }
            if (
              mediaRecoveryEnabled &&
              reactiveCompact?.isWithheldMediaSizeError(message)
            ) {
              withheld = true
            }
            if (isWithheldMaxOutputTokens(message)) {
              withheld = true
            }
            if (!withheld) {
              yield yieldMessage
            }
            if (message.type === 'assistant') {
              assistantMessages.push(message)

              const msgToolUseBlocks = collectToolUseBlocksFromMessage(message)
              if (msgToolUseBlocks.length > 0) {
                toolUseBlocks.push(...msgToolUseBlocks)
                needsFollowUp = true
                traceDsxuLifecycle('query_assistant_tool_use', {
                  toolUseIDs: msgToolUseBlocks.map(block => block.id),
                  toolNames: msgToolUseBlocks.map(block => block.name),
                  streamingToolExecution: !!streamingToolExecutor,
                })
              }

              if (
                streamingToolExecutor &&
                !toolUseContext.abortController.signal.aborted
              ) {
                for (const toolBlock of msgToolUseBlocks) {
                  streamingToolExecutor.addTool(
                    toolBlock,
                    message,
                    msgToolUseBlocks,
                  )
                }
              }
            }

            if (
              streamingToolExecutor &&
              !toolUseContext.abortController.signal.aborted
            ) {
              for (const result of streamingToolExecutor.getCompletedResults()) {
                if (result.message) {
                  traceDsxuLifecycle('query_streaming_tool_update', {
                    messageType: result.message.type,
                  })
                  yield result.message
                  toolResults.push(
                    ...normalizeToolUpdateUserResults(
                      result.message,
                      toolUseContext,
                    ),
                  )
                }
              }
            }
            }
          } finally {
            stopModelWaitTrace({
              assistantMessages: assistantMessages.length,
              toolUseBlocks: toolUseBlocks.length,
              needsFollowUp,
              aborted: toolUseContext.abortController.signal.aborted,
            })
          }
          queryCheckpoint('query_api_streaming_end')

          // Yield deferred microcompact boundary message using actual API-reported
          // token deletion count instead of client-side estimates.
          // Entire block gated behind feature() so the excluded string
          // is eliminated from external builds.
          if (feature('CACHED_MICROCOMPACT') && pendingCacheEdits) {
            const lastAssistant = assistantMessages.at(-1)
            // The API field is cumulative/sticky across requests, so we
            // subtract the baseline captured before this request to get the delta.
            const usage = lastAssistant?.message.usage
            const cumulativeDeleted = usage
              ? ((usage as unknown as Record<string, number>)
                  .cache_deleted_input_tokens ?? 0)
              : 0
            const deletedTokens = Math.max(
              0,
              cumulativeDeleted - pendingCacheEdits.baselineCacheDeletedTokens,
            )
            if (deletedTokens > 0) {
              yield createMicrocompactBoundaryMessage(
                pendingCacheEdits.trigger,
                0,
                deletedTokens,
                pendingCacheEdits.deletedToolIds,
                [],
              )
            }
          }
        } catch (innerError) {
          if (innerError instanceof FallbackTriggeredError && fallbackModel) {
            // Fallback was triggered - switch model and retry
            currentModel = fallbackModel
            attemptWithFallback = true

            // Clear assistant messages since we'll retry the entire request
            yield* yieldMissingToolResultBlocks(
              assistantMessages,
              'Model fallback triggered',
            )
            assistantMessages.length = 0
            toolResults.length = 0
            toolUseBlocks.length = 0
            needsFollowUp = false

            // Discard pending results from the failed attempt and create a
            // fresh executor. This prevents orphan tool_results (with old
            // tool_use_ids) from leaking into the retry.
            if (streamingToolExecutor) {
              streamingToolExecutor.discard()
              streamingToolExecutor = new StreamingToolExecutor(
                toolUseContext.options.tools,
                canUseTool,
                toolUseContext,
              )
            }

            // Update tool use context with new model
            toolUseContext.options.mainLoopModel = fallbackModel

            // Thinking signatures are model-bound: replaying a protected-thinking
            // block to an unprotected fallback can 400.
            // Strip before retry so the fallback model gets clean history.
            if (process.env.USER_TYPE === 'ant') {
              messagesForQuery = stripSignatureBlocks(messagesForQuery)
            }

            // Log the fallback event
            logEvent('tengu_model_fallback_triggered', {
              original_model:
                innerError.originalModel as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
              fallback_model:
                fallbackModel as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
              entrypoint:
                'cli' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
              queryChainId: queryChainIdForAnalytics,
              queryDepth: queryTracking.depth,
            })

            // Yield system message about fallback -?use 'warning' level so
            // users see the notification without needing verbose mode
            yield createSystemMessage(
              `Switched to ${renderModelName(innerError.fallbackModel)} due to high demand for ${renderModelName(innerError.originalModel)}`,
              'warning',
            )

            continue
          }
          throw innerError
        }
      }
    } catch (error) {
      logError(error)
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      traceDsxuLifecycle('query_error', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        assistantMessages: assistantMessages.length,
        toolUses: collectAssistantToolUseBlocks(assistantMessages).length,
      })
      logEvent('tengu_query_error', {
        assistantMessages: assistantMessages.length,
        toolUses: collectAssistantToolUseBlocks(assistantMessages).length,

        queryChainId: queryChainIdForAnalytics,
        queryDepth: queryTracking.depth,
      })

      // Handle image size/resize errors with user-friendly messages
      if (
        error instanceof ImageSizeError ||
        error instanceof ImageResizeError
      ) {
        yield createAssistantAPIErrorMessage({
          content: error.message,
        })
        return { reason: 'image_error' }
      }

      // Generally queryModelWithStreaming should not throw errors but instead
      // yield them as synthetic assistant messages. However if it does throw
      // due to a bug, we may end up in a state where we have already emitted
      // a tool_use block but will stop before emitting the tool_result.
      yield* yieldMissingToolResultBlocks(assistantMessages, errorMessage)

      // Surface the real error instead of a misleading "[Request interrupted
      // by user]" -?this path is a model/runtime failure, not a user action.
      // SDK consumers were seeing phantom interrupts on e.g. Node 18's missing
      // Array.prototype.with(), masking the actual cause.
      yield createAssistantAPIErrorMessage({
        content: errorMessage,
      })

      // To help track down bugs, log loudly for ants
      logAntError('Query error', error)
      return { reason: 'model_error', error }
    }

    // Execute post-sampling hooks after model response is complete
    if (assistantMessages.length > 0) {
      void executePostSamplingHooks(
        [...messagesForQuery, ...assistantMessages],
        systemPrompt,
        userContext,
        systemContext,
        toolUseContext,
        querySource,
      )
    }

    const untrackedAssistantToolUseBlocks = collectAssistantToolUseBlocks(
      assistantMessages,
    ).filter(block => !toolUseBlocks.some(tracked => tracked.id === block.id))
    if (untrackedAssistantToolUseBlocks.length > 0) {
      toolUseBlocks.push(...untrackedAssistantToolUseBlocks)
      needsFollowUp = true
      logEvent('dsxu_untracked_assistant_tool_use_recovered', {
        recoveredToolUses: untrackedAssistantToolUseBlocks.length,
        queryChainId: queryChainIdForAnalytics,
        queryDepth: queryTracking.depth,
      })
      logError(
        new Error(
          `DSXU recovered ${untrackedAssistantToolUseBlocks.length} assistant tool_use block(s) before turn routing.`,
        ),
      )
    }

    // We need to handle a streaming abort before anything else.
    // When using streamingToolExecutor, we must consume getRemainingResults() so the
    // executor can generate synthetic tool_result blocks for queued/in-progress tools.
    // Without this, tool_use blocks would lack matching tool_result blocks.
    if (toolUseContext.abortController.signal.aborted) {
      const abortedToolResults: (UserMessage | AttachmentMessage)[] = []
      if (streamingToolExecutor) {
        // Consume remaining results - executor generates synthetic tool_results for
        // aborted tools since it checks the abort signal in executeTool()
        for await (const update of streamingToolExecutor.getRemainingResults()) {
          if (update.message) {
            yield update.message
            abortedToolResults.push(
              ...normalizeToolUpdateUserResults(
                update.message,
                toolUseContext,
              ),
            )
          }
        }
      } else {
        const interruptionToolResults = [
          ...yieldMissingToolResultBlocks(
            assistantMessages,
            'Interrupted by user',
          ),
        ]
        for (const interruptionToolResult of interruptionToolResults) {
          yield interruptionToolResult
          abortedToolResults.push(interruptionToolResult)
        }
      }
      const missingAbortToolResults = createMissingToolResultMessagesForBatch(
        toolUseBlocks,
        assistantMessages,
        abortedToolResults,
      )
      for (const missingAbortToolResult of missingAbortToolResults) {
        yield missingAbortToolResult
      }
      traceQueryLoopStateSnapshot({
        lastEvent: 'abort_gate_blocked',
        snapshotMessages: [
          ...messagesForQuery,
          ...assistantMessages,
          ...abortedToolResults,
          ...missingAbortToolResults,
        ],
        gateState: {
          owner: 'query_loop',
          gateId: 'dsxu_abort_streaming_gate',
          gateKind: 'recovery',
          gateClass: 'RECOVERY_BLOCK',
          blocked: true,
          completionBlocked: true,
          nextAction: 'surface_cancelled_state_and_stop_current_turn',
        },
      })
      // chicago MCP: auto-unhide + lock release on interrupt. Same cleanup
      // as the natural turn-end path in stopHooks.ts. Main thread only -?      // see stopHooks.ts for the subagent-releasing-main's-lock rationale.
      if (feature('CHICAGO_MCP') && !toolUseContext.agentId) {
        try {
          const { cleanupComputerUseAfterTurn } = await import(
            './utils/computerUse/cleanup.js'
          )
          await cleanupComputerUseAfterTurn(toolUseContext)
        } catch {
          // Failures are silent -?this is dogfooding cleanup, not critical path
        }
      }

      // Skip the interruption message for submit-interrupts -?the queued
      // user message that follows provides sufficient context.
      if (toolUseContext.abortController.signal.reason !== 'interrupt') {
        yield createUserInterruptionMessage({
          toolUse: false,
        })
      }
      return { reason: 'aborted_streaming' }
    }

    // Yield tool use summary from previous turn; the lightweight route resolves during model streaming.
    if (pendingToolUseSummary) {
      const summary = await pendingToolUseSummary
      if (summary) {
        yield summary
      }
    }

    if (!needsFollowUp) {
      const lastMessage = assistantMessages.at(-1)

      // Prompt-too-long recovery: the streaming loop withheld the error
      // (see withheldByCollapse / withheldByReactive above). Try collapse
      // drain first (cheap, keeps granular context), then reactive compact
      // (full summary). Single-shot on each -?if a retry still 413's,
      // the next stage handles it or the error surfaces.
      const isWithheld413 =
        lastMessage?.type === 'assistant' &&
        lastMessage.isApiErrorMessage &&
        isPromptTooLongMessage(lastMessage)
      // Media-size rejections (image/PDF/many-image) are recoverable via
      // reactive compact's strip-retry. Unlike PTL, media errors skip the
      // collapse drain -?collapse doesn't strip images. mediaRecoveryEnabled
      // is the hoisted gate from before the stream loop (same value as the
      // withholding check -?these two must agree or a withheld message is
      // lost). If the oversized media is in the preserved tail, the
      // post-compact turn will media-error again; hasAttemptedReactiveCompact
      // prevents a spiral and the error surfaces.
      const isWithheldMedia =
        mediaRecoveryEnabled &&
        reactiveCompact?.isWithheldMediaSizeError(lastMessage)
      if (isWithheld413) {
        // First: drain all staged context-collapses. Gated on the PREVIOUS
        // transition not being collapse_drain_retry -?if we already drained
        // and the retry still 413'd, fall through to reactive compact.
        if (
          feature('CONTEXT_COLLAPSE') &&
          contextCollapse &&
          state.transition?.reason !== 'collapse_drain_retry'
        ) {
          const drained = contextCollapse.recoverFromOverflow(
            messagesForQuery,
            querySource,
          )
          if (drained.committed > 0) {
            const next: State = {
              messages: drained.messages,
              toolUseContext,
              autoCompactTracking: tracking,
              maxOutputTokensRecoveryCount,
              hasAttemptedReactiveCompact,
              maxOutputTokensOverride: undefined,
              pendingToolUseSummary: undefined,
              stopHookActive: undefined,
              turnCount,
              transition: {
                reason: 'collapse_drain_retry',
                committed: drained.committed,
              },
            }
            state = next
            continue
          }
        }
      }
      if ((isWithheld413 || isWithheldMedia) && reactiveCompact) {
        const compacted = await reactiveCompact.tryReactiveCompact({
          hasAttempted: hasAttemptedReactiveCompact,
          querySource,
          aborted: toolUseContext.abortController.signal.aborted,
          messages: messagesForQuery,
          cacheSafeParams: {
            systemPrompt,
            userContext,
            systemContext,
            toolUseContext,
            forkContextMessages: messagesForQuery,
          },
        })

        if (compacted) {
          // task_budget: same carryover as the proactive path above.
          // messagesForQuery still holds the pre-compact array here (the
          // 413-failed attempt's input).
          if (params.taskBudget) {
            const preCompactContext =
              finalContextTokensFromLastResponse(messagesForQuery)
            taskBudgetRemaining = Math.max(
              0,
              (taskBudgetRemaining ?? params.taskBudget.total) -
                preCompactContext,
            )
          }

          const postCompactMessages = buildPostCompactMessages(compacted)
          for (const msg of postCompactMessages) {
            yield msg
          }
          const next: State = {
            messages: postCompactMessages,
            toolUseContext,
            autoCompactTracking: undefined,
            maxOutputTokensRecoveryCount,
            hasAttemptedReactiveCompact: true,
            maxOutputTokensOverride: undefined,
            pendingToolUseSummary: undefined,
            stopHookActive: undefined,
            turnCount,
            transition: { reason: 'reactive_compact_retry' },
          }
          state = next
          continue
        }

        // No recovery -?surface the withheld error and exit. Do NOT fall
        // through to stop hooks: the model never produced a valid response,
        // so hooks have nothing meaningful to evaluate. Running stop hooks
        // on prompt-too-long creates a death spiral: error -?hook blocking
        // -?retry -?error -?-?(the hook injects more tokens each cycle).
        yield lastMessage
        void executeStopFailureHooks(lastMessage, toolUseContext)
        return { reason: isWithheldMedia ? 'image_error' : 'prompt_too_long' }
      } else if (feature('CONTEXT_COLLAPSE') && isWithheld413) {
        // reactiveCompact compiled out but contextCollapse withheld and
        // couldn't recover (staged queue empty/stale). Surface. Same
        // early-return rationale -?don't fall through to stop hooks.
        yield lastMessage
        void executeStopFailureHooks(lastMessage, toolUseContext)
        return { reason: 'prompt_too_long' }
      }

      // Check for max_output_tokens and inject recovery message. The error
      // was withheld from the stream above; only surface it if recovery
      // exhausts.
      if (isWithheldMaxOutputTokens(lastMessage)) {
        // Escalating retry: if we used the capped 8k default and hit the
        // limit, retry the SAME request at 64k -?no meta message, no
        // multi-turn dance. This fires once per turn (guarded by the
        // override check), then falls through to multi-turn recovery if
        // 64k also hits the cap.
        // 3P default: false (not validated on Bedrock/Vertex)
        const capEnabled = getFeatureValue_CACHED_MAY_BE_STALE(
          'tengu_otk_slot_v1',
          false,
        )
        if (
          capEnabled &&
          maxOutputTokensOverride === undefined &&
          !process.env.DSXU_CODE_MAX_OUTPUT_TOKENS
        ) {
          logEvent('tengu_max_tokens_escalate', {
            escalatedTo: ESCALATED_MAX_TOKENS,
          })
          traceQueryLoopStateSnapshot({
            lastEvent: 'recovery_gate_blocked',
            snapshotMessages: [...messagesForQuery, ...assistantMessages],
            gateState: {
              owner: 'query_loop',
              gateId: 'max_output_tokens_escalate',
              gateKind: 'recovery',
              gateClass: 'RECOVERY_BLOCK',
              blocked: true,
              completionBlocked: true,
              nextAction: 'retry_same_request_with_escalated_output_tokens',
            },
          })
          const next: State = {
            messages: messagesForQuery,
            toolUseContext,
            autoCompactTracking: tracking,
            maxOutputTokensRecoveryCount,
            hasAttemptedReactiveCompact,
            maxOutputTokensOverride: ESCALATED_MAX_TOKENS,
            pendingToolUseSummary: undefined,
            stopHookActive: undefined,
            turnCount,
            transition: { reason: 'max_output_tokens_escalate' },
          }
          state = next
          continue
        }

        if (maxOutputTokensRecoveryCount < MAX_OUTPUT_TOKENS_RECOVERY_LIMIT) {
          const recoveryMessage = createUserMessage({
            content:
              `Output token limit hit. Resume directly -?no apology, no recap of what you were doing. ` +
              `Pick up mid-thought if that is where the cut happened. Break remaining work into smaller pieces.`,
            isMeta: true,
          })
          traceQueryLoopStateSnapshot({
            lastEvent: 'recovery_gate_blocked',
            snapshotMessages: [
              ...messagesForQuery,
              ...assistantMessages,
              recoveryMessage,
            ],
            gateState: {
              owner: 'query_loop',
              gateId: 'max_output_tokens_recovery',
              gateKind: 'recovery',
              gateClass: 'RECOVERY_BLOCK',
              blocked: true,
              completionBlocked: true,
              nextAction: 'inject_bounded_resume_message',
            },
          })

          const next: State = {
            messages: [
              ...messagesForQuery,
              ...assistantMessages,
              recoveryMessage,
            ],
            toolUseContext,
            autoCompactTracking: tracking,
            maxOutputTokensRecoveryCount: maxOutputTokensRecoveryCount + 1,
            hasAttemptedReactiveCompact,
            maxOutputTokensOverride: undefined,
            pendingToolUseSummary: undefined,
            stopHookActive: undefined,
            turnCount,
            transition: {
              reason: 'max_output_tokens_recovery',
              attempt: maxOutputTokensRecoveryCount + 1,
            },
          }
          state = next
          continue
        }

        // Recovery exhausted -?surface the withheld error now.
        yield lastMessage
      }

      // Skip stop hooks when the last message is an API error (rate limit,
      // prompt-too-long, auth failure, etc.). The model never produced a
      // real response -?hooks evaluating it create a death spiral:
      // error -?hook blocking -?retry -?error -?-?
      if (lastMessage?.isApiErrorMessage) {
        void executeStopFailureHooks(lastMessage, toolUseContext)
        return { reason: 'completed' }
      }

      const stopHookResult = yield* handleStopHooks(
        messagesForQuery,
        assistantMessages,
        systemPrompt,
        userContext,
        systemContext,
        toolUseContext,
        querySource,
        stopHookActive,
      )

      if (stopHookResult.preventContinuation) {
        return { reason: 'stop_hook_prevented' }
      }

      if (stopHookResult.blockingErrors.length > 0) {
        traceQueryLoopStateSnapshot({
          lastEvent: 'recovery_gate_blocked',
          snapshotMessages: [
            ...messagesForQuery,
            ...assistantMessages,
            ...stopHookResult.blockingErrors,
          ],
          gateState: {
            owner: 'query_loop',
            gateId: 'dsxu_stop_hook_blocking_gate',
            gateKind: 'recovery',
            gateClass: 'RECOVERY_BLOCK',
            blocked: true,
            completionBlocked: true,
            nextAction: 'apply_stop_hook_feedback_without_resetting_recovery_guards',
          },
        })
        const next: State = {
          messages: [
            ...messagesForQuery,
            ...assistantMessages,
            ...stopHookResult.blockingErrors,
          ],
          toolUseContext,
          autoCompactTracking: tracking,
          maxOutputTokensRecoveryCount: 0,
          // Preserve the reactive compact guard -?if compact already ran and
          // couldn't recover from prompt-too-long, retrying after a stop-hook
          // blocking error will produce the same result. Resetting to false
          // here caused an infinite loop: compact -?still too long -?error -?          // stop hook blocking -?compact -?-?burning thousands of API calls.
          hasAttemptedReactiveCompact,
          maxOutputTokensOverride: undefined,
          pendingToolUseSummary: undefined,
          stopHookActive: true,
          turnCount,
          transition: { reason: 'stop_hook_blocking' },
        }
        state = next
        continue
      }

      const emptyFinalAnswerNudge =
        buildDsxuEmptyFinalAnswerNudge(assistantMessages)
      if (emptyFinalAnswerNudge) {
        traceQueryLoopStateSnapshot({
          lastEvent: 'final_gate_blocked',
          snapshotMessages: [...messagesForQuery, ...assistantMessages],
          finalGateState: 'dsxu_empty_final_answer_gate',
        })
        state = {
          messages: [
            ...messagesForQuery,
            ...assistantMessages,
            createUserMessage({
              content: emptyFinalAnswerNudge,
              isMeta: true,
            }),
          ],
          toolUseContext,
          autoCompactTracking: tracking,
          maxOutputTokensRecoveryCount: 0,
          hasAttemptedReactiveCompact,
          maxOutputTokensOverride: undefined,
          pendingToolUseSummary: undefined,
          stopHookActive: undefined,
          turnCount,
          transition: { reason: 'dsxu_empty_final_answer_gate' },
        }
        continue
      }

      const intentOnlyFinalNudge =
        buildDsxuIntentOnlyFinalNudge(assistantMessages)
      if (intentOnlyFinalNudge) {
        traceQueryLoopStateSnapshot({
          lastEvent: 'final_gate_blocked',
          snapshotMessages: [...messagesForQuery, ...assistantMessages],
          finalGateState: 'dsxu_intent_only_final_gate',
        })
        state = {
          messages: [
            ...messagesForQuery,
            ...assistantMessages,
            createUserMessage({
              content: intentOnlyFinalNudge,
              isMeta: true,
            }),
          ],
          toolUseContext,
          autoCompactTracking: tracking,
          maxOutputTokensRecoveryCount: 0,
          hasAttemptedReactiveCompact,
          maxOutputTokensOverride: undefined,
          pendingToolUseSummary: undefined,
          stopHookActive: undefined,
          turnCount,
          transition: { reason: 'dsxu_intent_only_final_gate' },
        }
        continue
      }

      const verificationToolAvailable = toolUseContext.options.tools.some(tool =>
        DSXU_VERIFICATION_TOOL_NAMES.has(tool.name),
      )
      const unverifiedMutationFinalGateNudge =
        buildDsxuUnverifiedMutationFinalGateNudge(
          messages,
          assistantMessages,
          verificationToolAvailable,
        )
      if (unverifiedMutationFinalGateNudge) {
        const unverifiedMutationFinalGateMessage = createUserMessage({
          content: unverifiedMutationFinalGateNudge,
          isMeta: true,
        })
        yield unverifiedMutationFinalGateMessage
        traceQueryLoopStateSnapshot({
          lastEvent: 'final_gate_blocked',
          snapshotMessages: [...messagesForQuery, ...assistantMessages],
          finalGateState: 'dsxu_unverified_mutation_final_gate',
        })
        state = {
          messages: [
            ...messagesForQuery,
            ...assistantMessages,
            unverifiedMutationFinalGateMessage,
          ],
          toolUseContext,
          autoCompactTracking: tracking,
          maxOutputTokensRecoveryCount: 0,
          hasAttemptedReactiveCompact,
          maxOutputTokensOverride: undefined,
          pendingToolUseSummary: undefined,
          stopHookActive: undefined,
          turnCount,
          transition: { reason: 'dsxu_unverified_mutation_final_gate' },
        }
        continue
      }

      const agentFinalGateNudge = buildDsxuAgentFinalGateNudge(
        messages,
        assistantMessages,
      )
      if (agentFinalGateNudge) {
        const agentFinalGateMessage = createUserMessage({
          content: agentFinalGateNudge,
          isMeta: true,
        })
        yield agentFinalGateMessage
        traceQueryLoopStateSnapshot({
          lastEvent: 'final_gate_blocked',
          snapshotMessages: [...messagesForQuery, ...assistantMessages],
          finalGateState: 'dsxu_agent_final_gate',
        })
        state = {
          messages: [
            ...messagesForQuery,
            ...assistantMessages,
            agentFinalGateMessage,
          ],
          toolUseContext,
          autoCompactTracking: tracking,
          maxOutputTokensRecoveryCount: 0,
          hasAttemptedReactiveCompact,
          maxOutputTokensOverride: undefined,
          pendingToolUseSummary: undefined,
          stopHookActive: undefined,
          turnCount,
          transition: { reason: 'dsxu_agent_final_gate' },
        }
        continue
      }

      const backgroundTaskFinalGateNudge =
        buildDsxuBackgroundTaskFinalGateNudge(
          assistantMessages,
          toolUseContext.getAppState().tasks as Record<string, unknown>,
        )
      if (backgroundTaskFinalGateNudge) {
        traceQueryLoopStateSnapshot({
          lastEvent: 'final_gate_blocked',
          snapshotMessages: [...messagesForQuery, ...assistantMessages],
          finalGateState: 'dsxu_background_task_final_gate',
        })
        state = {
          messages: [
            ...messagesForQuery,
            ...assistantMessages,
            createUserMessage({
              content: backgroundTaskFinalGateNudge,
              isMeta: true,
            }),
          ],
          toolUseContext,
          autoCompactTracking: tracking,
          maxOutputTokensRecoveryCount: 0,
          hasAttemptedReactiveCompact,
          maxOutputTokensOverride: undefined,
          pendingToolUseSummary: undefined,
          stopHookActive: undefined,
          turnCount,
          transition: { reason: 'dsxu_background_task_final_gate' },
        }
        continue
      }

      if (feature('TOKEN_BUDGET')) {
        const decision = checkTokenBudget(
          budgetTracker!,
          toolUseContext.agentId,
          getCurrentTurnTokenBudget(),
          getTurnOutputTokens(),
        )

        if (decision.action === 'continue') {
          incrementBudgetContinuationCount()
          logForDebugging(
            `Token budget continuation #${decision.continuationCount}: ${decision.pct}% (${decision.turnTokens.toLocaleString()} / ${decision.budget.toLocaleString()})`,
          )
          state = {
            messages: [
              ...messagesForQuery,
              ...assistantMessages,
              createUserMessage({
                content: decision.nudgeMessage,
                isMeta: true,
              }),
            ],
            toolUseContext,
            autoCompactTracking: tracking,
            maxOutputTokensRecoveryCount: 0,
            hasAttemptedReactiveCompact: false,
            maxOutputTokensOverride: undefined,
            pendingToolUseSummary: undefined,
            stopHookActive: undefined,
            turnCount,
            transition: { reason: 'token_budget_continuation' },
          }
          continue
        }

        if (decision.completionEvent) {
          if (decision.completionEvent.diminishingReturns) {
            logForDebugging(
              `Token budget early stop: diminishing returns at ${decision.completionEvent.pct}%`,
            )
          }
          logEvent('tengu_token_budget_completed', {
            ...decision.completionEvent,
            queryChainId: queryChainIdForAnalytics,
            queryDepth: queryTracking.depth,
          })
        }
      }

      if (!toolUseContext.agentId) {
        yield createSystemMessage(
          buildDsxuFinalUsageEvidenceSystemMessage({
            assistantMessages,
            model: routeDecision.model,
            routeReason: routeDecision.reason,
            workflowKind: routeInput.workflowKind,
            role: routeInput.role,
          }),
          'info',
        )
      }

      return { reason: 'completed' }
    }

    let shouldPreventContinuation = false
    let updatedToolUseContext = toolUseContext

    queryCheckpoint('query_tool_execution_start')

    const executionVisibilityNudge = buildDsxuExecutionVisibilityNudge(
      toolUseBlocks,
      assistantMessages,
    )
    if (executionVisibilityNudge) {
      if (streamingToolExecutor) {
        await streamingToolExecutor.discardAndSettle()
      }
      const clearedReadCachePaths =
        clearDsxuReadCacheForBlockedExecutionVisibility(
          toolUseBlocks,
          toolUseContext.readFileState,
        )
      if (clearedReadCachePaths.length > 0) {
        traceDsxuLifecycle('execution_visibility_read_cache_cleared', {
          count: clearedReadCachePaths.length,
        })
      }
      const blockedToolResults =
        createDsxuExecutionVisibilityBlockedToolResultMessage({
          toolUseBlocks,
          assistantMessages,
          nudge: executionVisibilityNudge,
        })
      yield blockedToolResults
      traceQueryLoopStateSnapshot({
        lastEvent: 'tool_scheduling_gate_blocked',
        snapshotMessages: [
          ...messagesForQuery,
          ...assistantMessages,
          blockedToolResults,
        ],
        gateState: {
          owner: 'query_loop',
          gateId: 'dsxu_execution_visibility_gate',
          gateKind: 'tool_scheduling',
          gateClass: 'QUALITY_BLOCK',
          blocked: true,
          completionBlocked: true,
          nextAction: 'write_visible_parallel_tool_intent_brief',
        },
      })
      state = {
        messages: [
          ...messagesForQuery,
          ...assistantMessages,
          blockedToolResults,
          createUserMessage({
            content: executionVisibilityNudge,
            isMeta: true,
          }),
        ],
        toolUseContext,
        autoCompactTracking: tracking,
        maxOutputTokensRecoveryCount: 0,
        hasAttemptedReactiveCompact,
        maxOutputTokensOverride: undefined,
        pendingToolUseSummary: undefined,
        stopHookActive: undefined,
        turnCount,
        transition: { reason: 'dsxu_execution_visibility_gate' },
      }
      continue
    }

    if (streamingToolExecutor) {
      logEvent('tengu_streaming_tool_execution_used', {
        tool_count: toolUseBlocks.length,
        queryChainId: queryChainIdForAnalytics,
        queryDepth: queryTracking.depth,
      })
    } else {
      logEvent('tengu_streaming_tool_execution_not_used', {
        tool_count: toolUseBlocks.length,
        queryChainId: queryChainIdForAnalytics,
        queryDepth: queryTracking.depth,
      })
    }

    const toolUpdates = streamingToolExecutor
      ? streamingToolExecutor.getRemainingResults()
      : runTools(toolUseBlocks, assistantMessages, canUseTool, toolUseContext)

    for await (const update of toolUpdates) {
      if (update.message) {
        traceDsxuLifecycle('query_tool_update', {
          messageType: update.message.type,
        })
        yield update.message

        if (
          update.message.type === 'attachment' &&
          update.message.attachment.type === 'hook_stopped_continuation'
        ) {
          shouldPreventContinuation = true
        }

        toolResults.push(
          ...normalizeToolUpdateUserResults(update.message, toolUseContext),
        )
      }
      if (update.newContext) {
        updatedToolUseContext = {
          ...update.newContext,
          queryTracking,
        }
      }
    }
    queryCheckpoint('query_tool_execution_end')

    const missingToolResultMessages = createMissingToolResultMessagesForBatch(
      toolUseBlocks,
      assistantMessages,
      toolResults,
    )
    if (missingToolResultMessages.length > 0) {
      logEvent('dsxu_orphan_tool_use_tool_result_synthesized', {
        missingToolResults: missingToolResultMessages.length,
        toolUseIDs: toolUseBlocks
          .filter(
            block =>
              !collectToolResultIDs(toolResults).has(block.id),
          )
          .map(block => block.id)
          .join(',') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        queryChainId: queryChainIdForAnalytics,
        queryDepth: queryTracking.depth,
      })
      logError(
        new Error(
          `DSXU synthesized ${missingToolResultMessages.length} missing tool_result block(s) after tool execution completed without results.`,
        ),
      )
      for (const missingToolResultMessage of missingToolResultMessages) {
        yield missingToolResultMessage
        toolResults.push(missingToolResultMessage)
      }
    }

    const postPassGateMessages = [
      ...messagesForQuery,
      ...assistantMessages,
      ...toolResults,
    ]
    const postPassToolBlockHardStopFinal =
      buildDsxuPostPassToolBlockHardStopFinal(postPassGateMessages)
    if (postPassToolBlockHardStopFinal) {
      yield createAssistantMessage({
        content: postPassToolBlockHardStopFinal,
        isVirtual: true,
      })
      const postPassGateText = postPassGateMessages
        .flatMap(message =>
          extractDsxuMessageText(
            (message as { message?: { content?: unknown } }).message?.content,
          ),
        )
        .join('\n')
      const postPassSource = /\btool_blocked_after_pass_marker\b/i.test(
        postPassGateText,
      )
        ? 'pass_marker'
        : 'verified_pass'
      traceQueryLoopStateSnapshot({
        lastEvent: 'post_pass_finalization_gate',
        snapshotMessages: postPassGateMessages,
        gateState: buildDsxuPostPassFinalizationGateState(postPassSource),
      })
      if (!toolUseContext.agentId) {
        yield createSystemMessage(
          buildDsxuFinalUsageEvidenceSystemMessage({
            assistantMessages,
            model: routeDecision.model,
            routeReason: routeDecision.reason,
            workflowKind: routeInput.workflowKind,
            role: routeInput.role,
          }),
          'info',
        )
      }
      return { reason: 'completed' }
    }

    // Generate tool use summary after tool batch completes -?passed to next recursive call
    let nextPendingToolUseSummary:
      | Promise<ToolUseSummaryMessage | null>
      | undefined
    if (
      config.gates.emitToolUseSummaries &&
      toolUseBlocks.length > 0 &&
      !toolUseContext.abortController.signal.aborted &&
      !toolUseContext.agentId // subagents don't surface in mobile UI; skip the lightweight summary call
    ) {
      // Extract the last assistant text block for context
      const lastAssistantMessage = assistantMessages.at(-1)
      let lastAssistantText: string | undefined
      if (lastAssistantMessage) {
        const textBlocks = getDsxuMessageContentArray(lastAssistantMessage).filter(
          block =>
            !!block &&
            typeof block === 'object' &&
            (block as { type?: unknown }).type === 'text',
        )
        if (textBlocks.length > 0) {
          const lastTextBlock = textBlocks.at(-1)
          if (
            lastTextBlock &&
            typeof lastTextBlock === 'object' &&
            'text' in lastTextBlock &&
            typeof (lastTextBlock as { text?: unknown }).text === 'string'
          ) {
            lastAssistantText = (lastTextBlock as { text: string }).text
          }
        }
      }

      // Collect tool info for summary generation
      const toolUseIds = toolUseBlocks.map(block => block.id)
      const toolInfoForSummary = toolUseBlocks.map(block => {
        // Find the corresponding tool result
        const toolResult = toolResults.find(
          result =>
            result.type === 'user' &&
            Array.isArray(result.message.content) &&
            result.message.content.some(
              content =>
                content.type === 'tool_result' &&
                content.tool_use_id === block.id,
            ),
        )
        const resultContent =
          toolResult?.type === 'user' &&
          Array.isArray(toolResult.message.content)
            ? toolResult.message.content.find(
                (c): c is ToolResultBlockParam =>
                  c.type === 'tool_result' && c.tool_use_id === block.id,
              )
            : undefined
        return {
          name: block.name,
          input: block.input,
          output:
            resultContent && 'content' in resultContent
              ? resultContent.content
              : null,
        }
      })

      // Fire off summary generation without blocking the next API call
      nextPendingToolUseSummary = generateToolUseSummary({
        tools: toolInfoForSummary,
        signal: toolUseContext.abortController.signal,
        isNonInteractiveSession: toolUseContext.options.isNonInteractiveSession,
        lastAssistantText,
      })
        .then(summary => {
          if (summary) {
            return createToolUseSummaryMessage(summary, toolUseIds)
          }
          return null
        })
        .catch(() => null)
    }

    // We were aborted during tool calls
    if (toolUseContext.abortController.signal.aborted) {
      // chicago MCP: auto-unhide + lock release when aborted mid-tool-call.
      // This is the most likely Ctrl+C path for CU (e.g. slow screenshot).
      // Main thread only -?see stopHooks.ts for the subagent rationale.
      if (feature('CHICAGO_MCP') && !toolUseContext.agentId) {
        try {
          const { cleanupComputerUseAfterTurn } = await import(
            './utils/computerUse/cleanup.js'
          )
          await cleanupComputerUseAfterTurn(toolUseContext)
        } catch {
          // Failures are silent -?this is dogfooding cleanup, not critical path
        }
      }
      // Skip the interruption message for submit-interrupts -?the queued
      // user message that follows provides sufficient context.
      if (toolUseContext.abortController.signal.reason !== 'interrupt') {
        const abortInterruptionMessage = createUserInterruptionMessage({
          toolUse: true,
        })
        yield abortInterruptionMessage
      }
      traceQueryLoopStateSnapshot({
        lastEvent: 'abort_gate_blocked',
        snapshotMessages: [
          ...messagesForQuery,
          ...assistantMessages,
          ...toolResults,
        ],
        gateState: {
          owner: 'query_loop',
          gateId: 'dsxu_abort_tools_gate',
          gateKind: 'recovery',
          gateClass: 'RECOVERY_BLOCK',
          blocked: true,
          completionBlocked: true,
          nextAction: 'surface_cancelled_tool_state_and_stop_current_turn',
        },
      })
      // Check maxTurns before returning when aborted
      const nextTurnCountOnAbort = turnCount + 1
      if (maxTurns && nextTurnCountOnAbort > maxTurns) {
        yield createAttachmentMessage({
          type: 'max_turns_reached',
          maxTurns,
          turnCount: nextTurnCountOnAbort,
        })
      }
      return { reason: 'aborted_tools' }
    }

    // If a hook indicated to prevent continuation, stop here
    if (shouldPreventContinuation) {
      return { reason: 'hook_stopped' }
    }

    const verifiedPassNudge = shouldInjectVerifiedPassNudge(
      toolResults,
      toolUseBlocks,
      messagesForQuery,
    )
      ? createUserMessage({
          content: buildDsxuVerificationPassNudge([
            ...messagesForQuery,
            ...toolResults,
          ]),
          isMeta: true,
        })
      : null
    const toolStateCursorRecoveryState =
      verifiedPassNudge === null
        ? buildDsxuRecoveryState({
            toolResults,
            toolUseBlocks,
            conversationMessages: messagesForQuery,
          })
        : null
    const toolStateCursorNudgeText =
      toolStateCursorRecoveryState !== null
        ? buildDsxuToolStateCursorNudge(
            toolResults,
            toolUseBlocks,
            messagesForQuery,
          )
        : null
    const toolStateCursorGateState = toolStateCursorRecoveryState
      ? buildDsxuRecoveryGateState(toolStateCursorRecoveryState)
      : null
    const toolStateCursorNudge = toolStateCursorNudgeText
      ? createUserMessage({
          content: toolStateCursorNudgeText,
          isMeta: true,
        })
      : null
    if (toolStateCursorNudge && toolStateCursorGateState) {
      traceQueryLoopStateSnapshot({
        lastEvent: 'recovery_gate_advisory',
        snapshotMessages: [
          ...messagesForQuery,
          ...assistantMessages,
          ...toolResults,
          toolStateCursorNudge,
        ],
        gateState: toolStateCursorGateState,
      })
    }

    if (tracking?.compacted) {
      tracking.turnCounter++
      logEvent('tengu_post_autocompact_turn', {
        turnId:
          tracking.turnId as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        turnCounter: tracking.turnCounter,

        queryChainId: queryChainIdForAnalytics,
        queryDepth: queryTracking.depth,
      })
    }

    // Be careful to do this after tool calls are done, because the API
    // will error if we interleave tool_result messages with regular user messages.

    // Instrumentation: Track message count before attachments
    logEvent('tengu_query_before_attachments', {
      messagesForQueryCount: messagesForQuery.length,
      assistantMessagesCount: assistantMessages.length,
      toolResultsCount: toolResults.length,
      queryChainId: queryChainIdForAnalytics,
      queryDepth: queryTracking.depth,
    })

    // Get queued commands snapshot before processing attachments.
    // These will be sent as attachments so DSXU can respond to them in the current turn.
    //
    // Drain pending notifications. LocalShellTask completions are 'next'
    // (when MONITOR_TOOL is on) and drain without Sleep. Other task types
    // (agent/workflow/framework) still default to 'later' -?the Sleep flush
    // covers those. If all task types move to 'next', this branch could go.
    //
    // Slash commands are excluded from mid-turn drain -?they must go through
    // processSlashCommand after the turn ends (via useQueueProcessor), not be
    // sent to the model as text. Bash-mode commands are already excluded by
    // INLINE_NOTIFICATION_MODES in getQueuedCommandAttachments.
    //
    // Agent scoping: the queue is a process-global singleton shared by the
    // coordinator and all in-process subagents. Each loop drains only what's
    // addressed to it -?main thread drains agentId===undefined, subagents
    // drain their own agentId. User prompts (mode:'prompt') still go to main
    // only; subagents never see the prompt stream.
    // eslint-disable-next-line custom-rules/require-tool-match-name -- ToolUseBlock.name has no aliases
    const sleepRan = toolUseBlocks.some(b => b.name === SLEEP_TOOL_NAME)
    const isMainThread =
      querySource.startsWith('repl_main_thread') || querySource === 'sdk'
    const currentAgentId = toolUseContext.agentId
    const queueDrainMaxPriority = sleepRan ? 'later' : 'next'
    const queuedCommandDrainDecision = selectQueuedCommandsForQueryTurn(
      getCommandsByMaxPriority(queueDrainMaxPriority),
      {
        maxPriority: queueDrainMaxPriority,
        isMainThread,
        currentAgentId,
        allowSystemNotifications:
          sleepRan || shouldAllowSystemQueuedCommandDrainForTurn(messagesForQuery),
      },
    )
    const queuedCommandsSnapshot = queuedCommandDrainDecision.attachable
    if (queuedCommandDrainDecision.deferred.length > 0) {
      traceDsxuLifecycle('query_loop_queued_command_boundary', {
        owner: 'query_loop',
        attachedCount: queuedCommandsSnapshot.length,
        deferredCount: queuedCommandDrainDecision.deferred.length,
        deferredReasonCounts:
          queuedCommandDrainDecision.deferredReasonCounts,
        maxPriority: queueDrainMaxPriority,
        isMainThread,
        currentAgentId,
        transitionReason: state.transition?.reason ?? null,
      })
    }

    for await (const attachment of getAttachmentMessages(
      null,
      updatedToolUseContext,
      null,
      queuedCommandsSnapshot,
      [...messagesForQuery, ...assistantMessages, ...toolResults],
      querySource,
    )) {
      yield attachment
      toolResults.push(attachment)
    }

    // Memory prefetch consume: only if settled and not already consumed on
    // an earlier iteration. If not settled yet, skip (zero-wait) and retry
    // next iteration -?the prefetch gets as many chances as there are loop
    // iterations before the turn ends. readFileState (cumulative across
    // iterations) filters out memories the model already Read/Wrote/Edited
    // -?including in earlier iterations, which the per-iteration
    // toolUseBlocks array would miss.
    if (
      pendingMemoryPrefetch &&
      pendingMemoryPrefetch.settledAt !== null &&
      pendingMemoryPrefetch.consumedOnIteration === -1
    ) {
      const memoryAttachments = filterDuplicateMemoryAttachments(
        await pendingMemoryPrefetch.promise,
        toolUseContext.readFileState,
      )
      for (const memAttachment of memoryAttachments) {
        const msg = createAttachmentMessage(memAttachment)
        yield msg
        toolResults.push(msg)
      }
      pendingMemoryPrefetch.consumedOnIteration = turnCount - 1
    }


    // Inject prefetched skill discovery. collectSkillDiscoveryPrefetch emits
    // hidden_by_main_turn is true when the prefetch resolved before this point
    // (the expected path is sub-second prefetch vs turn durations of 2-30s).
    if (skillPrefetch && pendingSkillPrefetch) {
      const skillAttachments =
        await skillPrefetch.collectSkillDiscoveryPrefetch(pendingSkillPrefetch)
      for (const att of skillAttachments) {
        const msg = createAttachmentMessage(att)
        yield msg
        toolResults.push(msg)
      }
    }

    // Remove only commands that were actually consumed as attachments.
    // Prompt and task-notification commands are converted to attachments above.
    const consumedCommands = queuedCommandsSnapshot.filter(
      cmd => cmd.mode === 'prompt' || cmd.mode === 'task-notification',
    )
    if (consumedCommands.length > 0) {
      for (const cmd of consumedCommands) {
        if (cmd.uuid) {
          consumedCommandUuids.push(cmd.uuid)
          notifyCommandLifecycle(cmd.uuid, 'started')
        }
      }
      removeFromQueue(consumedCommands)
    }

    // Instrumentation: Track file change attachments after they're added
    const fileChangeAttachmentCount = count(
      toolResults,
      tr =>
        tr.type === 'attachment' && tr.attachment.type === 'edited_text_file',
    )

    logEvent('tengu_query_after_attachments', {
      totalToolResultsCount: toolResults.length,
      fileChangeAttachmentCount,
      queryChainId: queryChainIdForAnalytics,
      queryDepth: queryTracking.depth,
    })

    // Refresh tools between turns so newly-connected MCP servers become available
    if (updatedToolUseContext.options.refreshTools) {
      const refreshedTools = updatedToolUseContext.options.refreshTools()
      if (refreshedTools !== updatedToolUseContext.options.tools) {
        updatedToolUseContext = {
          ...updatedToolUseContext,
          options: {
            ...updatedToolUseContext.options,
            tools: refreshedTools,
          },
        }
      }
    }

    const toolUseContextWithQueryTracking = {
      ...updatedToolUseContext,
      queryTracking,
    }
    const pendingAgentContinuations = toolUseContextWithQueryTracking.agentId
      ? drainPendingAgentContinuationMessages(
          toolUseContextWithQueryTracking.agentId,
          toolUseContextWithQueryTracking.getAppState,
          toolUseContextWithQueryTracking.setAppStateForTasks ??
            toolUseContextWithQueryTracking.setAppState,
        )
      : []
    for (const continuation of pendingAgentContinuations) {
      yield continuation
    }

    // Each time we have tool results and are about to recurse, that's a turn
    const nextTurnCount = turnCount + 1

    // Periodic task summary for `dsxu ps` -?fires mid-turn so a
    // long-running agent still refreshes what it's working on. Gated
    // only on !agentId so every top-level conversation (REPL, SDK, HFI,
    // remote) generates summaries; subagents/forks don't.
    if (feature('BG_SESSIONS')) {
      if (
        !toolUseContext.agentId &&
        taskSummaryModule!.shouldGenerateTaskSummary()
      ) {
        taskSummaryModule!.maybeGenerateTaskSummary({
          systemPrompt,
          userContext,
          systemContext,
          toolUseContext,
          forkContextMessages: [
            ...messagesForQuery,
            ...assistantMessages,
            ...toolResults,
          ],
        })
      }
    }

    // Check if we've reached the max turns limit
    if (maxTurns && nextTurnCount > maxTurns) {
      yield createAttachmentMessage({
        type: 'max_turns_reached',
        maxTurns,
        turnCount: nextTurnCount,
      })
      return { reason: 'max_turns', turnCount: nextTurnCount }
    }

    queryCheckpoint('query_recursive_call')
    const next: State = {
      messages: [
        ...messagesForQuery,
        ...assistantMessages,
        ...toolResults,
        ...(verifiedPassNudge ? [verifiedPassNudge] : []),
        ...(toolStateCursorNudge ? [toolStateCursorNudge] : []),
        ...pendingAgentContinuations,
      ],
      toolUseContext: toolUseContextWithQueryTracking,
      autoCompactTracking: tracking,
      turnCount: nextTurnCount,
      maxOutputTokensRecoveryCount: 0,
      hasAttemptedReactiveCompact: false,
      pendingToolUseSummary: nextPendingToolUseSummary,
      maxOutputTokensOverride: undefined,
      stopHookActive,
      transition: { reason: 'next_turn' },
    }
    state = next
  } // while (true)
}
