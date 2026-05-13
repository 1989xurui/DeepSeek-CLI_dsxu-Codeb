import type {
  RealTaskReplayEvidenceChecklist,
  RealTaskReplayStatus,
} from './real-task-replay-suite-v1'

export type P12RawComparisonStatus = 'PASS' | 'PARTIAL' | 'BLOCKED'
export type P12RawComparisonSide = 'dsxu' | 'target-reference'

export type P12RawComparisonIntegrity = {
  rawTranscript: boolean
  toolTrace: boolean
  finalReport: boolean
}

export type P12RawComparisonMetrics = {
  elapsedMs: number | null
  interventionCount: number
  toolCallCount: number
  evidenceCompletenessPct: number
  costUsd: number | null
  noEvidenceActionCount: number
}

export type P12RawTaskLog = {
  comparisonId: string
  taskId: string
  side: P12RawComparisonSide
  taskPrompt: string
  rawLogPath: string
  artifactPaths: readonly string[]
  outcome: RealTaskReplayStatus | 'FAIL'
  evidence: RealTaskReplayEvidenceChecklist
  integrity: P12RawComparisonIntegrity
  metrics: P12RawComparisonMetrics
  risks: readonly string[]
}

export type P12RawLogManifest = {
  schemaVersion: 'dsxu.phase12-raw-log-manifest.v1'
  side: P12RawComparisonSide
  source: {
    collectedAt: string
    acquisitionMethod: 'manual-import' | 'runner-export'
    immutableRawDir?: string
  }
  logs: readonly P12RawTaskLog[]
}

export type P12RawLogManifestValidation = {
  schemaVersion: 'dsxu.phase12-raw-log-manifest-validation.v1'
  status: P12RawComparisonStatus
  side: P12RawComparisonSide | null
  acceptedLogs: readonly P12RawTaskLog[]
  rejectedLogs: readonly {
    index: number
    redlines: readonly string[]
  }[]
  redlines: readonly string[]
}

export type P12RawTaskLogEvaluation = {
  side: P12RawComparisonSide
  status: P12RawComparisonStatus
  missingEvidence: readonly string[]
  redlines: readonly string[]
}

export type P12RawComparisonInput = {
  comparisonId: string
  taskId: string
  taskPrompt: string
  dsxu: P12RawTaskLog
  targetReference?: P12RawTaskLog
}

export type P12RawDeltaFinding = {
  kind:
    | 'missing-target-reference-raw-log'
    | 'task-mismatch'
    | 'dsxu-outcome-gap'
    | 'intervention-gap'
    | 'evidence-gap'
    | 'cost-gap'
    | 'raw-integrity-block'
  severity: 'info' | 'warning' | 'critical'
  message: string
}

export type P12RawComparisonCaseResult = {
  comparisonId: string
  taskId: string
  status: P12RawComparisonStatus
  dsxu: P12RawTaskLogEvaluation
  targetReference: P12RawTaskLogEvaluation | null
  outcomeDelta: number | null
  interventionDelta: number | null
  evidenceCompletenessDeltaPct: number | null
  costDeltaUsd: number | null
  findings: readonly P12RawDeltaFinding[]
  requiredArtifacts: readonly string[]
}

export type P12RawComparisonReport = {
  schemaVersion: 'dsxu.phase12-raw-comparison.v1'
  status: P12RawComparisonStatus
  caseCount: number
  pairedRawLogCount: number
  minimumPairedRawLogsForPass: number
  replayFamilyGapCount: number
  unmappedPairedRawLogCount: number
  pass: number
  partial: number
  blocked: number
  mustNotClaimComparisonWin: boolean
  replayFamilyCoverage: readonly P12RawReplayFamilyCoverage[]
  cases: readonly P12RawComparisonCaseResult[]
  requiredArtifacts: readonly string[]
  redlines: readonly string[]
  nextAction: 'collect-target-reference-raw-logs' | 'fix-blocked-raw-integrity' | 'expand-sample-set' | 'ready-for-delta-review'
}

export type P12RawDeltaReport = {
  schemaVersion: 'dsxu.phase12-raw-delta-report.v1'
  status: P12RawComparisonStatus
  caseCount: number
  pairedRawLogCount: number
  minimumPairedRawLogsForPass: number
  mustNotClaimComparisonWin: boolean
  summary: {
    pass: number
    partial: number
    blocked: number
    criticalFindings: number
    warningFindings: number
    infoFindings: number
    missingTargetReferenceRawLogs: number
    replayFamilyGapCount: number
    unmappedPairedRawLogs: number
    negativeOutcomeGaps: number
    higherInterventionCount: number
    lowerEvidenceCompleteness: number
    higherCostCount: number
  }
  cases: readonly {
    comparisonId: string
    taskId: string
    status: P12RawComparisonStatus
    targetReferencePresent: boolean
    outcomeDelta: number | null
    interventionDelta: number | null
    evidenceCompletenessDeltaPct: number | null
    costDeltaUsd: number | null
    findingKinds: readonly P12RawDeltaFinding['kind'][]
    requiredArtifacts: readonly string[]
  }[]
  redlines: readonly string[]
  nextAction: P12RawComparisonReport['nextAction']
}

export type P12TargetReferenceCollectionTask = {
  comparisonId: string
  taskId: string
  taskPrompt: string
  dsxuRawLogPath: string
  dsxuArtifactPaths: readonly string[]
  requiredTargetFields: readonly string[]
}

export type P12ReplayFamilyId =
  | 'RT-01'
  | 'RT-02'
  | 'RT-03'
  | 'RT-04'
  | 'RT-05'
  | 'RT-06'
  | 'RT-07'
  | 'RT-08'

export type P12ReplayFamilyCoverage = {
  familyId: P12ReplayFamilyId
  requiredPairCount: number
  currentCollectionTaskCount: number
  missingPairCount: number
}

export type P12RawReplayFamilyCoverage = {
  familyId: P12ReplayFamilyId
  requiredPairCount: number
  pairedRawLogCount: number
  missingPairCount: number
}

export type P12TargetReferenceExpansionTask = {
  slotId: string
  familyId: P12ReplayFamilyId
  requiredScenario: string
  requiredEvidence: readonly string[]
  mustUseExistingOwner: string
}

export type P12TargetReferenceManifestBacklogSlot = P12TargetReferenceExpansionTask & {
  dsxuPairRequirement: string
  manifestLogRequirement: string
  taskIdRequirement: string
  comparisonIdRequirement: string
}

export type P12TargetReferenceCollectionWorkOrder = {
  workOrderId: string
  kind: 'existing-dsxu-pair' | 'expansion-pair-slot'
  familyId: P12ReplayFamilyId | null
  comparisonIdRequirement: string
  taskIdRequirement: string
  taskPromptRequirement: string
  mustUseExistingOwner: string
  dsxuRawOutputRequirement: string
  targetReferenceRawOutputRequirement: string
  requiredEvidence: readonly string[]
  acceptanceGate: readonly string[]
}

export type P12TargetReferenceCollectionPack = {
  schemaVersion: 'dsxu.p12-target-reference-collection.v1'
  status: 'READY_FOR_COLLECTION'
  taskCount: number
  minimumPairedRawLogsForPass: number
  pairedRawLogCount: 0
  currentPackCanReachPass: boolean
  requiredAdditionalSameTaskPairCount: number
  unmappedCollectionTaskCount: number
  mustNotClaimComparisonWin: true
  tasks: readonly P12TargetReferenceCollectionTask[]
  replayFamilyCoverage: readonly P12ReplayFamilyCoverage[]
  expansionBacklog: readonly P12TargetReferenceExpansionTask[]
  targetManifestBacklogSlots: readonly P12TargetReferenceManifestBacklogSlot[]
  collectionWorkOrders: readonly P12TargetReferenceCollectionWorkOrder[]
  targetManifestAcceptanceCriteria: readonly string[]
  manifestTemplate: {
    schemaVersion: 'dsxu.phase12-raw-log-manifest.v1'
    side: 'target-reference'
    source: {
      collectedAt: '<fill-after-run>'
      acquisitionMethod: 'manual-import'
      immutableRawDir: '<fill-raw-log-directory>'
    }
    logs: readonly []
  }
  instructions: readonly string[]
}

const evidenceKeys: Array<keyof RealTaskReplayEvidenceChecklist> = [
  'baseline',
  'context',
  'execution',
  'recovery',
  'verification',
  'cost',
  'final',
]

const integrityKeys: Array<keyof P12RawComparisonIntegrity> = [
  'rawTranscript',
  'toolTrace',
  'finalReport',
]

const p12ReplayFamilyRequirements: readonly {
  familyId: P12ReplayFamilyId
  requiredPairCount: number
  requiredScenario: string
  requiredEvidence: readonly string[]
  mustUseExistingOwner: string
}[] = [
  {
    familyId: 'RT-01',
    requiredPairCount: 3,
    requiredScenario: 'multi-file bugfix with baseline failure, localization, patch repair, verification, and final report',
    requiredEvidence: ['baseline fail', 'localized files', 'patch artifact', 'verification command', 'cost', 'final report'],
    mustUseExistingOwner: 'Code Intelligence / Repair Loop Owner',
  },
  {
    familyId: 'RT-02',
    requiredPairCount: 2,
    requiredScenario: 'feature plus tests with plan, implementation, new verification, and final report',
    requiredEvidence: ['requirement split', 'implementation trace', 'test addition', 'verification log', 'final report'],
    mustUseExistingOwner: 'Code Intelligence / Task Runtime Owner',
  },
  {
    familyId: 'RT-03',
    requiredPairCount: 2,
    requiredScenario: 'review plus fix with non-style finding, patch, verification, and review note',
    requiredEvidence: ['finding rationale', 'risk severity', 'patch artifact', 'verification log', 'review summary'],
    mustUseExistingOwner: 'Review / Verification Owner',
  },
  {
    familyId: 'RT-04',
    requiredPairCount: 2,
    requiredScenario: 'terminal repair with shell state, command budget, failure classification, artifact, and recovery',
    requiredEvidence: ['shell state', 'command log', 'failure class', 'artifact path', 'recovery proof'],
    mustUseExistingOwner: 'Terminal ResultPack / Bash-PowerShell Adapter Owner',
  },
  {
    familyId: 'RT-05',
    requiredPairCount: 1,
    requiredScenario: 'frontend or dev-server task with browser/screenshot/trace and visible error recovery',
    requiredEvidence: ['dev-server log', 'browser trace or screenshot', 'visible error', 'recovery action', 'final report'],
    mustUseExistingOwner: 'Browser / Dev Server Proof Owner',
  },
  {
    familyId: 'RT-06',
    requiredPairCount: 1,
    requiredScenario: 'package, build, or dependency task with environment diagnosis, failed build path, and artifact',
    requiredEvidence: ['environment diagnosis', 'build command log', 'dependency or package change', 'artifact', 'final report'],
    mustUseExistingOwner: 'Build / Package Verification Owner',
  },
  {
    familyId: 'RT-07',
    requiredPairCount: 2,
    requiredScenario: 'long resume across at least two turns with compact snapshot, source reread, edit, and verification',
    requiredEvidence: ['compact snapshot', 'source reread', 'pending action preservation', 'verification after resume', 'final report'],
    mustUseExistingOwner: 'Context / Compact Resume Owner',
  },
  {
    familyId: 'RT-08',
    requiredPairCount: 1,
    requiredScenario: 'agent synthesis with worker evidence, parent final gate, partial worker handling, and honest final',
    requiredEvidence: ['worker scope', 'worker artifact', 'parent synthesis', 'partial handling', 'final gate'],
    mustUseExistingOwner: 'Agent Orchestration / Parent Final Gate Owner',
  },
]

function outcomeScore(outcome: RealTaskReplayStatus | 'FAIL'): number {
  if (outcome === 'PASS') return 1
  if (outcome === 'PARTIAL') return 0.5
  return 0
}

function p12ReplayFamilyIdForTask(taskId: string): P12ReplayFamilyId | null {
  return p12ReplayFamilyRequirements
    .find(item => taskId === item.familyId || taskId.startsWith(`${item.familyId}-`))
    ?.familyId ?? null
}

function p12ReplayFamilyRequirementForTask(taskId: string): (typeof p12ReplayFamilyRequirements)[number] | null {
  const familyId = p12ReplayFamilyIdForTask(taskId)
  return familyId ? p12ReplayFamilyRequirements.find(item => item.familyId === familyId) ?? null : null
}

function looksLikeDryPlan(input: P12RawTaskLog): boolean {
  return /dry plan|planned only|score-only|ranking without raw/i.test([
    input.rawLogPath,
    ...input.risks,
  ].join('\n'))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSide(value: unknown): value is P12RawComparisonSide {
  return value === 'dsxu' || value === 'target-reference'
}

function isOutcome(value: unknown): value is P12RawTaskLog['outcome'] {
  return value === 'PASS' || value === 'PARTIAL' || value === 'BLOCKED' || value === 'FAIL'
}

function readBooleanRecord(
  value: unknown,
  keys: readonly string[],
  prefix: string,
): { value: Record<string, boolean> | null, redlines: string[] } {
  if (!isRecord(value)) return { value: null, redlines: [`missing ${prefix}`] }
  const redlines = keys
    .filter(key => typeof value[key] !== 'boolean')
    .map(key => `missing ${prefix}.${key}`)
  if (redlines.length > 0) return { value: null, redlines }
  return {
    value: Object.fromEntries(keys.map(key => [key, value[key] as boolean])),
    redlines,
  }
}

function parseManifestLog(
  input: unknown,
  expectedSide: P12RawComparisonSide,
  index: number,
): { log: P12RawTaskLog | null, redlines: string[] } {
  if (!isRecord(input)) {
    return { log: null, redlines: [`log ${index}: entry is not an object`] }
  }
  const redlines: string[] = []
  const comparisonId = typeof input.comparisonId === 'string' ? input.comparisonId : ''
  const taskId = typeof input.taskId === 'string' ? input.taskId : ''
  const side = isSide(input.side) ? input.side : null
  const taskPrompt = typeof input.taskPrompt === 'string' ? input.taskPrompt : ''
  const rawLogPath = typeof input.rawLogPath === 'string' ? input.rawLogPath : ''
  const artifactPaths = Array.isArray(input.artifactPaths) && input.artifactPaths.every(item => typeof item === 'string')
    ? input.artifactPaths
    : []
  const outcome = isOutcome(input.outcome) ? input.outcome : null
  const evidence = readBooleanRecord(input.evidence, evidenceKeys, 'evidence')
  const integrity = readBooleanRecord(input.integrity, integrityKeys, 'integrity')
  const metricsInput = isRecord(input.metrics) ? input.metrics : null
  const risks = Array.isArray(input.risks) && input.risks.every(item => typeof item === 'string')
    ? input.risks
    : []

  if (!comparisonId) redlines.push('missing comparisonId')
  if (!taskId) redlines.push('missing taskId')
  if (!side) redlines.push('missing side')
  if (side && side !== expectedSide) redlines.push(`side ${side} does not match manifest side ${expectedSide}`)
  if (!taskPrompt) redlines.push('missing taskPrompt')
  if (!rawLogPath) redlines.push('missing rawLogPath')
  if (artifactPaths.length === 0) redlines.push('missing artifactPaths')
  if (!outcome) redlines.push('missing outcome')
  redlines.push(...evidence.redlines, ...integrity.redlines)
  if (!metricsInput) {
    redlines.push('missing metrics')
  }
  const elapsedMs = metricsInput && (typeof metricsInput.elapsedMs === 'number' || metricsInput.elapsedMs === null)
    ? metricsInput.elapsedMs
    : null
  const interventionCount = metricsInput && typeof metricsInput.interventionCount === 'number'
    ? metricsInput.interventionCount
    : NaN
  const toolCallCount = metricsInput && typeof metricsInput.toolCallCount === 'number'
    ? metricsInput.toolCallCount
    : NaN
  const evidenceCompletenessPct = metricsInput && typeof metricsInput.evidenceCompletenessPct === 'number'
    ? metricsInput.evidenceCompletenessPct
    : NaN
  const costUsd = metricsInput && (typeof metricsInput.costUsd === 'number' || metricsInput.costUsd === null)
    ? metricsInput.costUsd
    : null
  const noEvidenceActionCount = metricsInput && typeof metricsInput.noEvidenceActionCount === 'number'
    ? metricsInput.noEvidenceActionCount
    : NaN
  if (Number.isNaN(interventionCount)) redlines.push('missing metrics.interventionCount')
  if (Number.isNaN(toolCallCount)) redlines.push('missing metrics.toolCallCount')
  if (Number.isNaN(evidenceCompletenessPct)) redlines.push('missing metrics.evidenceCompletenessPct')
  if (Number.isNaN(noEvidenceActionCount)) redlines.push('missing metrics.noEvidenceActionCount')
  if (redlines.length > 0 || !side || !outcome || !evidence.value || !integrity.value) {
    return { log: null, redlines }
  }
  return {
    log: {
      comparisonId,
      taskId,
      side,
      taskPrompt,
      rawLogPath,
      artifactPaths,
      outcome,
      evidence: evidence.value as RealTaskReplayEvidenceChecklist,
      integrity: integrity.value as P12RawComparisonIntegrity,
      metrics: {
        elapsedMs,
        interventionCount,
        toolCallCount,
        evidenceCompletenessPct,
        costUsd,
        noEvidenceActionCount,
      },
      risks,
    },
    redlines,
  }
}

export function buildP12RawComparisonKey(input: {
  comparisonId: string
  taskId: string
  taskPrompt: string
}): string {
  return `${input.comparisonId}\u0000${input.taskId}\u0000${input.taskPrompt}`
}

export function validateP12RawLogManifest(input: unknown): P12RawLogManifestValidation {
  const redlines: string[] = []
  if (!isRecord(input)) {
    return {
      schemaVersion: 'dsxu.phase12-raw-log-manifest-validation.v1',
      status: 'BLOCKED',
      side: null,
      acceptedLogs: [],
      rejectedLogs: [{ index: -1, redlines: ['manifest is not an object'] }],
      redlines: ['manifest is not an object'],
    }
  }
  if (input.schemaVersion !== 'dsxu.phase12-raw-log-manifest.v1') {
    redlines.push('manifest schemaVersion mismatch')
  }
  const side = isSide(input.side) ? input.side : null
  if (!side) redlines.push('manifest side is missing')
  const logs = Array.isArray(input.logs) ? input.logs : []
  if (!Array.isArray(input.logs)) redlines.push('manifest logs must be an array')
  if (!isRecord(input.source)) redlines.push('manifest source is missing')
  const source = isRecord(input.source) ? input.source : null
  if (logs.length > 0) {
    if (typeof source?.collectedAt !== 'string' || source.collectedAt.includes('<')) {
      redlines.push('manifest source.collectedAt must be filled for imported raw logs')
    }
    if (source?.acquisitionMethod !== 'manual-import' && source?.acquisitionMethod !== 'runner-export') {
      redlines.push('manifest source.acquisitionMethod is invalid')
    }
    if (typeof source?.immutableRawDir !== 'string' || source.immutableRawDir.includes('<')) {
      redlines.push('manifest source.immutableRawDir must point to the immutable raw log directory')
    }
  }

  const parsed = side
    ? logs.map((item, index) => ({ index, ...parseManifestLog(item, side, index) }))
    : []
  const acceptedLogs = parsed
    .map(item => item.log)
    .filter((item): item is P12RawTaskLog => item !== null)
  const rejectedLogs = parsed
    .filter(item => item.redlines.length > 0)
    .map(item => ({ index: item.index, redlines: item.redlines }))
  const duplicateKeys = new Set<string>()
  const seenKeys = new Set<string>()
  for (const log of acceptedLogs) {
    const key = buildP12RawComparisonKey(log)
    if (seenKeys.has(key)) duplicateKeys.add(key)
    seenKeys.add(key)
  }
  for (const key of duplicateKeys) {
    redlines.push(`duplicate comparison key: ${key}`)
  }
  redlines.push(...rejectedLogs.flatMap(item => item.redlines.map(line => `log ${item.index}: ${line}`)))

  return {
    schemaVersion: 'dsxu.phase12-raw-log-manifest-validation.v1',
    status: redlines.length > 0 ? 'BLOCKED' : 'PASS',
    side,
    acceptedLogs,
    rejectedLogs,
    redlines,
  }
}

export function evaluateP12RawTaskLog(input: P12RawTaskLog): P12RawTaskLogEvaluation {
  const missingEvidence = [
    ...(input.comparisonId.trim() ? [] : ['comparisonId']),
    ...(input.taskId.trim() ? [] : ['taskId']),
    ...(input.taskPrompt.trim() ? [] : ['taskPrompt']),
    ...(input.rawLogPath.trim() ? [] : ['rawLogPath']),
    ...evidenceKeys
      .filter(key => input.evidence[key] !== true)
      .map(key => `evidence.${key}`),
    ...integrityKeys
      .filter(key => input.integrity[key] !== true)
      .map(key => `integrity.${key}`),
  ]
  const redlines = [
    ...missingEvidence.map(item => `${input.side}: missing ${item}`),
    ...(input.metrics.noEvidenceActionCount > 0
      ? [`${input.side}: contains no-evidence actions`]
      : []),
    ...(looksLikeDryPlan(input)
      ? [`${input.side}: dry plan cannot be used as raw comparison evidence`]
      : []),
  ]
  return {
    side: input.side,
    status: redlines.length > 0 ? 'BLOCKED' : 'PASS',
    missingEvidence,
    redlines,
  }
}

export function buildP12RawComparisonCase(
  input: P12RawComparisonInput,
): P12RawComparisonCaseResult {
  const dsxu = evaluateP12RawTaskLog(input.dsxu)
  const targetReference = input.targetReference
    ? evaluateP12RawTaskLog(input.targetReference)
    : null
  const findings: P12RawDeltaFinding[] = []

  if (!targetReference) {
    findings.push({
      kind: 'missing-target-reference-raw-log',
      severity: 'warning',
      message: `${input.taskId}: same-task target reference raw log is missing`,
    })
  }

  if (
    input.dsxu.comparisonId !== input.comparisonId ||
    input.dsxu.taskId !== input.taskId ||
    input.dsxu.taskPrompt !== input.taskPrompt ||
    (input.targetReference && (
      input.targetReference.comparisonId !== input.comparisonId ||
      input.targetReference.taskId !== input.taskId ||
      input.targetReference.taskPrompt !== input.taskPrompt
    ))
  ) {
    findings.push({
      kind: 'task-mismatch',
      severity: 'critical',
      message: `${input.taskId}: comparison logs do not match the declared same-task identity`,
    })
  }

  const outcomeDelta = input.targetReference
    ? outcomeScore(input.dsxu.outcome) - outcomeScore(input.targetReference.outcome)
    : null
  const interventionDelta = input.targetReference
    ? input.dsxu.metrics.interventionCount - input.targetReference.metrics.interventionCount
    : null
  const evidenceCompletenessDeltaPct = input.targetReference
    ? input.dsxu.metrics.evidenceCompletenessPct - input.targetReference.metrics.evidenceCompletenessPct
    : null
  const costDeltaUsd = input.targetReference && input.dsxu.metrics.costUsd !== null && input.targetReference.metrics.costUsd !== null
    ? input.dsxu.metrics.costUsd - input.targetReference.metrics.costUsd
    : null

  if (outcomeDelta !== null && outcomeDelta < 0) {
    findings.push({
      kind: 'dsxu-outcome-gap',
      severity: 'critical',
      message: `${input.taskId}: target reference solved more of the task than DSXU`,
    })
  }
  if (interventionDelta !== null && interventionDelta > 0) {
    findings.push({
      kind: 'intervention-gap',
      severity: 'warning',
      message: `${input.taskId}: DSXU required more human intervention`,
    })
  }
  if (evidenceCompletenessDeltaPct !== null && evidenceCompletenessDeltaPct < 0) {
    findings.push({
      kind: 'evidence-gap',
      severity: 'warning',
      message: `${input.taskId}: DSXU evidence completeness is lower`,
    })
  }
  if (costDeltaUsd !== null && costDeltaUsd > 0) {
    findings.push({
      kind: 'cost-gap',
      severity: 'info',
      message: `${input.taskId}: DSXU cost is higher on this same-task run`,
    })
  }

  const hasCriticalFinding = findings.some(finding => finding.severity === 'critical')
  const hasRawIntegrityBlock = dsxu.status === 'BLOCKED' || targetReference?.status === 'BLOCKED'
  if (hasRawIntegrityBlock) {
    findings.push({
      kind: 'raw-integrity-block',
      severity: 'critical',
      message: `${input.taskId}: raw log integrity is incomplete`,
    })
  }

  const status: P12RawComparisonStatus = hasRawIntegrityBlock || findings.some(finding => finding.kind === 'task-mismatch')
    ? 'BLOCKED'
    : !targetReference || hasCriticalFinding
      ? 'PARTIAL'
      : 'PASS'

  return {
    comparisonId: input.comparisonId,
    taskId: input.taskId,
    status,
    dsxu,
    targetReference,
    outcomeDelta,
    interventionDelta,
    evidenceCompletenessDeltaPct,
    costDeltaUsd,
    findings,
    requiredArtifacts: [
      input.dsxu.rawLogPath,
      ...input.dsxu.artifactPaths,
      ...(input.targetReference ? [
        input.targetReference.rawLogPath,
        ...input.targetReference.artifactPaths,
      ] : []),
    ],
  }
}

export function buildP12RawComparisonReport(
  inputs: readonly P12RawComparisonInput[],
  options: { minimumPairedRawLogsForPass?: number } = {},
): P12RawComparisonReport {
  const minimumPairedRawLogsForPass = options.minimumPairedRawLogsForPass ?? 14
  const cases = inputs.map(buildP12RawComparisonCase)
  const pass = cases.filter(item => item.status === 'PASS').length
  const partial = cases.filter(item => item.status === 'PARTIAL').length
  const blocked = cases.filter(item => item.status === 'BLOCKED').length
  const pairedRawLogCount = cases.filter(item => item.targetReference !== null).length
  const pairedByFamily = new Map<P12ReplayFamilyId, number>()
  let unmappedPairedRawLogCount = 0
  for (const item of cases) {
    if (!item.targetReference) continue
    const familyId = p12ReplayFamilyIdForTask(item.taskId)
    if (familyId) {
      pairedByFamily.set(familyId, (pairedByFamily.get(familyId) ?? 0) + 1)
    } else {
      unmappedPairedRawLogCount += 1
    }
  }
  const replayFamilyCoverage: P12RawReplayFamilyCoverage[] = p12ReplayFamilyRequirements.map(item => {
    const familyPairedRawLogCount = pairedByFamily.get(item.familyId) ?? 0
    return {
      familyId: item.familyId,
      requiredPairCount: item.requiredPairCount,
      pairedRawLogCount: familyPairedRawLogCount,
      missingPairCount: Math.max(item.requiredPairCount - familyPairedRawLogCount, 0),
    }
  })
  const replayFamilyGapCount = replayFamilyCoverage.reduce((sum, item) => sum + item.missingPairCount, 0)
  const sampleSetIncomplete = pairedRawLogCount < minimumPairedRawLogsForPass || replayFamilyGapCount > 0
  const status: P12RawComparisonStatus =
    blocked > 0
      ? 'BLOCKED'
      : partial > 0 || sampleSetIncomplete
        ? 'PARTIAL'
        : 'PASS'
  const negativeOutcomeGap = cases.some(item => item.outcomeDelta !== null && item.outcomeDelta < 0)
  const redlines = cases.flatMap(item => [
    ...item.dsxu.redlines,
    ...(item.targetReference?.redlines ?? []),
    ...item.findings
      .filter(finding => finding.severity !== 'info')
      .map(finding => finding.message),
  ]).concat(
    pairedRawLogCount > 0
      ? replayFamilyCoverage
        .filter(item => item.missingPairCount > 0)
        .map(item => `${item.familyId}: needs ${item.missingPairCount} additional paired target-reference raw log(s) for original-side family coverage`)
      : [],
  )
  return {
    schemaVersion: 'dsxu.phase12-raw-comparison.v1',
    status,
    caseCount: cases.length,
    pairedRawLogCount,
    minimumPairedRawLogsForPass,
    replayFamilyGapCount,
    unmappedPairedRawLogCount,
    pass,
    partial,
    blocked,
    mustNotClaimComparisonWin: status !== 'PASS' || negativeOutcomeGap,
    replayFamilyCoverage,
    cases,
    requiredArtifacts: [...new Set(cases.flatMap(item => item.requiredArtifacts))],
    redlines,
    nextAction: blocked > 0
      ? 'fix-blocked-raw-integrity'
      : pairedRawLogCount === 0
        ? 'collect-target-reference-raw-logs'
        : sampleSetIncomplete
          ? 'expand-sample-set'
          : 'ready-for-delta-review',
  }
}

export function buildP12RawDeltaReport(report: P12RawComparisonReport): P12RawDeltaReport {
  const findings = report.cases.flatMap(item => item.findings)
  return {
    schemaVersion: 'dsxu.phase12-raw-delta-report.v1',
    status: report.status,
    caseCount: report.caseCount,
    pairedRawLogCount: report.pairedRawLogCount,
    minimumPairedRawLogsForPass: report.minimumPairedRawLogsForPass,
    mustNotClaimComparisonWin: report.mustNotClaimComparisonWin,
    summary: {
      pass: report.pass,
      partial: report.partial,
      blocked: report.blocked,
      criticalFindings: findings.filter(item => item.severity === 'critical').length,
      warningFindings: findings.filter(item => item.severity === 'warning').length,
      infoFindings: findings.filter(item => item.severity === 'info').length,
      missingTargetReferenceRawLogs: findings.filter(item => item.kind === 'missing-target-reference-raw-log').length,
      replayFamilyGapCount: report.replayFamilyGapCount,
      unmappedPairedRawLogs: report.unmappedPairedRawLogCount,
      negativeOutcomeGaps: report.cases.filter(item => item.outcomeDelta !== null && item.outcomeDelta < 0).length,
      higherInterventionCount: report.cases.filter(item => item.interventionDelta !== null && item.interventionDelta > 0).length,
      lowerEvidenceCompleteness: report.cases.filter(item => item.evidenceCompletenessDeltaPct !== null && item.evidenceCompletenessDeltaPct < 0).length,
      higherCostCount: report.cases.filter(item => item.costDeltaUsd !== null && item.costDeltaUsd > 0).length,
    },
    cases: report.cases.map(item => ({
      comparisonId: item.comparisonId,
      taskId: item.taskId,
      status: item.status,
      targetReferencePresent: item.targetReference !== null,
      outcomeDelta: item.outcomeDelta,
      interventionDelta: item.interventionDelta,
      evidenceCompletenessDeltaPct: item.evidenceCompletenessDeltaPct,
      costDeltaUsd: item.costDeltaUsd,
      findingKinds: item.findings.map(finding => finding.kind),
      requiredArtifacts: item.requiredArtifacts,
    })),
    redlines: report.redlines,
    nextAction: report.nextAction,
  }
}

export function buildP12TargetReferenceCollectionPack(
  dsxuLogs: readonly P12RawTaskLog[],
  options: { minimumPairedRawLogsForPass?: number } = {},
): P12TargetReferenceCollectionPack {
  const minimumPairedRawLogsForPass = options.minimumPairedRawLogsForPass ?? 14
  const currentByFamily = new Map<P12ReplayFamilyId, number>()
  let unmappedCollectionTaskCount = 0
  for (const log of dsxuLogs) {
    const familyId = p12ReplayFamilyIdForTask(log.taskId)
    if (familyId) {
      currentByFamily.set(familyId, (currentByFamily.get(familyId) ?? 0) + 1)
    } else {
      unmappedCollectionTaskCount += 1
    }
  }
  const replayFamilyCoverage: P12ReplayFamilyCoverage[] = p12ReplayFamilyRequirements.map(item => {
    const currentCollectionTaskCount = currentByFamily.get(item.familyId) ?? 0
    return {
      familyId: item.familyId,
      requiredPairCount: item.requiredPairCount,
      currentCollectionTaskCount,
      missingPairCount: Math.max(item.requiredPairCount - currentCollectionTaskCount, 0),
    }
  })
  const expansionBacklog: P12TargetReferenceExpansionTask[] = p12ReplayFamilyRequirements.flatMap(item => {
    const currentCollectionTaskCount = currentByFamily.get(item.familyId) ?? 0
    const missingPairCount = Math.max(item.requiredPairCount - currentCollectionTaskCount, 0)
    return Array.from({ length: missingPairCount }, (_, index) => ({
      slotId: `${item.familyId}-additional-${currentCollectionTaskCount + index + 1}`,
      familyId: item.familyId,
      requiredScenario: item.requiredScenario,
      requiredEvidence: item.requiredEvidence,
      mustUseExistingOwner: item.mustUseExistingOwner,
    }))
  })
  const targetManifestBacklogSlots: P12TargetReferenceManifestBacklogSlot[] = expansionBacklog.map(task => ({
    ...task,
    dsxuPairRequirement: 'add the matching DSXU raw log for this slot before the target-reference log can become a paired comparison case',
    manifestLogRequirement: 'add one real target-reference raw log only after the same slot is executed under the target reference condition',
    taskIdRequirement: `taskId must preserve the backlog slot id ${task.slotId}`,
    comparisonIdRequirement: `comparisonId must use a stable P12-19 target-reference slot for ${task.slotId}; do not reuse an unrelated generic task`,
  }))
  const collectionWorkOrders: P12TargetReferenceCollectionWorkOrder[] = [
    ...dsxuLogs.map((log): P12TargetReferenceCollectionWorkOrder => {
      const familyRequirement = p12ReplayFamilyRequirementForTask(log.taskId)
      return {
        workOrderId: `${log.comparisonId}:target-reference`,
        kind: 'existing-dsxu-pair',
        familyId: familyRequirement?.familyId ?? null,
        comparisonIdRequirement: `target-reference log comparisonId must equal ${log.comparisonId}`,
        taskIdRequirement: `target-reference log taskId must equal ${log.taskId}`,
        taskPromptRequirement: 'target-reference run must use the exact DSXU taskPrompt from this work order',
        mustUseExistingOwner: familyRequirement?.mustUseExistingOwner ?? 'Named mainline owner for this DSXU replay task',
        dsxuRawOutputRequirement: `DSXU raw output already exists at ${log.rawLogPath}; do not replace it with a template or summary`,
        targetReferenceRawOutputRequirement: 'collect one real target-reference raw transcript, tool trace, final report, artifacts, metrics, and risks for the same task identity',
        requiredEvidence: familyRequirement?.requiredEvidence ?? evidenceKeys,
        acceptanceGate: [
          'manifest log side is target-reference',
          'comparisonId, taskId, and taskPrompt match the DSXU replay case exactly',
          'rawLogPath and artifactPaths point to immutable target-reference run output',
          'integrity.rawTranscript/toolTrace/finalReport are true',
          'generic, target-only, dry-plan, score-only, or template material is rejected',
        ],
      }
    }),
    ...targetManifestBacklogSlots.map((slot): P12TargetReferenceCollectionWorkOrder => ({
      workOrderId: `P12-19-${slot.slotId}:pair-slot`,
      kind: 'expansion-pair-slot',
      familyId: slot.familyId,
      comparisonIdRequirement: slot.comparisonIdRequirement,
      taskIdRequirement: slot.taskIdRequirement,
      taskPromptRequirement: 'define one concrete same-task prompt for both DSXU and target-reference runs before collection',
      mustUseExistingOwner: slot.mustUseExistingOwner,
      dsxuRawOutputRequirement: slot.dsxuPairRequirement,
      targetReferenceRawOutputRequirement: slot.manifestLogRequirement,
      requiredEvidence: slot.requiredEvidence,
      acceptanceGate: [
        'execute the DSXU side first under the named existing owner and store raw output',
        'execute the target-reference side with the same comparisonId, taskId, and taskPrompt',
        'import only after both sides have raw transcript, tool trace, final report, artifacts, metrics, and risks',
        'slot does not count toward paired raw logs until both sides are present',
      ],
    })),
  ]
  return {
    schemaVersion: 'dsxu.p12-target-reference-collection.v1',
    status: 'READY_FOR_COLLECTION',
    taskCount: dsxuLogs.length,
    minimumPairedRawLogsForPass,
    pairedRawLogCount: 0,
    currentPackCanReachPass: expansionBacklog.length === 0,
    requiredAdditionalSameTaskPairCount: expansionBacklog.length,
    unmappedCollectionTaskCount,
    mustNotClaimComparisonWin: true,
    tasks: dsxuLogs.map(log => ({
      comparisonId: log.comparisonId,
      taskId: log.taskId,
      taskPrompt: log.taskPrompt,
      dsxuRawLogPath: log.rawLogPath,
      dsxuArtifactPaths: log.artifactPaths,
      requiredTargetFields: [
        'rawLogPath',
        'artifactPaths',
        'outcome',
        'evidence.baseline/context/execution/recovery/verification/cost/final',
        'integrity.rawTranscript/toolTrace/finalReport',
        'metrics.elapsedMs/interventionCount/toolCallCount/evidenceCompletenessPct/costUsd/noEvidenceActionCount',
        'risks',
      ],
    })),
    replayFamilyCoverage,
    expansionBacklog,
    targetManifestBacklogSlots,
    collectionWorkOrders,
    targetManifestAcceptanceCriteria: [
      'manifest side must be target-reference when imported through targetReferenceManifestPath',
      'source.collectedAt must be filled with the actual run timestamp',
      'source.immutableRawDir must point to the immutable raw log directory',
      'each log must match comparisonId, taskId, and taskPrompt from the DSXU replay task',
      'each log must include raw transcript, tool trace, final report, artifacts, metrics, and risks',
      'dry plans, score-only rows, templates, or ranking summaries are rejected as raw comparison evidence',
      'targetManifestBacklogSlots are pair-slot collection requirements only; they are not raw logs and do not count until matching DSXU and target-reference logs are imported',
      'collectionWorkOrders are the only accepted intake checklist for current P12-19 collection; generic tasks outside these work orders do not reduce RT family gaps',
      `P12-19 PASS requires ${minimumPairedRawLogsForPass} paired same-task raw logs and no critical gap`,
    ],
    manifestTemplate: {
      schemaVersion: 'dsxu.phase12-raw-log-manifest.v1',
      side: 'target-reference',
      source: {
        collectedAt: '<fill-after-run>',
        acquisitionMethod: 'manual-import',
        immutableRawDir: '<fill-raw-log-directory>',
      },
      logs: [],
    },
    instructions: [
      'run the same taskPrompt for every taskId outside DSXU under the target reference condition',
      'store raw transcript, tool trace, final report, artifacts, metrics, and risks before judging outcome',
      'fill a target-reference manifest only with real run outputs; do not use this template as evidence',
      'import the completed manifest through targetReferenceManifestPath',
      'P12-19 remains PARTIAL until enough paired raw logs are imported and gap-free',
      'targetManifestBacklogSlots list the required original-side RT family pair slots; never convert them into manifest logs without matching DSXU and target-reference execution output',
      'collectionWorkOrders combine current DSXU pairs and expansion slots into the operator intake queue; use them instead of ad hoc generic tasks',
      dsxuLogs.length < minimumPairedRawLogsForPass
        ? `current collection pack covers ${dsxuLogs.length} tasks; add ${minimumPairedRawLogsForPass - dsxuLogs.length} more same-task pairs before PASS can be claimed`
        : 'current collection pack has enough task slots for the minimum paired raw log threshold',
    ],
  }
}
