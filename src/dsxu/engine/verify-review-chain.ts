import type { ReviewSummary, VerifySummary } from './types'

export type DefaultChainPhase =
  | 'edit'
  | 'execute'
  | 'verify'
  | 'review'
  | 'commit'
  | 'rollback'

export interface PhaseResult<T = unknown> {
  phase: DefaultChainPhase
  success: boolean
  data?: T
  error?: string
  startedAt: number
  endedAt: number
  metadata?: Record<string, unknown>
}

export interface VerifyPhaseResult extends PhaseResult<VerifySummary> {
  phase: 'verify'
}

export interface ReviewPhaseResult extends PhaseResult<ReviewSummary> {
  phase: 'review'
}

export type RollbackTriggerReason =
  | 'verify_failed'
  | 'review_rejected'
  | 'execution_failed'
  | 'error'

export interface RollbackTrigger {
  reason: RollbackTriggerReason
  fromPhase: DefaultChainPhase
  error?: string
  timestamp: number
}

export interface DefaultChainConfig {
  enableVerification: boolean
  enableReview: boolean
  verificationThreshold: number
  reviewThreshold: number
  autoRollback: {
    onVerifyFailed: boolean
    onReviewRejected: boolean
    onExecutionFailed: boolean
  }
}

export interface DefaultChainResult {
  finalOutcome: 'commit' | 'rollback'
  phaseResults: PhaseResult[]
  rollbackTrigger?: RollbackTrigger
  totalDuration: number
  success: boolean
}

export interface RollbackDecision {
  /**
   * Remains false by default. V18 forbids destructive rollback unless an
   * explicit user-confirmed path turns the suggestion into an action.
   */
  shouldRollback: boolean
  suggestedRollback: boolean
  requiresUserConfirmation: boolean
  reason?: RollbackTriggerReason
  trigger?: RollbackTrigger
  next: 'continue' | 'request_user_confirmation'
}

export const DEFAULT_CHAIN_CONFIG: DefaultChainConfig = {
  enableVerification: true,
  enableReview: true,
  verificationThreshold: 70,
  reviewThreshold: 60,
  autoRollback: {
    onVerifyFailed: false,
    onReviewRejected: false,
    onExecutionFailed: false,
  },
}

export function isVerificationPassed(verifyResult: VerifySummary): boolean {
  return (
    verifyResult.passed &&
    verifyResult.score >= DEFAULT_CHAIN_CONFIG.verificationThreshold
  )
}

export function isReviewApproved(reviewResult: ReviewSummary): boolean {
  return (
    reviewResult.approved &&
    reviewResult.score >= DEFAULT_CHAIN_CONFIG.reviewThreshold
  )
}

function buildRollbackSuggestion(
  reason: RollbackTriggerReason,
  fromPhase: DefaultChainPhase,
  error?: string,
): RollbackDecision {
  return {
    shouldRollback: false,
    suggestedRollback: true,
    requiresUserConfirmation: true,
    reason,
    trigger: {
      reason,
      fromPhase,
      error,
      timestamp: Date.now(),
    },
    next: 'request_user_confirmation',
  }
}

export function shouldRollback(
  verifyResult?: VerifySummary,
  reviewResult?: ReviewSummary,
  executionSuccess?: boolean,
): RollbackDecision {
  if (executionSuccess === false) {
    return buildRollbackSuggestion(
      'execution_failed',
      'execute',
      'Execution phase failed',
    )
  }

  if (verifyResult && !isVerificationPassed(verifyResult)) {
    return buildRollbackSuggestion(
      'verify_failed',
      'verify',
      'Verification did not pass',
    )
  }

  if (reviewResult && !isReviewApproved(reviewResult)) {
    return buildRollbackSuggestion(
      'review_rejected',
      'review',
      'Review did not approve the change',
    )
  }

  return {
    shouldRollback: false,
    suggestedRollback: false,
    requiresUserConfirmation: false,
    next: 'continue',
  }
}

export function createPhaseResult<T>(
  phase: DefaultChainPhase,
  success: boolean,
  data?: T,
  error?: string,
): PhaseResult<T> {
  const now = Date.now()
  return {
    phase,
    success,
    data,
    error,
    startedAt: now - 100,
    endedAt: now,
    metadata: {},
  }
}
