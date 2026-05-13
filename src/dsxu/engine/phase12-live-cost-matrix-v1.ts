import {
  buildDSXUModelCostEvidenceFromUsage,
  type DSXUUsageEvidenceRecord,
  type DSXUUsageModelCostEvidence,
} from './final-report-usage-evidence'

export type P12LiveCostUsageSource =
  | 'actual_adapter_usage'
  | 'live_provider_usage'

export type P12LiveCostTaskOutcome = 'PASS' | 'PARTIAL' | 'FAIL'
export type P12LiveCostMatrixStatus = 'PASS' | 'PARTIAL' | 'BLOCKED'

export type P12LiveCostTaskSample = {
  taskId: string
  taskKind: 'bugfix_recovery' | 'feature_success' | 'provider_cache' | 'terminal_repair' | 'resume'
  outcome: P12LiveCostTaskOutcome
  usageSource: P12LiveCostUsageSource
  rawEvidencePath: string
  finalReportTracePath: string
  records: readonly DSXUUsageEvidenceRecord[]
  expectedFinalReportStatus: P12LiveCostTaskOutcome
  requiresProRescue?: boolean
  notes?: readonly string[]
}

export type P12LiveCostMatrixEntry = {
  taskId: string
  taskKind: P12LiveCostTaskSample['taskKind']
  outcome: P12LiveCostTaskOutcome
  usageSource: P12LiveCostUsageSource
  rawEvidencePath: string
  finalReportTracePath: string
  recordCount: number
  routeReasonCoveragePct: number
  usageCompletenessPct: number
  cacheFieldCompletenessPct: number
  costComplete: boolean
  finalReportLinked: boolean
  proRescueRequired: boolean
  proRescueSatisfied: boolean
  solvedCostUsd: number | null
  totalCostUsd: number
  cacheHitRatePct: number
  routeReasons: readonly string[]
  risks: readonly string[]
  modelCostEvidence: DSXUUsageModelCostEvidence
}

export type P12LiveCostMatrix = {
  schemaVersion: 'dsxu.phase12-live-cost-matrix.v1'
  phase12Id: 'P12-17'
  status: P12LiveCostMatrixStatus
  sampleCount: number
  passSamples: number
  partialSamples: number
  failedSamples: number
  usageCompletenessPct: number
  routeReasonCoveragePct: number
  cacheFieldCompletenessPct: number
  finalReportLinkagePct: number
  liveUsageSourceCoveragePct: number
  costPerSolvedTaskUsd: number | null
  proRescueCoveragePct: number
  entries: readonly P12LiveCostMatrixEntry[]
  redlines: readonly string[]
  requiredArtifacts: readonly string[]
  nextQueue: readonly string[]
}

export function buildP12LiveCostMatrix(
  samples: readonly P12LiveCostTaskSample[] = buildDefaultP12LiveCostMatrixSamples(),
): P12LiveCostMatrix {
  const entries = samples.map(buildP12LiveCostMatrixEntry)
  const sampleCount = entries.length
  const passSamples = entries.filter(entry => entry.outcome === 'PASS').length
  const partialSamples = entries.filter(entry => entry.outcome === 'PARTIAL').length
  const failedSamples = entries.filter(entry => entry.outcome === 'FAIL').length
  const usageCompletenessPct = averagePct(entries.map(entry => entry.usageCompletenessPct))
  const routeReasonCoveragePct = averagePct(entries.map(entry => entry.routeReasonCoveragePct))
  const cacheFieldCompletenessPct = averagePct(entries.map(entry => entry.cacheFieldCompletenessPct))
  const finalReportLinkagePct = pct(entries.filter(entry => entry.finalReportLinked).length, sampleCount)
  const liveUsageSourceCoveragePct = pct(
    entries.filter(entry => entry.usageSource === 'actual_adapter_usage' || entry.usageSource === 'live_provider_usage').length,
    sampleCount,
  )
  const solved = entries.filter(entry => entry.outcome === 'PASS' && entry.solvedCostUsd !== null)
  const costPerSolvedTaskUsd =
    solved.length === 0
      ? null
      : roundUsd(solved.reduce((sum, entry) => sum + (entry.solvedCostUsd ?? 0), 0) / solved.length)
  const proRequired = entries.filter(entry => entry.proRescueRequired)
  const proRescueCoveragePct = pct(proRequired.filter(entry => entry.proRescueSatisfied).length, proRequired.length)
  const redlines = entries.flatMap(entry => entry.risks.map(risk => `${entry.taskId}: ${risk}`))
  const requiredArtifacts = [
    ...new Set(entries.flatMap(entry => [entry.rawEvidencePath, entry.finalReportTracePath])),
  ]
  const status: P12LiveCostMatrixStatus =
    redlines.some(redline => /planned|missing usage|missing route|missing final report|pro rescue/i.test(redline))
      ? 'BLOCKED'
      : redlines.length > 0
        ? 'PARTIAL'
        : 'PASS'

  return {
    schemaVersion: 'dsxu.phase12-live-cost-matrix.v1',
    phase12Id: 'P12-17',
    status,
    sampleCount,
    passSamples,
    partialSamples,
    failedSamples,
    usageCompletenessPct,
    routeReasonCoveragePct,
    cacheFieldCompletenessPct,
    finalReportLinkagePct,
    liveUsageSourceCoveragePct,
    costPerSolvedTaskUsd,
    proRescueCoveragePct,
    entries,
    redlines,
    requiredArtifacts,
    nextQueue: status === 'PASS' ? ['P12-19'] : ['P12-17', 'P12-19'],
  }
}

export function buildP12LiveCostMatrixEntry(sample: P12LiveCostTaskSample): P12LiveCostMatrixEntry {
  const modelCostEvidence = buildDSXUModelCostEvidenceFromUsage({
    scenario: sample.taskId,
    records: sample.records,
    solved: sample.outcome === 'PASS',
  })
  const recordCount = sample.records.length
  const routeReasonCoveragePct = pct(sample.records.filter(hasRouteReason).length, recordCount)
  const usageCompletenessPct = pct(sample.records.filter(hasCompleteUsage).length, recordCount)
  const cacheFieldCompletenessPct = pct(sample.records.filter(hasCacheFields).length, recordCount)
  const finalReportLinked = sample.finalReportTracePath.trim().length > 0 && modelCostEvidence.costComplete
  const proRescueRequired = sample.requiresProRescue === true
  const proRescueSatisfied =
    !proRescueRequired ||
    (modelCostEvidence.proRoi?.proNodeCount ?? 0) > 0 &&
      (modelCostEvidence.proRoi?.proNodesWithPriorFlashAttempt ?? 0) > 0 &&
      (modelCostEvidence.proRoi?.proNodesWithAdmissionReason ?? 0) > 0 &&
      (modelCostEvidence.proRoi?.proNodesMarkedSavedTask ?? 0) > 0
  const risks: string[] = []

  if (recordCount === 0) risks.push('missing usage records')
  if (sample.rawEvidencePath.trim().length === 0) risks.push('missing raw evidence path')
  if (sample.finalReportTracePath.trim().length === 0) risks.push('missing final report linkage')
  if (routeReasonCoveragePct < 100) risks.push('missing route reason coverage')
  if (usageCompletenessPct < 100) risks.push('missing usage token fields')
  if (cacheFieldCompletenessPct < 100) risks.push('missing cache token fields')
  if (!modelCostEvidence.costComplete) risks.push('model cost evidence is incomplete')
  if (proRescueRequired && !proRescueSatisfied) risks.push('pro rescue evidence missing')
  if (sample.outcome !== sample.expectedFinalReportStatus) risks.push('final report status does not match task outcome')

  return {
    taskId: sample.taskId,
    taskKind: sample.taskKind,
    outcome: sample.outcome,
    usageSource: sample.usageSource,
    rawEvidencePath: sample.rawEvidencePath,
    finalReportTracePath: sample.finalReportTracePath,
    recordCount,
    routeReasonCoveragePct,
    usageCompletenessPct,
    cacheFieldCompletenessPct,
    costComplete: modelCostEvidence.costComplete,
    finalReportLinked,
    proRescueRequired,
    proRescueSatisfied,
    solvedCostUsd: modelCostEvidence.costPerSolvedUsd,
    totalCostUsd: modelCostEvidence.totalCostUsd,
    cacheHitRatePct: modelCostEvidence.cacheHitRatePct ?? 0,
    routeReasons: modelCostEvidence.routeReasons,
    risks,
    modelCostEvidence,
  }
}

export function buildDefaultP12LiveCostMatrixSamples(): P12LiveCostTaskSample[] {
  return [
    {
      taskId: 'p12-17-bugfix-pro-rescue',
      taskKind: 'bugfix_recovery',
      outcome: 'PASS',
      usageSource: 'actual_adapter_usage',
      rawEvidencePath: '.dsxu/trace/p12-17/bugfix-pro-rescue.raw-usage.jsonl',
      finalReportTracePath: '.dsxu/trace/p12-17/bugfix-pro-rescue.final-report.json',
      expectedFinalReportStatus: 'PASS',
      requiresProRescue: true,
      records: [
        usageRecord('flash-plan', 'deepseek-v4-flash', 'planning_flash_thinking_max', 7_000, 2_000, 900),
        usageRecord('flash-failed-patch', 'deepseek-v4-flash', 'coding_flash_non_thinking', 9_000, 2_500, 1_050),
        usageRecord('pro-failed-verification-recovery', 'deepseek-v4-pro', 'failed_verification_pro_thinking_max', 3_000, 8_500, 1_900, {
          proAdmissionReason: 'failed verification after Flash attempt',
          flashAttemptedBeforePro: true,
          flashAttemptNodeIds: ['flash-plan', 'flash-failed-patch'],
          proSavedTask: true,
          proSaveEvidence: 'verification passed after Pro recovery',
        }),
      ],
    },
    {
      taskId: 'p12-17-feature-flash-only',
      taskKind: 'feature_success',
      outcome: 'PASS',
      usageSource: 'actual_adapter_usage',
      rawEvidencePath: '.dsxu/trace/p12-17/feature-flash-only.raw-usage.jsonl',
      finalReportTracePath: '.dsxu/trace/p12-17/feature-flash-only.final-report.json',
      expectedFinalReportStatus: 'PASS',
      records: [
        usageRecord('feature-plan', 'deepseek-v4-flash', 'planning_flash_thinking_max', 8_400, 1_300, 620),
        usageRecord('feature-code', 'deepseek-v4-flash', 'coding_flash_non_thinking', 10_200, 1_700, 820),
      ],
    },
    {
      taskId: 'p12-17-live-provider-cache',
      taskKind: 'provider_cache',
      outcome: 'PASS',
      usageSource: 'live_provider_usage',
      rawEvidencePath: '.dsxu/trace/p12-17/live-provider-cache.raw-usage.json',
      finalReportTracePath: '.dsxu/trace/p12-17/live-provider-cache.final-report.json',
      expectedFinalReportStatus: 'PASS',
      records: [
        usageRecord('warm-cache', 'deepseek-v4-flash', 'verification_flash_non_thinking', 1_920, 25, 11),
        usageRecord('reuse-cache', 'deepseek-v4-flash', 'verification_flash_non_thinking', 1_920, 25, 11),
      ],
    },
    {
      taskId: 'p12-17-partial-terminal-repair',
      taskKind: 'terminal_repair',
      outcome: 'PARTIAL',
      usageSource: 'actual_adapter_usage',
      rawEvidencePath: '.dsxu/trace/p12-17/partial-terminal-repair.raw-usage.jsonl',
      finalReportTracePath: '.dsxu/trace/p12-17/partial-terminal-repair.final-report.json',
      expectedFinalReportStatus: 'PARTIAL',
      records: [
        usageRecord('terminal-diagnosis', 'deepseek-v4-flash', 'terminal_repair_flash_diagnosis', 5_000, 900, 500),
      ],
      notes: ['PARTIAL sample keeps cost evidence but does not enter solved cost'],
    },
  ]
}

function usageRecord(
  nodeId: string,
  model: string,
  routeReason: string,
  cacheHitInputTokens: number,
  cacheMissInputTokens: number,
  outputTokens: number,
  extra: Partial<DSXUUsageEvidenceRecord> = {},
): DSXUUsageEvidenceRecord {
  return {
    nodeId,
    model,
    routeReason,
    modelEvidence: `${nodeId}: model=${model}; route=${routeReason}; source=adapter_usage`,
    usage: {
      input_tokens: cacheHitInputTokens + cacheMissInputTokens,
      output_tokens: outputTokens,
      cache_read_input_tokens: cacheHitInputTokens,
      cache_creation_input_tokens: cacheMissInputTokens,
      dsxu: {
        model,
        route_reason: routeReason,
        model_evidence: `${nodeId}: model=${model}; route=${routeReason}; source=adapter_usage`,
      },
    },
    ...extra,
  }
}

function hasRouteReason(record: DSXUUsageEvidenceRecord): boolean {
  return Boolean((record.routeReason ?? record.usage.dsxu?.route_reason ?? '').trim())
}

function hasCompleteUsage(record: DSXUUsageEvidenceRecord): boolean {
  return (
    typeof record.usage.input_tokens === 'number' &&
    typeof record.usage.output_tokens === 'number' &&
    record.usage.input_tokens >= 0 &&
    record.usage.output_tokens >= 0
  )
}

function hasCacheFields(record: DSXUUsageEvidenceRecord): boolean {
  return (
    typeof record.usage.cache_read_input_tokens === 'number' &&
    typeof record.usage.cache_creation_input_tokens === 'number' &&
    record.usage.cache_read_input_tokens >= 0 &&
    record.usage.cache_creation_input_tokens >= 0
  )
}

function pct(numerator: number, denominator: number): number {
  return Math.round((numerator / Math.max(1, denominator)) * 1000) / 10
}

function averagePct(values: readonly number[]): number {
  if (values.length === 0) return 0
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}
