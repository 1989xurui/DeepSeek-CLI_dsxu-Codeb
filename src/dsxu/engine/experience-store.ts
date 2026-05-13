import {
  buildDsxuLocalMemoryReadOnlyBundle,
  buildDsxuSmoothResumePlan,
  type DsxuLocalMemoryBundle,
  type DsxuLocalMemoryEntry,
  type DsxuLocalMemoryKind,
  type DsxuSmoothResumePlan,
  type DsxuTaskStateSnapshotPromptState,
} from './task-governance'

export type DsxuExperienceKind =
  | DsxuLocalMemoryKind
  | 'success_fix'
  | 'cost_route'

export type DsxuExperienceEntry = Omit<DsxuLocalMemoryEntry, 'kind'> & {
  kind: DsxuExperienceKind
  taskId?: string
  tags?: readonly string[]
  evidencePath?: string
  outcome?: 'unknown' | 'failed' | 'passed'
  usage?: {
    model?: string
    routeReason?: string
    modelEvidence?: string
    inputTokens?: number
    outputTokens?: number
    toolCalls?: number
    costUsd?: number
    tracePath?: string
  }
}

export type DsxuExperienceStore = {
  entries: DsxuExperienceEntry[]
  tombstones: Array<{ id: string; deletedAt: string; deletablePath: string }>
}

export type DsxuExperienceRecall = {
  entry: DsxuExperienceEntry
  score: number
  reasons: readonly string[]
}

export type DsxuExperienceInjection = {
  recalls: readonly DsxuExperienceRecall[]
  memory: DsxuLocalMemoryBundle
  planning: DsxuExperiencePlanningContext
  sourceTruthGuard: DsxuExperienceSourceTruthGuard
  rendered: string
}

export type DsxuExperienceReplayMetrics = {
  toolCalls: number
  readCalls: number
  verificationRuns: number
  estimatedTokens: number
}

export type DsxuExperienceReplayReport = {
  cold: DsxuExperienceReplayMetrics
  warm: DsxuExperienceReplayMetrics
  toolCallReductionPct: number
  readReductionPct: number
  tokenReductionPct: number
  repeatedExplorationReduced: boolean
  planningQuality: DsxuExperiencePlanningQuality
}

export type DsxuExperiencePlanningQualityGrade = 'blocked' | 'weak' | 'stable' | 'strong'

export type DsxuExperiencePlanningQuality = {
  score: number
  grade: DsxuExperiencePlanningQualityGrade
  hitRateEstimatePct: number
  wasteToolCallsAvoided: number
  signals: {
    repeatedExplorationReduced: boolean
    readCallsReduced: boolean
    verificationRunsReducedOrStable: boolean
    sourceTruthRefreshPresent: boolean
    actionableVerificationPresent: boolean
    failureAvoidancePresent: boolean
    successfulFixPresent: boolean
  }
  recommendations: readonly string[]
}

export type DsxuExperiencePlanningLane =
  | 'source_refresh'
  | 'success_fix'
  | 'failure_pattern'
  | 'verification_command'
  | 'project_fact'
  | 'task_snapshot'
  | 'user_preference'
  | 'cost_route'
  | 'trace_index'

export type DsxuExperiencePlanningItem = {
  lane: DsxuExperiencePlanningLane
  id: string
  kind: DsxuExperienceKind
  title: string
  directive: string
  confidence: number
  sourcePath: string
  deletablePath: string
}

export type DsxuExperiencePlanningContext = {
  items: readonly DsxuExperiencePlanningItem[]
  sourceRefreshFiles: readonly string[]
  verificationCommands: readonly string[]
  failedStrategyIds: readonly string[]
  successFixIds: readonly string[]
  tracePaths: readonly string[]
  guardrails: readonly string[]
  rendered: string
  evidence: {
    itemCount: number
    hasActionableVerification: boolean
    hasFailureAvoidance: boolean
    hasSuccessfulFix: boolean
    hasTraceIndex: boolean
    sourceTruthRefreshRequired: boolean
  }
}

export type DsxuExperienceSourceTruthGuard = {
  policy: 'current-source-wins'
  currentSourceFiles: readonly string[]
  rereadFiles: readonly string[]
  overlappingRecallIds: readonly string[]
  staleRecallIds: readonly string[]
  memoryMaySelectEditTarget: false
  mayUseStaleRecallForEditTarget: false
  selectedEditTargetSource: 'current-source-truth'
  verificationSource: 'current-verification-output'
  rendered: string
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9_./:-]+/g, ' ').trim()
}

function tokenize(text: string): Set<string> {
  return new Set(normalizeText(text).split(/\s+/).filter(token => token.length >= 2))
}

function normalizePath(filePath: string): string {
  return filePath.replace(/[\\/]+/g, '/').toLowerCase()
}

function normalizeExperienceKindForLocalMemory(kind: DsxuExperienceKind): DsxuLocalMemoryKind {
  if (kind === 'success_fix' || kind === 'cost_route') return 'evidence_index'
  return kind
}

function oneLine(text: string, maxChars: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= maxChars) return clean
  return `${clean.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`
}

function planningLaneForExperienceKind(kind: DsxuExperienceKind): DsxuExperiencePlanningLane {
  if (kind === 'success_fix') return 'success_fix'
  if (kind === 'failure_pattern') return 'failure_pattern'
  if (kind === 'verification_command') return 'verification_command'
  if (kind === 'project_fact') return 'project_fact'
  if (kind === 'task_snapshot') return 'task_snapshot'
  if (kind === 'user_preference') return 'user_preference'
  if (kind === 'cost_route') return 'cost_route'
  return 'trace_index'
}

function directiveForExperienceEntry(entry: DsxuExperienceEntry, maxChars: number): string {
  const content = oneLine(entry.content, maxChars)
  if (entry.kind === 'success_fix') return `reuse after source reread: ${content}`
  if (entry.kind === 'failure_pattern') return `avoid repeated failed strategy: ${content}`
  if (entry.kind === 'verification_command') return `focused verification: ${content}`
  if (entry.kind === 'cost_route') return `model route evidence: ${content}`
  if (entry.kind === 'task_snapshot') return `resume state hint: ${content}`
  if (entry.kind === 'user_preference') return `user preference hint: ${content}`
  if (entry.kind === 'project_fact') return `project fact hint: ${content}`
  return `evidence hint: ${content}`
}

function uniqueBounded(items: readonly string[], maxItems: number): string[] {
  return [...new Set(items.filter(Boolean))].slice(0, maxItems)
}

function renderPlanningLane(
  title: string,
  items: readonly DsxuExperiencePlanningItem[],
): string {
  if (items.length === 0) return `- ${title}: none`
  return [
    `- ${title}:`,
    ...items.map(
      item =>
        `  - ${item.id}: ${item.directive} (confidence=${item.confidence.toFixed(2)}, source=${item.sourcePath}, delete=${item.deletablePath})`,
    ),
  ].join('\n')
}

function toLocalMemoryEntry(entry: DsxuExperienceEntry): DsxuLocalMemoryEntry {
  return {
    id: entry.id,
    kind: normalizeExperienceKindForLocalMemory(entry.kind),
    title: entry.title,
    content: entry.content,
    sourcePath: entry.sourcePath,
    createdAt: entry.createdAt,
    confidence: entry.confidence,
    deletablePath: entry.deletablePath,
    relatedFiles: entry.relatedFiles,
  }
}

function validExperienceEntry(entry: DsxuExperienceEntry): boolean {
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

const BENCHMARK_ANSWER_MARKERS: readonly RegExp[] = [
  /\bDSXU_BENCH_[A-Z0-9_]+_PASS\b/i,
  /\bDSXU_SCORE_[A-Z0-9_]+_PASS\b/i,
  /\bBENCHMARK_(?:ANSWER|PASS)\b/i,
]

export function containsDsxuBenchmarkAnswerLeak(entry: DsxuExperienceEntry): boolean {
  const text = [
    entry.id,
    entry.title,
    entry.content,
    entry.sourcePath,
    entry.evidencePath ?? '',
    ...(entry.tags ?? []),
  ].join('\n')
  return BENCHMARK_ANSWER_MARKERS.some(marker => marker.test(text))
}

function stableEntrySort(a: DsxuExperienceEntry, b: DsxuExperienceEntry): number {
  return b.confidence - a.confidence || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)
}

export function createDsxuExperienceStore(
  entries: readonly DsxuExperienceEntry[] = [],
): DsxuExperienceStore {
  const store: DsxuExperienceStore = { entries: [], tombstones: [] }
  for (const entry of entries) {
    recordDsxuExperience(store, entry)
  }
  return store
}

export function recordDsxuExperience(
  store: DsxuExperienceStore,
  entry: DsxuExperienceEntry,
): { accepted: boolean; reason: string } {
  if (!validExperienceEntry(entry)) {
    return { accepted: false, reason: `invalid-experience:${entry.id || 'missing-id'}` }
  }
  if (containsDsxuBenchmarkAnswerLeak(entry)) {
    return { accepted: false, reason: `benchmark-answer-blocked:${entry.id}` }
  }
  if (store.tombstones.some(tombstone => tombstone.id === entry.id)) {
    return { accepted: false, reason: `deleted-experience:${entry.id}` }
  }
  const existingIndex = store.entries.findIndex(item => item.id === entry.id)
  if (existingIndex >= 0) {
    store.entries[existingIndex] = entry
  } else {
    store.entries.push(entry)
  }
  store.entries.sort(stableEntrySort)
  return { accepted: true, reason: `recorded:${entry.id}` }
}

export function deleteDsxuExperience(
  store: DsxuExperienceStore,
  id: string,
  deletedAt = new Date().toISOString(),
): { deleted: boolean; reason: string } {
  const index = store.entries.findIndex(entry => entry.id === id)
  if (index < 0) {
    return { deleted: false, reason: `missing-experience:${id}` }
  }
  const [entry] = store.entries.splice(index, 1)
  if (entry) {
    store.tombstones.push({ id, deletedAt, deletablePath: entry.deletablePath })
  }
  return { deleted: true, reason: `deleted:${id}` }
}

export function recallDsxuExperience(input: {
  store: DsxuExperienceStore
  query: string
  currentSourceFiles?: readonly string[]
  maxEntries?: number
  minScore?: number
}): DsxuExperienceRecall[] {
  const queryTokens = tokenize(input.query)
  const currentFiles = new Set((input.currentSourceFiles ?? []).map(normalizePath))
  const minScore = input.minScore ?? 0.35
  const recalls = input.store.entries
    .map(entry => {
      const reasons: string[] = []
      let score = entry.confidence
      const textTokens = tokenize(
        [entry.title, entry.content, ...(entry.tags ?? []), entry.kind].join(' '),
      )
      const overlap = [...queryTokens].filter(token => textTokens.has(token)).length
      if (overlap > 0) {
        score += Math.min(0.4, overlap * 0.08)
        reasons.push(`query-overlap:${overlap}`)
      }
      const relatedOverlap = (entry.relatedFiles ?? []).filter(filePath =>
        currentFiles.has(normalizePath(filePath)),
      )
      if (relatedOverlap.length > 0) {
        score += 0.25
        reasons.push(`source-overlap:${relatedOverlap.join(',')}`)
      }
      if (entry.outcome === 'passed' || entry.kind === 'success_fix') {
        score += 0.08
        reasons.push('successful-prior-fix')
      }
      if (entry.kind === 'verification_command') {
        score += 0.06
        reasons.push('verification-command')
      }
      return { entry, score: Math.min(1.5, score), reasons }
    })
    .filter(recall => recall.score >= minScore)
    .sort((a, b) => b.score - a.score || stableEntrySort(a.entry, b.entry))
    .slice(0, input.maxEntries ?? 8)

  return recalls
}

export function buildDsxuExperienceInjection(input: {
  recalls: readonly DsxuExperienceRecall[]
  currentSourceFiles?: readonly string[]
  minConfidence?: number
}): DsxuExperienceInjection {
  const currentSourceFiles = input.currentSourceFiles ?? []
  const memory = buildDsxuLocalMemoryReadOnlyBundle({
    entries: input.recalls.map(recall => toLocalMemoryEntry(recall.entry)),
    currentSourceFiles,
    minConfidence: input.minConfidence ?? 0.5,
      maxEntries: input.recalls.length || 1,
  })
  const planning = buildDsxuExperiencePlanningContext({
    recalls: input.recalls,
    memory,
  })
  const sourceTruthGuard = buildDsxuExperienceSourceTruthGuard({
    recalls: input.recalls,
    currentSourceFiles,
    rereadFiles: memory.rereadFiles,
  })
  const renderedRecalls = input.recalls
    .map(
      recall =>
        `- ${recall.entry.id}: score=${recall.score.toFixed(2)} reasons=${recall.reasons.join('|') || 'confidence'} source=${recall.entry.sourcePath} delete=${recall.entry.deletablePath}`,
    )
    .join('\n')
  return {
    recalls: input.recalls,
    memory,
    planning,
    sourceTruthGuard,
    rendered: [
      '## ExperienceStore Injection (read-only)',
      '- policy: memory can narrow exploration, never replace current files or verification.',
      `- sourceTruthRefreshRequired: ${memory.sourceTruthRefreshRequired ? 'yes' : 'no'}`,
      renderedRecalls || '- recalls: none',
      sourceTruthGuard.rendered,
      planning.rendered,
      memory.rendered,
    ].join('\n'),
  }
}

export function buildDsxuExperienceSourceTruthGuard(input: {
  recalls: readonly DsxuExperienceRecall[]
  currentSourceFiles?: readonly string[]
  rereadFiles?: readonly string[]
}): DsxuExperienceSourceTruthGuard {
  const currentSourceFiles = uniqueBounded(input.currentSourceFiles ?? [], 16)
  const currentSourceSet = new Set(currentSourceFiles.map(normalizePath))
  const overlappingRecallIds: string[] = []
  const staleRecallIds: string[] = []

  for (const recall of input.recalls) {
    const relatedFiles = recall.entry.relatedFiles ?? []
    const hasCurrentOverlap = relatedFiles.some(filePath =>
      currentSourceSet.has(normalizePath(filePath)),
    )
    if (hasCurrentOverlap) {
      overlappingRecallIds.push(recall.entry.id)
    } else {
      staleRecallIds.push(recall.entry.id)
    }
  }

  const rereadFiles = uniqueBounded(input.rereadFiles ?? [], 16)
  const rendered = [
    '## ExperienceStore Source Truth Guard',
    '- policy: current source files and verification output win over recalled memory.',
    '- memoryMaySelectEditTarget: false',
    '- mayUseStaleRecallForEditTarget: false',
    `- currentSourceFiles: ${currentSourceFiles.length ? currentSourceFiles.join(', ') : 'none'}`,
    `- rereadFiles: ${rereadFiles.length ? rereadFiles.join(', ') : 'none'}`,
    `- overlappingRecallIds: ${overlappingRecallIds.length ? overlappingRecallIds.join(', ') : 'none'}`,
    `- staleRecallIds: ${staleRecallIds.length ? staleRecallIds.join(', ') : 'none'}`,
  ].join('\n')

  return {
    policy: 'current-source-wins',
    currentSourceFiles,
    rereadFiles,
    overlappingRecallIds,
    staleRecallIds,
    memoryMaySelectEditTarget: false,
    mayUseStaleRecallForEditTarget: false,
    selectedEditTargetSource: 'current-source-truth',
    verificationSource: 'current-verification-output',
    rendered,
  }
}

export function buildDsxuExperiencePlanningContext(input: {
  recalls: readonly DsxuExperienceRecall[]
  memory: DsxuLocalMemoryBundle
  maxItems?: number
  maxContentChars?: number
}): DsxuExperiencePlanningContext {
  const maxItems = Math.max(1, input.maxItems ?? 8)
  const maxContentChars = Math.max(80, input.maxContentChars ?? 180)
  const items = input.recalls.slice(0, maxItems).map(recall => ({
    lane: planningLaneForExperienceKind(recall.entry.kind),
    id: recall.entry.id,
    kind: recall.entry.kind,
    title: recall.entry.title,
    directive: directiveForExperienceEntry(recall.entry, maxContentChars),
    confidence: recall.entry.confidence,
    sourcePath: recall.entry.sourcePath,
    deletablePath: recall.entry.deletablePath,
  }))
  const verificationCommands = uniqueBounded(
    items.filter(item => item.lane === 'verification_command').map(item => item.directive),
    4,
  )
  const failedStrategyIds = uniqueBounded(
    items.filter(item => item.lane === 'failure_pattern').map(item => item.id),
    4,
  )
  const successFixIds = uniqueBounded(
    items.filter(item => item.lane === 'success_fix').map(item => item.id),
    4,
  )
  const tracePaths = uniqueBounded(
    input.recalls.flatMap(recall => [
      recall.entry.evidencePath ?? '',
      recall.entry.usage?.tracePath ?? '',
      recall.entry.sourcePath,
    ]),
    8,
  )
  const guardrails = [
    'read current source truth before Edit',
    'do not claim PASS from memory',
    'run focused verification after the patch',
    'change strategy before rerunning a failed command',
  ]
  const byLane = (lane: DsxuExperiencePlanningLane): DsxuExperiencePlanningItem[] =>
    items.filter(item => item.lane === lane)

  const rendered = [
    '## ExperienceStore Planning Pack (read-only)',
    '- policy: actionable memory can narrow the plan, but current source files win and verification output is the truth.',
    `- sourceRefreshFiles: ${input.memory.rereadFiles.length ? input.memory.rereadFiles.join(', ') : 'none'}`,
    renderPlanningLane('successFixes', byLane('success_fix')),
    renderPlanningLane('failurePatterns', byLane('failure_pattern')),
    renderPlanningLane('verificationCommands', byLane('verification_command')),
    renderPlanningLane('projectFacts', byLane('project_fact')),
    renderPlanningLane('taskSnapshots', byLane('task_snapshot')),
    renderPlanningLane('costRoutes', byLane('cost_route')),
    `- traceIndexes: ${tracePaths.length ? tracePaths.join(', ') : 'none'}`,
    `- guardrails: ${guardrails.join('; ')}`,
  ].join('\n')

  return {
    items,
    sourceRefreshFiles: input.memory.rereadFiles,
    verificationCommands,
    failedStrategyIds,
    successFixIds,
    tracePaths,
    guardrails,
    rendered,
    evidence: {
      itemCount: items.length,
      hasActionableVerification: verificationCommands.length > 0,
      hasFailureAvoidance: failedStrategyIds.length > 0,
      hasSuccessfulFix: successFixIds.length > 0,
      hasTraceIndex: tracePaths.length > 0,
      sourceTruthRefreshRequired: input.memory.sourceTruthRefreshRequired,
    },
  }
}

export function buildDsxuExperienceSmoothResume(input: {
  snapshot: DsxuTaskStateSnapshotPromptState
  injection: DsxuExperienceInjection
}): DsxuSmoothResumePlan {
  return buildDsxuSmoothResumePlan({
    snapshot: input.snapshot,
    memory: input.injection.memory,
  })
}

export function explainDsxuExperienceRecall(recalls: readonly DsxuExperienceRecall[]): string {
  if (recalls.length === 0) {
    return 'ExperienceStore recall: no usable local memory. Continue from source truth.'
  }
  return [
    'ExperienceStore recall explanation:',
    '- all recalled entries include sourcePath, confidence, createdAt, and deletablePath.',
    '- current source files must be reread before Edit when relatedFiles overlap.',
    ...recalls.map(
      recall =>
        `- ${recall.entry.id}: ${recall.entry.kind}; score=${recall.score.toFixed(2)}; reasons=${recall.reasons.join(', ') || 'confidence'}; source=${recall.entry.sourcePath}`,
    ),
  ].join('\n')
}

export function buildDsxuExperienceReplayReport(input: {
  cold: DsxuExperienceReplayMetrics
  warm: DsxuExperienceReplayMetrics
  planning?: DsxuExperiencePlanningContext
}): DsxuExperienceReplayReport {
  const pct = (before: number, after: number): number =>
    before <= 0 ? 0 : Math.round(((before - after) / before) * 1000) / 10
  const toolCallReductionPct = pct(input.cold.toolCalls, input.warm.toolCalls)
  const readReductionPct = pct(input.cold.readCalls, input.warm.readCalls)
  const tokenReductionPct = pct(input.cold.estimatedTokens, input.warm.estimatedTokens)
  const repeatedExplorationReduced = toolCallReductionPct >= 30 || readReductionPct >= 30 || tokenReductionPct >= 30
  return {
    cold: input.cold,
    warm: input.warm,
    toolCallReductionPct,
    readReductionPct,
    tokenReductionPct,
    repeatedExplorationReduced,
    planningQuality: scoreDsxuExperiencePlanningQuality({
      cold: input.cold,
      warm: input.warm,
      planning: input.planning,
      repeatedExplorationReduced,
    }),
  }
}

export function scoreDsxuExperiencePlanningQuality(input: {
  cold: DsxuExperienceReplayMetrics
  warm: DsxuExperienceReplayMetrics
  planning?: DsxuExperiencePlanningContext
  repeatedExplorationReduced?: boolean
}): DsxuExperiencePlanningQuality {
  const signals = {
    repeatedExplorationReduced:
      input.repeatedExplorationReduced ??
      (
        input.warm.toolCalls < input.cold.toolCalls ||
        input.warm.readCalls < input.cold.readCalls ||
        input.warm.estimatedTokens < input.cold.estimatedTokens
      ),
    readCallsReduced: input.warm.readCalls < input.cold.readCalls,
    verificationRunsReducedOrStable: input.warm.verificationRuns <= input.cold.verificationRuns,
    sourceTruthRefreshPresent: input.planning?.evidence.sourceTruthRefreshRequired === true,
    actionableVerificationPresent: input.planning?.evidence.hasActionableVerification === true,
    failureAvoidancePresent: input.planning?.evidence.hasFailureAvoidance === true,
    successfulFixPresent: input.planning?.evidence.hasSuccessfulFix === true,
  }
  let score = 0
  if (signals.repeatedExplorationReduced) score += 25
  if (signals.readCallsReduced) score += 15
  if (signals.verificationRunsReducedOrStable) score += 10
  if (signals.sourceTruthRefreshPresent) score += 15
  if (signals.actionableVerificationPresent) score += 15
  if (signals.failureAvoidancePresent) score += 10
  if (signals.successfulFixPresent) score += 10
  score = Math.max(0, Math.min(100, score))

  const wasteToolCallsAvoided = Math.max(0, input.cold.toolCalls - input.warm.toolCalls)
  const hitRateEstimatePct = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        score * 0.7 +
          Math.min(20, wasteToolCallsAvoided * 4) +
          (signals.verificationRunsReducedOrStable ? 10 : 0),
      ),
    ),
  )
  const grade: DsxuExperiencePlanningQualityGrade =
    score >= 85 ? 'strong' : score >= 70 ? 'stable' : score >= 45 ? 'weak' : 'blocked'
  const recommendations: string[] = []
  if (!signals.sourceTruthRefreshPresent) recommendations.push('add source truth refresh files before using memory')
  if (!signals.actionableVerificationPresent) recommendations.push('store the focused verification command')
  if (!signals.readCallsReduced) recommendations.push('narrow recalled files to reduce repeated reads')
  if (!signals.verificationRunsReducedOrStable) recommendations.push('inspect failure output before repeating verification')
  if (!signals.failureAvoidancePresent && input.cold.verificationRuns > 1) {
    recommendations.push('record failed strategy so recovery changes approach before rerun')
  }
  if (!signals.successfulFixPresent) recommendations.push('record successful fix evidence after PASS')

  return {
    score,
    grade,
    hitRateEstimatePct,
    wasteToolCallsAvoided,
    signals,
    recommendations,
  }
}
