import type { LLMCallFn, Message } from './types'
import {
  DEEPSEEK_V4_CONTEXT_WINDOW,
  DEEPSEEK_V4_FLASH_MODEL,
} from '../../utils/model/deepseekV4Control'

export const DSXU_COMPACT_RECOVERY_SCHEMA_VERSION = 'dsxu.compact-recovery.v1' as const

export type CompactVerificationStatus = 'unknown' | 'partial' | 'pass' | 'fail'

export type CompactRecoverySnapshot = {
  schemaVersion: typeof DSXU_COMPACT_RECOVERY_SCHEMA_VERSION
  createdAt: string
  primaryRequest: string
  userInstructions: string[]
  changedFiles: string[]
  pendingTasks: string[]
  pendingAgents: string[]
  failedCommands: string[]
  permissionDenials: string[]
  recoveryDecisions: string[]
  verificationStatus: CompactVerificationStatus
  nextActions: string[]
}

export type ContextHygieneIssueType =
  | 'context_too_long'
  | 'context_overloaded'
  | 'context_polluted'
  | 'important_info_lost'
  | 'slice_task_mixed'

export type ContextHygieneAction = 'keep' | 'trim' | 'compact' | 'flag_risk'
export type ContextHygieneSeverity = 'low' | 'medium' | 'high' | 'critical'

export type ContextHygieneIssue = {
  type: ContextHygieneIssueType
  description: string
  severity: ContextHygieneSeverity
  suggestedAction: ContextHygieneAction
  location?: {
    messageIndex?: number
    role?: Message['role']
  }
  metadata?: Record<string, unknown>
}

export type ContextHygieneResult = {
  passed: boolean
  issues: ContextHygieneIssue[]
  overallRisk: 'none' | 'low' | 'medium' | 'high' | 'critical'
  suggestedActions: ContextHygieneAction[]
  stats: {
    totalMessages: number
    totalTokens: number
    issuesFound: number
    highRiskIssues: number
    checkTimeMs: number
  }
}

export type CompactLevel = 'light' | 'medium' | 'aggressive'

export type CompactMetadata = {
  level: CompactLevel
  strategy: string
  timestamp: number
  durationMs: number
  recoverable: boolean
  resumeHints: string[]
  stats: {
    messagesBefore: number
    messagesAfter: number
    tokensBefore: number
    tokensAfter: number
    compressionRatio: number
  }
  riskFlags: string[]
  qualityScore: number
  hygiene?: ContextHygieneResult
}

export type CompactResult = {
  messages: Message[]
  wasCompacted: boolean
  compactType: 'none' | 'micro' | 'light' | 'full'
  tokensBefore: number
  tokensAfter: number
  messagesRemoved: number
  summary?: string
  strategyUsed?: 'none' | 'micro' | 'light' | 'full' | 'tiered-micro' | 'tiered-light' | 'tiered-full'
  metadata?: CompactMetadata
}

export type CompactConfig = {
  keepRecentRounds?: number
  keepRecentToolResults?: number
  summaryMaxTokens?: number
  autoCompactThreshold?: number
  lightCompactThreshold?: number
  fullCompactThreshold?: number
  enableTieredCompaction?: boolean
  minTokensAfterCompact?: number
  cooldownMs?: number
  onArchive?: (messages: Message[], summary: string) => Promise<void>
}

export type CompactInput = {
  messages: Message[]
  level: CompactLevel
  llmCall?: LLMCallFn
  config?: CompactConfig
  hygieneResult?: ContextHygieneResult
}

type CompactDecision = {
  shouldCompact: boolean
  recommendedLevel: CompactLevel
  reason: string
  priority: 'low' | 'medium' | 'high'
}

const TOOL_RESULT_PLACEHOLDER = '[Earlier tool result cleared by compact]'
const DEFAULT_KEEP_RECENT_ROUNDS = 3
const DEFAULT_KEEP_RECENT_TOOL_RESULTS = 8
const DEFAULT_SUMMARY_MAX_TOKENS = 4096
const DEFAULT_AUTO_THRESHOLD = Math.floor(DEEPSEEK_V4_CONTEXT_WINDOW * 0.82)
const DEFAULT_LIGHT_RATIO = 0.55
const DEFAULT_FULL_RATIO = 0.78

function toContentString(content: Message['content'] | unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (typeof part === 'string') return part
        if (part && typeof part === 'object') {
          const value = part as Record<string, unknown>
          if (typeof value.text === 'string') return value.text
          if (typeof value.content === 'string') return value.content
          if (typeof value.thinking === 'string') return value.thinking
        }
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }
  return content == null ? '' : String(content)
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4))
}

function estimateMessageTokens(message: Message): number {
  const content = toContentString(message.content)
  const toolCallCost = Array.isArray((message as any).toolCalls)
    ? JSON.stringify((message as any).toolCalls).length
    : Array.isArray((message as any).tool_calls)
      ? JSON.stringify((message as any).tool_calls).length
      : 0
  return estimateTokens(content) + estimateTokens(message.role) + Math.ceil(toolCallCost / 4)
}

function estimateAllTokens(messages: readonly Message[]): number {
  return messages.reduce((sum, message) => sum + estimateMessageTokens(message), 0)
}

function cloneMessage(message: Message): Message {
  return {
    ...message,
    content: Array.isArray(message.content)
      ? message.content.map(part => ({ ...part }))
      : message.content,
  }
}

function compactNone(messages: Message[], tokensBefore = estimateAllTokens(messages)): CompactResult {
  return {
    messages,
    wasCompacted: false,
    compactType: 'none',
    tokensBefore,
    tokensAfter: tokensBefore,
    messagesRemoved: 0,
    strategyUsed: 'none',
  }
}

function capList(values: readonly string[] | undefined, limit: number): string[] {
  const unique: string[] = []
  for (const value of values ?? []) {
    const normalized = String(value ?? '').trim()
    if (normalized && !unique.includes(normalized)) unique.push(normalized)
    if (unique.length >= limit) break
  }
  return unique
}

function makeMetadata(input: {
  level: CompactLevel
  strategy: string
  startedAt: number
  messagesBefore: Message[]
  messagesAfter: Message[]
  hygiene?: ContextHygieneResult
  riskFlags?: string[]
}): CompactMetadata {
  const tokensBefore = estimateAllTokens(input.messagesBefore)
  const tokensAfter = estimateAllTokens(input.messagesAfter)
  const ratio = tokensBefore === 0 ? 1 : tokensAfter / tokensBefore
  const riskFlags = input.riskFlags ?? []

  return {
    level: input.level,
    strategy: input.strategy,
    timestamp: input.startedAt,
    durationMs: Math.max(0, Date.now() - input.startedAt),
    recoverable: true,
    resumeHints: [
      'Re-read source files before editing after compact.',
      'Do not claim PASS until focused verification has run after resume.',
    ],
    stats: {
      messagesBefore: input.messagesBefore.length,
      messagesAfter: input.messagesAfter.length,
      tokensBefore,
      tokensAfter,
      compressionRatio: ratio,
    },
    riskFlags,
    qualityScore: Math.max(0, Math.min(1, 1 - ratio * 0.5 - riskFlags.length * 0.05)),
    hygiene: input.hygiene,
  }
}

function attachMetadata(
  result: CompactResult,
  input: {
    level: CompactLevel
    strategy: string
    startedAt: number
    messagesBefore: Message[]
    hygiene?: ContextHygieneResult
    riskFlags?: string[]
  },
): CompactResult {
  return {
    ...result,
    metadata: makeMetadata({
      ...input,
      messagesAfter: result.messages,
    }),
  }
}

function hasToolCalls(message: Message): boolean {
  return (
    Array.isArray((message as any).toolCalls) && (message as any).toolCalls.length > 0
  ) || (
    Array.isArray((message as any).tool_calls) && (message as any).tool_calls.length > 0
  )
}

function splitSystemMessages(messages: readonly Message[]): {
  systemMessages: Message[]
  bodyMessages: Message[]
} {
  const systemMessages: Message[] = []
  const bodyMessages: Message[] = []
  for (const message of messages) {
    if (message.role === 'system' && bodyMessages.length === 0) {
      systemMessages.push(message)
    } else {
      bodyMessages.push(message)
    }
  }
  return { systemMessages, bodyMessages }
}

function selectRecentRounds(bodyMessages: readonly Message[], keepRecentRounds: number): Message[] {
  if (bodyMessages.length === 0) return []

  let userRounds = 0
  let startIndex = bodyMessages.length
  for (let index = bodyMessages.length - 1; index >= 0; index -= 1) {
    if (bodyMessages[index].role === 'user') {
      userRounds += 1
      if (userRounds >= keepRecentRounds) {
        startIndex = index
        break
      }
    }
  }

  if (userRounds < keepRecentRounds) {
    return bodyMessages.slice()
  }

  while (
    startIndex > 0 &&
    (bodyMessages[startIndex].role === 'tool' ||
      (bodyMessages[startIndex - 1]?.role === 'assistant' && hasToolCalls(bodyMessages[startIndex - 1])))
  ) {
    startIndex -= 1
  }

  return bodyMessages.slice(startIndex)
}

function splitOldAndRecent(messages: readonly Message[], keepRecentRounds: number): {
  systemMessages: Message[]
  oldMessages: Message[]
  recentMessages: Message[]
} {
  const { systemMessages, bodyMessages } = splitSystemMessages(messages)
  const recentMessages = selectRecentRounds(bodyMessages, keepRecentRounds)
  const oldCount = Math.max(0, bodyMessages.length - recentMessages.length)
  return {
    systemMessages,
    oldMessages: bodyMessages.slice(0, oldCount),
    recentMessages,
  }
}

function generateLightSummary(messages: readonly Message[]): string {
  const lines: string[] = []
  const files = new Set<string>()
  const recentUserRequests: string[] = []

  for (const message of messages) {
    const content = toContentString(message.content)
    const pathMatches = content.matchAll(/(?:path|file_path|file|Read file|Edit file)\s*:?\s*["']?([A-Za-z0-9_./\\:-]+\.[A-Za-z0-9]+)["']?/gi)
    for (const match of pathMatches) {
      const candidate = match[1]
      if (candidate && (candidate.includes('/') || candidate.includes('\\'))) {
        files.add(candidate)
      }
    }
    const loosePaths = content.matchAll(/\b[A-Za-z0-9_./\\:-]+\.(?:ts|tsx|js|jsx|json|md|css|html|py|go|rs)\b/g)
    for (const match of loosePaths) {
      if (match[0].includes('/') || match[0].includes('\\')) files.add(match[0])
    }
    if (message.role === 'user' && recentUserRequests.length < 4) {
      recentUserRequests.push(content.slice(0, 180))
    }
  }

  lines.push(`Messages summarized: ${messages.length}`)
  if (recentUserRequests.length > 0) {
    lines.push('Prior user requests:')
    lines.push(...recentUserRequests.map(item => `- ${item}`))
  }
  if (files.size > 0) {
    lines.push('Files mentioned:')
    lines.push(...Array.from(files).slice(0, 20).map(file => `- ${file}`))
  }
  lines.push('Resume rule: re-read source truth before editing.')
  return lines.join('\n')
}

export function buildCompactRecoverySnapshot(input: {
  primaryRequest: string
  userInstructions?: string[]
  changedFiles?: string[]
  pendingTasks?: string[]
  pendingAgents?: string[]
  failedCommands?: string[]
  permissionDenials?: string[]
  recoveryDecisions?: string[]
  verificationStatus?: CompactVerificationStatus
  nextActions?: string[]
  createdAt?: string
}): CompactRecoverySnapshot {
  return {
    schemaVersion: DSXU_COMPACT_RECOVERY_SCHEMA_VERSION,
    createdAt: input.createdAt ?? new Date().toISOString(),
    primaryRequest: input.primaryRequest,
    userInstructions: capList(input.userInstructions, 40),
    changedFiles: capList(input.changedFiles, 40),
    pendingTasks: capList(input.pendingTasks, 40),
    pendingAgents: capList(input.pendingAgents, 40),
    failedCommands: capList(input.failedCommands, 40),
    permissionDenials: capList(input.permissionDenials, 40),
    recoveryDecisions: capList(input.recoveryDecisions, 40),
    verificationStatus: input.verificationStatus ?? 'unknown',
    nextActions: capList(input.nextActions, 40),
  }
}

export function renderCompactRecoverySchemaContract(): string {
  return [
    'DSXU compact recovery schema contract:',
    `- schemaVersion: ${DSXU_COMPACT_RECOVERY_SCHEMA_VERSION}`,
    '- primaryRequest: original task goal.',
    '- userInstructions: Do not drop user constraints.',
    '- changedFiles: files that may require source-truth reread before edit.',
    '- pendingTasks: unfinished work that must continue after compact.',
    '- pendingAgents: active or unresolved agent tasks.',
    '- failedCommands: failed verification or execution commands.',
    '- permissionDenials: denied or blocked operations that affect the next step.',
    '- recoveryDecisions: decisions already made before compact.',
    '- verificationStatus: unknown | partial | pass | fail.',
    '- nextActions: ordered next steps after resume.',
    '- Resume rule: memory and summaries are hints; source files and verification are truth.',
  ].join('\n')
}

export function renderCompactRecoverySnapshot(snapshot: CompactRecoverySnapshot): string {
  return [
    '<dsxu_compact_recovery_snapshot>',
    JSON.stringify(snapshot, null, 2),
    '</dsxu_compact_recovery_snapshot>',
  ].join('\n')
}

export function microCompact(
  messages: Message[],
  keepRecentToolResults = DEFAULT_KEEP_RECENT_TOOL_RESULTS,
): CompactResult {
  const tokensBefore = estimateAllTokens(messages)
  const toolMessageIndexes = messages
    .map((message, index) => ({ message, index }))
    .filter(item => item.message.role === 'tool')
    .map(item => item.index)

  if (toolMessageIndexes.length <= keepRecentToolResults) {
    return compactNone(messages, tokensBefore)
  }

  const indexesToKeep = new Set(toolMessageIndexes.slice(-keepRecentToolResults))
  let changed = false
  const compacted = messages.map((message, index) => {
    if (message.role !== 'tool' || indexesToKeep.has(index)) return message
    const content = toContentString(message.content)
    if (content.length <= 100) return message
    changed = true
    return { ...cloneMessage(message), content: TOOL_RESULT_PLACEHOLDER }
  })

  if (!changed) {
    return {
      messages: compacted,
      wasCompacted: false,
      compactType: 'none',
      tokensBefore,
      tokensAfter: estimateAllTokens(compacted),
      messagesRemoved: 0,
      strategyUsed: 'none',
    }
  }

  return {
    messages: compacted,
    wasCompacted: true,
    compactType: 'micro',
    tokensBefore,
    tokensAfter: estimateAllTokens(compacted),
    messagesRemoved: 0,
    strategyUsed: 'micro',
  }
}

export async function fullCompact(
  messages: Message[],
  llmCall: LLMCallFn,
  config: CompactConfig = {},
): Promise<CompactResult> {
  const tokensBefore = estimateAllTokens(messages)
  const keepRecentRounds = config.keepRecentRounds ?? DEFAULT_KEEP_RECENT_ROUNDS
  const { systemMessages, oldMessages, recentMessages } = splitOldAndRecent(messages, keepRecentRounds)

  if (oldMessages.length === 0) {
    return compactNone(messages, tokensBefore)
  }

  const summaryMaxTokens = config.summaryMaxTokens ?? DEFAULT_SUMMARY_MAX_TOKENS
  const summaryPrompt: Message[] = [
    {
      role: 'system',
      content: [
        'Summarize the earlier DSXU coding conversation for exact task resume.',
        renderCompactRecoverySchemaContract(),
        'Preserve user constraints, changed files, failed commands, permission denials, pending agents, and verification status.',
      ].join('\n\n'),
    },
    {
      role: 'user',
      content: oldMessages
        .map((message, index) => `[${index}] ${message.role}: ${toContentString(message.content)}`)
        .join('\n\n'),
    },
  ]

  try {
    const response = await llmCall(summaryPrompt, [], {
      model: DEEPSEEK_V4_FLASH_MODEL,
      maxTokens: summaryMaxTokens,
      temperature: 0.1,
    })
    const summary = response.content || generateLightSummary(oldMessages)
    if (config.onArchive) {
      try {
        await config.onArchive(oldMessages, summary)
      } catch {
        // Archive failures must not break the active recovery path.
      }
    }

    const summaryMessage: Message = {
      role: 'system',
      content: `<conversation_summary>\n${summary}\n</conversation_summary>`,
    }
    const compactedMessages = [
      ...systemMessages.map(cloneMessage),
      summaryMessage,
      ...recentMessages.map(cloneMessage),
    ]

    return {
      messages: compactedMessages,
      wasCompacted: true,
      compactType: 'full',
      tokensBefore,
      tokensAfter: estimateAllTokens(compactedMessages),
      messagesRemoved: oldMessages.length,
      summary,
      strategyUsed: 'full',
    }
  } catch {
    return microCompact(messages, config.keepRecentToolResults ?? DEFAULT_KEEP_RECENT_TOOL_RESULTS)
  }
}

export function lightCompact(messages: Message[], config: CompactConfig = {}): CompactResult {
  if (messages.length === 0) return compactNone(messages, 0)
  const tokensBefore = estimateAllTokens(messages)
  const keepRecentRounds = config.keepRecentRounds ?? DEFAULT_KEEP_RECENT_ROUNDS
  const { systemMessages, oldMessages, recentMessages } = splitOldAndRecent(messages, keepRecentRounds)

  if (oldMessages.length === 0) {
    return compactNone(messages, tokensBefore)
  }

  const summary = generateLightSummary(oldMessages)
  const summaryMessage: Message = {
    role: 'system',
    content: `<light_summary>\nEarlier conversation summary:\n\n${summary}\n</light_summary>`,
  }
  const compactedMessages = [
    ...systemMessages.map(cloneMessage),
    summaryMessage,
    ...recentMessages.map(cloneMessage),
  ]

  return {
    messages: compactedMessages,
    wasCompacted: true,
    compactType: 'light',
    tokensBefore,
    tokensAfter: estimateAllTokens(compactedMessages),
    messagesRemoved: oldMessages.length,
    summary,
    strategyUsed: 'light',
  }
}

export class CompactionManager {
  private static instance: CompactionManager | undefined
  private lastCompactAt = 0
  private cooldownMs = 30_000
  private minTokensAfterCompact = 512

  static getInstance(): CompactionManager {
    if (!this.instance) this.instance = new CompactionManager()
    return this.instance
  }

  configure(config: CompactConfig = {}): void {
    this.cooldownMs = config.cooldownMs ?? this.cooldownMs
    this.minTokensAfterCompact = config.minTokensAfterCompact ?? this.minTokensAfterCompact
  }

  canCompact(): boolean {
    return Date.now() - this.lastCompactAt >= this.cooldownMs
  }

  satisfiesMinTokens(result: CompactResult, config: CompactConfig = {}): boolean {
    const minTokens = config.minTokensAfterCompact ?? this.minTokensAfterCompact
    return result.tokensAfter >= minTokens
  }

  recordCompaction(): void {
    this.lastCompactAt = Date.now()
  }

  reset(): void {
    this.lastCompactAt = 0
    this.cooldownMs = 30_000
    this.minTokensAfterCompact = 512
  }
}

export async function autoCompactIfNeeded(
  messages: Message[],
  llmCall: LLMCallFn,
  config: CompactConfig = {},
): Promise<CompactResult> {
  const tokensBefore = estimateAllTokens(messages)
  const threshold = config.autoCompactThreshold ?? DEFAULT_AUTO_THRESHOLD
  if (tokensBefore < threshold) {
    return compactNone(messages, tokensBefore)
  }

  const manager = CompactionManager.getInstance()
  manager.configure(config)
  if (!manager.canCompact()) {
    return compactNone(messages, tokensBefore)
  }

  const enableTiered = config.enableTieredCompaction !== false
  let result: CompactResult

  if (enableTiered) {
    const contextRatio = tokensBefore / DEEPSEEK_V4_CONTEXT_WINDOW
    const micro = microCompact(messages, config.keepRecentToolResults ?? DEFAULT_KEEP_RECENT_TOOL_RESULTS)
    if (micro.wasCompacted && micro.tokensAfter < threshold && manager.satisfiesMinTokens(micro, config)) {
      result = { ...micro, strategyUsed: 'tiered-micro' }
    } else if (contextRatio >= (config.fullCompactThreshold ?? DEFAULT_FULL_RATIO)) {
      result = await fullCompact(messages, llmCall, config)
      result = { ...result, strategyUsed: 'tiered-full' }
    } else if (contextRatio >= (config.lightCompactThreshold ?? DEFAULT_LIGHT_RATIO)) {
      result = lightCompact(messages, config)
      result = { ...result, strategyUsed: 'tiered-light' }
    } else if (micro.wasCompacted) {
      result = { ...micro, strategyUsed: 'tiered-micro' }
    } else {
      result = lightCompact(messages, config)
      result = { ...result, strategyUsed: 'tiered-light' }
    }
  } else {
    const micro = microCompact(messages, config.keepRecentToolResults ?? DEFAULT_KEEP_RECENT_TOOL_RESULTS)
    result = micro.wasCompacted && micro.tokensAfter < threshold
      ? micro
      : await fullCompact(messages, llmCall, config)
  }

  if (!result.wasCompacted || !manager.satisfiesMinTokens(result, config)) {
    return compactNone(messages, tokensBefore)
  }

  manager.recordCompaction()
  return result
}

export async function compactMessages(input: CompactInput): Promise<CompactResult> {
  const startedAt = Date.now()
  const config = input.config ?? {}
  let result: CompactResult

  if (input.level === 'light') {
    result = lightCompact(input.messages, config)
  } else if (input.level === 'medium') {
    const micro = microCompact(input.messages, config.keepRecentToolResults ?? 2)
    result = micro.wasCompacted ? micro : lightCompact(input.messages, { ...config, keepRecentRounds: 2 })
  } else {
    if (input.llmCall) {
      result = await fullCompact(input.messages, input.llmCall, { ...config, keepRecentRounds: 1 })
    } else {
      result = lightCompact(input.messages, { ...config, keepRecentRounds: 1 })
    }
  }

  return attachMetadata(result, {
    level: input.level,
    strategy: result.strategyUsed ?? result.compactType,
    startedAt,
    messagesBefore: input.messages,
    hygiene: input.hygieneResult,
    riskFlags: input.hygieneResult?.issues.map(issue => issue.type) ?? [],
  })
}

export function checkContextHygiene(messages: Message[], maxTokens = 100_000): ContextHygieneResult {
  const startedAt = Date.now()
  const totalTokens = estimateAllTokens(messages)
  const issues: ContextHygieneIssue[] = []

  if (totalTokens > maxTokens * 0.9 || messages.length > 60) {
    issues.push({
      type: 'context_too_long',
      description: 'Context is near or above the configured token budget.',
      severity: totalTokens > maxTokens ? 'critical' : 'high',
      suggestedAction: 'compact',
      metadata: { totalTokens, maxTokens },
    })
  }

  if (messages.length > 50) {
    issues.push({
      type: 'context_overloaded',
      description: 'Conversation contains many messages and may need trimming.',
      severity: messages.length > 80 ? 'high' : 'medium',
      suggestedAction: 'trim',
      metadata: { totalMessages: messages.length },
    })
  }

  const seen = new Map<string, number>()
  messages.forEach((message, index) => {
    const key = `${message.role}:${toContentString(message.content).slice(0, 500)}`
    const count = (seen.get(key) ?? 0) + 1
    seen.set(key, count)
    if (count === 3) {
      issues.push({
        type: 'context_polluted',
        description: 'Repeated message content suggests stale or duplicated context.',
        severity: 'medium',
        suggestedAction: 'trim',
        location: { messageIndex: index, role: message.role },
        metadata: { duplicateCount: count },
      })
    }
  })

  messages.forEach((message, index) => {
    const length = toContentString(message.content).length
    if (length > 5_000) {
      issues.push({
        type: 'important_info_lost',
        description: 'A very large message can bury current task state during resume.',
        severity: length > 12_000 ? 'critical' : 'high',
        suggestedAction: 'flag_risk',
        location: { messageIndex: index, role: message.role },
        metadata: { length },
      })
    }
  })

  const roleSwitches = messages.reduce((count, message, index) => {
    return index > 0 && messages[index - 1].role !== message.role ? count + 1 : count
  }, 0)
  if (messages.length > 30 && roleSwitches > 20) {
    issues.push({
      type: 'slice_task_mixed',
      description: 'The context mixes many task slices and should be summarized before planning.',
      severity: 'medium',
      suggestedAction: 'compact',
      metadata: { roleSwitches },
    })
  }

  const suggestedActions = Array.from(new Set<ContextHygieneAction>(
    issues.length === 0 ? ['keep'] : issues.map(issue => issue.suggestedAction),
  ))
  const severityScore = Math.max(
    0,
    ...issues.map(issue => (
      issue.severity === 'critical' ? 4 :
      issue.severity === 'high' ? 3 :
      issue.severity === 'medium' ? 2 :
      1
    )),
  )
  const overallRisk: ContextHygieneResult['overallRisk'] =
    severityScore >= 4 ? 'critical' :
    severityScore === 3 ? 'high' :
    severityScore === 2 ? 'medium' :
    severityScore === 1 ? 'low' :
    'none'

  return {
    passed: issues.length === 0,
    issues,
    overallRisk,
    suggestedActions,
    stats: {
      totalMessages: messages.length,
      totalTokens,
      issuesFound: issues.length,
      highRiskIssues: issues.filter(issue => issue.severity === 'high' || issue.severity === 'critical').length,
      checkTimeMs: Math.max(0, Date.now() - startedAt),
    },
  }
}

export function applyContextHygiene(messages: Message[], hygiene: ContextHygieneResult): Message[] {
  if (hygiene.passed) return messages

  let output = messages.slice()
  if (hygiene.suggestedActions.includes('trim') && output.length > 30) {
    const systemPrefix = output.filter((message, index) => message.role === 'system' && index < 5)
    const recent = output.slice(-25)
    output = [...systemPrefix, ...recent]
  }

  if (hygiene.suggestedActions.includes('flag_risk')) {
    output = [
      {
        role: 'system',
        content: [
          '\u4e0a\u4e0b\u6587\u98ce\u9669\u6807\u8bb0:',
          `risk=${hygiene.overallRisk}`,
          `issues=${hygiene.issues.map(issue => issue.type).join(',')}`,
          'Resume rule: re-read source truth and verify before claiming completion.',
        ].join('\n'),
      },
      ...output,
    ]
  }

  return output
}

export function decideCompactionWithHygiene(
  messages: Message[],
  hygiene = checkContextHygiene(messages),
): CompactDecision {
  const tokenUsage = estimateAllTokens(messages) / DEEPSEEK_V4_CONTEXT_WINDOW
  if (hygiene.overallRisk === 'critical' || hygiene.overallRisk === 'high' || tokenUsage > 0.9) {
    return {
      shouldCompact: true,
      recommendedLevel: 'aggressive',
      reason: 'High context risk or near context limit.',
      priority: 'high',
    }
  }
  if (hygiene.overallRisk === 'medium' || tokenUsage > 0.7) {
    return {
      shouldCompact: true,
      recommendedLevel: 'medium',
      reason: 'Moderate context risk requires compacted resume state.',
      priority: 'medium',
    }
  }
  if (!hygiene.passed || tokenUsage > 0.5) {
    return {
      shouldCompact: true,
      recommendedLevel: 'light',
      reason: 'Light hygiene issue or growing context.',
      priority: 'low',
    }
  }
  return {
    shouldCompact: false,
    recommendedLevel: 'light',
    reason: 'Context is healthy.',
    priority: 'low',
  }
}

export async function applyHygieneAndCompact(
  messages: Message[],
  llmCall: LLMCallFn,
  config: CompactConfig = {},
): Promise<{
  messages: Message[]
  hygieneResult: ContextHygieneResult
  decision: CompactDecision
  compactResult?: CompactResult
}> {
  const hygieneResult = checkContextHygiene(messages)
  const cleanedMessages = applyContextHygiene(messages, hygieneResult)
  const decision = decideCompactionWithHygiene(cleanedMessages, hygieneResult)

  if (!decision.shouldCompact) {
    return { messages: cleanedMessages, hygieneResult, decision }
  }

  const compactResult = await compactMessages({
    messages: cleanedMessages,
    level: decision.recommendedLevel,
    llmCall,
    config,
    hygieneResult,
  })

  return {
    messages: compactResult.messages,
    hygieneResult,
    decision,
    compactResult,
  }
}
