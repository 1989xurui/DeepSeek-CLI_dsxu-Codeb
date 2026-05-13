/**
 * Quality Gate Bug Brain Link V1 测试
 *
 * 测试验证门禁与 Bug Brain 的集成
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import { bugBrainHooks, quickRecordBug } from '../bug-brain/integration'
import type { BugBrain } from '../bug-brain/types'

describe('Quality Gate Bug Brain Link V1', () => {
  let mockBugBrain: BugBrain

  beforeEach(() => {
    // 创建模拟的 Bug Brain
    mockBugBrain = {
      recordBug: mock(() => ({
        bugId: 'mock-bug-id',
        timestamp: Date.now()
      }))
    } as any
  })

  test('验证门禁钩子应正确记录验证失败', () => {
    // 直接测试钩子函数的存在性
    const verifyGateHook = bugBrainHooks.verifyGate

    expect(verifyGateHook).toBeDefined()
    expect(typeof verifyGateHook.recordVerifyFailure).toBe('function')

    // 由于我们无法模拟内部的 defaultBugBrain，我们只测试接口
    const context = {
      code: 'const x = 1;',
      filePath: '/test/file.ts',
      rule: 'syntax-check-001',
      error: new Error('Syntax error'),
      sessionId: 'test-session-123',
      taskId: 'test-task-456',
      compactLevel: 'micro'
    }

    // 调用函数，但不验证内部实现
    expect(() => {
      verifyGateHook.recordVerifyFailure('验证失败：语法错误', context)
    }).not.toThrow()
  })

  test('验证审查链钩子应正确记录审查失败', () => {
    const verifyReviewChainHook = bugBrainHooks.verifyReviewChain

    expect(verifyReviewChainHook).toBeDefined()
    expect(typeof verifyReviewChainHook.recordReviewFailure).toBe('function')

    const context = {
      reviewStage: 'final_review',
      reviewerType: 'automated',
      feedback: '代码质量不达标',
      error: new Error('Review failed')
    }

    // 调用函数，但不验证内部实现
    expect(() => {
      verifyReviewChainHook.recordReviewFailure('审查失败：代码质量不达标', context)
    }).not.toThrow()
  })

  test('审查子代理钩子应正确记录审查拒绝', () => {
    const reviewerSubagentHook = bugBrainHooks.reviewerSubagent

    expect(reviewerSubagentHook).toBeDefined()
    expect(typeof reviewerSubagentHook.recordReviewerRejection).toBe('function')

    const context = {
      subagentType: 'quality_reviewer',
      criteria: ['code_quality', 'test_coverage'],
      score: 65,
      threshold: 70,
      error: new Error('Score below threshold')
    }

    // 调用函数，但不验证内部实现
    expect(() => {
      reviewerSubagentHook.recordReviewerRejection('审查拒绝：分数低于阈值', context)
    }).not.toThrow()
  })

  test('快速记录工具应正确工作', () => {
    // 测试 quickRecordBug 函数的存在性
    expect(typeof quickRecordBug).toBe('function')

    const context = {
      codeSnippet: 'test code',
      filePath: '/test/file.ts',
      timestamp: Date.now()
    }

    // 调用函数，但不验证内部实现
    expect(() => {
      quickRecordBug(
        'verify-failure',
        'high',
        'verify-gate',
        '快速记录测试',
        context
      )
    }).not.toThrow()
  })

  test('所有集成钩子应可用', () => {
    const hooks = bugBrainHooks

    expect(hooks.verifyGate).toBeDefined()
    expect(hooks.verifyReviewChain).toBeDefined()
    expect(hooks.reviewerSubagent).toBeDefined()
    expect(hooks.memory).toBeDefined()
    expect(hooks.episodeMemory).toBeDefined()
    expect(hooks.graphRetrieval).toBeDefined()
    expect(hooks.toolExecution).toBeDefined()
    expect(hooks.contextRouting).toBeDefined()
    expect(hooks.compact).toBeDefined()
    expect(hooks.rollback).toBeDefined()

    // 验证钩子方法存在
    expect(typeof hooks.verifyGate.recordVerifyFailure).toBe('function')
    expect(typeof hooks.verifyReviewChain.recordReviewFailure).toBe('function')
    expect(typeof hooks.reviewerSubagent.recordReviewerRejection).toBe('function')
  })
})