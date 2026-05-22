// DSXU mainline tool batch gate.
// Keeps weak-model correction in the execution path instead of relying only on prompt text.
import type { ToolUseBlock } from 'src/types/providerSdk.js'
import { createUserMessage } from '../../utils/messages.js'
import type { AssistantMessage, Message } from '../../types/message.js'
import { BASH_TOOL_NAME } from '../../tools/BashTool/toolName.js'
import { FILE_EDIT_TOOL_NAME } from '../../tools/FileEditTool/constants.js'
import { FILE_WRITE_TOOL_NAME } from '../../tools/FileWriteTool/prompt.js'
import { NOTEBOOK_EDIT_TOOL_NAME } from '../../tools/NotebookEditTool/constants.js'
import { POWERSHELL_TOOL_NAME } from '../../tools/PowerShellTool/toolName.js'
import { TASK_OUTPUT_TOOL_NAME } from '../../tools/TaskOutputTool/constants.js'

const DSXU_MUTATION_TOOL_NAMES = new Set([
  FILE_EDIT_TOOL_NAME,
  FILE_WRITE_TOOL_NAME,
  NOTEBOOK_EDIT_TOOL_NAME,
  'MultiEdit',
])

const DSXU_VERIFICATION_TOOL_NAMES = new Set([
  BASH_TOOL_NAME,
  POWERSHELL_TOOL_NAME,
  TASK_OUTPUT_TOOL_NAME,
])

const DSXU_DISCOVERY_TOOL_NAMES = new Set([
  'Read',
  'Grep',
  'Glob',
])

const DSXU_FILE_READ_TOOL_NAME = 'Read'

const DSXU_POST_PASS_BLOCKED_TOOL_NAMES = new Set([
  ...DSXU_VERIFICATION_TOOL_NAMES,
  ...DSXU_DISCOVERY_TOOL_NAMES,
  'Agent',
  TASK_OUTPUT_TOOL_NAME,
  'SendMessage',
  'TaskCreate',
  'TaskUpdate',
  'TodoWrite',
  'MCPTool',
  'ReadMcpResource',
  'ReadMcpResourceTool',
  'ListMcpResources',
  'ListMcpResourcesTool',
  'LSP',
  'Workflow',
  'workflow',
])

const DSXU_TERMINAL_PASS_MARKER_RE =
  /(?:^|\n)\s*(?:\*\*)?(?:Result:\s*)?DSXU_BENCH_[A-Z0-9_]+_PASS(?:\*\*)?\s*(?:\n|$)/i

const DSXU_DISCOVERY_BATCH_BUDGET = 5
const DSXU_FAILED_VERIFICATION_RERUN_LIMIT = 2
const DSXU_REPEATED_SEMANTIC_TOOL_NAMES = new Set([
  ...DSXU_DISCOVERY_TOOL_NAMES,
  BASH_TOOL_NAME,
  POWERSHELL_TOOL_NAME,
])

export type DsxuToolBatchGateClass =
  | 'SAFETY_BLOCK'
  | 'QUALITY_BLOCK'
  | 'RECOVERY_BLOCK'
  | 'CAPABILITY_NUDGE'
  | 'COST_SMELL'
  | 'BENCH_CONTRACT_ONLY'
  | 'RELAX_OR_REMOVE'

export type DsxuToolBatchGateDecision = {
  owner: 'tool_lifecycle'
  gateId: string
  gateKind: 'tool_batch'
  gateClass: DsxuToolBatchGateClass
  reason: string
  blocked: boolean
  nextAction: string
  createMessage: (assistantMessage: AssistantMessage) => Message
}

export function isDsxuMutationToolName(toolName: string): boolean {
  return DSXU_MUTATION_TOOL_NAMES.has(toolName)
}

export function isDsxuVerificationToolName(toolName: string): boolean {
  return DSXU_VERIFICATION_TOOL_NAMES.has(toolName)
}

export function isDsxuDiscoveryToolName(toolName: string): boolean {
  return DSXU_DISCOVERY_TOOL_NAMES.has(toolName)
}

export function hasUnsafeMutationVerificationBatch(
  toolUseBlocks: readonly ToolUseBlock[],
): boolean {
  return (
    toolUseBlocks.length > 1 &&
    toolUseBlocks.some(block => isDsxuMutationToolName(block.name)) &&
    toolUseBlocks.some(block => isDsxuVerificationToolName(block.name))
  )
}

export function shouldBlockUnsafeBatchVerification(
  toolUseBlocks: readonly ToolUseBlock[],
  block: ToolUseBlock,
): boolean {
  return (
    hasUnsafeMutationVerificationBatch(toolUseBlocks) &&
    isDsxuVerificationToolName(block.name)
  )
}

export function shouldRequireDiscoveryNarrowingInBatch(
  toolUseBlocks: readonly ToolUseBlock[],
  block: ToolUseBlock,
): boolean {
  if (!isDsxuDiscoveryToolName(block.name)) return false
  let discoveryIndex = 0
  for (const candidate of toolUseBlocks) {
    if (isDsxuDiscoveryToolName(candidate.name)) {
      discoveryIndex++
    }
    if (candidate.id === block.id) {
      return discoveryIndex > DSXU_DISCOVERY_BATCH_BUDGET
    }
  }
  return false
}

export function getLatestDsxuToolState(messages: readonly Message[]): string | null {
  let latest: string | null = null
  for (const message of messages) {
    if (message.type !== 'user') continue
    const content = message.message.content
    if (!Array.isArray(content)) continue
    for (const block of content) {
      if (block.type !== 'tool_result' || typeof block.content !== 'string') {
        continue
      }
      const match = block.content.match(/DSXU tool state:\s*([^;\n]+)/i)
      if (match) {
        latest = match[1]!.trim().toLowerCase()
      }
    }
  }
  return latest
}

function looksLikeDsxuEvidenceCollectedPass(text: string): boolean {
  return (
    /DSXU tool state:\s*evidence_collected\b/i.test(text) &&
    /\b(?:CollectEvidence\s+status|status)\s*:\s*PASS\b/i.test(text)
  )
}

function getDsxuMessageText(message: Message): string[] {
  if (!('message' in message) || !message.message) return []
  const content = message.message.content
  if (typeof content === 'string') return [content]
  if (!Array.isArray(content)) return []
  return content.flatMap(block => {
    if (typeof block === 'string') return [block]
    if (!block || typeof block !== 'object') return []
    const parts: string[] = []
    if ('text' in block && typeof block.text === 'string') parts.push(block.text)
    if ('content' in block && typeof block.content === 'string') {
      parts.push(block.content)
    }
    return parts
  })
}

function getDsxuAssistantVisibleText(message: Message): string[] {
  if (message.type !== 'assistant') return []
  if (!('message' in message) || !message.message) return []
  const content = message.message.content
  if (typeof content === 'string') return [content]
  if (!Array.isArray(content)) return []
  return content.flatMap(block => {
    if (!block || typeof block !== 'object') return []
    if (
      'type' in block &&
      block.type === 'text' &&
      'text' in block &&
      typeof block.text === 'string'
    ) {
      return [block.text]
    }
    return []
  })
}

export function hasDsxuAssistantTerminalPassMarker(
  messages: readonly Message[] | undefined,
): boolean {
  return (messages ?? []).some(message =>
    getDsxuAssistantVisibleText(message).some(text =>
      DSXU_TERMINAL_PASS_MARKER_RE.test(text),
    ),
  )
}

export function shouldBlockToolAfterAssistantPassMarker(
  messages: readonly Message[] | undefined,
  _block: ToolUseBlock,
): boolean {
  return hasDsxuAssistantTerminalPassMarker(messages)
}

function getDsxuMessageContentArray(message: Message): unknown[] {
  if (!('message' in message) || !message.message) return []
  const content = message.message.content
  return Array.isArray(content) ? content : []
}

function hasDsxuEditProgress(messages: readonly Message[]): boolean {
  return messages.some(message =>
    getDsxuMessageText(message).some(text =>
      /DSXU tool state:\s*(?:edit_applied|edit_already_applied)\b/i.test(text),
    ),
  )
}

function hasDsxuExplicitRequiredEditDirective(text: string): boolean {
  const hasEditDirective =
    /\bmust\s+make\s+exactly\s+\d+\s+Edits?\b/i.test(text) ||
    /\b(?:make|apply|use)\s+exactly\s+\d+\s+(?:successful\s+)?Edits?\b/i.test(text) ||
    /\bexactly\s+\d+\s+(?:(?:sequential|source|successful)\s+){0,3}Edits?\b/i.test(text) ||
    /\b(?:one|1)\s+source\s+edit\b/i.test(text) ||
    /\b(?:one|1)\s+test\s+edit\b/i.test(text) ||
    /\b(?:fix|update|change|replace)\b[\s\S]{0,160}\bwith\s+(?:one|1|exactly\s+\d+)\s+Edit\b/i.test(text)
  const hasSourceOrRegressionRequirement =
    /\bfix\b[\s\S]{0,220}\b(?:source|implementation|function|bug|risk|regression|test|assertion)\b/i.test(text) ||
    /\badd\s+(?:one|1|a)\s+regression\s+(?:assertion|test)\b/i.test(text) ||
    /\b(?:source|test)\s+edit\b/i.test(text)
  return hasEditDirective || hasSourceOrRegressionRequirement
}

export function hasDsxuPendingRequiredEditAfterBaselinePass(
  messages: readonly Message[],
): boolean {
  const text = messages.flatMap(getDsxuMessageText).join('\n')
  if (!/DSXU tool state:\s*verification_passed\b/i.test(text)) return false
  if (hasDsxuEditProgress(messages)) return false
  return hasDsxuExplicitRequiredEditDirective(text)
}

export function shouldBlockVerificationAfterVerifiedPass(
  messages: readonly Message[] | undefined,
  block: ToolUseBlock,
): boolean {
  const conversation = messages ?? []
  if (hasDsxuPendingRequiredEditAfterBaselinePass(conversation)) return false
  const latestToolResultText = getLatestDsxuToolResultText(conversation)
  const latestIsVerifiedFinal =
    getLatestDsxuToolState(conversation) === 'verification_passed' ||
    (latestToolResultText
      ? looksLikeDsxuEvidenceCollectedPass(latestToolResultText)
      : false)
  return (
    DSXU_POST_PASS_BLOCKED_TOOL_NAMES.has(block.name) &&
    latestIsVerifiedFinal
  )
}

function looksLikeFailedVerification(text: string): boolean {
  if (/DSXU tool state:\s*verification_failed/i.test(text)) return true

  const hasVerificationSignal =
    /\bbun test\b/i.test(text) ||
    /\b(vitest|jest|pytest|npm test|pnpm test|yarn test)\b/i.test(text) ||
    /\bRan\s+\d+\s+tests?\b/i.test(text) ||
    /\b\d+\s+fail\b/i.test(text)
  if (!hasVerificationSignal) return false

  const hasFailure =
    /\bexit code\s+[1-9]\b/i.test(text) ||
    /\b[1-9]\d*\s+fail\b/i.test(text) ||
    /\b(assertionerror|error:|failed|failures?)\b/i.test(text)
  const hasPassingSummary =
    /\b[1-9]\d*\s+pass\b/i.test(text) &&
    (/\b0\s+fail\b/i.test(text) || !/\b[1-9]\d*\s+fail\b/i.test(text))

  return hasFailure && !hasPassingSummary
}

function getToolInputFilePath(block: ToolUseBlock): string | null {
  const input = block.input
  if (!input || typeof input !== 'object') return null
  const candidate = (input as { file_path?: unknown; path?: unknown }).file_path ??
    (input as { file_path?: unknown; path?: unknown }).path
  return typeof candidate === 'string' && candidate.trim().length > 0
    ? candidate
    : null
}

function getToolInputString(block: ToolUseBlock, key: string): string | null {
  const input = block.input
  if (!input || typeof input !== 'object') return null
  const value = (input as Record<string, unknown>)[key]
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function normalizeDsxuPath(path: string): string {
  return path
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .toLowerCase()
}

function normalizeSemanticText(value: string): string {
  return value
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function parseDsxuPositiveInteger(value: unknown): number | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  const text = String(value).trim()
  if (!/^\d+$/.test(text)) return undefined
  const parsed = Number.parseInt(text, 10)
  return parsed > 0 ? parsed : undefined
}

function parseDsxuSmallNumberWord(value: string): number | undefined {
  const normalized = value.trim().toLowerCase()
  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
  }
  return parseDsxuPositiveInteger(normalized) ?? words[normalized]
}

type DsxuEditBudgetContract = {
  exactSuccessfulEdits?: number
  maxSuccessfulEdits?: number
  source: 'env' | 'prompt'
}

function getDsxuEditBudgetContract(
  messages: readonly Message[] | undefined,
): DsxuEditBudgetContract | null {
  const envExact = parseDsxuPositiveInteger(
    process.env.DSXU_EXACT_SUCCESSFUL_EDIT_BUDGET,
  )
  const envMax = parseDsxuPositiveInteger(
    process.env.DSXU_MAX_SUCCESSFUL_EDIT_BUDGET,
  )
  if (envExact || envMax) {
    return {
      exactSuccessfulEdits: envExact,
      maxSuccessfulEdits: envMax ?? envExact,
      source: 'env',
    }
  }

  const text = (messages ?? []).flatMap(getDsxuMessageText).join('\n')
  if (!text) return null

  const contractLine = text.match(/DSXU edit budget contract:[^\n]*/i)?.[0]
  const exactFromContract = contractLine?.match(
    /(?:exact_successful_edits|exactEditCalls|exact_edits)\s*=\s*(\d+)/i,
  )?.[1]
  const maxFromContract = contractLine?.match(
    /(?:max_successful_edits|maxEditCalls|max_edits)\s*=\s*(\d+)/i,
  )?.[1]
  const parsedExact = parseDsxuPositiveInteger(exactFromContract)
  const parsedMax = parseDsxuPositiveInteger(maxFromContract)
  if (parsedExact || parsedMax) {
    return {
      exactSuccessfulEdits: parsedExact,
      maxSuccessfulEdits: parsedMax ?? parsedExact,
      source: 'prompt',
    }
  }

  const exactNatural = text.match(
    /\b(?:make|apply|perform|use|implement|fix(?:\s+\w+){0,3}\s+with)?\s*exactly\s+(\d+|one|two|three|four|five|six)\s+(?:(?:sequential|source|successful)\s+){0,3}Edits?\b/i,
  )?.[1]
  const parsedNaturalExact = exactNatural
    ? parseDsxuSmallNumberWord(exactNatural)
    : undefined
  if (parsedNaturalExact) {
    return {
      exactSuccessfulEdits: parsedNaturalExact,
      maxSuccessfulEdits: parsedNaturalExact,
      source: 'prompt',
    }
  }

  const asksForOneSourceAndOneTestEdit =
    /\b(?:one|1)\s+source\s+edit\b/i.test(text) &&
    /\b(?:one|1)\s+test\s+edit\b/i.test(text)
  if (asksForOneSourceAndOneTestEdit) {
    return {
      exactSuccessfulEdits: 2,
      maxSuccessfulEdits: 2,
      source: 'prompt',
    }
  }

  return null
}

function countDsxuSuccessfulSourceMutations(
  messages: readonly Message[] | undefined,
): number {
  let count = 0
  for (const message of messages ?? []) {
    if (message.type !== 'user') continue
    const content = message.message.content
    if (!Array.isArray(content)) continue
    for (const block of content) {
      if (block.type !== 'tool_result' || typeof block.content !== 'string') {
        continue
      }
      if (
        /DSXU tool state:\s*(?:edit_applied|write_applied|file_written)\b/i.test(
          block.content,
        )
      ) {
        count++
      }
    }
  }
  return count
}

function getBatchMutationOrdinal(
  toolUseBlocks: readonly ToolUseBlock[],
  block: ToolUseBlock,
): number {
  let ordinal = 0
  for (const candidate of toolUseBlocks) {
    if (isDsxuMutationToolName(candidate.name)) ordinal++
    if (candidate.id === block.id) return ordinal
  }
  return 0
}

export function shouldBlockEditBudgetExhausted(
  messages: readonly Message[] | undefined,
  toolUseBlocks: readonly ToolUseBlock[],
  block: ToolUseBlock,
): boolean {
  if (!isDsxuMutationToolName(block.name)) return false
  const contract = getDsxuEditBudgetContract(messages)
  const maxEdits = contract?.maxSuccessfulEdits ?? contract?.exactSuccessfulEdits
  if (!maxEdits) return false

  const completedMutations = countDsxuSuccessfulSourceMutations(messages)
  const batchOrdinal = getBatchMutationOrdinal(toolUseBlocks, block)
  return completedMutations + Math.max(batchOrdinal, 1) > maxEdits
}

function allowsVerificationBetweenExactEdits(
  messages: readonly Message[] | undefined,
): boolean {
  const text = (messages ?? []).flatMap(getDsxuMessageText).join('\n')
  return /\b(?:verify|run\s+tests?|run\s+checks?)\s+after\s+(?:each|every)\s+Edit\b/i.test(text) ||
    /\bafter\s+(?:each|every)\s+Edit\b[\s\S]{0,80}\b(?:verify|run\s+tests?|run\s+checks?)\b/i.test(text)
}

function requiresVerificationAfterExactEditBudget(
  messages: readonly Message[] | undefined,
): boolean {
  const text = (messages ?? []).flatMap(getDsxuMessageText).join('\n')
  return (
    /\b(?:then|afterwards|finally)\b[\s\S]{0,120}\b(?:run|perform|use)\s+(?:one\s+|a\s+single\s+)?(?:PowerShell\s+|Bash\s+|native\s+)?(?:bun\s+test|verification|test|check)\b[\s\S]{0,120}\bafter\s+(?:those|all|the)\s+(?:source\s+)?Edits?\b/i.test(text) ||
    /\bafter\s+(?:those|all|the)\s+(?:source\s+)?Edits?\b[\s\S]{0,120}\b(?:run|perform|use)\s+(?:one\s+|a\s+single\s+)?(?:PowerShell\s+|Bash\s+|native\s+)?(?:bun\s+test|verification|test|check)\b/i.test(text) ||
    /\brun\s+(?:one\s+|a\s+single\s+)?(?:final\s+)?(?:PowerShell\s+|Bash\s+|native\s+)?(?:bun\s+test|verification|test|check)\s+after\s+(?:those|all|the)\s+(?:source\s+)?Edits?\b/i.test(text) ||
    /\bdo\s+not\s+(?:verify|run\s+tests?|run\s+checks?)\s+between\s+(?:planned\s+)?(?:source\s+)?Edits?\b/i.test(text)
  )
}

export function shouldBlockPrematureVerificationBeforeExactEditBudgetComplete(
  messages: readonly Message[] | undefined,
  block: ToolUseBlock,
): boolean {
  if (!isDsxuVerificationToolName(block.name)) return false
  const contract = getDsxuEditBudgetContract(messages)
  const exactEdits = contract?.exactSuccessfulEdits
  if (!exactEdits || exactEdits <= 1) return false
  if (allowsVerificationBetweenExactEdits(messages)) return false
  if (!requiresVerificationAfterExactEditBudget(messages)) return false

  const completedMutations = countDsxuSuccessfulSourceMutations(messages)
  return completedMutations > 0 && completedMutations < exactEdits
}

function getSemanticToolKey(block: ToolUseBlock): string | null {
  if (!DSXU_REPEATED_SEMANTIC_TOOL_NAMES.has(block.name)) return null
  if (block.name === DSXU_FILE_READ_TOOL_NAME) {
    const filePath = getToolInputFilePath(block)
    return filePath ? `${block.name}:${normalizeDsxuPath(filePath)}` : null
  }
  if (block.name === 'Glob') {
    const pattern = getToolInputString(block, 'pattern')
    const path = getToolInputString(block, 'path') ?? ''
    return pattern
      ? `${block.name}:${normalizeSemanticText(path)}:${normalizeSemanticText(pattern)}`
      : null
  }
  if (block.name === 'Grep') {
    const pattern = getToolInputString(block, 'pattern')
    const path = getToolInputString(block, 'path') ?? ''
    const glob = getToolInputString(block, 'glob') ?? ''
    return pattern
      ? `${block.name}:${normalizeSemanticText(path)}:${normalizeSemanticText(glob)}:${normalizeSemanticText(pattern)}`
      : null
  }
  if (block.name === BASH_TOOL_NAME || block.name === POWERSHELL_TOOL_NAME) {
    const command = getToolInputString(block, 'command')
    return command ? `${block.name}:${normalizeSemanticText(command)}` : null
  }
  return null
}

export function shouldBlockRepeatedSemanticToolInBatch(
  toolUseBlocks: readonly ToolUseBlock[],
  block: ToolUseBlock,
): boolean {
  const key = getSemanticToolKey(block)
  if (!key) return false
  let seen = 0
  for (const candidate of toolUseBlocks) {
    if (getSemanticToolKey(candidate) === key) seen++
    if (candidate.id === block.id) return seen > 1
  }
  return false
}

function hasDsxuSourceMutationProgress(text: string): boolean {
  return /DSXU tool state:\s*(?:edit_applied|edit_already_applied|write_applied|file_written)\b/i.test(text)
}

export function shouldBlockReadCacheHitRepeat(
  messages: readonly Message[] | undefined,
  block: ToolUseBlock,
): boolean {
  if (block.name !== DSXU_FILE_READ_TOOL_NAME) return false
  const key = getSemanticToolKey(block)
  if (!key) return false

  const toolKeyById = new Map<string, string>()
  const unchangedReadKeys = new Set<string>()
  for (const message of messages ?? []) {
    if (message.type === 'assistant') {
      for (const candidate of getDsxuMessageContentArray(message)) {
        if (!candidate || typeof candidate !== 'object') continue
        const maybeToolUse = candidate as Partial<ToolUseBlock> & {
          type?: unknown
        }
        if (
          maybeToolUse.type === 'tool_use' &&
          typeof maybeToolUse.id === 'string' &&
          typeof maybeToolUse.name === 'string'
        ) {
          const semanticKey = getSemanticToolKey(maybeToolUse as ToolUseBlock)
          if (semanticKey) toolKeyById.set(maybeToolUse.id, semanticKey)
        }
      }
      continue
    }
    if (message.type !== 'user') continue
    const content = message.message.content
    if (!Array.isArray(content)) continue
    for (const result of content) {
      if (
        !result ||
        typeof result !== 'object' ||
        (result as { type?: unknown }).type !== 'tool_result'
      ) {
        continue
      }
      const text = (result as { content?: unknown }).content
      if (typeof text !== 'string') continue
      if (hasDsxuSourceMutationProgress(text)) {
        unchangedReadKeys.clear()
        continue
      }
      if (!/DSXU tool state:\s*read_cache_hit\b/i.test(text)) continue
      const toolUseId = (result as { tool_use_id?: unknown }).tool_use_id
      if (typeof toolUseId !== 'string') continue
      const resultKey = toolKeyById.get(toolUseId)
      if (resultKey) unchangedReadKeys.add(resultKey)
    }
  }
  return unchangedReadKeys.has(key)
}

function extractEditedPathsFromToolResult(text: string): Set<string> {
  const paths = new Set<string>()
  const patterns = [
    /\bThe file\s+(.+?)\s+has been updated(?: successfully)?\b/gi,
    /\bThe requested edit for\s+(.+?)\s+is already present\b/gi,
  ]
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const candidate = match[1]?.trim()
      if (candidate) paths.add(normalizeDsxuPath(candidate))
    }
  }
  return paths
}

type PendingEditGate = {
  paths: Set<string>
  failedVerificationAfterEdit: boolean
}

function getPendingEditGate(messages: readonly Message[]): PendingEditGate | null {
  let pending: PendingEditGate | null = null
  for (const message of messages) {
    if (message.type !== 'user') continue
    const content = message.message.content
    if (!Array.isArray(content)) continue
    for (const block of content) {
      if (block.type !== 'tool_result' || typeof block.content !== 'string') {
        continue
      }
      const text = block.content
      if (/DSXU tool state:\s*(?:edit_applied|edit_already_applied)\b/i.test(text)) {
        pending = {
          paths: extractEditedPathsFromToolResult(text),
          failedVerificationAfterEdit: false,
        }
        continue
      }
      if (/DSXU tool state:\s*verification_passed\b/i.test(text)) {
        pending = null
        continue
      }
      if (looksLikeDsxuEvidenceCollectedPass(text)) {
        pending = null
        continue
      }
      if (pending && looksLikeFailedVerification(text)) {
        pending.failedVerificationAfterEdit = true
      }
    }
  }
  return pending
}

function isSamePendingEditPath(
  messages: readonly Message[] | undefined,
  block: ToolUseBlock,
): boolean {
  const targetPath = getToolInputFilePath(block)
  if (!targetPath) return false
  const pending = getPendingEditGate(messages ?? [])
  if (!pending || pending.failedVerificationAfterEdit) return false
  return pending.paths.has(normalizeDsxuPath(targetPath))
}

function allowsSameFileReadAfterEditForSourceTruth(
  messages: readonly Message[] | undefined,
  block: ToolUseBlock,
): boolean {
  const text = (messages ?? []).flatMap(getDsxuMessageText).join('\n')
  const description = [
    getToolInputString(block, 'description'),
    getToolInputString(block, 'reason'),
  ].filter(Boolean).join('\n')
  const combined = `${text}\n${description}`
  return (
    /\b(?:second|next|another|remaining)\s+(?:same-file\s+)?(?:source\s+)?Edit\b/i.test(combined) ||
    /\b(?:multiple|two|three|\d+)\s+(?:source\s+)?Edits?\s+in\s+(?:the\s+)?same\s+file\b/i.test(combined) ||
    /\breread\s+(?:the\s+)?same\s+file\b[\s\S]{0,100}\b(?:next|second|another|remaining|source-truth|stale|changed)\b/i.test(combined) ||
    /\b(?:source-truth|stale\s+context|user\s+modified|mtime|compact\/resume|resume)\s+(?:recovery|check|reread)\b/i.test(combined)
  )
}

export function shouldBlockReadAfterEditBeforeVerification(
  messages: readonly Message[] | undefined,
  block: ToolUseBlock,
): boolean {
  return (
    block.name === DSXU_FILE_READ_TOOL_NAME &&
    !allowsSameFileReadAfterEditForSourceTruth(messages, block) &&
    isSamePendingEditPath(messages, block)
  )
}

export function shouldBlockWriteFallbackAfterEdit(
  messages: readonly Message[] | undefined,
  block: ToolUseBlock,
): boolean {
  return block.name === FILE_WRITE_TOOL_NAME && isSamePendingEditPath(messages, block)
}

export function getFailedVerificationStreakSinceProgress(
  messages: readonly Message[],
): number {
  let streak = 0
  for (const message of messages) {
    if (message.type !== 'user') continue
    const content = message.message.content
    if (!Array.isArray(content)) continue
    for (const block of content) {
      if (block.type !== 'tool_result' || typeof block.content !== 'string') {
        continue
      }
      if (/DSXU tool state:\s*(?:edit_applied|edit_already_applied|verification_passed|edit_preflight_required|edit_preflight_failed)/i.test(block.content)) {
        streak = 0
        continue
      }
      if (looksLikeDsxuEvidenceCollectedPass(block.content)) {
        streak = 0
        continue
      }
      if (looksLikeFailedVerification(block.content)) {
        streak++
      }
    }
  }
  return streak
}

export function shouldBlockRepeatedFailedVerification(
  messages: readonly Message[] | undefined,
  block: ToolUseBlock,
): boolean {
  return (
    isDsxuVerificationToolName(block.name) &&
    getFailedVerificationStreakSinceProgress(messages ?? []) >= DSXU_FAILED_VERIFICATION_RERUN_LIMIT
  )
}

function getLatestDsxuToolResultText(messages: readonly Message[]): string | null {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex--) {
    const message = messages[messageIndex]
    if (message.type !== 'user') continue
    const content = message.message.content
    if (!Array.isArray(content)) continue
    for (let blockIndex = content.length - 1; blockIndex >= 0; blockIndex--) {
      const block = content[blockIndex]
      if (block.type === 'tool_result' && typeof block.content === 'string') {
        return block.content
      }
    }
  }
  return null
}

export function shouldBlockWorkerLocalVerificationAfterParentHandoff(
  messages: readonly Message[] | undefined,
  block: ToolUseBlock,
): boolean {
  if (!isDsxuVerificationToolName(block.name)) return false
  const latest = getLatestDsxuToolResultText(messages ?? [])
  return !!latest && (
    /next=planned_edit_or_parent_verification_handoff\b/i.test(latest) ||
    /parent\/verifier owns post-edit verification/i.test(latest)
  )
}

export function createWorkerLocalVerificationAfterParentHandoffBlockedMessage(
  block: ToolUseBlock,
  assistantMessage: AssistantMessage,
): Message {
  const content =
    `DSXU worker handoff gate blocked this ${block.name} call because the delegated worker already completed its Edit and the parent/verifier owns post-edit verification. ` +
    'Do not spend local verification tools inside the worker after a parent-verification handoff. Report the changed file and expected regression evidence, then let the parent run the single required verification.\n' +
    'DSXU tool state: worker_verification_blocked_parent_handoff; blocked=worker_local_verification_after_handoff; next=report_edit_result_to_parent.'

  return createUserMessage({
    content: [
      {
        type: 'tool_result',
        content,
        is_error: true,
        tool_use_id: block.id,
      },
    ],
    toolUseResult: content,
    sourceToolAssistantUUID: assistantMessage.uuid,
  })
}

export function shouldBlockParentMutationAfterWorkerOwnership(
  messages: readonly Message[] | undefined,
  block: ToolUseBlock,
): boolean {
  return (
    isDsxuMutationToolName(block.name) &&
    getLatestDsxuToolState(messages ?? []) === 'agent_worker_owned'
  )
}

export function createParentMutationAfterWorkerOwnershipBlockedMessage(
  block: ToolUseBlock,
  assistantMessage: AssistantMessage,
): Message {
  const content =
    `DSXU Agent ownership gate blocked this parent ${block.name} call because the latest Agent handoff marked the implementation scope as worker-owned. ` +
    'Do not duplicate or take over worker-owned edits in the parent context. Wait for worker evidence, use SendMessage once to request missing evidence or correction, or explicitly report PARTIAL if the worker cannot complete within scope.\n' +
    'DSXU tool state: parent_mutation_blocked_worker_owned; blocked=parent_edit_worker_owned_scope; next=worker_evidence_or_sendmessage.'

  return createUserMessage({
    content: [
      {
        type: 'tool_result',
        content,
        is_error: true,
        tool_use_id: block.id,
      },
    ],
    toolUseResult: content,
    sourceToolAssistantUUID: assistantMessage.uuid,
  })
}

export function createDiscoveryNarrowingRequiredMessage(
  block: ToolUseBlock,
  assistantMessage: AssistantMessage,
): Message {
  const content =
    `DSXU discovery narrowing required: this same-turn ${block.name} call was not run because the assistant already requested ${DSXU_DISCOVERY_BATCH_BUDGET} discovery tools in this batch. ` +
    'Use the discovery results already returned to make a short candidate-file selection before any more broad discovery. Required shape: candidate_files, evidence_for_each_candidate, selected_candidate, latest_source_truth_to_read_or_reuse, smallest_safe_edit, verification_command, and why lower-priority candidates can wait. ' +
    'Then choose one candidate and Edit, verify, or report PARTIAL with the exact missing fact. Do not switch to shell listing, shell reads, or shell writes to bypass narrowing.\n' +
    'DSXU tool state: discovery_narrowing_required; blocked=broad_same_turn_discovery; next=candidate_file_selection.'

  return createUserMessage({
    content: [
      {
        type: 'tool_result',
        content,
        is_error: true,
        tool_use_id: block.id,
      },
    ],
    toolUseResult: content,
    sourceToolAssistantUUID: assistantMessage.uuid,
  })
}

export function createRepeatedSemanticToolBlockedMessage(
  block: ToolUseBlock,
  assistantMessage: AssistantMessage,
): Message {
  const content =
    `DSXU semantic tool gate blocked this repeated ${block.name} call because the same tool target already appears in the current assistant batch. ` +
    'Use the first result for that target, then narrow, edit, verify, or report PARTIAL with the exact missing fact. Do not spend another tool call on an identical target in the same turn.\n' +
    'DSXU tool state: repeated_semantic_tool_blocked; blocked=same_batch_same_target; next=use_existing_result_or_strategy_change.'

  return createUserMessage({
    content: [
      {
        type: 'tool_result',
        content,
        is_error: true,
        tool_use_id: block.id,
      },
    ],
    toolUseResult: content,
    sourceToolAssistantUUID: assistantMessage.uuid,
  })
}

export function createReadCacheHitRepeatBlockedMessage(
  block: ToolUseBlock,
  assistantMessage: AssistantMessage,
): Message {
  const content =
    'DSXU read-cache gate blocked this repeated Read because the same file already returned read_cache_hit and no source mutation changed it afterward. ' +
    'Treat the earlier Read content as current source truth for this cursor step. Move to the next planned file, Edit, verification, or PARTIAL with the exact missing fact.\n' +
    'DSXU tool state: read_cache_repeat_blocked; blocked=same_file_read_after_cache_hit; next=advance_cursor_or_verify.'

  return createUserMessage({
    content: [
      {
        type: 'tool_result',
        content,
        is_error: true,
        tool_use_id: block.id,
      },
    ],
    toolUseResult: content,
    sourceToolAssistantUUID: assistantMessage.uuid,
  })
}

export function createVerificationAfterPassBlockedMessage(
  block: ToolUseBlock,
  assistantMessage: AssistantMessage,
): Message {
  const content =
    `DSXU stop-on-pass gate blocked this ${block.name} call because the current task is already verification_passed. ` +
    'Do not run more discovery, agents, cache clearing, or verification after a verified PASS. Reply with the requested PASS marker or final answer now. ' +
    'A later source mutation may continue only when it is part of the approved plan or an explicit next task; after that mutation, run one fresh verification.\n' +
    'DSXU tool state: tool_blocked_after_pass; blocked=post_pass_tool_call; next=final_answer.'

  return createUserMessage({
    content: [
      {
        type: 'tool_result',
        content,
        is_error: true,
        tool_use_id: block.id,
      },
    ],
    toolUseResult: content,
    sourceToolAssistantUUID: assistantMessage.uuid,
  })
}

export function createToolAfterPassMarkerBlockedMessage(
  block: ToolUseBlock,
  assistantMessage: AssistantMessage,
): Message {
  const content =
    `DSXU stop-on-pass marker gate blocked this ${block.name} call because the assistant already emitted a terminal PASS marker. ` +
    'No tool calls are allowed after a requested PASS marker. Reply with the final answer only, or report the exact terminal evidence already collected.\n' +
    'DSXU tool state: tool_blocked_after_pass_marker; blocked=post_pass_marker_tool_call; next=final_answer.'

  return createUserMessage({
    content: [
      {
        type: 'tool_result',
        content,
        is_error: true,
        tool_use_id: block.id,
      },
    ],
    toolUseResult: content,
    sourceToolAssistantUUID: assistantMessage.uuid,
  })
}

export function createRepeatedFailedVerificationBlockedMessage(
  block: ToolUseBlock,
  assistantMessage: AssistantMessage,
): Message {
  const content =
    'DSXU recovery gate blocked this repeated verification command because the latest attempts are still failing and no source-changing action has occurred since those failures. ' +
    'Do not rerun the same verification unchanged. Use the latest failing assertion to make one precise source Edit that changes the failing behavior, or output PARTIAL/FAIL with the exact blocker if no safe Edit is identifiable.\n' +
    'DSXU tool state: verification_blocked_repeated_failure; blocked=failed_verification_rerun; next=source_repair_or_partial.'

  return createUserMessage({
    content: [
      {
        type: 'tool_result',
        content,
        is_error: true,
        tool_use_id: block.id,
      },
    ],
    toolUseResult: content,
    sourceToolAssistantUUID: assistantMessage.uuid,
  })
}

export function createReadAfterEditBlockedMessage(
  block: ToolUseBlock,
  assistantMessage: AssistantMessage,
): Message {
  const content =
    'DSXU edit-convergence gate blocked this Read because the same file already had a successful Edit and no fresh verification failure followed it. ' +
    'Do not reread the just-edited file merely to confirm the diff; the Edit result is the current source-truth checkpoint. Run the smallest relevant verification command next, continue to a different planned file edit, reread only for an explicit same-file source-truth recovery/next-edit need, or report PARTIAL with the exact blocker.\n' +
    'DSXU tool state: read_blocked_after_edit; blocked=read_edited_file_before_verification; next=verify_or_distinct_planned_edit_or_explicit_source_truth_reread.'

  return createUserMessage({
    content: [
      {
        type: 'tool_result',
        content,
        is_error: true,
        tool_use_id: block.id,
      },
    ],
    toolUseResult: content,
    sourceToolAssistantUUID: assistantMessage.uuid,
  })
}

export function createWriteFallbackAfterEditBlockedMessage(
  block: ToolUseBlock,
  assistantMessage: AssistantMessage,
): Message {
  const content =
    'DSXU edit-convergence gate blocked this Write because the same file already had a successful Edit and no fresh verification failure followed it. ' +
    'Do not overwrite a just-edited file as a fallback for stale old_string confusion. Run the smallest relevant verification command now; if it fails, use the latest failure/source truth for one precise Edit or report PARTIAL.\n' +
    'DSXU tool state: write_fallback_blocked_after_edit; blocked=shell_write_fallback_after_edit; next=verify_or_failed_verification_repair.'

  return createUserMessage({
    content: [
      {
        type: 'tool_result',
        content,
        is_error: true,
        tool_use_id: block.id,
      },
    ],
    toolUseResult: content,
    sourceToolAssistantUUID: assistantMessage.uuid,
  })
}

export function createEditBudgetExhaustedBlockedMessage(
  block: ToolUseBlock,
  assistantMessage: AssistantMessage,
): Message {
  const content =
    `DSXU edit-budget gate blocked this ${block.name} call because the current task has an explicit successful-Edit budget and the next mutation would exceed that contract. ` +
    'Do not spend extra Edit/Write calls after the required source changes are done. Run the smallest allowed verification, emit the requested final marker if verification already passed, or report PARTIAL/FAIL with the latest mismatch or failing evidence.\n' +
    'DSXU tool state: edit_budget_exhausted; blocked=exact_edit_budget_reached; next=verify_or_final_or_partial.'

  return createUserMessage({
    content: [
      {
        type: 'tool_result',
        content,
        is_error: true,
        tool_use_id: block.id,
      },
    ],
    toolUseResult: content,
    sourceToolAssistantUUID: assistantMessage.uuid,
  })
}

export function createPrematureVerificationBeforeExactEditBudgetBlockedMessage(
  block: ToolUseBlock,
  assistantMessage: AssistantMessage,
): Message {
  const content =
    `DSXU edit-budget gate blocked this ${block.name} call because the current task explicitly requires multiple successful Edits and that edit budget is not complete yet. ` +
    'Do not run verification between planned source edits unless the user explicitly asked to verify after each Edit. Continue with the next already-planned Edit using the current source truth, then run one final verification after the exact Edit budget is complete.\n' +
    'DSXU tool state: verification_blocked_pending_exact_edits; blocked=premature_verification_before_exact_edit_budget_complete; next=next_planned_edit_then_verify.'

  return createUserMessage({
    content: [
      {
        type: 'tool_result',
        content,
        is_error: true,
        tool_use_id: block.id,
      },
    ],
    toolUseResult: content,
    sourceToolAssistantUUID: assistantMessage.uuid,
  })
}

export function createUnsafeBatchVerificationBlockedMessage(
  block: ToolUseBlock,
  assistantMessage: AssistantMessage,
): Message {
  const content =
    'DSXU pre-execution tool batch gate blocked this verification command because the same assistant tool batch also contains a file mutation. ' +
    'Run the mutation first, wait for its tool result, then issue one fresh verification command in the next turn. ' +
    'Do not treat this blocked verification as PASS or FAIL evidence.\n' +
    'DSXU tool state: verification_blocked_unsafe_batch; blocked=stale_same_batch_verification; next=wait_for_mutation_result_then_verify.'

  return createUserMessage({
    content: [
      {
        type: 'tool_result',
        content,
        is_error: true,
        tool_use_id: block.id,
      },
    ],
    toolUseResult: content,
    sourceToolAssistantUUID: assistantMessage.uuid,
  })
}

function buildDsxuToolBatchGateDecision({
  block,
  gateId,
  gateClass,
  reason,
  blocked = true,
  nextAction,
  createMessage,
}: {
  block: ToolUseBlock
  gateId: string
  gateClass: DsxuToolBatchGateClass
  reason: string
  blocked?: boolean
  nextAction: string
  createMessage: (
    block: ToolUseBlock,
    assistantMessage: AssistantMessage,
  ) => Message
}): DsxuToolBatchGateDecision {
  return {
    owner: 'tool_lifecycle',
    gateId,
    gateKind: 'tool_batch',
    gateClass,
    reason,
    blocked,
    nextAction,
    createMessage: assistantMessage => createMessage(block, assistantMessage),
  }
}

export function getDsxuToolBatchGateDecision({
  messages,
  toolUseBlocks,
  block,
}: {
  messages: readonly Message[] | undefined
  toolUseBlocks: readonly ToolUseBlock[]
  block: ToolUseBlock
}): DsxuToolBatchGateDecision | null {
  if (shouldBlockRepeatedSemanticToolInBatch(toolUseBlocks, block)) {
    return buildDsxuToolBatchGateDecision({
      block,
      gateId: 'dsxu_repeated_semantic_tool_gate',
      gateClass: 'CAPABILITY_NUDGE',
      reason: 'repeated_semantic_tool',
      nextAction: 'use_existing_result_or_strategy_change',
      createMessage: createRepeatedSemanticToolBlockedMessage,
    })
  }
  if (shouldRequireDiscoveryNarrowingInBatch(toolUseBlocks, block)) {
    return buildDsxuToolBatchGateDecision({
      block,
      gateId: 'dsxu_discovery_narrowing_gate',
      gateClass: 'CAPABILITY_NUDGE',
      reason: 'discovery_narrowing',
      nextAction: 'select_candidate_file_before_more_discovery',
      createMessage: createDiscoveryNarrowingRequiredMessage,
    })
  }
  if (shouldBlockToolAfterAssistantPassMarker(messages, block)) {
    return buildDsxuToolBatchGateDecision({
      block,
      gateId: 'dsxu_post_pass_marker_gate',
      gateClass: 'BENCH_CONTRACT_ONLY',
      reason: 'post_pass_marker',
      nextAction: 'final_answer_from_existing_pass_marker',
      createMessage: createToolAfterPassMarkerBlockedMessage,
    })
  }
  if (shouldBlockVerificationAfterVerifiedPass(messages, block)) {
    return buildDsxuToolBatchGateDecision({
      block,
      gateId: 'dsxu_post_pass_tool_gate',
      gateClass: 'QUALITY_BLOCK',
      reason: 'post_pass',
      nextAction: 'final_answer_after_verified_pass',
      createMessage: createVerificationAfterPassBlockedMessage,
    })
  }
  if (shouldBlockRepeatedFailedVerification(messages, block)) {
    return buildDsxuToolBatchGateDecision({
      block,
      gateId: 'dsxu_repeated_failed_verification_gate',
      gateClass: 'RECOVERY_BLOCK',
      reason: 'repeated_failed_verification',
      nextAction: 'source_repair_or_partial',
      createMessage: createRepeatedFailedVerificationBlockedMessage,
    })
  }
  if (shouldBlockWorkerLocalVerificationAfterParentHandoff(messages, block)) {
    return buildDsxuToolBatchGateDecision({
      block,
      gateId: 'dsxu_worker_handoff_verification_gate',
      gateClass: 'QUALITY_BLOCK',
      reason: 'worker_local_verification_after_handoff',
      nextAction: 'report_edit_result_to_parent',
      createMessage: createWorkerLocalVerificationAfterParentHandoffBlockedMessage,
    })
  }
  if (shouldBlockReadCacheHitRepeat(messages, block)) {
    return buildDsxuToolBatchGateDecision({
      block,
      gateId: 'dsxu_read_cache_repeat_gate',
      gateClass: 'COST_SMELL',
      reason: 'read_cache_hit_repeat',
      blocked: false,
      nextAction: 'advance_cursor_or_verify',
      createMessage: createReadCacheHitRepeatBlockedMessage,
    })
  }
  if (shouldBlockReadAfterEditBeforeVerification(messages, block)) {
    return buildDsxuToolBatchGateDecision({
      block,
      gateId: 'dsxu_read_after_edit_gate',
      gateClass: 'QUALITY_BLOCK',
      reason: 'read_after_edit_before_verification',
      nextAction: 'verify_or_distinct_planned_edit_or_explicit_source_truth_reread',
      createMessage: createReadAfterEditBlockedMessage,
    })
  }
  if (shouldBlockEditBudgetExhausted(messages, toolUseBlocks, block)) {
    return buildDsxuToolBatchGateDecision({
      block,
      gateId: 'dsxu_edit_budget_gate',
      gateClass: 'BENCH_CONTRACT_ONLY',
      reason: 'edit_budget_exhausted',
      blocked: false,
      nextAction: 'verify_or_final_or_partial',
      createMessage: createEditBudgetExhaustedBlockedMessage,
    })
  }
  if (shouldBlockPrematureVerificationBeforeExactEditBudgetComplete(messages, block)) {
    return buildDsxuToolBatchGateDecision({
      block,
      gateId: 'dsxu_exact_edit_budget_verification_gate',
      gateClass: 'BENCH_CONTRACT_ONLY',
      reason: 'premature_verification_before_exact_edit_budget_complete',
      blocked: false,
      nextAction: 'next_planned_edit_then_verify',
      createMessage: createPrematureVerificationBeforeExactEditBudgetBlockedMessage,
    })
  }
  if (shouldBlockWriteFallbackAfterEdit(messages, block)) {
    return buildDsxuToolBatchGateDecision({
      block,
      gateId: 'dsxu_write_fallback_after_edit_gate',
      gateClass: 'QUALITY_BLOCK',
      reason: 'write_fallback_after_edit',
      nextAction: 'verify_or_failed_verification_repair',
      createMessage: createWriteFallbackAfterEditBlockedMessage,
    })
  }
  if (shouldBlockParentMutationAfterWorkerOwnership(messages, block)) {
    return buildDsxuToolBatchGateDecision({
      block,
      gateId: 'dsxu_agent_worker_ownership_gate',
      gateClass: 'QUALITY_BLOCK',
      reason: 'parent_mutation_worker_owned',
      nextAction: 'worker_evidence_or_sendmessage',
      createMessage: createParentMutationAfterWorkerOwnershipBlockedMessage,
    })
  }
  if (shouldBlockUnsafeBatchVerification(toolUseBlocks, block)) {
    return buildDsxuToolBatchGateDecision({
      block,
      gateId: 'dsxu_unsafe_batch_verification_gate',
      gateClass: 'QUALITY_BLOCK',
      reason: 'unsafe_batch_verification',
      nextAction: 'wait_for_mutation_result_then_verify',
      createMessage: createUnsafeBatchVerificationBlockedMessage,
    })
  }
  return null
}
