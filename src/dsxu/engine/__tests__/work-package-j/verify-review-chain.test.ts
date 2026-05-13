import { describe, it, expect } from 'bun:test'
import {
  DefaultChainPhase,
  DEFAULT_CHAIN_CONFIG,
  isVerificationPassed,
  isReviewApproved,
  shouldRollback,
  createPhaseResult,
  type VerifySummary,
  type ReviewSummary,
} from '../../verify-review-chain'

describe('Verify / Review / Rollback default chain contract', () => {
  describe('1. default chain phases', () => {
    it('contains all expected default chain phases', () => {
      const phases: DefaultChainPhase[] = [
        'edit',
        'execute',
        'verify',
        'review',
        'commit',
        'rollback',
      ]

      phases.forEach((phase) => {
        expect(phase).toBeDefined()
        expect(typeof phase).toBe('string')
      })

      const uniquePhases = new Set(phases)
      expect(uniquePhases.size).toBe(6)
    })

    it('uses only valid phase literals', () => {
      const validPhases: DefaultChainPhase[] = [
        'edit',
        'execute',
        'verify',
        'review',
        'commit',
        'rollback',
      ]

      validPhases.forEach((phase) => {
        expect(phase).toMatch(/^(edit|execute|verify|review|commit|rollback)$/)
      })
    })
  })

  describe('2. verify summary helpers', () => {
    it('supports the required VerifySummary shape', () => {
      const verifyResult: VerifySummary = {
        passed: true,
        score: 85,
        findings: [],
        timestamp: Date.now(),
      }

      expect(verifyResult.passed).toBe(true)
      expect(verifyResult.score).toBe(85)
      expect(Array.isArray(verifyResult.findings)).toBe(true)
      expect(verifyResult.findings.length).toBe(0)
      expect(verifyResult.timestamp).toBeGreaterThan(0)
    })

    it('supports complete finding structures', () => {
      const verifyResult: VerifySummary = {
        passed: false,
        score: 60,
        findings: [
          {
            severity: 'P1',
            title: 'syntax error',
            detail: 'line 10 has a syntax error',
            suggestion: 'fix syntax error',
          },
          {
            severity: 'P2',
            title: 'style issue',
            detail: 'missing type annotation',
            suggestion: 'add type annotation',
          },
        ],
        timestamp: Date.now(),
      }

      expect(verifyResult.findings.length).toBe(2)
      expect(verifyResult.findings[0].severity).toBe('P1')
      expect(verifyResult.findings[0].title).toBe('syntax error')
      expect(verifyResult.findings[0].detail).toBe('line 10 has a syntax error')
      expect(verifyResult.findings[0].suggestion).toBe('fix syntax error')
      expect(verifyResult.findings[1].severity).toBe('P2')
      expect(verifyResult.findings[1].title).toBe('style issue')
    })

    it('isVerificationPassed() evaluates pass flag and threshold', () => {
      const passedResult: VerifySummary = {
        passed: true,
        score: 80,
        findings: [],
        timestamp: Date.now(),
      }

      const failedResult1: VerifySummary = {
        passed: false,
        score: 90,
        findings: [],
        timestamp: Date.now(),
      }

      const failedResult2: VerifySummary = {
        passed: true,
        score: 60,
        findings: [],
        timestamp: Date.now(),
      }

      expect(isVerificationPassed(passedResult)).toBe(true)
      expect(isVerificationPassed(failedResult1)).toBe(false)
      expect(isVerificationPassed(failedResult2)).toBe(false)
    })
  })

  describe('3. review summary helpers', () => {
    it('supports the required ReviewSummary shape', () => {
      const reviewResult: ReviewSummary = {
        approved: true,
        score: 90,
        comments: ['code quality looks good'],
        riskLevel: 'low',
        timestamp: Date.now(),
      }

      expect(reviewResult.approved).toBe(true)
      expect(reviewResult.score).toBe(90)
      expect(Array.isArray(reviewResult.comments)).toBe(true)
      expect(reviewResult.comments[0]).toBe('code quality looks good')
      expect(['low', 'medium', 'high']).toContain(reviewResult.riskLevel)
      expect(reviewResult.timestamp).toBeGreaterThan(0)
    })

    it('isReviewApproved() evaluates approval flag and threshold', () => {
      const approvedResult: ReviewSummary = {
        approved: true,
        score: 70,
        comments: [],
        riskLevel: 'low',
        timestamp: Date.now(),
      }

      const rejectedResult1: ReviewSummary = {
        approved: false,
        score: 90,
        comments: [],
        riskLevel: 'low',
        timestamp: Date.now(),
      }

      const rejectedResult2: ReviewSummary = {
        approved: true,
        score: 50,
        comments: [],
        riskLevel: 'low',
        timestamp: Date.now(),
      }

      expect(isReviewApproved(approvedResult)).toBe(true)
      expect(isReviewApproved(rejectedResult1)).toBe(false)
      expect(isReviewApproved(rejectedResult2)).toBe(false)
    })
  })

  describe('4. rollback safety policy', () => {
    it('verify failure suggests rollback but does not execute it', () => {
      const verifyResult: VerifySummary = {
        passed: false,
        score: 80,
        findings: [],
        timestamp: Date.now(),
      }

      const result = shouldRollback(verifyResult, undefined, true)
      expect(result.shouldRollback).toBe(false)
      expect(result.suggestedRollback).toBe(true)
      expect(result.requiresUserConfirmation).toBe(true)
      expect(result.reason).toBe('verify_failed')
      expect(result.next).toBe('request_user_confirmation')
    })

    it('low verify score suggests rollback but does not execute it', () => {
      const verifyResult: VerifySummary = {
        passed: true,
        score: 60,
        findings: [],
        timestamp: Date.now(),
      }

      const result = shouldRollback(verifyResult, undefined, true)
      expect(result.shouldRollback).toBe(false)
      expect(result.suggestedRollback).toBe(true)
      expect(result.requiresUserConfirmation).toBe(true)
      expect(result.reason).toBe('verify_failed')
      expect(result.next).toBe('request_user_confirmation')
    })

    it('review rejection suggests rollback but does not execute it', () => {
      const reviewResult: ReviewSummary = {
        approved: false,
        score: 90,
        comments: [],
        riskLevel: 'low',
        timestamp: Date.now(),
      }

      const result = shouldRollback(undefined, reviewResult, true)
      expect(result.shouldRollback).toBe(false)
      expect(result.suggestedRollback).toBe(true)
      expect(result.requiresUserConfirmation).toBe(true)
      expect(result.reason).toBe('review_rejected')
      expect(result.next).toBe('request_user_confirmation')
    })

    it('low review score suggests rollback but does not execute it', () => {
      const reviewResult: ReviewSummary = {
        approved: true,
        score: 50,
        comments: [],
        riskLevel: 'low',
        timestamp: Date.now(),
      }

      const result = shouldRollback(undefined, reviewResult, true)
      expect(result.shouldRollback).toBe(false)
      expect(result.suggestedRollback).toBe(true)
      expect(result.requiresUserConfirmation).toBe(true)
      expect(result.reason).toBe('review_rejected')
      expect(result.next).toBe('request_user_confirmation')
    })

    it('execution failure suggests rollback but does not execute it', () => {
      const result = shouldRollback(undefined, undefined, false)
      expect(result.shouldRollback).toBe(false)
      expect(result.suggestedRollback).toBe(true)
      expect(result.requiresUserConfirmation).toBe(true)
      expect(result.reason).toBe('execution_failed')
      expect(result.next).toBe('request_user_confirmation')
    })

    it('passing execution, verification, and review continues', () => {
      const verifyResult: VerifySummary = {
        passed: true,
        score: 80,
        findings: [],
        timestamp: Date.now(),
      }

      const reviewResult: ReviewSummary = {
        approved: true,
        score: 70,
        comments: [],
        riskLevel: 'low',
        timestamp: Date.now(),
      }

      const result = shouldRollback(verifyResult, reviewResult, true)
      expect(result.shouldRollback).toBe(false)
      expect(result.suggestedRollback).toBe(false)
      expect(result.requiresUserConfirmation).toBe(false)
      expect(result.next).toBe('continue')
      expect(result.reason).toBeUndefined()
    })
  })

  describe('5. helper functions', () => {
    it('createPhaseResult() creates a valid phase result', () => {
      const phaseResult = createPhaseResult('edit', true, { filesChanged: 2 })

      expect(phaseResult.phase).toBe('edit')
      expect(phaseResult.success).toBe(true)
      expect(phaseResult.data).toEqual({ filesChanged: 2 })
      expect(phaseResult.error).toBeUndefined()
      expect(phaseResult.startedAt).toBeLessThanOrEqual(phaseResult.endedAt)
      expect(phaseResult.endedAt).toBeGreaterThan(0)
      expect(phaseResult.metadata).toEqual({})
    })

    it('createPhaseResult() supports error text', () => {
      const phaseResult = createPhaseResult('execute', false, undefined, 'execution failed')

      expect(phaseResult.phase).toBe('execute')
      expect(phaseResult.success).toBe(false)
      expect(phaseResult.data).toBeUndefined()
      expect(phaseResult.error).toBe('execution failed')
    })

    it('DEFAULT_CHAIN_CONFIG disables automatic rollback by default', () => {
      expect(DEFAULT_CHAIN_CONFIG.enableVerification).toBe(true)
      expect(DEFAULT_CHAIN_CONFIG.enableReview).toBe(true)
      expect(DEFAULT_CHAIN_CONFIG.verificationThreshold).toBe(70)
      expect(DEFAULT_CHAIN_CONFIG.reviewThreshold).toBe(60)
      expect(DEFAULT_CHAIN_CONFIG.autoRollback.onVerifyFailed).toBe(false)
      expect(DEFAULT_CHAIN_CONFIG.autoRollback.onReviewRejected).toBe(false)
      expect(DEFAULT_CHAIN_CONFIG.autoRollback.onExecutionFailed).toBe(false)
    })
  })
})
