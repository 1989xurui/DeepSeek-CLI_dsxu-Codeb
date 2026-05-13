import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join, resolve, sep } from 'path'
import {
  buildDsxuContextOwnerRuleFromResume,
  type DsxuContextOwnerRuleDecision,
} from './context-owner-rule-v1'

export type DsxuScopeFence = {
  allowedFiles: readonly string[]
  deniedFiles: readonly string[]
  allowedDirs: readonly string[]
  deniedDirs: readonly string[]
  allowedTools: readonly string[]
  deniedTools: readonly string[]
}

export type DsxuTaskStateSnapshot = {
  goal: string
  scope: string
  filesRead: readonly string[]
  filesChanged: readonly string[]
  lastPassingCommand?: string
  failedCommands: readonly string[]
  permissionDenials: readonly string[]
  activeAgents: readonly string[]
  pendingTasks: readonly string[]
  workflowPreferencesApplied: readonly string[]
  nextAction: string
  verificationStatus: 'unknown' | 'unverified' | 'partial' | 'failed' | 'passed'
  createdAt: string
}

export type DsxuWorkflowPreference = {
  id: string
  text: string
  keywords: readonly string[]
}

export type DsxuTaskStateSnapshotPromptState = Partial<
  Omit<DsxuTaskStateSnapshot, 'createdAt'>
> & {
  createdAt?: string
}

type DsxuConversationMessageLike = {
  type?: string
  message?: {
    role?: string
    content?: string | readonly unknown[]
  }
}

const EMPTY_SCOPE_FENCE: DsxuScopeFence = {
  allowedFiles: [],
  deniedFiles: [],
  allowedDirs: [],
  deniedDirs: [],
  allowedTools: [],
  deniedTools: [],
}

function splitList(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(/[,;\n]/)
    .map(item => item.trim().replace(/^[-*]\s*/, ''))
    .filter(Boolean)
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[\s_-]+/g, '')
}

function boundedList(items: readonly string[] | undefined, fallback = 'none'): string {
  if (!items || items.length === 0) return fallback
  return [...new Set(items.filter(Boolean))].slice(0, 12).join(', ')
}

function normalizePathForCompare(root: string, candidate: string): string {
  const resolved = resolve(root, candidate)
  return resolved.toLowerCase().replace(/[\\/]+/g, sep)
}

function blockText(block: unknown): string {
  if (!block || typeof block !== 'object') return ''
  const item = block as Record<string, unknown>
  if (typeof item.text === 'string') return item.text
  if (typeof item.content === 'string') return item.content
  if (Array.isArray(item.content)) return item.content.map(blockText).filter(Boolean).join('\n')
  return ''
}

function messageText(message: DsxuConversationMessageLike): string {
  const content = message.message?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map(blockText).filter(Boolean).join('\n')
  return ''
}

function getToolUseBlocks(message: DsxuConversationMessageLike): Array<Record<string, unknown>> {
  const content = message.message?.content
  if (!Array.isArray(content)) return []
  return content
    .filter(block => block && typeof block === 'object')
    .map(block => block as Record<string, unknown>)
    .filter(block => block.type === 'tool_use')
}

function getToolResultBlocks(message: DsxuConversationMessageLike): Array<Record<string, unknown>> {
  const content = message.message?.content
  if (!Array.isArray(content)) return []
  return content
    .filter(block => block && typeof block === 'object')
    .map(block => block as Record<string, unknown>)
    .filter(block => block.type === 'tool_result')
}

function normalizeToolName(name: unknown): string {
  return typeof name === 'string' ? name.toLowerCase() : ''
}

function getInputString(block: Record<string, unknown>, key: string): string | undefined {
  const input = block.input
  if (!input || typeof input !== 'object') return undefined
  const value = (input as Record<string, unknown>)[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function looksLikePassingVerification(text: string): boolean {
  const lower = text.toLowerCase()
  if (lower.includes('dsxu tool state: verification_passed')) return true
  if (lower.includes('exit code 1') || lower.includes('failed') || /\b\d+\s+fail\b/.test(lower)) {
    return false
  }
  return /\b0\s+fail\b/.test(lower) || /\b\d+\s+pass(?:ed)?\b/.test(lower)
}

function looksLikeFailedVerification(text: string): boolean {
  const lower = text.toLowerCase()
  return (
    lower.includes('dsxu tool state: verification_failed') ||
    lower.includes('exit code 1') ||
    /\b\d+\s+fail\b/.test(lower) ||
    lower.includes('error:')
  )
}

function isSameOrChild(parent: string, candidate: string): boolean {
  return candidate === parent || candidate.startsWith(parent.endsWith(sep) ? parent : `${parent}${sep}`)
}

export function parseDsxuScopeFence(planText: string): DsxuScopeFence {
  const parsed: Record<string, string[]> = {}
  const linePattern = /^\s*(?:[-*]\s*)?(allowed files|denied files|allowed dirs|allowed directories|denied dirs|denied directories|allowed tools|denied tools)\s*:\s*(.+)$/gim
  let match: RegExpExecArray | null

  while ((match = linePattern.exec(planText)) !== null) {
    const key = normalizeKey(match[1] ?? '')
    parsed[key] = [...(parsed[key] ?? []), ...splitList(match[2])]
  }

  return {
    allowedFiles: parsed.allowedfiles ?? [],
    deniedFiles: parsed.deniedfiles ?? [],
    allowedDirs: [...(parsed.alloweddirs ?? []), ...(parsed.alloweddirectories ?? [])],
    deniedDirs: [...(parsed.denieddirs ?? []), ...(parsed.denieddirectories ?? [])],
    allowedTools: parsed.allowedtools ?? [],
    deniedTools: parsed.deniedtools ?? [],
  }
}

export function isPathAllowedByDsxuScopeFence(
  root: string,
  filePath: string,
  scopeFence: DsxuScopeFence = EMPTY_SCOPE_FENCE,
): { allowed: boolean; reason: string } {
  const candidate = normalizePathForCompare(root, filePath)
  const deniedFile = scopeFence.deniedFiles.find(item => normalizePathForCompare(root, item) === candidate)
  if (deniedFile) {
    return { allowed: false, reason: `denied file: ${deniedFile}` }
  }

  const deniedDir = scopeFence.deniedDirs.find(item =>
    isSameOrChild(normalizePathForCompare(root, item), candidate),
  )
  if (deniedDir) {
    return { allowed: false, reason: `denied directory: ${deniedDir}` }
  }

  const hasAllowlist = scopeFence.allowedFiles.length > 0 || scopeFence.allowedDirs.length > 0
  if (!hasAllowlist) {
    return { allowed: true, reason: 'no allowlist scope fence' }
  }

  const allowedFile = scopeFence.allowedFiles.find(item => normalizePathForCompare(root, item) === candidate)
  if (allowedFile) {
    return { allowed: true, reason: `allowed file: ${allowedFile}` }
  }

  const allowedDir = scopeFence.allowedDirs.find(item =>
    isSameOrChild(normalizePathForCompare(root, item), candidate),
  )
  if (allowedDir) {
    return { allowed: true, reason: `allowed directory: ${allowedDir}` }
  }

  return { allowed: false, reason: 'outside allowed scope fence' }
}

export function isToolAllowedByDsxuScopeFence(
  toolName: string,
  scopeFence: DsxuScopeFence = EMPTY_SCOPE_FENCE,
): { allowed: boolean; reason: string } {
  const lower = toolName.toLowerCase()
  if (scopeFence.deniedTools.some(item => item.toLowerCase() === lower)) {
    return { allowed: false, reason: `denied tool: ${toolName}` }
  }
  if (scopeFence.allowedTools.length === 0) {
    return { allowed: true, reason: 'no tool allowlist scope fence' }
  }
  if (scopeFence.allowedTools.some(item => item.toLowerCase() === lower)) {
    return { allowed: true, reason: `allowed tool: ${toolName}` }
  }
  return { allowed: false, reason: `tool outside allowed scope fence: ${toolName}` }
}

export function createDsxuTaskStateSnapshot(
  input: Omit<DsxuTaskStateSnapshot, 'createdAt'> & { createdAt?: string },
): DsxuTaskStateSnapshot {
  return {
    ...input,
    createdAt: input.createdAt ?? new Date().toISOString(),
  }
}

export function createDsxuTaskStateSnapshotFromMessages(
  messages: readonly DsxuConversationMessageLike[],
  overrides: Partial<Omit<DsxuTaskStateSnapshot, 'createdAt'>> & { createdAt?: string } = {},
): DsxuTaskStateSnapshot {
  const filesRead: string[] = []
  const filesChanged: string[] = []
  const failedCommands: string[] = []
  const permissionDenials: string[] = []
  const activeAgents: string[] = []
  const toolCommands = new Map<string, string>()
  let latestUserGoal = ''
  let lastPassingCommand: string | undefined
  let verificationStatus: DsxuTaskStateSnapshot['verificationStatus'] = 'unknown'

  for (const message of messages) {
    if (message.type === 'user' && getToolResultBlocks(message).length === 0) {
      const text = messageText(message).trim()
      if (text) latestUserGoal = text.slice(0, 240)
    }

    for (const block of getToolUseBlocks(message)) {
      const name = normalizeToolName(block.name)
      const id = typeof block.id === 'string' ? block.id : undefined
      const filePath =
        getInputString(block, 'file_path') ??
        getInputString(block, 'path') ??
        getInputString(block, 'notebook_path')
      const command = getInputString(block, 'command')

      if (filePath && (name === 'read' || name === 'fileread')) filesRead.push(filePath)
      if (filePath && ['edit', 'write', 'fileedit', 'filewrite', 'notebookedit'].includes(name)) {
        filesChanged.push(filePath)
      }
      if (id && command && ['bash', 'powershell'].includes(name)) toolCommands.set(id, command)
      if (name === 'agent') {
        activeAgents.push(getInputString(block, 'description') ?? getInputString(block, 'prompt') ?? 'agent')
      }
    }

    for (const block of getToolResultBlocks(message)) {
      const text = blockText(block)
      const toolUseId = typeof block.tool_use_id === 'string' ? block.tool_use_id : undefined
      const command = toolUseId ? toolCommands.get(toolUseId) : undefined
      const lower = text.toLowerCase()

      if (lower.includes('permission') && /\bden(?:y|ied|ial)\b/.test(lower)) {
        permissionDenials.push(command ?? text.slice(0, 160))
      }
      if (looksLikePassingVerification(text)) {
        verificationStatus = 'passed'
        if (command) lastPassingCommand = command
      } else if (looksLikeFailedVerification(text)) {
        verificationStatus = 'failed'
        if (command) failedCommands.push(command)
      }
    }
  }

  const nextAction =
    overrides.nextAction ??
    (verificationStatus === 'passed'
      ? 'final answer with verification evidence'
      : verificationStatus === 'failed'
        ? 'read latest source truth and repair one hypothesis'
        : 'reread source truth before next edit or verification')

  return createDsxuTaskStateSnapshot({
    goal: overrides.goal ?? latestUserGoal ?? 'unknown',
    scope: overrides.scope ?? 'unknown',
    filesRead: overrides.filesRead ?? [...new Set(filesRead)],
    filesChanged: overrides.filesChanged ?? [...new Set(filesChanged)],
    lastPassingCommand: overrides.lastPassingCommand ?? lastPassingCommand,
    failedCommands: overrides.failedCommands ?? [...new Set(failedCommands)],
    permissionDenials: overrides.permissionDenials ?? [...new Set(permissionDenials)],
    activeAgents: overrides.activeAgents ?? [...new Set(activeAgents)],
    pendingTasks: overrides.pendingTasks ?? [],
    workflowPreferencesApplied: overrides.workflowPreferencesApplied ?? [],
    nextAction,
    verificationStatus: overrides.verificationStatus ?? verificationStatus,
    createdAt: overrides.createdAt,
  })
}

export function renderDsxuTaskStateSnapshotForResume(
  snapshot: DsxuTaskStateSnapshotPromptState,
): string {
  return `## Task-State Snapshot
- goal: ${snapshot.goal || 'unknown'}
- scope: ${snapshot.scope || 'unknown'}
- filesRead: ${boundedList(snapshot.filesRead)}
- filesChanged: ${boundedList(snapshot.filesChanged)}
- lastPassingCommand: ${snapshot.lastPassingCommand || 'none'}
- failedCommands: ${boundedList(snapshot.failedCommands)}
- permissionDenials: ${boundedList(snapshot.permissionDenials)}
- activeAgents: ${boundedList(snapshot.activeAgents)}
- pendingTasks: ${boundedList(snapshot.pendingTasks)}
- workflowPreferencesApplied: ${boundedList(snapshot.workflowPreferencesApplied)}
- nextAction: ${snapshot.nextAction || 'unknown'}
- verificationStatus: ${snapshot.verificationStatus || 'unknown'}
${snapshot.createdAt ? `- createdAt: ${snapshot.createdAt}\n` : ''}- Snapshot is navigation only. Reread source truth before editing or claiming PASS.`
}

export function writeDsxuTaskStateSnapshot(
  root: string,
  taskId: string,
  snapshot: DsxuTaskStateSnapshot,
): string {
  const safeTaskId = taskId.replace(/[^A-Za-z0-9_.-]/g, '_')
  const target = join(root, '.dsxu', 'snapshots', `${safeTaskId}.json`)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
  return target
}

export function readDsxuTaskStateSnapshot(
  root: string,
  taskId: string,
): DsxuTaskStateSnapshot | null {
  const safeTaskId = taskId.replace(/[^A-Za-z0-9_.-]/g, '_')
  const target = join(root, '.dsxu', 'snapshots', `${safeTaskId}.json`)
  if (!existsSync(target)) return null
  return JSON.parse(readFileSync(target, 'utf8')) as DsxuTaskStateSnapshot
}

export function selectDsxuWorkflowPreferences(
  taskText: string,
  preferences: readonly DsxuWorkflowPreference[],
): string[] {
  const lowerTask = taskText.toLowerCase()
  return preferences
    .filter(preference =>
      preference.keywords.some(keyword => lowerTask.includes(keyword.toLowerCase())),
    )
    .map(preference => preference.text)
}

export function getDsxuTaskGovernanceRuntimeProfile(): {
  module: 'DSXU Task Governance'
  absorbedFrom: readonly string[]
  guarantees: readonly string[]
} {
  return {
    module: 'DSXU Task Governance',
    absorbedFrom: [
      'reference fileHistory snapshot/rewind behavior',
      'reference PlanMode scope discipline',
      'reference SessionMemory preference recall behavior',
    ],
    guarantees: [
      'scope fence is parseable into file/tool allow/deny lists',
      'task snapshots persist navigation state without becoming PASS evidence',
      'workflow preferences are selected by task keywords as hints only',
    ],
  }
}

export type DsxuLocalMemoryKind =
  | 'project_fact'
  | 'task_snapshot'
  | 'failure_pattern'
  | 'user_preference'
  | 'verification_command'
  | 'evidence_index'

export type DsxuLocalMemoryEntry = {
  id: string
  kind: DsxuLocalMemoryKind
  title: string
  content: string
  sourcePath: string
  createdAt: string
  confidence: number
  deletablePath: string
  relatedFiles?: readonly string[]
}

export type DsxuLocalMemoryBundle = {
  entries: readonly DsxuLocalMemoryEntry[]
  warnings: readonly string[]
  sourceTruthRefreshRequired: boolean
  rereadFiles: readonly string[]
  rendered: string
}

export type DsxuSmoothResumePlan = {
  actions: readonly string[]
  mayEditFromMemory: false
  mayClaimPass: boolean
  ownerRule: DsxuContextOwnerRuleDecision
  rendered: string
}

function normalizeMemoryPath(filePath: string): string {
  return filePath.replace(/[\\/]+/g, '/').toLowerCase()
}

function memoryEntryOverlapsSourceTruth(
  entry: DsxuLocalMemoryEntry,
  currentSourceFiles: readonly string[],
): boolean {
  const sourceSet = new Set(currentSourceFiles.map(normalizeMemoryPath))
  return (entry.relatedFiles ?? []).some(filePath => sourceSet.has(normalizeMemoryPath(filePath)))
}

function isValidLocalMemoryEntry(entry: Partial<DsxuLocalMemoryEntry>): entry is DsxuLocalMemoryEntry {
  return Boolean(
    entry.id &&
      entry.kind &&
      entry.title &&
      entry.content &&
      entry.sourcePath &&
      entry.createdAt &&
      entry.deletablePath &&
      typeof entry.confidence === 'number' &&
      entry.confidence >= 0 &&
      entry.confidence <= 1,
  )
}

export function buildDsxuLocalMemoryReadOnlyBundle(input: {
  entries: readonly Partial<DsxuLocalMemoryEntry>[]
  currentSourceFiles?: readonly string[]
  minConfidence?: number
  maxEntries?: number
}): DsxuLocalMemoryBundle {
  const warnings: string[] = []
  const currentSourceFiles = input.currentSourceFiles ?? []
  const minConfidence = input.minConfidence ?? 0.5
  const maxEntries = input.maxEntries ?? 8
  const validEntries: DsxuLocalMemoryEntry[] = []

  for (const entry of input.entries) {
    if (!isValidLocalMemoryEntry(entry)) {
      warnings.push(`invalid-memory-entry:${entry.id ?? 'missing-id'}`)
      continue
    }
    if (entry.confidence < minConfidence) {
      warnings.push(`low-confidence-memory:${entry.id}`)
      continue
    }
    validEntries.push(entry)
  }

  const entries = validEntries
    .sort((a, b) => b.confidence - a.confidence || b.createdAt.localeCompare(a.createdAt))
    .slice(0, maxEntries)

  const rereadFiles = [
    ...new Set(
      entries
        .flatMap(entry => entry.relatedFiles ?? [])
        .filter(filePath => currentSourceFiles.map(normalizeMemoryPath).includes(normalizeMemoryPath(filePath))),
    ),
  ]
  const sourceTruthRefreshRequired = rereadFiles.length > 0
  const renderedEntries = entries
    .map(entry => {
      const reread = memoryEntryOverlapsSourceTruth(entry, currentSourceFiles)
        ? ' reread-source-before-use'
        : ''
      return `- ${entry.kind}: ${entry.title} (confidence=${entry.confidence.toFixed(2)}, source=${entry.sourcePath}, createdAt=${entry.createdAt})${reread}`
    })
    .join('\n')

  return {
    entries,
    warnings,
    sourceTruthRefreshRequired,
    rereadFiles,
    rendered: [
      '## LocalMemory Lite (read-only)',
      '- policy: memory is hint-only; current source files win.',
      `- sourceTruthRefreshRequired: ${sourceTruthRefreshRequired ? 'yes' : 'no'}`,
      rereadFiles.length ? `- rereadFiles: ${rereadFiles.join(', ')}` : '- rereadFiles: none',
      renderedEntries || '- entries: none',
      warnings.length ? `- warnings: ${warnings.join(', ')}` : '- warnings: none',
    ].join('\n'),
  }
}

export function buildDsxuSmoothResumePlan(input: {
  snapshot: DsxuTaskStateSnapshotPromptState
  memory: DsxuLocalMemoryBundle
  sourceTruthRereadAfterResume?: boolean
  verificationEvidenceAfterResume?: boolean
}): DsxuSmoothResumePlan {
  const ownerRule = buildDsxuContextOwnerRuleFromResume({
    snapshot: input.snapshot,
    memory: input.memory,
    sourceTruthRereadAfterResume: input.sourceTruthRereadAfterResume,
    verificationEvidenceAfterResume: input.verificationEvidenceAfterResume,
  })
  const actions: string[] = []
  for (const filePath of input.memory.rereadFiles) {
    actions.push(`Read latest source truth for ${filePath} before any Edit.`)
  }
  for (const filePath of input.snapshot.filesChanged ?? []) {
    if (!input.memory.rereadFiles.includes(filePath)) {
      actions.push(`Read changed file ${filePath} before continuing.`)
    }
  }
  for (const task of input.snapshot.pendingTasks ?? []) {
    actions.push(`Continue pending task: ${task}`)
  }
  for (const command of input.snapshot.failedCommands ?? []) {
    actions.push(`Repair or rerun failed verification: ${command}`)
  }
  if (input.snapshot.nextAction) {
    actions.push(`Next action from snapshot: ${input.snapshot.nextAction}`)
  }
  const uniqueActions = [...new Set(actions)]

  return {
    actions: uniqueActions,
    mayEditFromMemory: false,
    mayClaimPass: ownerRule.mayClaimPass,
    ownerRule,
    rendered: [
      '## Smooth Resume Plan',
      '- memoryPolicy: read-only hints; no Edit or PASS can be based on memory alone.',
      `- mayEditFromMemory: false`,
      `- mayClaimPass: ${ownerRule.mayClaimPass ? 'yes' : 'no'}`,
      ownerRule.rendered,
      uniqueActions.length ? uniqueActions.map(action => `- ${action}`).join('\n') : '- No pending action.',
    ].join('\n'),
  }
}
