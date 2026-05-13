/**
 * Quality Gate Bug Brain V1 Harness
 *
 * Bug Brain 集成测试工具
 */

import { bugBrainHooks, quickRecordBug } from '../../engine/bug-brain/integration'
import type { BugCategory, BugSeverity, BugSource, BugContext } from '../../engine/bug-brain/types'

/**
 * 测试验证门禁钩子
 */
export function testVerifyGateHook() {
  const verifyGateHook = bugBrainHooks.verifyGate

  const context = {
    code: 'const x = 1;',
    filePath: '/test/file.ts',
    rule: 'syntax-check-001',
    error: new Error('Syntax error'),
    sessionId: 'test-session-123',
    taskId: 'test-task-456',
    compactLevel: 'micro'
  }

  try {
    verifyGateHook.recordVerifyFailure('验证失败：语法错误', context)
    return { success: true, hook: 'verifyGate' }
  } catch (error) {
    return { success: false, hook: 'verifyGate', error: error.message }
  }
}

/**
 * 测试验证审查链钩子
 */
export function testVerifyReviewChainHook() {
  const verifyReviewChainHook = bugBrainHooks.verifyReviewChain

  const context = {
    reviewStage: 'final_review',
    reviewerType: 'automated',
    feedback: '代码质量不达标',
    error: new Error('Review failed')
  }

  try {
    verifyReviewChainHook.recordReviewFailure('审查失败：代码质量不达标', context)
    return { success: true, hook: 'verifyReviewChain' }
  } catch (error) {
    return { success: false, hook: 'verifyReviewChain', error: error.message }
  }
}

/**
 * 测试审查子代理钩子
 */
export function testReviewerSubagentHook() {
  const reviewerSubagentHook = bugBrainHooks.reviewerSubagent

  const context = {
    subagentType: 'quality_reviewer',
    criteria: ['code_quality', 'test_coverage'],
    score: 65,
    threshold: 70,
    error: new Error('Score below threshold')
  }

  try {
    reviewerSubagentHook.recordReviewerRejection('审查拒绝：分数低于阈值', context)
    return { success: true, hook: 'reviewerSubagent' }
  } catch (error) {
    return { success: false, hook: 'reviewerSubagent', error: error.message }
  }
}

/**
 * 测试快速记录工具
 */
export function testQuickRecordBug() {
  const context: Partial<BugContext> = {
    codeSnippet: 'test code',
    filePath: '/test/file.ts',
    timestamp: Date.now()
  }

  try {
    quickRecordBug(
      'verify-failure' as BugCategory,
      'high' as BugSeverity,
      'verify-gate' as BugSource,
      '快速记录测试',
      context
    )
    return { success: true, tool: 'quickRecordBug' }
  } catch (error) {
    return { success: false, tool: 'quickRecordBug', error: error.message }
  }
}

/**
 * 测试所有集成钩子可用性
 */
export function testAllHooksAvailability() {
  const hooks = bugBrainHooks
  const availableHooks = []

  if (hooks.verifyGate) availableHooks.push('verifyGate')
  if (hooks.verifyReviewChain) availableHooks.push('verifyReviewChain')
  if (hooks.reviewerSubagent) availableHooks.push('reviewerSubagent')
  if (hooks.memory) availableHooks.push('memory')
  if (hooks.episodeMemory) availableHooks.push('episodeMemory')
  if (hooks.graphRetrieval) availableHooks.push('graphRetrieval')
  if (hooks.toolExecution) availableHooks.push('toolExecution')
  if (hooks.contextRouting) availableHooks.push('contextRouting')
  if (hooks.compact) availableHooks.push('compact')
  if (hooks.rollback) availableHooks.push('rollback')

  return {
    totalHooks: availableHooks.length,
    availableHooks,
    allAvailable: availableHooks.length === 10
  }
}

/**
 * Bug Brain 集成测试工具集
 */
export const QualityGateBugBrainHarness = {
  testVerifyGateHook,
  testVerifyReviewChainHook,
  testReviewerSubagentHook,
  testQuickRecordBug,
  testAllHooksAvailability,
  bugBrainHooks
}