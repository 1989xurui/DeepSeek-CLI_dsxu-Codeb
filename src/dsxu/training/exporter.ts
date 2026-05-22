import type { ToolCallResult } from '../engine/tool-protocol'
import type { LongTaskLedgerEvent } from '../engine/progress-ledger'
import type { DSXUWorkStateTimeline } from '../engine/work-state-timeline'
import { redactPath, snapshotText, stableHash, summarizeArtifactText } from './redaction'
import {
  TRAINING_TRAJECTORY_SCHEMA_VERSION,
  type DsxuTrainingAgentHandoff,
  type DsxuTrainingAntiCheat,
  type DsxuTrainingClaimScope,
  type DsxuTrainingCommunication,
  type DsxuTrainingContextMemory,
  type DsxuTrainingCostRoute,
  type DsxuTrainingEditTraceEntry,
  type DsxuTrainingIntentUnderstanding,
  type DsxuTrainingOutcome,
  type DsxuTrainingOutcomeStatus,
  type DsxuTrainingRecovery,
  type DsxuTrainingRiskLevel,
  type DsxuTrainingScores,
  type DsxuTrainingSourceTruth,
  type DsxuTrainingStateTraceEntry,
  type DsxuTrainingTask,
  type DsxuTrainingToolTraceEntry,
  type DsxuTrainingTrajectory,
  type DsxuTrainingTrajectoryState,
  type DsxuTrainingVerification,
  validateTrainingTrajectoryShape,
} from './schema'

export interface TrainingTrajectoryToolInput {
  toolUseId?: string
  toolName: string
  readonly?: boolean
  concurrencyGroup?: string
  permissionDecision?: DsxuTrainingToolTraceEntry['permissionDecision']
  result?: ToolCallResult
  outputText?: string
  ok?: boolean
  errorType?: string
}

export interface TrainingTrajectoryVerificationInput {
  commands?: readonly string[]
  passed?: boolean
  claimBound?: boolean
  failureSignature?: string
  localizedFeedbackPresent?: boolean
  artifactPaths?: readonly string[]
}

export interface TrainingTrajectoryExportInput {
  task?: Partial<DsxuTrainingTask>
  intentUnderstanding?: Partial<DsxuTrainingIntentUnderstanding>
  ledgerEvents?: readonly Partial<LongTaskLedgerEvent>[]
  workStateTimeline?: Partial<DSXUWorkStateTimeline>
  toolResults?: readonly TrainingTrajectoryToolInput[]
  filesRead?: readonly string[]
  rangesRead?: readonly string[]
  sourceEvidenceText?: readonly string[]
  edits?: readonly Partial<DsxuTrainingEditTraceEntry>[]
  verification?: TrainingTrajectoryVerificationInput
  recovery?: Partial<DsxuTrainingRecovery>
  agentHandoff?: readonly Partial<DsxuTrainingAgentHandoff>[]
  contextMemory?: Partial<DsxuTrainingContextMemory>
  costRoute?: Partial<DsxuTrainingCostRoute>
  antiCheat?: Partial<DsxuTrainingAntiCheat>
  communication?: Partial<DsxuTrainingCommunication>
  outcome?: Partial<DsxuTrainingOutcome>
}

export interface TrainingTrajectoryExportResult {
  trajectory: DsxuTrainingTrajectory
  validation: ReturnType<typeof validateTrainingTrajectoryShape>
}

const DEFAULT_TASK_ID = 'dsxu-training-trajectory-dry-run'

export function exportTrainingTrajectory(input: TrainingTrajectoryExportInput = {}): TrainingTrajectoryExportResult {
  const task = buildTask(input.task)
  const verification = buildVerification(input.verification)
  const antiCheat = buildAntiCheat(input.antiCheat, task.claimScope)
  const outcome = buildOutcome(input.outcome, verification, antiCheat)
  const trajectory: DsxuTrainingTrajectory = {
    schemaVersion: TRAINING_TRAJECTORY_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    task,
    intentUnderstanding: buildIntentUnderstanding(input.intentUnderstanding, task),
    stateTrace: buildStateTrace(input.ledgerEvents),
    toolTrace: buildToolTrace(input.toolResults),
    sourceTruth: buildSourceTruth(input),
    editTrace: buildEditTrace(input.edits),
    verification,
    recovery: buildRecovery(input.recovery, verification),
    agentHandoff: buildAgentHandoff(input.agentHandoff),
    contextMemory: buildContextMemory(input.contextMemory, input.ledgerEvents),
    costRoute: buildCostRoute(input.costRoute, input.ledgerEvents),
    antiCheat,
    communication: buildCommunication(input.communication, outcome, verification),
    outcome,
    scores: buildScores({ outcome, verification, antiCheat, toolResults: input.toolResults, ledgerEvents: input.ledgerEvents }),
  }
  return {
    trajectory,
    validation: validateTrainingTrajectoryShape(trajectory),
  }
}

export function createDryRunTrainingTrajectory(): TrainingTrajectoryExportResult {
  const toolResult: ToolCallResult = {
    schemaVersion: 'dsxu.tool-call-result.v1',
    ok: true,
    outputText: 'read source owner summary',
    events: [],
    metadata: {
      duration: 12,
      executorKind: 'dsxu_native',
      usedBridge: false,
    },
  }

  return exportTrainingTrajectory({
    task: {
      taskId: DEFAULT_TASK_ID,
      category: 'training-exporter',
      intent: 'Export a redacted DSXU runtime evidence trajectory.',
      riskLevel: 'low',
      acceptanceCriteria: ['schema validates', 'source bodies are not stored', 'tool result is paired'],
      claimScope: 'internal',
    },
    intentUnderstanding: {
      interpretedGoal: 'Build a read-only trajectory from DSXU runtime evidence.',
      constraints: ['no default query-loop change', 'no source body storage'],
      explicitNoEdit: false,
      missingInfo: [],
      riskClassification: 'low',
    },
    ledgerEvents: [
      {
        kind: 'plan',
        summary: 'create read-only exporter',
        owner: 'Training Trajectory',
      },
      {
        kind: 'source_evidence',
        summary: 'read owner files',
        owner: 'Source Truth',
        evidence: ['src/dsxu/engine/tool-protocol.ts'],
      },
      {
        kind: 'verification',
        summary: 'schema and exporter tests are expected',
        owner: 'Training Trajectory',
      },
    ],
    toolResults: [{
      toolUseId: 'dry-run-read-1',
      toolName: 'Read',
      readonly: true,
      permissionDecision: 'allow',
      result: toolResult,
    }],
    filesRead: ['src/dsxu/engine/tool-protocol.ts'],
    rangesRead: ['src/dsxu/engine/tool-protocol.ts:1-120'],
    sourceEvidenceText: ['tool protocol owner summary'],
    verification: {
      commands: ['bun test src/dsxu/training/__tests__/schema.test.ts'],
      passed: true,
      claimBound: true,
      localizedFeedbackPresent: false,
    },
    costRoute: {
      model: 'deepseek-v4-flash',
      routeReason: 'dry-run-no-provider-call',
      estimatedCostUsd: 0,
      cacheHitInputTokens: 0,
      cacheMissInputTokens: 0,
      proAdmissionJustified: false,
    },
    communication: {
      userVisibleSummary: 'Dry-run trajectory export completed.',
      verifiedFacts: ['schema shape was produced'],
      unverifiedRisks: [],
      overclaimDetected: false,
    },
    outcome: {
      status: 'success',
      finalClaim: 'dry-run exporter produced a valid trajectory',
      verified: true,
      publicClaimAllowed: false,
    },
  })
}

function buildTask(task?: Partial<DsxuTrainingTask>): DsxuTrainingTask {
  return {
    taskId: task?.taskId ?? DEFAULT_TASK_ID,
    category: task?.category ?? 'unknown',
    intent: task?.intent ?? 'Export DSXU runtime evidence as training trajectory.',
    riskLevel: risk(task?.riskLevel),
    acceptanceCriteria: task?.acceptanceCriteria ?? [],
    claimScope: task?.claimScope ?? 'internal',
  }
}

function buildIntentUnderstanding(
  input: Partial<DsxuTrainingIntentUnderstanding> | undefined,
  task: DsxuTrainingTask,
): DsxuTrainingIntentUnderstanding {
  return {
    interpretedGoal: input?.interpretedGoal ?? task.intent,
    constraints: input?.constraints ?? [],
    explicitNoEdit: input?.explicitNoEdit ?? false,
    missingInfo: input?.missingInfo ?? [],
    riskClassification: risk(input?.riskClassification ?? task.riskLevel),
  }
}

function buildStateTrace(events?: readonly Partial<LongTaskLedgerEvent>[]): readonly DsxuTrainingStateTraceEntry[] {
  const states = (events ?? [])
    .map(event => stateFromLedgerKind(String(event.kind ?? '')))
    .filter((state): state is DsxuTrainingTrajectoryState => Boolean(state))

  const orderedStates = states.length > 0 ? states : ['plan']
  return orderedStates.map((state, index) => ({
    state,
    previousState: index > 0 ? orderedStates[index - 1] : undefined,
    allowedTransition: true,
    transitionReason: index === 0 ? 'initial state' : 'projected from runtime event',
    attemptCount: 1,
  }))
}

function buildToolTrace(tools?: readonly TrainingTrajectoryToolInput[]): readonly DsxuTrainingToolTraceEntry[] {
  return (tools ?? []).map((tool, index) => {
    const outputText = tool.result?.outputText ?? tool.outputText ?? ''
    const errorType = tool.errorType ?? tool.result?.error?.type
    return {
      toolUseId: tool.toolUseId ?? `tool-${index + 1}`,
      toolName: tool.toolName,
      readonly: tool.readonly ?? false,
      concurrencyGroup: tool.concurrencyGroup ?? 'default',
      permissionDecision: tool.permissionDecision ?? 'unknown',
      resultPaired: Boolean(tool.result || tool.outputText !== undefined),
      outputChars: outputText.length,
      ok: tool.ok ?? tool.result?.ok,
      errorType,
      outputHash: outputText ? stableHash(outputText) : undefined,
    }
  })
}

function buildSourceTruth(input: TrainingTrajectoryExportInput): DsxuTrainingSourceTruth {
  return {
    filesRead: (input.filesRead ?? []).map(redactPath),
    rangesRead: input.rangesRead ?? [],
    readFreshness: input.filesRead && input.filesRead.length > 0 ? 'fresh' : 'unknown',
    staleReadDetected: false,
    sourceBodyStored: false,
    evidenceHashes: (input.sourceEvidenceText ?? []).map(stableHash),
  }
}

function buildEditTrace(edits?: readonly Partial<DsxuTrainingEditTraceEntry>[]): readonly DsxuTrainingEditTraceEntry[] | undefined {
  if (!edits || edits.length === 0) return undefined
  return edits.map((edit, index) => ({
    file: redactPath(edit.file ?? `unknown-${index + 1}`),
    intent: edit.intent ?? 'unspecified edit intent',
    changedLineRanges: edit.changedLineRanges ?? [],
    sourceTruthFresh: edit.sourceTruthFresh ?? false,
    diffHash: edit.diffHash,
  }))
}

function buildVerification(input?: TrainingTrajectoryVerificationInput): DsxuTrainingVerification {
  return {
    commands: input?.commands ?? [],
    passed: input?.passed ?? false,
    claimBound: input?.claimBound ?? false,
    failureSignature: input?.failureSignature ? snapshotText(input.failureSignature)?.hash : undefined,
    localizedFeedbackPresent: input?.localizedFeedbackPresent ?? false,
    artifactPaths: (input?.artifactPaths ?? []).map(redactPath),
  }
}

function buildRecovery(
  input: Partial<DsxuTrainingRecovery> | undefined,
  verification: DsxuTrainingVerification,
): DsxuTrainingRecovery | undefined {
  if (!input && verification.passed) return undefined
  return {
    failureClass: input?.failureClass ?? (verification.passed ? undefined : 'unknown'),
    localizedFiles: (input?.localizedFiles ?? []).map(redactPath),
    changedStrategy: input?.changedStrategy ?? false,
    nextAction: input?.nextAction ?? (verification.passed ? 'none' : 'localize failure and replan'),
    recoveryDecision: input?.recoveryDecision,
  }
}

function buildAgentHandoff(input?: readonly Partial<DsxuTrainingAgentHandoff>[]): readonly DsxuTrainingAgentHandoff[] | undefined {
  if (!input || input.length === 0) return undefined
  return input.map((agent, index) => ({
    agentId: agent.agentId ?? `agent-${index + 1}`,
    agentRole: agent.agentRole ?? 'unknown',
    agentStatus: agent.agentStatus ?? 'unknown',
    evidencePacketPresent: agent.evidencePacketPresent ?? false,
    parentClaimAllowed: agent.parentClaimAllowed ?? false,
  }))
}

function buildContextMemory(
  input?: Partial<DsxuTrainingContextMemory>,
  events?: readonly Partial<LongTaskLedgerEvent>[],
): DsxuTrainingContextMemory {
  const openObligations = input?.openObligations ?? (events ?? [])
    .filter(event => event.kind === 'plan' || event.kind === 'stall')
    .map(event => summarizeArtifactText(event.summary) ?? String(event.kind))
  return {
    goalPreserved: input?.goalPreserved ?? true,
    resumePoint: input?.resumePoint ?? 'current-turn',
    openObligations,
    compactOccurred: input?.compactOccurred ?? false,
    sourceRereadAfterResume: input?.sourceRereadAfterResume ?? false,
  }
}

function buildCostRoute(
  input?: Partial<DsxuTrainingCostRoute>,
  events?: readonly Partial<LongTaskLedgerEvent>[],
): DsxuTrainingCostRoute {
  const routeEvent = (events ?? []).find(event => event.kind === 'route' || event.kind === 'model-route' || event.kind === 'cost-cache')
  const metadata = routeEvent?.metadata ?? {}
  return {
    model: input?.model ?? String(metadata.model ?? 'unknown'),
    routeReason: input?.routeReason ?? String(metadata.routeReason ?? routeEvent?.summary ?? 'unknown'),
    estimatedCostUsd: input?.estimatedCostUsd ?? Number(metadata.estimatedCostUsd ?? 0),
    cacheHitInputTokens: input?.cacheHitInputTokens ?? Number(metadata.cacheHitInputTokens ?? 0),
    cacheMissInputTokens: input?.cacheMissInputTokens ?? Number(metadata.cacheMissInputTokens ?? 0),
    proAdmissionJustified: input?.proAdmissionJustified ?? Boolean(metadata.proAdmissionJustified),
  }
}

function buildAntiCheat(input: Partial<DsxuTrainingAntiCheat> | undefined, claimScope: DsxuTrainingClaimScope): DsxuTrainingAntiCheat {
  return {
    oracleLeakFlag: input?.oracleLeakFlag ?? false,
    solutionArtifactFlag: input?.solutionArtifactFlag ?? false,
    oldReportFlag: input?.oldReportFlag ?? false,
    testOnlyFixFlag: input?.testOnlyFixFlag ?? false,
    publicClaimAllowed: input?.publicClaimAllowed ?? claimScope !== 'public',
  }
}

function buildCommunication(
  input: Partial<DsxuTrainingCommunication> | undefined,
  outcome: DsxuTrainingOutcome,
  verification: DsxuTrainingVerification,
): DsxuTrainingCommunication {
  return {
    userVisibleSummary: input?.userVisibleSummary ?? outcome.finalClaim,
    verifiedFacts: input?.verifiedFacts ?? (verification.passed ? ['verification passed'] : []),
    unverifiedRisks: input?.unverifiedRisks ?? (verification.passed ? [] : ['verification not passed']),
    overclaimDetected: input?.overclaimDetected ?? (outcome.status === 'success' && !verification.claimBound),
  }
}

function buildOutcome(
  input: Partial<DsxuTrainingOutcome> | undefined,
  verification: DsxuTrainingVerification,
  antiCheat: DsxuTrainingAntiCheat,
): DsxuTrainingOutcome {
  const status: DsxuTrainingOutcomeStatus = input?.status ?? (verification.passed ? 'success' : 'partial')
  return {
    status,
    finalClaim: input?.finalClaim ?? (verification.passed ? 'verified' : 'not verified'),
    verified: input?.verified ?? verification.passed,
    publicClaimAllowed: input?.publicClaimAllowed ?? (verification.claimBound && antiCheat.publicClaimAllowed),
  }
}

function buildScores(input: {
  outcome: DsxuTrainingOutcome
  verification: DsxuTrainingVerification
  antiCheat: DsxuTrainingAntiCheat
  toolResults?: readonly TrainingTrajectoryToolInput[]
  ledgerEvents?: readonly Partial<LongTaskLedgerEvent>[]
}): DsxuTrainingScores {
  const taskSuccessScore = input.outcome.status === 'success' ? 100 : input.outcome.status === 'partial' ? 60 : 20
  const verificationEvidenceScore = input.verification.passed && input.verification.claimBound ? 100 : input.verification.passed ? 70 : 20
  const unpaired = (input.toolResults ?? []).some(tool => !tool.result && tool.outputText === undefined)
  const toolDisciplineScore = unpaired ? 40 : 100
  const antiCheatScore = Object.entries(input.antiCheat).some(([key, value]) => key !== 'publicClaimAllowed' && value === true) ? 30 : 100
  const hasRecovery = (input.ledgerEvents ?? []).some(event => event.kind === 'recovery')
  const recoveryScore = input.verification.passed ? 80 : hasRecovery ? 70 : 30
  const longTaskScore = (input.ledgerEvents?.length ?? 0) >= 5 ? 80 : 60
  const complexCodingScore = (input.toolResults?.length ?? 0) >= 2 ? 75 : 60
  const communicationScore = input.outcome.status === 'success' && !input.verification.claimBound ? 40 : 90
  const sees = weightedScore({
    taskSuccessScore,
    complexCodingScore,
    longTaskScore,
    verificationEvidenceScore,
    recoveryScore,
    toolDisciplineScore,
    antiCheatScore,
    communicationScore,
  })
  return {
    taskSuccessScore,
    complexCodingScore,
    longTaskScore,
    verificationEvidenceScore,
    recoveryScore,
    toolDisciplineScore,
    antiCheatScore,
    communicationScore,
    sees,
  }
}

function weightedScore(scores: Omit<DsxuTrainingScores, 'sees'>): number {
  const total =
    scores.taskSuccessScore * 0.20 +
    scores.complexCodingScore * 0.20 +
    scores.longTaskScore * 0.15 +
    scores.verificationEvidenceScore * 0.15 +
    scores.recoveryScore * 0.10 +
    scores.toolDisciplineScore * 0.08 +
    scores.antiCheatScore * 0.07 +
    scores.communicationScore * 0.05
  return Math.round(total)
}

function stateFromLedgerKind(kind: string): DsxuTrainingTrajectoryState | undefined {
  switch (kind) {
    case 'goal':
    case 'task_contract':
    case 'plan':
      return 'plan'
    case 'source_evidence':
      return 'retrieve'
    case 'tool':
    case 'permission':
      return 'execute'
    case 'edit_proof':
      return 'edit'
    case 'verification':
      return 'verify'
    case 'review':
      return 'review'
    case 'rollback':
      return 'rollback'
    case 'recovery':
    case 'stall':
      return 'recovery'
    case 'final_claim':
      return 'final'
    default:
      return undefined
  }
}

function risk(value: unknown): DsxuTrainingRiskLevel {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'critical'
    ? value
    : 'medium'
}
