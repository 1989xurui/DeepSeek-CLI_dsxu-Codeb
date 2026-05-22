/**
 * Recovery Planner 核心功能测试
 */

import { RecoveryPlanner } from '../recovery/recovery-planner'
import { RecoveryContext, RecoveryInput } from '../recovery/types'

describe('RecoveryPlanner', () => {
  let planner: RecoveryPlanner

  beforeEach(() => {
    planner = new RecoveryPlanner({
      debug: false,
      logDecisions: false,
    })
  })

  describe('基础功能', () => {
    test('应该能够创建恢复决策', () => {
      const context: RecoveryContext = {
        sessionId: 'test-session',
        taskId: 'test-task',
        memoryAvailability: 'high',
        timestamp: Date.now(),
      }

      const input: RecoveryInput = {
        bugRecord: {
          id: 'test-bug',
          type: 'verify-failure',
          severity: 'medium',
          source: 'verify-gate',
          description: '验证失败测试',
          context: {},
          timestamp: Date.now(),
        },
      }

      const decision = planner.decideRecoveryAction(context, input)

      expect(decision).toBeDefined()
      expect(decision.decisionId).toBeDefined()
      expect(decision.action).toBeDefined()
      expect(decision.reason).toBe('verify-failure')
      expect(decision.confidence).toBeGreaterThan(0)
      expect(decision.confidence).toBeLessThanOrEqual(1)
    })

    test('应该为不同失败原因生成不同决策', () => {
      const context: RecoveryContext = {
        sessionId: 'test-session',
        timestamp: Date.now(),
      }

      // 测试 verify-failure
      const verifyInput: RecoveryInput = {
        bugRecord: {
          id: 'bug-1',
          type: 'verify-failure',
          severity: 'medium',
          source: 'verify-gate',
          description: '验证失败',
          context: {},
          timestamp: Date.now(),
        },
      }

      const verifyDecision = planner.decideRecoveryAction(context, verifyInput)
      expect(verifyDecision.reason).toBe('verify-failure')
      expect(['retry', 'replan']).toContain(verifyDecision.action)

      // 测试 reviewer-rejection
      const reviewerInput: RecoveryInput = {
        bugRecord: {
          id: 'bug-2',
          type: 'reviewer-rejection',
          severity: 'low',
          source: 'reviewer-subagent',
          description: '审核拒绝',
          context: {},
          timestamp: Date.now(),
        },
      }

      const reviewerDecision = planner.decideRecoveryAction(context, reviewerInput)
      expect(reviewerDecision.reason).toBe('reviewer-rejection')
      expect(['replan', 'ask-human']).toContain(reviewerDecision.action)

      // 测试 tool-failure
      const toolInput: RecoveryInput = {
        bugRecord: {
          id: 'bug-3',
          type: 'tool-failure',
          severity: 'high',
          source: 'tool-execution',
          description: '工具失败',
          context: {},
          timestamp: Date.now(),
        },
      }

      const toolDecision = planner.decideRecoveryAction(context, toolInput)
      expect(toolDecision.reason).toBe('tool-failure')
      expect(['retry', 'abort']).toContain(toolDecision.action)
    })
  })

  describe('上下文影响决策', () => {
    test('低质量上下文应该降低置信度', () => {
      const lowQualityContext: RecoveryContext = {
        memoryAvailability: 'low',
        graphCoverage: 'minimal',
        contextHygieneScore: 0.3,
        timestamp: Date.now(),
      }

      const highQualityContext: RecoveryContext = {
        memoryAvailability: 'high',
        graphCoverage: 'full',
        contextHygieneScore: 0.9,
        timestamp: Date.now(),
      }

      const input: RecoveryInput = {
        bugRecord: {
          id: 'test-bug',
          type: 'verify-failure',
          severity: 'medium',
          source: 'verify-gate',
          description: '测试',
          context: {},
          timestamp: Date.now(),
        },
      }

      const lowQualityDecision = planner.decideRecoveryAction(lowQualityContext, input)
      const highQualityDecision = planner.decideRecoveryAction(highQualityContext, input)

      // 低质量上下文的置信度应该较低
      expect(lowQualityDecision.confidence).toBeLessThan(highQualityDecision.confidence)
    })

    test('重复失败应该触发不同动作', () => {
      const context: RecoveryContext = {
        timestamp: Date.now(),
      }

      // 首次失败
      const firstInput: RecoveryInput = {
        bugRecord: {
          id: 'bug-1',
          type: 'verify-failure',
          severity: 'medium',
          source: 'verify-gate',
          description: '首次失败',
          context: {},
          timestamp: Date.now(),
        },
        failureHistory: {
          recentFailures: 1,
          sameTypeFailures: 1,
          lastFailureTime: Date.now(),
        },
      }

      // 重复失败
      const repeatedInput: RecoveryInput = {
        bugRecord: {
          id: 'bug-2',
          type: 'verify-failure',
          severity: 'medium',
          source: 'verify-gate',
          description: '重复失败',
          context: {},
          timestamp: Date.now(),
        },
        failureHistory: {
          recentFailures: 3,
          sameTypeFailures: 3,
          lastFailureTime: Date.now(),
        },
      }

      const firstDecision = planner.decideRecoveryAction(context, firstInput)
      const repeatedDecision = planner.decideRecoveryAction(context, repeatedInput)

      // 首次失败可能重试，重复失败可能重新规划或回滚
      expect(firstDecision.action).not.toBe('rollback')
      expect(['replan', 'rollback', 'escalate', 'ask-human']).toContain(repeatedDecision.action)
    })
  })

  describe('恢复计划生成', () => {
    test('应该能够生成恢复计划', () => {
      const context: RecoveryContext = {
        sessionId: 'test-session',
        timestamp: Date.now(),
      }

      const input: RecoveryInput = {
        bugRecord: {
          id: 'test-bug',
          type: 'verify-failure',
          severity: 'medium',
          source: 'verify-gate',
          description: '测试',
          context: {},
          timestamp: Date.now(),
        },
      }

      const decision = planner.decideRecoveryAction(context, input)
      const plan = planner.generateRecoveryPlan(decision)

      expect(plan).toBeDefined()
      expect(plan.planId).toBeDefined()
      expect(plan.decisionId).toBe(decision.decisionId)
      expect(plan.steps.length).toBeGreaterThan(0)
      expect(plan.estimatedDuration).toBeGreaterThan(0)
    })

    test('不同动作应该生成不同步骤', () => {
      const context: RecoveryContext = {
        timestamp: Date.now(),
      }

      // 测试 retry 动作
      const retryInput: RecoveryInput = {
        bugRecord: {
          id: 'bug-retry',
          type: 'tool-failure',
          severity: 'medium',
          source: 'tool-execution',
          description: '工具失败',
          context: {},
          timestamp: Date.now(),
        },
      }

      const retryDecision = planner.decideRecoveryAction(context, retryInput)
      const retryPlan = planner.generateRecoveryPlan(retryDecision)

      // 测试 replan 动作
      const replanInput: RecoveryInput = {
        bugRecord: {
          id: 'bug-replan',
          type: 'reviewer-rejection',
          severity: 'low',
          source: 'reviewer-subagent',
          description: '审核拒绝',
          context: {},
          timestamp: Date.now(),
        },
      }

      const replanDecision = planner.decideRecoveryAction(context, replanInput)
      const replanPlan = planner.generateRecoveryPlan(replanDecision)

      // 步骤应该不同
      expect(retryPlan.steps[0].action).not.toBe(replanPlan.steps[0].action)
      expect(retryPlan.steps.length).not.toBe(replanPlan.steps.length)
    })
  })

  describe('决策历史', () => {
    test('应该记录决策历史', () => {
      const context: RecoveryContext = {
        timestamp: Date.now(),
      }

      const input: RecoveryInput = {
        bugRecord: {
          id: 'test-bug',
          type: 'verify-failure',
          severity: 'medium',
          source: 'verify-gate',
          description: '测试',
          context: {},
          timestamp: Date.now(),
        },
      }

      // 创建多个决策
      const decision1 = planner.decideRecoveryAction(context, input)
      const decision2 = planner.decideRecoveryAction(context, input)

      const history = planner.getDecisionHistory()
      expect(history.length).toBe(2)
      expect(history.map(d => d.decisionId)).toContain(decision1.decisionId)
      expect(history.map(d => d.decisionId)).toContain(decision2.decisionId)
    })

    test('应该能够获取特定决策', () => {
      const context: RecoveryContext = {
        timestamp: Date.now(),
      }

      const input: RecoveryInput = {
        bugRecord: {
          id: 'test-bug',
          type: 'verify-failure',
          severity: 'medium',
          source: 'verify-gate',
          description: '测试',
          context: {},
          timestamp: Date.now(),
        },
      }

      const decision = planner.decideRecoveryAction(context, input)
      const retrieved = planner.getDecision(decision.decisionId)

      expect(retrieved).toBeDefined()
      expect(retrieved?.decisionId).toBe(decision.decisionId)
      expect(retrieved?.action).toBe(decision.action)
    })
  })
})
