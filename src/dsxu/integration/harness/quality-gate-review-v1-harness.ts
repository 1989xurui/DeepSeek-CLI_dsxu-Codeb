/**
 * Quality Gate Review V1 Harness
 *
 * 验证审查链测试工具
 */

import {
  DEFAULT_CHAIN_CONFIG,
  isVerificationPassed,
  isReviewApproved,
  shouldRollback,
  createPhaseResult,
  type VerifySummary,
  type ReviewSummary
} from '../../engine/verify-review-chain'

/**
 * 创建测试用验证摘要
 */
export function createTestVerifySummary(passed: boolean = true, score: number = 85): VerifySummary {
  return {
    passed,
    score,
    findings: [],
    timestamp: Date.now(),
    ruleResults: []
  }
}

/**
 * 创建测试用审查摘要
 */
export function createTestReviewSummary(approved: boolean = true, score: number = 75): ReviewSummary {
  return {
    approved,
    score,
    comments: [],
    riskLevel: 'low',
    timestamp: Date.now(),
    ruleResults: []
  }
}

/**
 * 测试验证通过检查
 */
export function testVerificationPassed() {
  const passedVerify = createTestVerifySummary(true, 85)
  const failedVerify = createTestVerifySummary(true, 65)

  return {
    passed: isVerificationPassed(passedVerify),
    failed: isVerificationPassed(failedVerify)
  }
}

/**
 * 测试审查批准检查
 */
export function testReviewApproved() {
  const approvedReview = createTestReviewSummary(true, 75)
  const failedReview = createTestReviewSummary(true, 55)

  return {
    approved: isReviewApproved(approvedReview),
    failed: isReviewApproved(failedReview)
  }
}

/**
 * 测试回滚判断
 */
export function testRollbackDecision() {
  const executionFailed = shouldRollback(undefined, undefined, false)
  const verifyFailed = shouldRollback(createTestVerifySummary(true, 65))
  const reviewRejected = shouldRollback(undefined, createTestReviewSummary(true, 55))
  const allPassed = shouldRollback(
    createTestVerifySummary(true, 85),
    createTestReviewSummary(true, 75),
    true
  )

  return {
    executionFailed,
    verifyFailed,
    reviewRejected,
    allPassed
  }
}

/**
 * 验证审查链测试工具集
 */
export const QualityGateReviewHarness = {
  createTestVerifySummary,
  createTestReviewSummary,
  testVerificationPassed,
  testReviewApproved,
  testRollbackDecision,
  DEFAULT_CHAIN_CONFIG
}