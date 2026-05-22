import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import {
  buildDsxuExperienceInjection,
  buildDsxuExperienceReplayReport,
  buildDsxuExperienceSmoothResume,
  recordDsxuExperience,
  recallDsxuExperience,
  type DsxuExperienceEntry,
  type DsxuExperienceRecall,
  type DsxuExperienceKind,
  type DsxuExperienceReplayReport,
  type DsxuExperienceStore,
} from './experience-store'
import type {
  DsxuSmoothResumePlan,
  DsxuTaskStateSnapshotPromptState,
} from './task-governance'

export type DsxuLiveReportCaseMetrics = {
  toolCalls?: number
  readCalls?: number
  powerShellCalls?: number
  runNativeTestCalls?: number
  successfulEditCalls?: number
  failedEditCalls?: number
  totalCostUSD?: number
  modelsUsed?: readonly string[]
  actualCommands?: readonly string[]
  modelUsage?: Record<string, {
    inputTokens?: number
    outputTokens?: number
    costUSD?: number
    cacheReadInputTokens?: number
    cacheCreationInputTokens?: number
  }>
}

export type DsxuLiveReportCaseLike = {
  id: string
  category?: string
  status?: string
  policyPassed?: boolean
  timedOut?: boolean
  expectedMarker?: string
  prompt?: string
  logPath?: string
  routeTracePath?: string
  fixturePath?: string
  localProjectPath?: string
  metrics?: DsxuLiveReportCaseMetrics
  routeExpectation?: {
    expectedModel?: string
    routeReason?: string
    workflowKind?: string
  }
  failureAnalysis?: {
    categories?: readonly string[]
    notes?: readonly string[]
  }
}

export type DsxuLiveReportLike = {
  generatedAt?: string
  mode?: string
  baselineProfile?: string | null
  benchMode?: string | null
  cases?: readonly DsxuLiveReportCaseLike[]
}

export type DsxuLiveReportExperienceIngestResult = {
  entries: readonly DsxuExperienceEntry[]
  accepted: readonly string[]
  rejected: readonly { id: string; reason: string }[]
  summary: {
    cases: number
    entries: number
    passedCases: number
    failedOrPolicyCases: number
    verificationCommandEntries: number
    costRouteEntries: number
  }
}

export type DsxuLiveReportExperienceIngestHarnessResult =
  DsxuLiveReportExperienceIngestResult & {
    status: 'DONE_EVIDENCED' | 'PARTIAL'
    reportPath: string
    evidencePath: string
    storeEntries: number
    recalls: readonly DsxuExperienceRecall[]
    benchmarkLeakDetected: boolean
    smoothResumeProjection?: DsxuLiveReportSmoothResumeProjection
  }

export type DsxuLiveReportSmoothResumeProjection = {
  status: 'DONE_EVIDENCED' | 'PARTIAL'
  caseId: string
  recallIds: readonly string[]
  sourceTruthRefreshRequired: boolean
  mayClaimPass: boolean
  resumePlan: DsxuSmoothResumePlan
  replayReport: DsxuExperienceReplayReport
  coldMetrics: {
    toolCalls: number
    readCalls: number
    verificationRuns: number
    estimatedTokens: number
  }
  warmMetrics: {
    toolCalls: number
    readCalls: number
    verificationRuns: number
    estimatedTokens: number
  }
  warnings: readonly string[]
}

function sanitizeId(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '')
}

function oneLine(text: string, maxChars: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= maxChars) return clean
  return `${clean.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`
}

function stripBenchmarkMarkers(text: string): string {
  return text
    .replace(/\bDSXU_BENCH_[A-Z0-9_]+_PASS\b/g, '[benchmark-marker-redacted]')
    .replace(/\bDSXU_SCORE_[A-Z0-9_]+_PASS\b/g, '[benchmark-marker-redacted]')
}

function unique(items: readonly string[]): string[] {
  return [...new Set(items.filter(Boolean))]
}

function caseSourcePath(
  reportPath: string,
  item: DsxuLiveReportCaseLike,
): string {
  return item.logPath || item.routeTracePath || reportPath
}

function relatedFilesForCase(item: DsxuLiveReportCaseLike): string[] {
  return unique([
    item.fixturePath ?? '',
    item.localProjectPath ?? '',
    item.logPath ?? '',
    item.routeTracePath ?? '',
    ...extractPromptFileReferences(item.prompt ?? ''),
  ])
}

function extractPromptFileReferences(prompt: string): string[] {
  return unique(prompt.match(/\b(?:src|test|tests|lib|app)\/[A-Za-z0-9_.\/-]+\b/g) ?? [])
}

function modelUsageSummary(metrics: DsxuLiveReportCaseMetrics | undefined): {
  model?: string
  inputTokens?: number
  outputTokens?: number
  costUsd?: number
} {
  const firstModel = metrics?.modelsUsed?.[0]
  const usage = firstModel ? metrics?.modelUsage?.[firstModel] : undefined
  return {
    model: firstModel,
    inputTokens: usage?.inputTokens,
    outputTokens: usage?.outputTokens,
    costUsd: metrics?.totalCostUSD ?? usage?.costUSD,
  }
}

function verificationRunsForCase(item: DsxuLiveReportCaseLike): number {
  return (
    (item.metrics?.powerShellCalls ?? 0) +
    (item.metrics?.runNativeTestCalls ?? 0)
  )
}

function estimatedInputTokensForCase(item: DsxuLiveReportCaseLike): number {
  const metrics = item.metrics
  const firstModel = metrics?.modelsUsed?.[0]
  const usage = firstModel ? metrics?.modelUsage?.[firstModel] : undefined
  return usage?.inputTokens ?? Math.max(0, (metrics?.toolCalls ?? 0) * 1200)
}

function buildSnapshotFromLiveReportCase(input: {
  item: DsxuLiveReportCaseLike
  currentSourceFiles: readonly string[]
}): DsxuTaskStateSnapshotPromptState {
  const failedCommands =
    input.item.status === 'fail' || input.item.policyPassed === false
      ? unique(input.item.metrics?.actualCommands ?? []).slice(0, 2)
      : []
  return {
    goal: `Resume similar ${input.item.category ?? 'coding'} task from live evidence: ${input.item.id}`,
    scope: input.currentSourceFiles.join(', ') || input.item.fixturePath || input.item.localProjectPath || input.item.id,
    filesRead: [],
    filesChanged: input.currentSourceFiles,
    failedCommands,
    permissionDenials:
      input.item.policyPassed === false ? ['prior live run had policy/tool drift'] : [],
    activeAgents: [],
    pendingTasks: [
      'reread current source truth',
      'reuse only the strategy, not stale code',
      'run focused verification before final answer',
    ],
    workflowPreferencesApplied: ['ExperienceStore is read-only evidence'],
    nextAction: 'Read current source files before any Edit; then verify with the focused command shape.',
    verificationStatus: failedCommands.length > 0 ? 'failed' : 'unverified',
    createdAt: new Date().toISOString(),
  }
}

function makeEntry(input: {
  id: string
  kind: DsxuExperienceKind
  title: string
  content: string
  sourcePath: string
  createdAt: string
  confidence: number
  relatedFiles: readonly string[]
  evidencePath?: string
  outcome?: 'unknown' | 'failed' | 'passed'
  tags?: readonly string[]
  usage?: DsxuExperienceEntry['usage']
}): DsxuExperienceEntry {
  return {
    id: input.id,
    kind: input.kind,
    title: stripBenchmarkMarkers(oneLine(input.title, 160)),
    content: stripBenchmarkMarkers(oneLine(input.content, 700)),
    sourcePath: input.sourcePath,
    createdAt: input.createdAt,
    confidence: input.confidence,
    deletablePath: `.dsxu/memory/${input.id}.json`,
    relatedFiles: input.relatedFiles,
    evidencePath: input.evidencePath,
    outcome: input.outcome ?? 'unknown',
    tags: input.tags,
    usage: input.usage,
  }
}

export function buildDsxuExperienceEntriesFromLiveReport(input: {
  report: DsxuLiveReportLike
  reportPath: string
  createdAt?: string
  maxCases?: number
}): DsxuExperienceEntry[] {
  const createdAt = input.createdAt ?? input.report.generatedAt ?? new Date().toISOString()
  const cases = (input.report.cases ?? []).slice(0, input.maxCases ?? 50)
  const entries: DsxuExperienceEntry[] = []

  for (const item of cases) {
    const caseId = sanitizeId(item.id)
    if (!caseId) continue
    const metrics = item.metrics ?? {}
    const sourcePath = caseSourcePath(input.reportPath, item)
    const relatedFiles = relatedFilesForCase(item)
    const routeReason = item.routeExpectation?.routeReason
    const modelUsage = modelUsageSummary(metrics)
    const verificationRuns = verificationRunsForCase(item)
    const passed = item.status === 'pass' && item.policyPassed === true
    const failedOrPolicy =
      item.status === 'fail' || item.policyPassed === false || item.timedOut === true

    entries.push(
      makeEntry({
        id: `live-${caseId}-task-snapshot`,
        kind: 'task_snapshot',
        title: `Live task snapshot for ${item.id}`,
        content: [
          `category=${item.category ?? 'unknown'}`,
          `status=${item.status ?? 'unknown'}`,
          `policyPassed=${item.policyPassed === true}`,
          `timedOut=${item.timedOut === true}`,
          `tools=${metrics.toolCalls ?? 0}`,
          `reads=${metrics.readCalls ?? 0}`,
          `successfulEdits=${metrics.successfulEditCalls ?? 0}`,
          `failedEdits=${metrics.failedEditCalls ?? 0}`,
          `verificationRuns=${verificationRuns}`,
          'resume rule: reread current source truth before applying any recalled fix.',
        ].join('; '),
        sourcePath,
        evidencePath: sourcePath,
        createdAt,
        confidence: passed ? 0.88 : 0.74,
        relatedFiles,
        outcome: passed ? 'passed' : failedOrPolicy ? 'failed' : 'unknown',
        tags: ['live-report', item.category ?? 'unknown', input.report.benchMode ?? 'cold'],
        usage: {
          model: modelUsage.model,
          routeReason,
          inputTokens: modelUsage.inputTokens,
          outputTokens: modelUsage.outputTokens,
          toolCalls: metrics.toolCalls,
          costUsd: modelUsage.costUsd,
          tracePath: item.routeTracePath,
        },
      }),
    )

    if (passed) {
      entries.push(
        makeEntry({
          id: `live-${caseId}-success-fix`,
          kind: 'success_fix',
          title: `Successful ${item.category ?? 'task'} strategy for ${item.id}`,
          content: [
            `Passed after ${metrics.successfulEditCalls ?? 0} successful edit(s).`,
            `Use the recalled strategy only after rereading current source and test files.`,
            `Verification runs observed: ${verificationRuns}.`,
            `Avoid repeating edits after success; verify and finalize.`,
          ].join(' '),
          sourcePath,
          evidencePath: sourcePath,
          createdAt,
          confidence: 0.92,
          relatedFiles,
          outcome: 'passed',
          tags: ['success-fix', item.category ?? 'unknown'],
          usage: {
            model: modelUsage.model,
            routeReason,
            inputTokens: modelUsage.inputTokens,
            outputTokens: modelUsage.outputTokens,
            toolCalls: metrics.toolCalls,
            costUsd: modelUsage.costUsd,
            tracePath: item.routeTracePath,
          },
        }),
      )
    }

    if ((metrics.actualCommands ?? []).length > 0) {
      const commands = unique(metrics.actualCommands ?? []).slice(0, 3)
      entries.push(
        makeEntry({
          id: `live-${caseId}-verification-command`,
          kind: 'verification_command',
          title: `Native verification pattern for ${item.id}`,
          content: [
            'Observed native verification command(s) from live evidence.',
            'Reuse the command shape only after replacing any temporary fixture cwd with the current project root.',
            commands.join(' | '),
          ].join(' '),
          sourcePath,
          evidencePath: sourcePath,
          createdAt,
          confidence: 0.9,
          relatedFiles,
          outcome: passed ? 'passed' : failedOrPolicy ? 'failed' : 'unknown',
          tags: ['verification-command', 'source-truth-required'],
        }),
      )
    }

    if (failedOrPolicy) {
      const categories = (item.failureAnalysis?.categories ?? []).join(', ') || 'unknown'
      const notes = (item.failureAnalysis?.notes ?? []).join(' | ') || 'No failure note recorded.'
      entries.push(
        makeEntry({
          id: `live-${caseId}-failure-pattern`,
          kind: 'failure_pattern',
          title: `Failure pattern for ${item.id}`,
          content: `failureCategories=${categories}; notes=${notes}; next repeat must change strategy before retrying tools or escalating model.`,
          sourcePath,
          evidencePath: sourcePath,
          createdAt,
          confidence: item.timedOut ? 0.86 : 0.9,
          relatedFiles,
          outcome: 'failed',
          tags: ['failure-pattern', item.category ?? 'unknown'],
        }),
      )
    }

    if (modelUsage.model || routeReason || modelUsage.costUsd !== undefined) {
      entries.push(
        makeEntry({
          id: `live-${caseId}-cost-route`,
          kind: 'cost_route',
          title: `Model route evidence for ${item.id}`,
          content: [
            `model=${modelUsage.model ?? 'unknown'}`,
            `routeReason=${routeReason ?? 'unknown'}`,
            `costUsd=${modelUsage.costUsd ?? 'unknown'}`,
            `toolCalls=${metrics.toolCalls ?? 0}`,
            `policyPassed=${item.policyPassed === true}`,
          ].join('; '),
          sourcePath,
          evidencePath: item.routeTracePath ?? sourcePath,
          createdAt,
          confidence: 0.87,
          relatedFiles,
          outcome: passed ? 'passed' : failedOrPolicy ? 'failed' : 'unknown',
          tags: ['cost-route', modelUsage.model ?? 'unknown', routeReason ?? 'unknown'],
          usage: {
            model: modelUsage.model,
            routeReason,
            inputTokens: modelUsage.inputTokens,
            outputTokens: modelUsage.outputTokens,
            toolCalls: metrics.toolCalls,
            costUsd: modelUsage.costUsd,
            tracePath: item.routeTracePath,
          },
        }),
      )
    }
  }

  return entries
}

export function ingestDsxuLiveReportIntoExperienceStore(input: {
  store: DsxuExperienceStore
  report: DsxuLiveReportLike
  reportPath: string
  createdAt?: string
  maxCases?: number
}): DsxuLiveReportExperienceIngestResult {
  const entries = buildDsxuExperienceEntriesFromLiveReport(input)
  const accepted: string[] = []
  const rejected: { id: string; reason: string }[] = []
  for (const entry of entries) {
    const result = recordDsxuExperience(input.store, entry)
    if (result.accepted) {
      accepted.push(entry.id)
    } else {
      rejected.push({ id: entry.id, reason: result.reason })
    }
  }
  const cases = input.report.cases ?? []
  return {
    entries,
    accepted,
    rejected,
    summary: {
      cases: cases.length,
      entries: entries.length,
      passedCases: cases.filter(item => item.status === 'pass' && item.policyPassed === true).length,
      failedOrPolicyCases: cases.filter(item => item.status === 'fail' || item.policyPassed === false || item.timedOut === true).length,
      verificationCommandEntries: entries.filter(entry => entry.kind === 'verification_command').length,
      costRouteEntries: entries.filter(entry => entry.kind === 'cost_route').length,
    },
  }
}

export function buildDsxuLiveReportSmoothResumeProjection(input: {
  report: DsxuLiveReportLike
  reportPath: string
  caseId: string
  query: string
  currentSourceFiles: readonly string[]
  maxRecalls?: number
}): DsxuLiveReportSmoothResumeProjection {
  const store: DsxuExperienceStore = { entries: [], tombstones: [] }
  const ingest = ingestDsxuLiveReportIntoExperienceStore({
    store,
    report: input.report,
    reportPath: input.reportPath,
  })
  const item = input.report.cases?.find(candidate => candidate.id === input.caseId)
  const warnings: string[] = []
  if (!item) {
    return {
      status: 'PARTIAL',
      caseId: input.caseId,
      recallIds: [],
      sourceTruthRefreshRequired: false,
      mayClaimPass: false,
      resumePlan: {
        actions: [],
        mayEditFromMemory: false,
        mayClaimPass: false,
        rendered: '## Smooth Resume Plan\n- missing live report case',
      },
      replayReport: buildDsxuExperienceReplayReport({
        cold: { toolCalls: 0, readCalls: 0, verificationRuns: 0, estimatedTokens: 0 },
        warm: { toolCalls: 0, readCalls: 0, verificationRuns: 0, estimatedTokens: 0 },
      }),
      coldMetrics: { toolCalls: 0, readCalls: 0, verificationRuns: 0, estimatedTokens: 0 },
      warmMetrics: { toolCalls: 0, readCalls: 0, verificationRuns: 0, estimatedTokens: 0 },
      warnings: ['missing-live-report-case'],
    }
  }
  if (ingest.rejected.length > 0) {
    warnings.push(`rejected-experience:${ingest.rejected.map(rejected => rejected.id).join(',')}`)
  }

  const recalls = recallDsxuExperience({
    store,
    query: input.query,
    currentSourceFiles: input.currentSourceFiles,
    maxEntries: input.maxRecalls ?? 8,
  })
  const injection = buildDsxuExperienceInjection({
    recalls,
    currentSourceFiles: input.currentSourceFiles,
  })
  const snapshot = buildSnapshotFromLiveReportCase({
    item,
    currentSourceFiles: input.currentSourceFiles,
  })
  const resumePlan = buildDsxuExperienceSmoothResume({ snapshot, injection })
  const coldMetrics = {
    toolCalls: item.metrics?.toolCalls ?? 0,
    readCalls: item.metrics?.readCalls ?? 0,
    verificationRuns: verificationRunsForCase(item),
    estimatedTokens: estimatedInputTokensForCase(item),
  }
  const warmReadCalls = Math.max(1, injection.memory.rereadFiles.length)
  const warmVerificationRuns = Math.min(
    Math.max(1, coldMetrics.verificationRuns),
    1,
  )
  const warmToolCalls = warmReadCalls + 2
  const warmMetrics = {
    toolCalls: warmToolCalls,
    readCalls: warmReadCalls,
    verificationRuns: warmVerificationRuns,
    estimatedTokens: Math.max(
      1,
      Math.round(coldMetrics.estimatedTokens * 0.45),
    ),
  }
  const replayReport = buildDsxuExperienceReplayReport({
    cold: coldMetrics,
    warm: warmMetrics,
    planning: injection.planning,
  })
  const status =
    recalls.length > 0 &&
    injection.memory.sourceTruthRefreshRequired &&
    resumePlan.mayClaimPass === false &&
    replayReport.repeatedExplorationReduced &&
    ingest.rejected.length === 0
      ? 'DONE_EVIDENCED'
      : 'PARTIAL'

  return {
    status,
    caseId: input.caseId,
    recallIds: recalls.map(recall => recall.entry.id),
    sourceTruthRefreshRequired: injection.memory.sourceTruthRefreshRequired,
    mayClaimPass: resumePlan.mayClaimPass,
    resumePlan,
    replayReport,
    coldMetrics,
    warmMetrics,
    warnings,
  }
}

export function runV18ExperienceLiveReportIngestHarness(input: {
  sourceReportPath: string
  evidencePath: string
  query?: string
  currentSourceFiles?: readonly string[]
  smoothResumeCaseId?: string
  maxCases?: number
  maxRecalls?: number
}): DsxuLiveReportExperienceIngestHarnessResult {
  const report = JSON.parse(readFileSync(input.sourceReportPath, 'utf8')) as DsxuLiveReportLike
  const store: DsxuExperienceStore = { entries: [], tombstones: [] }
  const ingest = ingestDsxuLiveReportIntoExperienceStore({
    store,
    report,
    reportPath: input.sourceReportPath,
    maxCases: input.maxCases,
  })
  const recalls = recallDsxuExperience({
    store,
    query: input.query ?? 'recover similar coding task using source truth and focused verification',
    currentSourceFiles: input.currentSourceFiles ?? [],
    maxEntries: input.maxRecalls ?? 8,
  })
  const benchmarkLeakDetected = store.entries.some(entry =>
    /\bDSXU_BENCH_[A-Z0-9_]+_PASS\b/i.test(`${entry.title}\n${entry.content}`),
  )
  const smoothResumeProjection = input.smoothResumeCaseId
    ? buildDsxuLiveReportSmoothResumeProjection({
        report,
        reportPath: input.sourceReportPath,
        caseId: input.smoothResumeCaseId,
        query: input.query ?? 'recover similar coding task using source truth and focused verification',
        currentSourceFiles: input.currentSourceFiles ?? [],
        maxRecalls: input.maxRecalls,
      })
    : undefined
  const status =
    ingest.rejected.length === 0 &&
    !benchmarkLeakDetected &&
    (!smoothResumeProjection || smoothResumeProjection.status === 'DONE_EVIDENCED')
      ? 'DONE_EVIDENCED'
      : 'PARTIAL'
  const result: DsxuLiveReportExperienceIngestHarnessResult = {
    ...ingest,
    status,
    reportPath: input.sourceReportPath,
    evidencePath: input.evidencePath,
    storeEntries: store.entries.length,
    recalls,
    benchmarkLeakDetected,
    ...(smoothResumeProjection ? { smoothResumeProjection } : {}),
  }

  mkdirSync(dirname(input.evidencePath), { recursive: true })
  writeFileSync(
    input.evidencePath,
    `${JSON.stringify({
      status,
      reportPath: input.sourceReportPath,
      summary: ingest.summary,
      acceptedCount: ingest.accepted.length,
      rejected: ingest.rejected,
      storeEntries: store.entries.length,
      recallKinds: recalls.map(recall => recall.entry.kind),
      recallIds: recalls.map(recall => recall.entry.id),
      benchmarkLeakDetected,
      smoothResumeProjection: smoothResumeProjection
        ? {
            status: smoothResumeProjection.status,
            caseId: smoothResumeProjection.caseId,
            recallIds: smoothResumeProjection.recallIds,
            sourceTruthRefreshRequired: smoothResumeProjection.sourceTruthRefreshRequired,
            mayClaimPass: smoothResumeProjection.mayClaimPass,
            toolCallReductionPct: smoothResumeProjection.replayReport.toolCallReductionPct,
            readReductionPct: smoothResumeProjection.replayReport.readReductionPct,
            tokenReductionPct: smoothResumeProjection.replayReport.tokenReductionPct,
            planningGrade: smoothResumeProjection.replayReport.planningQuality.grade,
            warnings: smoothResumeProjection.warnings,
          }
        : null,
    }, null, 2)}\n`,
    'utf8',
  )

  return result
}
