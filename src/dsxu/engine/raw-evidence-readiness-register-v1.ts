import type {
  P12RawComparisonReport,
  P12TargetReferenceCollectionPack,
} from './phase12-raw-comparison-v1'

export type RawEvidenceReadinessStatus = 'PASS' | 'PARTIAL' | 'BLOCKED'

export type DeferredEvalId = 'R01' | 'R02' | 'S02' | 'R04' | 'R05' | 'R06'

export type DeferredEvalRawEvidenceSpec = {
  id: DeferredEvalId
  name: string
  owner: string
  requiredRawEvidence: readonly string[]
  forbiddenRuntimeShortcut: string
}

export type RawEvidenceReadinessEntry = {
  id: string
  lane: 'P12-19' | 'deferred-eval'
  status: RawEvidenceReadinessStatus
  owner: string
  rawEvidenceState: 'missing-target-raw' | 'sample-incomplete' | 'ready-for-delta-review' | 'waiting-raw-live'
  pairedRawLogCount: number
  minimumPairedRawLogsForPass: number
  requiredAction: string
  requiredArtifacts: readonly string[]
  redlines: readonly string[]
}

export type RawEvidenceReadinessRegister = {
  schemaVersion: 'dsxu.raw-evidence-readiness-register.v1'
  status: RawEvidenceReadinessStatus
  p12Status: RawEvidenceReadinessStatus
  deferredEvalStatus: RawEvidenceReadinessStatus
  p12PairedRawLogCount: number
  p12MinimumPairedRawLogsForPass: number
  p12ReplayFamilyGapCount: number
  p12UnmappedPairedRawLogCount: number
  p12CollectionTaskCount: number
  p12RequiredAdditionalSameTaskPairCount: number
  p12CurrentCollectionPackCanReachPass: boolean
  p12ExpansionBacklogCount: number
  p12UnmappedCollectionTaskCount: number
  p12ReplayFamilyGaps: readonly string[]
  deferredEvalCount: number
  deferredEvalWaitingRawLiveCount: number
  entryCount: number
  pass: number
  partial: number
  blocked: number
  mustNotClaimComparisonWin: boolean
  entries: readonly RawEvidenceReadinessEntry[]
  blockers: readonly string[]
  safeguards: readonly string[]
  nextAction:
    | 'collect-target-reference-raw-logs'
    | 'expand-paired-raw-sample-set'
    | 'collect-deferred-eval-raw-live-logs'
    | 'ready-for-delta-review'
}

export const DEFERRED_EVAL_RAW_EVIDENCE_SPECS: readonly DeferredEvalRawEvidenceSpec[] = [
  {
    id: 'R01',
    name: 'Terminal-Bench 2.0',
    owner: 'Terminal ResultPack / Bash-PowerShell Adapter Owner',
    requiredRawEvidence: ['raw command log', 'artifact paths', 'cost', 'failure taxonomy', 'same-task constraints'],
    forbiddenRuntimeShortcut: 'do not create a second terminal executor or benchmark-only shell runtime',
  },
  {
    id: 'R02',
    name: 'Internal Code-30',
    owner: 'Code Intelligence Replay Owner',
    requiredRawEvidence: ['task prompt', 'baseline state', 'patch trace', 'verification log', 'final report'],
    forbiddenRuntimeShortcut: 'do not use dry plans or synthetic score rows as code-task evidence',
  },
  {
    id: 'S02',
    name: 'BenchMax Mode',
    owner: 'Eval Profile / Model Router Owner',
    requiredRawEvidence: ['candidate list', 'route/cost budget', 'Pro review trace', 'verification result', 'winner rationale'],
    forbiddenRuntimeShortcut: 'do not turn eval profile search into default product runtime',
  },
  {
    id: 'R04',
    name: 'SWE Verified',
    owner: 'External Code Repair Eval Owner',
    requiredRawEvidence: ['same-task raw log', 'patch artifact', 'test command log', 'outcome', 'cost'],
    forbiddenRuntimeShortcut: 'do not add an eval-specific provider runtime',
  },
  {
    id: 'R05',
    name: 'BFCL V4',
    owner: 'Tool Lifecycle / ToolBus Owner',
    requiredRawEvidence: ['tool call trace', 'permission/gate evidence', 'result schema', 'failure class', 'final outcome'],
    forbiddenRuntimeShortcut: 'do not create a second tool system for benchmark calls',
  },
  {
    id: 'R06',
    name: 'BrowseComp-Lite',
    owner: 'Browser/WebFetch/MCP/Context Owner',
    requiredRawEvidence: ['browse trace', 'source artifacts', 'retrieval context', 'answer evidence', 'cost'],
    forbiddenRuntimeShortcut: 'do not create a standalone retrieval/browser runtime',
  },
]

function p12RawEvidenceState(report: P12RawComparisonReport): RawEvidenceReadinessEntry['rawEvidenceState'] {
  if (report.pairedRawLogCount === 0) return 'missing-target-raw'
  if (
    report.pairedRawLogCount < report.minimumPairedRawLogsForPass ||
    report.replayFamilyGapCount > 0 ||
    report.unmappedPairedRawLogCount > 0
  ) return 'sample-incomplete'
  return 'ready-for-delta-review'
}

function p12Entry(
  report: P12RawComparisonReport,
  collectionPack: P12TargetReferenceCollectionPack,
): RawEvidenceReadinessEntry {
  const state = p12RawEvidenceState(report)
  const redlines = [
    ...(report.pairedRawLogCount === 0 ? ['target reference paired raw logs are missing'] : []),
    ...(report.pairedRawLogCount > 0 && report.pairedRawLogCount < report.minimumPairedRawLogsForPass
      ? ['paired raw log sample set is incomplete']
      : []),
    ...(report.replayFamilyGapCount > 0
      ? [`paired raw logs do not cover required original-side replay families: ${report.replayFamilyGapCount} gap(s)`]
      : []),
    ...(report.unmappedPairedRawLogCount > 0
      ? [`paired raw logs outside original-side replay families do not count for PASS: ${report.unmappedPairedRawLogCount}`]
      : []),
    ...report.redlines,
  ]
  const status: RawEvidenceReadinessStatus = redlines.some(redline => /missing|blocked|dry plan|no-evidence/i.test(redline))
    ? 'BLOCKED'
    : state === 'ready-for-delta-review' && report.status === 'PASS'
      ? 'PASS'
      : 'PARTIAL'

  return {
    id: 'P12-19',
    lane: 'P12-19',
    status,
    owner: 'Phase 12 / Same-task Raw Comparison Owner',
    rawEvidenceState: state,
    pairedRawLogCount: report.pairedRawLogCount,
    minimumPairedRawLogsForPass: report.minimumPairedRawLogsForPass,
    requiredAction: state === 'missing-target-raw'
      ? 'collect real same-task target-reference raw logs using the collection pack; do not use the template as evidence'
      : state === 'sample-incomplete'
        ? 'expand same-task target-reference raw logs until the minimum paired sample set and original-side replay family coverage are complete'
        : 'review delta findings before any comparison claim',
    requiredArtifacts: [
      ...report.requiredArtifacts,
      ...collectionPack.tasks.map(task => task.dsxuRawLogPath),
    ],
    redlines,
  }
}

function deferredEvalEntry(spec: DeferredEvalRawEvidenceSpec): RawEvidenceReadinessEntry {
  return {
    id: spec.id,
    lane: 'deferred-eval',
    status: 'PARTIAL',
    owner: spec.owner,
    rawEvidenceState: 'waiting-raw-live',
    pairedRawLogCount: 0,
    minimumPairedRawLogsForPass: 1,
    requiredAction: `collect raw/live evidence for ${spec.name}; ${spec.forbiddenRuntimeShortcut}`,
    requiredArtifacts: spec.requiredRawEvidence,
    redlines: ['raw/live eval evidence is not imported yet'],
  }
}

export function buildRawEvidenceReadinessRegister(input: {
  p12Report: P12RawComparisonReport
  collectionPack: P12TargetReferenceCollectionPack
  deferredEvalSpecs?: readonly DeferredEvalRawEvidenceSpec[]
}): RawEvidenceReadinessRegister {
  const deferredEvalSpecs = input.deferredEvalSpecs ?? DEFERRED_EVAL_RAW_EVIDENCE_SPECS
  const entries = [
    p12Entry(input.p12Report, input.collectionPack),
    ...deferredEvalSpecs.map(deferredEvalEntry),
  ]
  const pass = entries.filter(entry => entry.status === 'PASS').length
  const partial = entries.filter(entry => entry.status === 'PARTIAL').length
  const blocked = entries.filter(entry => entry.status === 'BLOCKED').length
  const deferredEvalWaitingRawLiveCount = entries
    .filter(entry => entry.lane === 'deferred-eval' && entry.rawEvidenceState === 'waiting-raw-live').length
  const p12 = entries.find(entry => entry.id === 'P12-19')
  const p12Status = p12?.status ?? 'BLOCKED'
  const deferredEvalStatus: RawEvidenceReadinessStatus = deferredEvalWaitingRawLiveCount > 0 ? 'PARTIAL' : 'PASS'
  const status: RawEvidenceReadinessStatus = blocked > 0
    ? 'BLOCKED'
    : partial > 0
      ? 'PARTIAL'
      : 'PASS'
  const blockers = entries.flatMap(entry =>
    entry.status === 'BLOCKED'
      ? entry.redlines.map(redline => `${entry.id}: ${redline}`)
      : [],
  )

  return {
    schemaVersion: 'dsxu.raw-evidence-readiness-register.v1',
    status,
    p12Status,
    deferredEvalStatus,
    p12PairedRawLogCount: input.p12Report.pairedRawLogCount,
    p12MinimumPairedRawLogsForPass: input.p12Report.minimumPairedRawLogsForPass,
    p12ReplayFamilyGapCount: input.p12Report.replayFamilyGapCount,
    p12UnmappedPairedRawLogCount: input.p12Report.unmappedPairedRawLogCount,
    p12CollectionTaskCount: input.collectionPack.taskCount,
    p12RequiredAdditionalSameTaskPairCount: input.collectionPack.requiredAdditionalSameTaskPairCount,
    p12CurrentCollectionPackCanReachPass: input.collectionPack.currentPackCanReachPass,
    p12ExpansionBacklogCount: input.collectionPack.expansionBacklog.length,
    p12UnmappedCollectionTaskCount: input.collectionPack.unmappedCollectionTaskCount,
    p12ReplayFamilyGaps: input.collectionPack.replayFamilyCoverage
      .filter(item => item.missingPairCount > 0)
      .map(item => `${item.familyId}:${item.missingPairCount}`),
    deferredEvalCount: deferredEvalSpecs.length,
    deferredEvalWaitingRawLiveCount,
    entryCount: entries.length,
    pass,
    partial,
    blocked,
    mustNotClaimComparisonWin: status !== 'PASS' || input.p12Report.mustNotClaimComparisonWin,
    entries,
    blockers,
    safeguards: [
      'register is evidence-only and does not create a target-reference log',
      'collection templates and runbooks are not raw evidence',
      'current P12 collection pack task count must not be confused with paired target-reference raw logs',
      'paired raw log quantity cannot satisfy PASS without original-side replay family coverage',
      'deferred eval rows cannot become PASS without raw/live logs, artifacts, cost, and outcome evidence',
      'external evals must reuse existing tool, terminal, browser, model-router, and evidence owners',
      'do not introduce benchmark-only runtime paths',
    ],
    nextAction: input.p12Report.pairedRawLogCount === 0
      ? 'collect-target-reference-raw-logs'
      : input.p12Report.pairedRawLogCount < input.p12Report.minimumPairedRawLogsForPass ||
          input.p12Report.replayFamilyGapCount > 0 ||
          input.p12Report.unmappedPairedRawLogCount > 0
        ? 'expand-paired-raw-sample-set'
        : deferredEvalWaitingRawLiveCount > 0
          ? 'collect-deferred-eval-raw-live-logs'
          : 'ready-for-delta-review',
  }
}
