import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_CHAIN_CONFIG,
  createPhaseResult,
  isReviewApproved,
  isVerificationPassed,
  shouldRollback,
  type DefaultChainPhase,
  type ReviewSummary,
  type VerifySummary,
} from '../verify-review-chain'

function verifySummary(input: Partial<VerifySummary> = {}): VerifySummary {
  return {
    passed: true,
    score: 85,
    findings: [],
    timestamp: Date.now(),
    ruleResults: [],
    ...input,
  }
}

function reviewSummary(input: Partial<ReviewSummary> = {}): ReviewSummary {
  return {
    approved: true,
    score: 75,
    comments: [],
    riskLevel: 'low',
    timestamp: Date.now(),
    ruleResults: [],
    ...input,
  }
}

describe('Quality Gate Review Chain V1', () => {
  test('default config is suggestion-only for rollback', () => {
    expect(DEFAULT_CHAIN_CONFIG.enableVerification).toBe(true)
    expect(DEFAULT_CHAIN_CONFIG.enableReview).toBe(true)
    expect(DEFAULT_CHAIN_CONFIG.verificationThreshold).toBe(70)
    expect(DEFAULT_CHAIN_CONFIG.reviewThreshold).toBe(60)
    expect(DEFAULT_CHAIN_CONFIG.autoRollback.onVerifyFailed).toBe(false)
    expect(DEFAULT_CHAIN_CONFIG.autoRollback.onReviewRejected).toBe(false)
    expect(DEFAULT_CHAIN_CONFIG.autoRollback.onExecutionFailed).toBe(false)
  })

  test('verification pass check uses both passed and score threshold', () => {
    expect(isVerificationPassed(verifySummary())).toBe(true)
    expect(isVerificationPassed(verifySummary({ score: 65 }))).toBe(false)
    expect(isVerificationPassed(verifySummary({ passed: false, score: 90 }))).toBe(
      false,
    )
  })

  test('review approval check uses both approved and score threshold', () => {
    expect(isReviewApproved(reviewSummary())).toBe(true)
    expect(isReviewApproved(reviewSummary({ score: 55 }))).toBe(false)
    expect(isReviewApproved(reviewSummary({ approved: false, score: 80 }))).toBe(
      false,
    )
  })

  test('rollback failures create suggestions, not automatic rollback actions', () => {
    const executionFailed = shouldRollback(undefined, undefined, false)
    expect(executionFailed.shouldRollback).toBe(false)
    expect(executionFailed.suggestedRollback).toBe(true)
    expect(executionFailed.requiresUserConfirmation).toBe(true)
    expect(executionFailed.reason).toBe('execution_failed')
    expect(executionFailed.next).toBe('request_user_confirmation')

    const verifyFailed = shouldRollback(verifySummary({ score: 65 }))
    expect(verifyFailed.shouldRollback).toBe(false)
    expect(verifyFailed.suggestedRollback).toBe(true)
    expect(verifyFailed.requiresUserConfirmation).toBe(true)
    expect(verifyFailed.reason).toBe('verify_failed')

    const reviewRejected = shouldRollback(undefined, reviewSummary({ score: 55 }))
    expect(reviewRejected.shouldRollback).toBe(false)
    expect(reviewRejected.suggestedRollback).toBe(true)
    expect(reviewRejected.requiresUserConfirmation).toBe(true)
    expect(reviewRejected.reason).toBe('review_rejected')
  })

  test('passing chain continues without rollback suggestion', () => {
    const allPassed = shouldRollback(verifySummary(), reviewSummary(), true)
    expect(allPassed.shouldRollback).toBe(false)
    expect(allPassed.suggestedRollback).toBe(false)
    expect(allPassed.requiresUserConfirmation).toBe(false)
    expect(allPassed.next).toBe('continue')
  })

  test('createPhaseResult records phase, data, error, and timing', () => {
    const phase: DefaultChainPhase = 'verify'
    const result = createPhaseResult(phase, true, { score: 85 })

    expect(result.phase).toBe('verify')
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ score: 85 })
    expect(result.error).toBeUndefined()
    expect(result.startedAt).toBeLessThanOrEqual(result.endedAt)
    expect(result.metadata).toEqual({})

    const failed = createPhaseResult('execute', false, undefined, 'timeout')
    expect(failed.phase).toBe('execute')
    expect(failed.success).toBe(false)
    expect(failed.error).toBe('timeout')
  })
})
