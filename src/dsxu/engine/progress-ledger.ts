/**
 * DSXU Progress Ledger - 轻量版进度账本
 *
 * 定义最小进度账本结构，用于任务状态跟踪和恢复
 * Work Package I - 步骤1
 */

import type { RuntimeState } from './types'
import type { RecoveryAction } from './recovery/recovery-types-v3'
import type { ToolCallResult } from './tool-protocol'
import { normalizeFailure, type DSXUFailure, type DSXUFailureCategory } from './failure-taxonomy'
import type { DeepSeekV4RouteDecision } from '../../utils/model/deepseekV4Control'

/**
 * 进度账本条目结果
 */
export interface LedgerEntryResult {
  /** 结果类型：success | failure | pending */
  type: 'success' | 'failure' | 'pending'
  /** 结果消息 */
  message?: string
  /** 错误信息（如果失败） */
  error?: string
  /** 结果数据 */
  data?: Record<string, any>
  /** 时间戳 */
  timestamp: number
}

/**
 * 验证摘要
 */
export interface VerifySummary {
  /** 是否通过 */
  passed: boolean
  /** 验证分数 (0-100) */
  score: number
  /** 验证发现的问题 */
  findings: Array<{
    severity: 'P1' | 'P2' | 'P3'
    title: string
    detail: string
    suggestion?: string
  }>
  /** 验证时间戳 */
  timestamp: number
}

/**
 * 审查摘要
 */
export interface ReviewSummary {
  /** 是否批准 */
  approved: boolean
  /** 审查分数 (0-100) */
  score: number
  /** 审查意见 */
  comments: string[]
  /** 风险等级：low | medium | high */
  riskLevel: 'low' | 'medium' | 'high'
  /** 审查时间戳 */
  timestamp: number
}

/**
 * 进度账本步骤
 */
export interface LedgerStep {
  /** 步骤ID */
  stepId: string
  /** 步骤类型 */
  type: string
  /** 步骤状态 */
  state: 'pending' | 'running' | 'completed' | 'failed'
  /** 开始时间 */
  startedAt: number
  /** 结束时间 */
  endedAt?: number
  /** 步骤结果 */
  result?: LedgerEntryResult
  /** 步骤元数据 */
  metadata?: Record<string, any>
}

export type LongTaskLedgerEventKind =
  | 'task_contract'
  | 'goal'
  | 'plan'
  | 'source_evidence'
  | 'tool'
  | 'permission'
  | 'edit_proof'
  | 'verification'
  | 'review'
  | 'rollback'
  | 'recovery'
  | 'model-route'
  | 'route'
  | 'cost-cache'
  | 'cache'
  | 'evidence'
  | 'final_claim'
  | 'stall'

export interface LongTaskLedgerEvent {
  schemaVersion: 'dsxu.runtime-event.v1'
  eventId: string
  kind: LongTaskLedgerEventKind
  owner: string
  summary: string
  timestamp: number
  taskId?: string
  turnId?: string
  toolUseId?: string
  modelCallId?: string
  evidence?: string[]
  metadata?: Record<string, any>
}

export type StallSignalKind =
  | 'repeated_read'
  | 'no_diff'
  | 'repeated_verification_failure'
  | 'tool_failure'
  | 'validation_failure'
  | 'timeout'
  | 'workspace_boundary'
  | 'model_failure'
  | 'context_pressure'
  | 'cost_pressure'
  | 'agent_timeout'
  | 'permission_loop'
  | 'tool_result_growth'

export interface StallSignal {
  kind: StallSignalKind
  count?: number
  severity?: 'low' | 'medium' | 'high' | 'critical'
  evidence?: string[]
}

export interface StallRecoveryDecision {
  schemaVersion: 'dsxu.stall-recovery-decision.v1'
  owner: 'Recovery / GearBox'
  action: RecoveryAction | 'flash-max' | 'pro-admission'
  reason: StallSignalKind
  confidence: number
  evidence: string[]
  nextAction: string
}

export type VerificationRecoveryPolicy = 'advisory' | 'blocking' | 'continue'

export interface LocalizedFeedbackEnvelope {
  schemaVersion: 'dsxu.localized-feedback-envelope.v10'
  owner: 'VerificationKernel / Recovery / GearBox'
  status: 'not_needed' | 'ready'
  command?: string
  failedAttemptsSinceProgress: number
  findingCount: number
  focusedFindingTitles: readonly string[]
  localizedFiles: readonly string[]
  feedbackLines: readonly string[]
  nextAction: string
  evidence: readonly string[]
}

export interface VerificationRecoveryDecisionProjection {
  schemaVersion: 'dsxu.verification-recovery-projection.v1'
  owner: 'VerificationKernel / Recovery / GearBox'
  policy: VerificationRecoveryPolicy
  verification: VerifySummary
  localizedFeedback?: LocalizedFeedbackEnvelope
  verificationEvent: Omit<LongTaskLedgerEvent, 'schemaVersion' | 'eventId' | 'timestamp' | 'taskId'> & {
    eventId?: string
    timestamp?: number
    taskId?: string
  }
  recoveryDecision?: StallRecoveryDecision
  finalClaimAllowed: boolean
  nextAction: string
}

export interface RecoveryDecisionTableRow {
  signal: StallSignalKind
  action: StallRecoveryDecision['action']
  repeatedAction?: StallRecoveryDecision['action']
  finalClaimAllowed: false
  ledgerEventRequired: true
  nextAction: string
  repeatedNextAction?: string
}

export interface FailureRecoveryDecisionProjection {
  schemaVersion: 'dsxu.failure-recovery-projection.v1'
  owner: 'FailureTaxonomy / Recovery / GearBox'
  failure: DSXUFailure
  failureEvent: Omit<LongTaskLedgerEvent, 'schemaVersion' | 'eventId' | 'timestamp' | 'taskId'> & {
    eventId?: string
    timestamp?: number
    taskId?: string
  }
  recoveryDecision: StallRecoveryDecision
  finalClaimAllowed: false
  nextAction: string
}

export interface DeepSeekRouteAdmissionProjection {
  schemaVersion: 'dsxu.deepseek-route-admission-projection.v8'
  owner: 'DeepSeek route/cost/cache'
  routeEvent: Omit<LongTaskLedgerEvent, 'schemaVersion' | 'eventId' | 'timestamp' | 'taskId'> & {
    eventId?: string
    timestamp?: number
    taskId?: string
  }
  proAdmissionState: NonNullable<DeepSeekV4RouteDecision['proAdmission']>['state']
  finalClaimAllowed: false
  evidence: readonly string[]
}

export const RECOVERY_DECISION_TABLE: readonly RecoveryDecisionTableRow[] = [
  {
    signal: 'repeated_read',
    action: 'replan',
    finalClaimAllowed: false,
    ledgerEventRequired: true,
    nextAction: 'stop repeated tool use, refresh source truth, and produce a narrower plan',
  },
  {
    signal: 'no_diff',
    action: 'replan',
    finalClaimAllowed: false,
    ledgerEventRequired: true,
    nextAction: 'stop no-diff mutation attempts, refresh source truth, and choose a new edit strategy',
  },
  {
    signal: 'repeated_verification_failure',
    action: 'replan',
    repeatedAction: 'rollback',
    finalClaimAllowed: false,
    ledgerEventRequired: true,
    nextAction: 'read the failing assertion, change strategy, and rerun focused verification',
    repeatedNextAction: 'restore or isolate the last mutation, then rerun the focused failing test',
  },
  {
    signal: 'tool_failure',
    action: 'retry',
    repeatedAction: 'replan',
    finalClaimAllowed: false,
    ledgerEventRequired: true,
    nextAction: 'retry once with bounded output and keep the failure evidence visible',
    repeatedNextAction: 'stop retrying the same tool path, replan with a safer owner path',
  },
  {
    signal: 'validation_failure',
    action: 'replan',
    finalClaimAllowed: false,
    ledgerEventRequired: true,
    nextAction: 'repair the schema or input contract before retrying the tool call',
  },
  {
    signal: 'timeout',
    action: 'retry',
    repeatedAction: 'replan',
    finalClaimAllowed: false,
    ledgerEventRequired: true,
    nextAction: 'retry with a tighter timeout, bounded output, and an artifact path',
    repeatedNextAction: 'replace the long-running command with a smaller owner-scoped step',
  },
  {
    signal: 'workspace_boundary',
    action: 'abort',
    finalClaimAllowed: false,
    ledgerEventRequired: true,
    nextAction: 'abort the unsafe workspace operation and ask for an explicit safe scope',
  },
  {
    signal: 'model_failure',
    action: 'flash-max',
    repeatedAction: 'pro-admission',
    finalClaimAllowed: false,
    ledgerEventRequired: true,
    nextAction: 'retry through the larger DeepSeek route only with route evidence',
    repeatedNextAction: 'request Pro admission with failure evidence and bounded budget',
  },
  {
    signal: 'context_pressure',
    action: 'flash-max',
    finalClaimAllowed: false,
    ledgerEventRequired: true,
    nextAction: 'snapshot current task state, shrink volatile tool output, then continue with larger context route if needed',
  },
  {
    signal: 'cost_pressure',
    action: 'ask-human',
    finalClaimAllowed: false,
    ledgerEventRequired: true,
    nextAction: 'pause and show cost/cache evidence before continuing',
  },
  {
    signal: 'agent_timeout',
    action: 'replan',
    finalClaimAllowed: false,
    ledgerEventRequired: true,
    nextAction: 'summarize worker evidence, cancel stale branch, and continue with a bounded owner plan',
  },
  {
    signal: 'permission_loop',
    action: 'ask-human',
    finalClaimAllowed: false,
    ledgerEventRequired: true,
    nextAction: 'surface the permission loop and request explicit owner approval or a safer alternative',
  },
  {
    signal: 'tool_result_growth',
    action: 'replan',
    finalClaimAllowed: false,
    ledgerEventRequired: true,
    nextAction: 'artifact large tool output, keep preview only, and rebuild source capsule',
  },
]

export interface LongTaskLedgerProjection {
  schemaVersion: 'dsxu.long-task-ledger-projection.v1'
  owner: 'PlanGraph / Work-State'
  taskId: string
  sessionId: string
  currentState: RuntimeState
  resumePoint: RuntimeState | null
  isResumable: boolean
  isCompleted: boolean
  eventCount: number
  lastStallDecision?: StallRecoveryDecision
  finalClaimAllowed: boolean
  nextAction: string
  workMemory: {
    task: readonly string[]
    sourceTruth: readonly string[]
    changes: readonly string[]
    failures: readonly string[]
    claims: readonly string[]
  }
  tuiLines: string[]
  finalReportSection: {
    title: 'Long Task Ledger'
    status: 'ready' | 'recoverable' | 'blocked' | 'completed'
    summary: string[]
    evidence: string[]
  }
}

export interface DurableLedgerRecoveryProof {
  schemaVersion: 'dsxu.durable-ledger-recovery-proof.v1'
  owner: 'PlanGraph / Work-State / Recovery'
  status: 'PASS_DURABLE_LEDGER_RECOVERY_READY' | 'NEEDS_DURABLE_LEDGER_RECOVERY_EVIDENCE'
  resumeSource: 'progress-ledger' | 'none'
  finalClaimAllowed: boolean
  nextAction: string
  guards: string[]
  evidence: string[]
  tuiLine: string
  finalReportSection: {
    title: 'Durable Ledger Recovery'
    status: 'ready' | 'recoverable' | 'blocked' | 'completed'
    summary: string[]
    evidence: string[]
  }
}

export interface RuntimeEventSchemaConsumptionProof {
  schemaVersion: 'dsxu.runtime-event-consumption-proof.v1'
  owner: 'PlanGraph / Work-State / Runtime Event'
  status: 'PASS_RUNTIME_EVENT_SCHEMA_CONSUMPTION' | 'NEEDS_RUNTIME_EVENT_SCHEMA_CONSUMPTION_REVIEW'
  requiredKinds: readonly LongTaskLedgerEventKind[]
  presentKinds: readonly LongTaskLedgerEventKind[]
  missingKinds: readonly LongTaskLedgerEventKind[]
  invalidEvents: readonly string[]
  guards: readonly string[]
  compactPanelLines: readonly string[]
  finalReportSection: {
    title: 'Runtime Event Schema'
    status: 'ready' | 'needs-evidence'
    summary: readonly string[]
    evidence: readonly string[]
  }
}

export interface DSXUActiveFrame {
  schemaVersion: 'dsxu.active-frame.v5'
  owner: 'PlanGraph / Work-State'
  taskId: string
  task: string
  phase: RuntimeState
  confirmedFacts: readonly string[]
  filesRead: readonly string[]
  filesChanged: readonly string[]
  openObligations: readonly string[]
  lastFailure: string | null
  nextAllowedActions: readonly string[]
  risk: 'low' | 'medium' | 'high' | 'critical'
  evidence: readonly string[]
  guards: readonly string[]
}

export interface DSXUActiveFrameBuildInput {
  ledger: ProgressLedger
  task?: string
  plan?: readonly string[]
  risk?: 'low' | 'medium' | 'high' | 'critical'
  sourceEvidence?: readonly string[]
  filesRead?: readonly string[]
  filesChanged?: readonly string[]
  openObligations?: readonly string[]
  nextAllowedActions?: readonly string[]
  maxConfirmedFacts?: number
}

/**
 * 进度账本 - 轻量版
 */
export interface ProgressLedger {
  /** 任务ID */
  taskId: string
  /** 会话ID */
  sessionId: string
  /** 当前状态（与FSM兼容） */
  currentState: RuntimeState
  /** 上一个状态 */
  previousState: RuntimeState | null
  /** 最后结果 */
  lastResult: LedgerEntryResult | null
  /** 最后更新时间 */
  updatedAt: number
  /** 账本版本 */
  version: string

  /** 步骤历史（预留） */
  steps?: LedgerStep[]
  /** append-only runtime events for long-task recovery */
  events?: LongTaskLedgerEvent[]
  /** last no-progress/stall recovery decision */
  stallDecision?: StallRecoveryDecision | null
  /** 恢复点（预留） */
  resumeFrom?: RuntimeState
  /** 验证摘要（预留） */
  verifySummary?: VerifySummary | null
  /** 审查摘要（预留） */
  reviewSummary?: ReviewSummary | null

  /** 创建时间 */
  createdAt: number
  /** 是否已完成 */
  isCompleted: boolean
  /** 完成时间 */
  completedAt?: number
  /** 账本元数据 */
  metadata?: Record<string, any>
}

/**
 * 创建进度账本
 */
export function createProgressLedger(
  taskId: string,
  sessionId: string,
  initialState: RuntimeState = 'plan'
): ProgressLedger {
  const now = Date.now()

  return {
    taskId,
    sessionId,
    currentState: initialState,
    previousState: null,
    lastResult: null,
    updatedAt: now,
    version: '1.0.0',

    // 预留字段初始化为空
    steps: [],
    events: [],
    stallDecision: null,
    resumeFrom: undefined,
    verifySummary: null,
    reviewSummary: null,

    // 基础字段
    createdAt: now,
    isCompleted: false,
    metadata: {}
  }
}

export function appendLedgerEvent(
  ledger: ProgressLedger,
  event: Omit<LongTaskLedgerEvent, 'schemaVersion' | 'eventId' | 'timestamp' | 'taskId'> & {
    eventId?: string
    timestamp?: number
    taskId?: string
  }
): ProgressLedger {
  const timestamp = event.timestamp ?? Date.now()
  const fullEvent: LongTaskLedgerEvent = {
    schemaVersion: 'dsxu.runtime-event.v1',
    ...event,
    eventId: event.eventId ?? `event-${timestamp}-${Math.random().toString(36).slice(2)}`,
    taskId: event.taskId ?? ledger.taskId,
    timestamp,
  }
  return {
    ...ledger,
    events: [...(ledger.events || []), fullEvent],
    updatedAt: timestamp,
  }
}

export function projectToolCallResultToLedgerEvent(input: {
  result: ToolCallResult
  callId: string
  toolName: string
  owner?: string
  turnId?: string
  taskId?: string
}): Omit<LongTaskLedgerEvent, 'schemaVersion' | 'eventId' | 'timestamp' | 'taskId'> & {
  eventId?: string
  timestamp?: number
  taskId?: string
} {
  return {
    kind: 'tool',
    owner: input.owner ?? 'Tool Gate',
    summary: `Tool ${input.toolName} ${input.result.ok ? 'completed' : 'failed'}`,
    taskId: input.taskId,
    turnId: input.turnId,
    toolUseId: input.callId,
    evidence: [
      'schema:ToolCallResult',
      `tool:${input.toolName}`,
      `ok:${String(input.result.ok)}`,
      `executor:${input.result.metadata.executorKind}`,
      `usedBridge:${String(input.result.metadata.usedBridge)}`,
      `durationMs:${input.result.metadata.duration}`,
      `outputChars:${input.result.outputText.length}`,
      input.result.error ? `error:${input.result.error.type}` : '',
      input.result.error?.retryable !== undefined ? `retryable:${String(input.result.error.retryable)}` : '',
    ].filter(Boolean),
    metadata: {
      canonicalToolResult: true,
      ok: input.result.ok,
      errorType: input.result.error?.type,
      retryable: input.result.error?.retryable,
      outputChars: input.result.outputText.length,
      executorKind: input.result.metadata.executorKind,
      usedBridge: input.result.metadata.usedBridge,
    },
  }
}

export function projectVerificationRecoveryDecision(input: {
  verification: VerifySummary
  onFailure?: 'warn' | 'block' | 'continue'
  failedAttemptsSinceProgress?: number
  command?: string
  owner?: string
  taskId?: string
  turnId?: string
  localizedFiles?: readonly string[]
  evidence?: readonly string[]
}): VerificationRecoveryDecisionProjection {
  const policy: VerificationRecoveryPolicy =
    input.onFailure === 'block'
      ? 'blocking'
      : input.onFailure === 'continue'
        ? 'continue'
        : 'advisory'
  const failedAttempts = Math.max(1, input.failedAttemptsSinceProgress ?? 1)
  const baseEvidence = [
    'schema:VerifySummary',
    `policy:${policy}`,
    `passed:${String(input.verification.passed)}`,
    `score:${input.verification.score}`,
    input.command ? `command:${input.command}` : '',
    ...input.verification.findings.slice(0, 3).map(finding =>
      `finding:${finding.severity}:${finding.title}`,
    ),
    ...(input.evidence ?? []),
  ].filter(Boolean)
  const verificationEvent: VerificationRecoveryDecisionProjection['verificationEvent'] = {
    kind: 'verification',
    owner: input.owner ?? 'VerificationKernel',
    summary: input.verification.passed
      ? `Verification passed (${policy})`
      : `Verification failed (${policy})`,
    taskId: input.taskId,
    turnId: input.turnId,
    evidence: baseEvidence,
    metadata: {
      verificationPassed: input.verification.passed,
      verificationScore: input.verification.score,
      policy,
      failedAttemptsSinceProgress: failedAttempts,
      finalClaimAllowed: input.verification.passed,
    },
  }
  const recoveryDecision = !input.verification.passed && (policy === 'blocking' || failedAttempts >= 2)
    ? decideStallRecovery({
        signals: [
          {
            kind: 'repeated_verification_failure',
            count: failedAttempts,
            severity: policy === 'blocking' || failedAttempts >= 2 ? 'high' : 'medium',
            evidence: baseEvidence,
          },
        ],
      })
    : undefined
  const localizedFeedback = buildLocalizedFeedbackEnvelope({
    verification: input.verification,
    command: input.command,
    failedAttemptsSinceProgress: failedAttempts,
    localizedFiles: input.localizedFiles,
    nextAction: recoveryDecision?.nextAction,
    evidence: input.evidence,
  })
  return {
    schemaVersion: 'dsxu.verification-recovery-projection.v1',
    owner: 'VerificationKernel / Recovery / GearBox',
    policy,
    verification: input.verification,
    localizedFeedback,
    verificationEvent,
    recoveryDecision,
    finalClaimAllowed: input.verification.passed,
    nextAction: input.verification.passed
      ? 'continue to review/final report evidence path'
      : recoveryDecision?.nextAction ??
        (policy === 'continue'
          ? 'continue only with explicit partial evidence; do not claim PASS'
          : 'show verification warning, attach focused evidence, and replan before final claim'),
  }
}

function truncateFeedback(value: string, limit = 180): string {
  const singleLine = value.replace(/\s+/g, ' ').trim()
  return singleLine.length <= limit ? singleLine : `${singleLine.slice(0, limit - 1)}...`
}

export function buildLocalizedFeedbackEnvelope(input: {
  verification: VerifySummary
  command?: string
  failedAttemptsSinceProgress?: number
  localizedFiles?: readonly string[]
  nextAction?: string
  evidence?: readonly string[]
}): LocalizedFeedbackEnvelope {
  const failedAttempts = Math.max(1, input.failedAttemptsSinceProgress ?? 1)
  if (input.verification.passed) {
    return {
      schemaVersion: 'dsxu.localized-feedback-envelope.v10',
      owner: 'VerificationKernel / Recovery / GearBox',
      status: 'not_needed',
      command: input.command,
      failedAttemptsSinceProgress: failedAttempts,
      findingCount: 0,
      focusedFindingTitles: [],
      localizedFiles: [],
      feedbackLines: [],
      nextAction: 'verification passed; continue to review/final evidence',
      evidence: ['localizedFeedback:not_needed', ...(input.evidence ?? [])],
    }
  }
  const severityRank: Record<VerifySummary['findings'][number]['severity'], number> = {
    P1: 0,
    P2: 1,
    P3: 2,
  }
  const focusedFindings = [...input.verification.findings]
    .sort((left, right) => severityRank[left.severity] - severityRank[right.severity])
    .slice(0, 3)
  const localizedFiles = [...new Set([...(input.localizedFiles ?? [])].filter(Boolean))].slice(0, 6)
  const primary = focusedFindings[0]
  const feedbackLines = [
    input.command ? `command: ${input.command}` : '',
    `score: ${input.verification.score}; failedAttempts: ${failedAttempts}`,
    primary ? `top finding: ${primary.severity} ${truncateFeedback(primary.title, 120)}` : 'top finding: verification failed without structured finding',
    primary?.detail ? `local detail: ${truncateFeedback(primary.detail)}` : '',
    primary?.suggestion ? `repair hint: ${truncateFeedback(primary.suggestion)}` : '',
    localizedFiles.length > 0 ? `localized files: ${localizedFiles.join(', ')}` : 'localized files: not supplied; refresh source truth before editing',
    `next action: ${truncateFeedback(input.nextAction ?? 'replan from the focused finding before claiming PASS')}`,
  ].filter(Boolean)
  return {
    schemaVersion: 'dsxu.localized-feedback-envelope.v10',
    owner: 'VerificationKernel / Recovery / GearBox',
    status: 'ready',
    command: input.command,
    failedAttemptsSinceProgress: failedAttempts,
    findingCount: input.verification.findings.length,
    focusedFindingTitles: focusedFindings.map(finding => finding.title),
    localizedFiles,
    feedbackLines,
    nextAction: input.nextAction ?? 'replan from the focused finding before claiming PASS',
    evidence: [
      'localizedFeedback:ready',
      `findingCount:${input.verification.findings.length}`,
      `localizedFiles:${localizedFiles.length}`,
      `feedbackLines:${feedbackLines.length}`,
      ...(input.evidence ?? []),
    ],
  }
}

export function decideStallRecovery(input: {
  signals: readonly StallSignal[]
  priorDecisions?: readonly StallRecoveryDecision[]
}): StallRecoveryDecision {
  const signal = selectHighestPriorityStallSignal(input.signals)
  const repeatedPrior = (input.priorDecisions ?? []).filter(
    decision => decision.reason === signal.kind,
  ).length
  const tableRow = getRecoveryDecisionTableRow(signal.kind)
  const repeated = repeatedPrior >= 1
  const action = repeated && tableRow.repeatedAction
    ? tableRow.repeatedAction
    : tableRow.action
  const nextAction = repeated && tableRow.repeatedNextAction
    ? tableRow.repeatedNextAction
    : tableRow.nextAction
  const confidenceBase = signal.severity === 'critical' ? 0.95 : signal.severity === 'high' ? 0.85 : 0.7
  return {
    schemaVersion: 'dsxu.stall-recovery-decision.v1',
    owner: 'Recovery / GearBox',
    action,
    reason: signal.kind,
    confidence: Math.min(0.99, confidenceBase + Math.min(0.1, repeatedPrior * 0.05)),
    evidence: [...(signal.evidence ?? []), `signal:${signal.kind}`, `count:${signal.count ?? 1}`],
    nextAction,
  }
}

export function projectFailureRecoveryDecision(input: {
  error: unknown
  operation?: string
  blockedByPolicy?: boolean
  failedAttemptsSinceProgress?: number
  taskId?: string
  turnId?: string
  evidence?: readonly string[]
}): FailureRecoveryDecisionProjection {
  const failure = normalizeFailure(input.error, {
    operation: input.operation,
    blockedByPolicy: input.blockedByPolicy,
  })
  const signalKind = stallSignalFromFailureCategory(failure.category)
  const failedAttempts = Math.max(1, input.failedAttemptsSinceProgress ?? 1)
  const evidence = [
    'schema:DSXUFailure',
    `failureCode:${failure.failureCode}`,
    `category:${failure.category}`,
    `recommendedAction:${failure.recommendedAction}`,
    `retryable:${String(failure.retryable)}`,
    ...(input.evidence ?? []),
  ]
  const recoveryDecision = decideStallRecovery({
    signals: [
      {
        kind: signalKind,
        count: failedAttempts,
        severity:
          failure.category === 'workspace' || failure.category === 'permission'
            ? 'critical'
            : failedAttempts >= 2
              ? 'high'
              : 'medium',
        evidence,
      },
    ],
  })
  return {
    schemaVersion: 'dsxu.failure-recovery-projection.v1',
    owner: 'FailureTaxonomy / Recovery / GearBox',
    failure,
    failureEvent: {
      kind: 'recovery',
      owner: 'FailureTaxonomy / Recovery / GearBox',
      summary: `${failure.failureCode} -> ${recoveryDecision.action}`,
      taskId: input.taskId,
      turnId: input.turnId,
      evidence,
      metadata: {
        failure,
        recoveryDecision,
        failedAttemptsSinceProgress: failedAttempts,
        finalClaimAllowed: false,
      },
    },
    recoveryDecision,
    finalClaimAllowed: false,
    nextAction: recoveryDecision.nextAction,
  }
}

function getRecoveryDecisionTableRow(kind: StallSignalKind): RecoveryDecisionTableRow {
  return RECOVERY_DECISION_TABLE.find(row => row.signal === kind) ?? RECOVERY_DECISION_TABLE[0]
}

function stallSignalFromFailureCategory(category: DSXUFailureCategory): StallSignalKind {
  switch (category) {
    case 'validation':
      return 'validation_failure'
    case 'permission':
      return 'permission_loop'
    case 'executor':
      return 'tool_failure'
    case 'timeout':
      return 'timeout'
    case 'workspace':
      return 'workspace_boundary'
    case 'model':
      return 'model_failure'
    case 'unknown':
      return 'tool_failure'
  }
}

export function recordStallDecision(
  ledger: ProgressLedger,
  decision: StallRecoveryDecision,
): ProgressLedger {
  const withEvent = appendLedgerEvent(ledger, {
    kind: 'stall',
    owner: decision.owner,
    summary: `${decision.reason} -> ${decision.action}`,
    evidence: decision.evidence,
    metadata: {
      decision,
    },
  })
  return {
    ...withEvent,
    stallDecision: decision,
    resumeFrom: withEvent.currentState,
  }
}

export function recordVerificationRecoveryDecision(
  ledger: ProgressLedger,
  projection: VerificationRecoveryDecisionProjection,
): ProgressLedger {
  let updated = appendLedgerEvent(ledger, projection.verificationEvent)
  if (projection.localizedFeedback?.status === 'ready') {
    updated = appendLedgerEvent(updated, {
      kind: 'recovery',
      owner: projection.localizedFeedback.owner,
      summary: `Localized feedback envelope ready (${projection.localizedFeedback.findingCount} findings)`,
      evidence: projection.localizedFeedback.evidence,
      metadata: {
        localizedFeedback: projection.localizedFeedback,
        finalClaimAllowed: false,
      },
    })
  }
  updated = setVerifySummary(updated, projection.verification)
  if (projection.recoveryDecision) {
    updated = recordStallDecision(updated, projection.recoveryDecision)
  }
  return {
    ...updated,
    resumeFrom: projection.recoveryDecision ? updated.currentState : updated.resumeFrom,
  }
}

export function recordFailureRecoveryDecision(
  ledger: ProgressLedger,
  projection: FailureRecoveryDecisionProjection,
): ProgressLedger {
  let updated = appendLedgerEvent(ledger, projection.failureEvent)
  updated = recordStallDecision(updated, projection.recoveryDecision)
  return {
    ...updated,
    resumeFrom: updated.currentState,
  }
}

export function projectDeepSeekRouteAdmissionToLedgerEvent(input: {
  routeDecision: DeepSeekV4RouteDecision
  priorFailureCount?: number
  sourceEvidenceCount?: number
  taskId?: string
  turnId?: string
}): DeepSeekRouteAdmissionProjection {
  const proAdmission = input.routeDecision.proAdmission
  const evidence = [
    `model:${input.routeDecision.model}`,
    `route:${input.routeDecision.reason}`,
    `apiMode:${input.routeDecision.apiMode}`,
    input.routeDecision.reasoningEffort ? `reasoning:${input.routeDecision.reasoningEffort}` : '',
    `approvalRequired:${String(input.routeDecision.approvalRequired)}`,
    `proAdmission:${proAdmission.state}`,
    `priorFlashAttempted:${String(proAdmission.priorFlashAttempted)}`,
    `savedTaskEvidence:${String(proAdmission.savedTaskEvidence)}`,
    `priorFailureCount:${input.priorFailureCount ?? 0}`,
    `sourceEvidenceCount:${input.sourceEvidenceCount ?? 0}`,
  ].filter(Boolean)
  return {
    schemaVersion: 'dsxu.deepseek-route-admission-projection.v8',
    owner: 'DeepSeek route/cost/cache',
    proAdmissionState: proAdmission.state,
    finalClaimAllowed: false,
    evidence,
    routeEvent: {
      kind: 'model-route',
      owner: 'DeepSeek route/cost/cache',
      summary: `${input.routeDecision.model} ${input.routeDecision.reason} pro=${proAdmission.state}`,
      taskId: input.taskId,
      turnId: input.turnId,
      evidence,
      metadata: {
        routeDecision: input.routeDecision,
        proAdmission,
        priorFailureCount: input.priorFailureCount ?? 0,
        sourceEvidenceCount: input.sourceEvidenceCount ?? 0,
        finalClaimAllowed: false,
      },
    },
  }
}

/**
 * 更新进度账本状态
 */
export function updateLedgerState(
  ledger: ProgressLedger,
  newState: RuntimeState,
  result?: LedgerEntryResult
): ProgressLedger {
  return {
    ...ledger,
    previousState: ledger.currentState,
    currentState: newState,
    lastResult: result || ledger.lastResult,
    updatedAt: Date.now()
  }
}

/**
 * 添加步骤到账本
 */
export function addLedgerStep(
  ledger: ProgressLedger,
  step: Omit<LedgerStep, 'stepId' | 'startedAt'>
): ProgressLedger {
  const newStep: LedgerStep = {
    stepId: `step-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    startedAt: Date.now(),
    ...step
  }

  return {
    ...ledger,
    steps: [...(ledger.steps || []), newStep],
    updatedAt: Date.now()
  }
}

/**
 * 更新步骤状态
 */
export function updateLedgerStep(
  ledger: ProgressLedger,
  stepId: string,
  updates: Partial<LedgerStep>
): ProgressLedger {
  return {
    ...ledger,
    steps: (ledger.steps || []).map(step =>
      step.stepId === stepId ? { ...step, ...updates } : step
    ),
    updatedAt: Date.now()
  }
}

/**
 * 设置验证摘要
 */
export function setVerifySummary(
  ledger: ProgressLedger,
  verifySummary: VerifySummary
): ProgressLedger {
  return {
    ...ledger,
    verifySummary,
    updatedAt: Date.now()
  }
}

/**
 * 设置审查摘要
 */
export function setReviewSummary(
  ledger: ProgressLedger,
  reviewSummary: ReviewSummary
): ProgressLedger {
  return {
    ...ledger,
    reviewSummary,
    updatedAt: Date.now()
  }
}

/**
 * 标记账本完成
 */
export function markLedgerCompleted(
  ledger: ProgressLedger,
  result: LedgerEntryResult
): ProgressLedger {
  const now = Date.now()

  return {
    ...ledger,
    isCompleted: true,
    completedAt: now,
    lastResult: result,
    updatedAt: now
  }
}

/**
 * 获取账本摘要
 */
export function getLedgerSummary(ledger: ProgressLedger): {
  taskId: string
  sessionId: string
  currentState: RuntimeState
  isCompleted: boolean
  stepCount: number
  completedSteps: number
  eventCount: number
  lastStallAction?: StallRecoveryDecision['action']
  lastUpdated: number
} {
  const steps = ledger.steps || []

  return {
    taskId: ledger.taskId,
    sessionId: ledger.sessionId,
    currentState: ledger.currentState,
    isCompleted: ledger.isCompleted,
    stepCount: steps.length,
    completedSteps: steps.filter(s => s.state === 'completed').length,
    eventCount: ledger.events?.length ?? 0,
    lastStallAction: ledger.stallDecision?.action,
    lastUpdated: ledger.updatedAt
  }
}

/**
 * 检查账本是否可恢复
 */
export function isLedgerResumable(ledger: ProgressLedger): boolean {
  return !ledger.isCompleted && ledger.resumeFrom !== undefined
}

/**
 * 获取恢复点
 */
export function getResumePoint(ledger: ProgressLedger): RuntimeState | null {
  return ledger.resumeFrom || ledger.currentState
}

function compactUnique(values: readonly string[], limit: number): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const item = value.trim()
    if (!item || seen.has(item)) continue
    seen.add(item)
    result.push(item)
    if (result.length >= limit) break
  }
  return result
}

function evidenceLooksLikePath(value: string): boolean {
  return /(?:^|[A-Za-z]:[\\/]|[\\/])(?:src|scripts|docs|test|tests)[\\/][^:\s]+/.test(value) ||
    /^(?:src|scripts|docs|test|tests)[\\/][^:\s]+/.test(value)
}

function extractEventStringArray(event: LongTaskLedgerEvent, key: string): string[] {
  const value = event.metadata?.[key]
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function defaultNextAllowedActionsForState(state: RuntimeState): string[] {
  switch (state) {
    case 'plan':
      return ['compile execution contract', 'build tool view', 'read source truth']
    case 'retrieve':
      return ['read source range', 'grep symbols', 'record source evidence']
    case 'edit':
      return ['edit scoped file', 'record edit proof', 'run post-mutation verification']
    case 'execute':
      return ['run focused command', 'capture bounded output', 'write verification event']
    case 'verify':
      return ['inspect verification result', 'record recovery decision', 'prepare evidence']
    case 'review':
      return ['review proof envelope', 'check claim boundary', 'prepare final report']
    case 'commit':
      return ['final evidence gate', 'summarize risks', 'close task']
    case 'rollback':
      return ['restore checkpoint', 'record rollback proof', 'replan owner path']
  }
}

export function buildDSXUActiveFrame(input: DSXUActiveFrameBuildInput): DSXUActiveFrame {
  const ledger = input.ledger
  const events = ledger.events ?? []
  const taskContractEvent = [...events].reverse().find(event => event.kind === 'task_contract')
  const metadataContract = taskContractEvent?.metadata?.executionContract as
    | {
        goal?: string
        risk?: 'low' | 'medium' | 'high' | 'critical'
        visibleTools?: readonly string[]
        verificationLevel?: string
        fallbackPolicy?: string
      }
    | undefined
  const sourceEvidence = [
    ...(input.sourceEvidence ?? []),
    ...events
      .filter(event => event.kind === 'source_evidence' || event.kind === 'evidence')
      .flatMap(event => event.evidence ?? []),
  ]
  const confirmedFacts = compactUnique(
    [
      ...sourceEvidence,
      ...events
        .filter(event => event.kind === 'verification' || event.kind === 'review')
        .flatMap(event => event.evidence ?? []),
    ],
    input.maxConfirmedFacts ?? 8,
  )
  const filesRead = compactUnique(
    [
      ...(input.filesRead ?? []),
      ...events.flatMap(event => extractEventStringArray(event, 'filesRead')),
      ...sourceEvidence.filter(evidenceLooksLikePath),
    ],
    24,
  )
  const filesChanged = compactUnique(
    [
      ...(input.filesChanged ?? []),
      ...events.flatMap(event => extractEventStringArray(event, 'filesChanged')),
    ],
    24,
  )
  const failedEvent = [...events].reverse().find(event =>
    event.kind === 'recovery' ||
    event.kind === 'stall' ||
    event.metadata?.verificationPassed === false ||
    event.metadata?.ok === false
  )
  const openObligations = compactUnique(
    [
      ...(input.openObligations ?? []),
      ...(ledger.verifySummary?.passed === false ? ['repair failed verification before final claim'] : []),
      ...(metadataContract?.verificationLevel && metadataContract.verificationLevel !== 'none'
        ? [`verification required:${metadataContract.verificationLevel}`]
        : []),
      ...(ledger.stallDecision ? [`recovery required:${ledger.stallDecision.action}`] : []),
      ...events.flatMap(event => extractEventStringArray(event, 'openObligations')),
    ],
    12,
  )
  const nextAllowedActions = compactUnique(
    [
      ...(input.nextAllowedActions ?? []),
      ...defaultNextAllowedActionsForState(ledger.currentState),
      ...(metadataContract?.visibleTools ?? []).map(tool => `tool:${tool}`),
    ],
    12,
  )
  const evidence = compactUnique(
    [
      `ledger:${ledger.taskId}`,
      `session:${ledger.sessionId}`,
      taskContractEvent ? `taskContract:${taskContractEvent.eventId}` : '',
      ...compactLedgerEvidence(ledger),
    ],
    30,
  )
  const guards = [
    !taskContractEvent ? 'missing task_contract ledger event' : '',
    metadataContract && metadataContract.verificationLevel !== 'none' && openObligations.length === 0
      ? 'verification contract has no visible open obligation'
      : '',
    confirmedFacts.length > 8 ? 'confirmed facts exceed active frame cap' : '',
  ].filter(Boolean)

  return {
    schemaVersion: 'dsxu.active-frame.v5',
    owner: 'PlanGraph / Work-State',
    taskId: ledger.taskId,
    task: input.task ?? metadataContract?.goal ?? ledger.taskId,
    phase: ledger.currentState,
    confirmedFacts,
    filesRead,
    filesChanged,
    openObligations,
    lastFailure: failedEvent ? failedEvent.summary : ledger.lastResult?.type === 'failure' ? ledger.lastResult.error ?? ledger.lastResult.message ?? 'failure' : null,
    nextAllowedActions,
    risk: input.risk ?? metadataContract?.risk ?? 'medium',
    evidence,
    guards,
  }
}

export function buildLongTaskLedgerProjection(ledger: ProgressLedger): LongTaskLedgerProjection {
  const summary = getLedgerSummary(ledger)
  const resumePoint = isLedgerResumable(ledger) ? getResumePoint(ledger) : null
  const lastStall = ledger.stallDecision ?? undefined
  const status = ledger.isCompleted
    ? 'completed'
    : lastStall?.action === 'ask-human' || lastStall?.action === 'abort'
      ? 'blocked'
      : resumePoint
        ? 'recoverable'
        : 'ready'
  const finalClaimAllowed = ledger.isCompleted && !lastStall
  const nextAction = lastStall?.nextAction
    ?? (resumePoint ? `resume from ${resumePoint}` : ledger.isCompleted ? 'attach final evidence and close' : 'continue planned owner workflow')
  const evidence = compactLedgerEvidence(ledger)
  const events = ledger.events ?? []
  const workMemory = {
    task: compactUnique([
      ledger.taskId,
      ...events
        .filter(event => event.kind === 'task_contract' || event.kind === 'goal' || event.kind === 'plan')
        .map(event => event.summary),
    ], 6),
    sourceTruth: compactUnique([
      ...events
        .filter(event => event.kind === 'source_evidence' || event.kind === 'evidence')
        .flatMap(event => event.evidence ?? []),
    ], 8),
    changes: compactUnique([
      ...events
        .filter(event => event.kind === 'edit_proof' || event.kind === 'tool')
        .flatMap(event => [
          event.summary,
          ...extractEventStringArray(event, 'filesChanged'),
        ]),
    ], 8),
    failures: compactUnique([
      ...(lastStall ? [`stall:${lastStall.reason}->${lastStall.action}`] : []),
      ...events
        .filter(event => event.kind === 'recovery' || event.kind === 'rollback' || event.kind === 'stall' || event.metadata?.ok === false)
        .map(event => event.summary),
    ], 8),
    claims: compactUnique([
      `finalClaimAllowed:${String(finalClaimAllowed)}`,
      ...events
        .filter(event => event.kind === 'final_claim' || event.kind === 'verification' || event.kind === 'review')
        .flatMap(event => [
          event.summary,
          ...(event.evidence ?? []),
        ]),
    ], 8),
  }
  const eventLines = events.slice(-8).map(event => {
    const suffix = event.evidence?.length ? ` | evidence=${event.evidence.slice(0, 3).join(',')}` : ''
    return `[${event.kind}] ${event.summary} | owner=${event.owner}${suffix}`
  })
  const stallLine = lastStall
    ? `Stall: ${lastStall.reason} -> ${lastStall.action} | confidence=${Math.round(lastStall.confidence * 100)}%`
    : 'Stall: none'
  const tuiLines = [
    `LongTask: task=${ledger.taskId} session=${ledger.sessionId}`,
    `State: ${ledger.currentState} | completed=${String(ledger.isCompleted)} | events=${summary.eventCount}`,
    `Resume: ${resumePoint ?? 'none'}`,
    `Memory: task=${workMemory.task.length} source=${workMemory.sourceTruth.length} change=${workMemory.changes.length} failure=${workMemory.failures.length} claim=${workMemory.claims.length}`,
    stallLine,
    ...eventLines,
    `Next: ${nextAction}`,
  ]
  return {
    schemaVersion: 'dsxu.long-task-ledger-projection.v1',
    owner: 'PlanGraph / Work-State',
    taskId: ledger.taskId,
    sessionId: ledger.sessionId,
    currentState: ledger.currentState,
    resumePoint,
    isResumable: Boolean(resumePoint),
    isCompleted: ledger.isCompleted,
    eventCount: summary.eventCount,
    lastStallDecision: lastStall,
    finalClaimAllowed,
    nextAction,
    workMemory,
    tuiLines,
    finalReportSection: {
      title: 'Long Task Ledger',
      status,
      summary: [
        `taskId=${ledger.taskId}`,
        `state=${ledger.currentState}`,
        `eventCount=${summary.eventCount}`,
        `resumePoint=${resumePoint ?? 'none'}`,
        `workMemory=task:${workMemory.task.length}/source:${workMemory.sourceTruth.length}/change:${workMemory.changes.length}/failure:${workMemory.failures.length}/claim:${workMemory.claims.length}`,
        lastStall ? `stall=${lastStall.reason}->${lastStall.action}` : 'stall=none',
        `finalClaimAllowed=${String(finalClaimAllowed)}`,
        `nextAction=${nextAction}`,
      ],
      evidence,
    },
  }
}

export function buildDurableLedgerRecoveryProof(ledger: ProgressLedger): DurableLedgerRecoveryProof {
  const projection = buildLongTaskLedgerProjection(ledger)
  const eventKinds = new Set((ledger.events ?? []).map(event => event.kind))
  const failedVerification = ledger.verifySummary?.passed === false
  const guards = [
    !eventKinds.has('verification') ? 'missing verification runtime event' : '',
    failedVerification && !eventKinds.has('stall') ? 'failed verification missing stall/recovery event' : '',
    failedVerification && !projection.isResumable ? 'failed verification is not recoverable from progress ledger' : '',
    projection.finalClaimAllowed && !ledger.isCompleted ? 'final claim allowed before ledger completion' : '',
  ].filter(Boolean)
  const evidence = [
    `ledger:${ledger.taskId}`,
    `session:${ledger.sessionId}`,
    `state:${ledger.currentState}`,
    `resume:${projection.resumePoint ?? 'none'}`,
    ...compactLedgerEvidence(ledger),
  ]
  const status = guards.length === 0 && (projection.isResumable || ledger.isCompleted)
    ? 'PASS_DURABLE_LEDGER_RECOVERY_READY'
    : 'NEEDS_DURABLE_LEDGER_RECOVERY_EVIDENCE'
  const reportStatus = projection.finalReportSection.status
  const tuiLine = [
    'DurableLedgerRecovery',
    `status=${status}`,
    `resumeSource=${projection.isResumable ? 'progress-ledger' : 'none'}`,
    `next=${projection.nextAction}`,
  ].join(' | ')

  return {
    schemaVersion: 'dsxu.durable-ledger-recovery-proof.v1',
    owner: 'PlanGraph / Work-State / Recovery',
    status,
    resumeSource: projection.isResumable ? 'progress-ledger' : 'none',
    finalClaimAllowed: projection.finalClaimAllowed,
    nextAction: projection.nextAction,
    guards,
    evidence,
    tuiLine,
    finalReportSection: {
      title: 'Durable Ledger Recovery',
      status: reportStatus,
      summary: [
        `status=${status}`,
        `resumeSource=${projection.isResumable ? 'progress-ledger' : 'none'}`,
        `finalClaimAllowed=${String(projection.finalClaimAllowed)}`,
        `nextAction=${projection.nextAction}`,
      ],
      evidence,
    },
  }
}

export function buildRuntimeEventSchemaConsumptionProof(input: {
  events: readonly LongTaskLedgerEvent[]
  requiredKinds?: readonly LongTaskLedgerEventKind[]
}): RuntimeEventSchemaConsumptionProof {
  const requiredKinds = input.requiredKinds ?? [
    'goal',
    'plan',
    'tool',
    'verification',
    'recovery',
    'evidence',
  ]
  const presentKinds = [...new Set(input.events.map(event => event.kind))]
  const missingKinds = requiredKinds.filter(kind => !presentKinds.includes(kind))
  const invalidEvents = input.events
    .filter(event =>
      event.schemaVersion !== 'dsxu.runtime-event.v1' ||
      !event.eventId ||
      !event.owner ||
      !event.summary ||
      typeof event.timestamp !== 'number',
    )
    .map(event => event.eventId || `${event.kind}:missing-event-id`)
  const guards = [
    ...missingKinds.map(kind => `missing runtime event kind:${kind}`),
    ...invalidEvents.map(eventId => `invalid runtime event:${eventId}`),
  ]
  const status = guards.length === 0
    ? 'PASS_RUNTIME_EVENT_SCHEMA_CONSUMPTION'
    : 'NEEDS_RUNTIME_EVENT_SCHEMA_CONSUMPTION_REVIEW'
  const evidence = [
    ...input.events.flatMap(event => event.evidence ?? []),
    ...input.events.map(event => `${event.kind}:${event.owner}`),
  ].map(item => item.trim()).filter(Boolean)

  return {
    schemaVersion: 'dsxu.runtime-event-consumption-proof.v1',
    owner: 'PlanGraph / Work-State / Runtime Event',
    status,
    requiredKinds,
    presentKinds,
    missingKinds,
    invalidEvents,
    guards,
    compactPanelLines: [
      `RuntimeEventSchema: ${status}`,
      `Kinds: present=${presentKinds.length} required=${requiredKinds.length} missing=${missingKinds.join(',') || 'none'}`,
      `Invalid events: ${invalidEvents.join(',') || 'none'}`,
    ],
    finalReportSection: {
      title: 'Runtime Event Schema',
      status: status === 'PASS_RUNTIME_EVENT_SCHEMA_CONSUMPTION'
        ? 'ready'
        : 'needs-evidence',
      summary: [
        `status=${status}`,
        `presentKinds=${presentKinds.join(',') || 'none'}`,
        `missingKinds=${missingKinds.join(',') || 'none'}`,
        `invalidEvents=${invalidEvents.join(',') || 'none'}`,
      ],
      evidence: [...new Set(evidence)].slice(0, 30),
    },
  }
}

function selectHighestPriorityStallSignal(signals: readonly StallSignal[]): StallSignal {
  if (signals.length === 0) {
    return {
      kind: 'no_diff',
      severity: 'medium',
      evidence: ['stall:no-explicit-signal'],
    }
  }
  const rank: Record<NonNullable<StallSignal['severity']>, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  }
  return [...signals].sort((left, right) => {
    const severityDelta =
      rank[right.severity ?? 'medium'] - rank[left.severity ?? 'medium']
    if (severityDelta !== 0) return severityDelta
    return (right.count ?? 1) - (left.count ?? 1)
  })[0]
}

function compactLedgerEvidence(ledger: ProgressLedger): string[] {
  const rows = [
    ...(ledger.events ?? []).flatMap(event => event.evidence ?? []),
    ...(ledger.stallDecision?.evidence ?? []),
    ledger.verifySummary ? `verify:score=${ledger.verifySummary.score}:passed=${String(ledger.verifySummary.passed)}` : '',
    ledger.reviewSummary ? `review:score=${ledger.reviewSummary.score}:approved=${String(ledger.reviewSummary.approved)}` : '',
  ]
  return [...new Set(rows.map(row => row.trim()).filter(Boolean))].slice(0, 20)
}
