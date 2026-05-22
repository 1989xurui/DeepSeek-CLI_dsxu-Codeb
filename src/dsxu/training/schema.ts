export const TRAINING_TRAJECTORY_SCHEMA_VERSION = 'dsxu.training-trajectory.v1' as const

export const TRAINING_TRAJECTORY_REQUIRED_TOP_LEVEL_FIELDS = [
  'schemaVersion',
  'task',
  'intentUnderstanding',
  'stateTrace',
  'toolTrace',
  'sourceTruth',
  'verification',
  'contextMemory',
  'costRoute',
  'antiCheat',
  'communication',
  'outcome',
  'scores',
] as const

export const TRAINING_TRAJECTORY_STATES = [
  'plan',
  'retrieve',
  'edit',
  'execute',
  'verify',
  'review',
  'recovery',
  'rollback',
  'final',
] as const

export type DsxuTrainingTrajectoryState = typeof TRAINING_TRAJECTORY_STATES[number]

export type DsxuTrainingRiskLevel = 'low' | 'medium' | 'high' | 'critical'

export type DsxuTrainingReadFreshness = 'fresh' | 'stale' | 'unknown'

export type DsxuTrainingOutcomeStatus =
  | 'success'
  | 'partial'
  | 'failed'
  | 'blocked'

export type DsxuTrainingClaimScope =
  | 'none'
  | 'internal'
  | 'user-visible'
  | 'public'

export interface DsxuTrainingTask {
  taskId: string
  category: string
  intent: string
  riskLevel: DsxuTrainingRiskLevel
  acceptanceCriteria: readonly string[]
  claimScope: DsxuTrainingClaimScope
}

export interface DsxuTrainingIntentUnderstanding {
  interpretedGoal: string
  constraints: readonly string[]
  explicitNoEdit: boolean
  missingInfo: readonly string[]
  riskClassification: DsxuTrainingRiskLevel
}

export interface DsxuTrainingStateTraceEntry {
  state: DsxuTrainingTrajectoryState
  previousState?: DsxuTrainingTrajectoryState
  allowedTransition: boolean
  transitionReason: string
  attemptCount: number
  timestamp?: string
}

export interface DsxuTrainingToolTraceEntry {
  toolUseId: string
  toolName: string
  readonly: boolean
  concurrencyGroup: string
  permissionDecision: 'allow' | 'block' | 'require_approval' | 'unknown'
  resultPaired: boolean
  outputChars: number
  ok?: boolean
  errorType?: string
  outputHash?: string
}

export interface DsxuTrainingSourceTruth {
  filesRead: readonly string[]
  rangesRead: readonly string[]
  readFreshness: DsxuTrainingReadFreshness
  staleReadDetected: boolean
  sourceBodyStored: false
  evidenceHashes: readonly string[]
}

export interface DsxuTrainingEditTraceEntry {
  file: string
  intent: string
  changedLineRanges: readonly string[]
  sourceTruthFresh: boolean
  diffHash?: string
}

export interface DsxuTrainingVerification {
  commands: readonly string[]
  passed: boolean
  claimBound: boolean
  failureSignature?: string
  localizedFeedbackPresent: boolean
  artifactPaths: readonly string[]
}

export interface DsxuTrainingRecovery {
  failureClass?: string
  localizedFiles: readonly string[]
  changedStrategy: boolean
  nextAction: string
  recoveryDecision?: string
}

export interface DsxuTrainingAgentHandoff {
  agentId: string
  agentRole: string
  agentStatus: 'running' | 'blocked' | 'failed' | 'completed' | 'unknown'
  evidencePacketPresent: boolean
  parentClaimAllowed: boolean
}

export interface DsxuTrainingContextMemory {
  goalPreserved: boolean
  resumePoint: string
  openObligations: readonly string[]
  compactOccurred: boolean
  sourceRereadAfterResume: boolean
}

export interface DsxuTrainingCostRoute {
  model: string
  routeReason: string
  estimatedCostUsd: number
  cacheHitInputTokens: number
  cacheMissInputTokens: number
  proAdmissionJustified: boolean
}

export interface DsxuTrainingAntiCheat {
  oracleLeakFlag: boolean
  solutionArtifactFlag: boolean
  oldReportFlag: boolean
  testOnlyFixFlag: boolean
  publicClaimAllowed: boolean
}

export interface DsxuTrainingCommunication {
  userVisibleSummary: string
  verifiedFacts: readonly string[]
  unverifiedRisks: readonly string[]
  overclaimDetected: boolean
}

export interface DsxuTrainingOutcome {
  status: DsxuTrainingOutcomeStatus
  finalClaim: string
  verified: boolean
  publicClaimAllowed: boolean
}

export interface DsxuTrainingScores {
  taskSuccessScore: number
  complexCodingScore: number
  longTaskScore: number
  verificationEvidenceScore: number
  recoveryScore: number
  toolDisciplineScore: number
  antiCheatScore: number
  communicationScore: number
  sees: number
}

export interface DsxuTrainingTrajectory {
  schemaVersion: typeof TRAINING_TRAJECTORY_SCHEMA_VERSION
  generatedAt: string
  task: DsxuTrainingTask
  intentUnderstanding: DsxuTrainingIntentUnderstanding
  stateTrace: readonly DsxuTrainingStateTraceEntry[]
  toolTrace: readonly DsxuTrainingToolTraceEntry[]
  sourceTruth: DsxuTrainingSourceTruth
  editTrace?: readonly DsxuTrainingEditTraceEntry[]
  verification: DsxuTrainingVerification
  recovery?: DsxuTrainingRecovery
  agentHandoff?: readonly DsxuTrainingAgentHandoff[]
  contextMemory: DsxuTrainingContextMemory
  costRoute: DsxuTrainingCostRoute
  antiCheat: DsxuTrainingAntiCheat
  communication: DsxuTrainingCommunication
  outcome: DsxuTrainingOutcome
  scores: DsxuTrainingScores
}

export interface DsxuTrainingValidationResult {
  ok: boolean
  errors: string[]
}

export function isTrainingTrajectoryState(value: unknown): value is DsxuTrainingTrajectoryState {
  return typeof value === 'string' && TRAINING_TRAJECTORY_STATES.includes(value as DsxuTrainingTrajectoryState)
}

export function validateTrainingTrajectoryShape(value: unknown): DsxuTrainingValidationResult {
  const errors: string[] = []
  if (!value || typeof value !== 'object') {
    return { ok: false, errors: ['trajectory must be an object'] }
  }

  const record = value as Record<string, unknown>
  for (const field of TRAINING_TRAJECTORY_REQUIRED_TOP_LEVEL_FIELDS) {
    if (!(field in record)) errors.push(`missing top-level field:${field}`)
  }

  if (record.schemaVersion !== TRAINING_TRAJECTORY_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${TRAINING_TRAJECTORY_SCHEMA_VERSION}`)
  }

  const sourceTruth = record.sourceTruth as Record<string, unknown> | undefined
  if (!sourceTruth || sourceTruth.sourceBodyStored !== false) {
    errors.push('sourceTruth.sourceBodyStored must be false')
  }

  const stateTrace = record.stateTrace
  if (!Array.isArray(stateTrace) || stateTrace.length === 0) {
    errors.push('stateTrace must be a non-empty array')
  } else {
    for (const [index, entry] of stateTrace.entries()) {
      const state = (entry as Record<string, unknown>)?.state
      if (!isTrainingTrajectoryState(state)) errors.push(`stateTrace[${index}].state is invalid`)
    }
  }

  const toolTrace = record.toolTrace
  if (!Array.isArray(toolTrace)) {
    errors.push('toolTrace must be an array')
  }

  const scores = record.scores as Record<string, unknown> | undefined
  if (typeof scores?.sees !== 'number' || scores.sees < 0 || scores.sees > 100) {
    errors.push('scores.sees must be a number between 0 and 100')
  }

  return { ok: errors.length === 0, errors }
}
