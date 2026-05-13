/**
 * Recovery Decision 逻辑测试
 * 测试决策逻辑和动作选择
 */

import { RecoveryPlanner } from '../recovery/recovery-planner'
import { RecoveryContext, RecoveryInput } from '../recovery/types'

describe('Recovery Decision Logic', () => {
  let planner: RecoveryPlanner

  beforeEach(() => {
    planner = new RecoveryPlanner({
      debug: false,
      logDecisions: false,
      retryThreshold: 2,
      rollbackThreshold: 3,
      humanInterventionThreshold: 0.3,
    })
  })

  describe('动作选择逻辑', () => {
    test('verify-failure 首次应该重试，重复应该重新规划', () => {
      const context: RecoveryContext = { timestamp: Date.now() }

      // 首次失败
      const firstFailure: RecoveryInput = {
        bugRecord: {
          id: 'bug-1',
          type: 'verify-failure',
          severity: 'medium',
          source: 'verify-gate',
          description: '首次验证失败',
          context: {},
          timestamp: Date.now(),
        },
        failureHistory: {
          recentFailures: 1,
          sameTypeFailures: 1,
        },
      }

      // 重复失败
      const repeatedFailure: RecoveryInput = {
        bugRecord: {
          id: 'bug-2',
          type: 'verify-failure',
          severity: 'medium',
          source: 'verify-gate',
          description: '重复验证失败',
          context: {},
          timestamp: Date.now(),
        },
        failureHistory: {
          recentFailures: 3,
          sameTypeFailures: 3,
        },
      }

      const firstDecision = planner.decideRecoveryAction(context, firstFailure)
      const repeatedDecision = planner.decideRecoveryAction(context, repeatedFailure)

      expect(firstDecision.action).toBe('retry')
      expect(['replan', 'escalate']).toContain(repeatedDecision.action) // 重复失败可能重新规划或升级
    })

    test('reviewer-rejection 应该重新规划或请求人工', () => {
      const context: RecoveryContext = { timestamp: Date.now() }

      const input: RecoveryInput = {
        bugRecord: {
          id: 'bug-review',
          type: 'reviewer-rejection',
          severity: 'low',
          source: 'reviewer-subagent',
          description: '审核拒绝',
          context: {},
          timestamp: Date.now(),
        },
      }

      const decision = planner.decideRecoveryAction(context, input)

      expect(['replan', 'ask-human']).toContain(decision.action)
      expect(decision.reason).toBe('reviewer-rejection')
    })

    test('tool-failure 首次应该重试，严重应该中止', () => {
      const context: RecoveryContext = { timestamp: Date.now() }

      // 首次工具失败
      const firstToolFailure: RecoveryInput = {
        bugRecord: {
          id: 'bug-tool-1',
          type: 'tool-failure',
          severity: 'medium',
          source: 'tool-execution',
          description: '工具执行失败',
          context: {},
          timestamp: Date.now(),
        },
        failureHistory: {
          recentFailures: 1,
          sameTypeFailures: 1,
        },
      }

      // 严重工具失败
      const severeToolFailure: RecoveryInput = {
        bugRecord: {
          id: 'bug-tool-2',
          type: 'tool-failure',
          severity: 'critical',
          source: 'tool-execution',
          description: '工具崩溃',
          context: {},
          timestamp: Date.now(),
        },
        failureHistory: {
          recentFailures: 2,
          sameTypeFailures: 2,
        },
      }

      const firstDecision = planner.decideRecoveryAction(context, firstToolFailure)
      const severeDecision = planner.decideRecoveryAction(context, severeToolFailure)

      expect(firstDecision.action).toBe('retry')
      expect(severeDecision.action).toBe('abort')
    })

    test('context-insufficiency 应该重新规划', () => {
      const context: RecoveryContext = { timestamp: Date.now() }

      const input: RecoveryInput = {
        bugRecord: {
          id: 'bug-context',
          type: 'context-insufficiency',
          severity: 'medium',
          source: 'context-routing',
          description: '上下文不足',
          context: {},
          timestamp: Date.now(),
        },
      }

      const decision = planner.decideRecoveryAction(context, input)

      expect(decision.action).toBe('replan')
      expect(decision.reason).toBe('context-insufficiency')
    })

    test('重复失败超过阈值应该回滚或升级', () => {
      const context: RecoveryContext = { timestamp: Date.now() }

      const input: RecoveryInput = {
        bugRecord: {
          id: 'bug-repeated',
          type: 'verify-failure',
          severity: 'medium',
          source: 'verify-gate',
          description: '重复失败',
          context: {},
          timestamp: Date.now(),
        },
        failureHistory: {
          recentFailures: 5,
          sameTypeFailures: 5, // 超过 rollbackThreshold (3)
        },
      }

      const decision = planner.decideRecoveryAction(context, input)

      expect(['rollback', 'escalate']).toContain(decision.action)
      expect(decision.reason).toBe('verify-failure')
    })
  })

  describe('上下文影响决策', () => {
    test('低质量上下文应该倾向于人工干预', () => {
      const lowQualityContext: RecoveryContext = {
        memoryAvailability: 'low',
        graphCoverage: 'minimal',
        contextHygieneScore: 0.2,
        timestamp: Date.now(),
      }

      const input: RecoveryInput = {
        bugRecord: {
          id: 'bug-low-context',
          type: 'verify-failure',
          severity: 'medium',
          source: 'verify-gate',
          description: '验证失败',
          context: {},
          timestamp: Date.now(),
        },
        failureHistory: {
          recentFailures: 2,
          sameTypeFailures: 2,
        },
      }

      const decision = planner.decideRecoveryAction(lowQualityContext, input)

      // 低质量上下文应该增加人工干预的可能性
      expect(decision.action).toBe('ask-human')
    })

    test('高质量上下文应该提高置信度', () => {
      const highQualityContext: RecoveryContext = {
        memoryAvailability: 'high',
        graphCoverage: 'full',
        contextHygieneScore: 0.9,
        timestamp: Date.now(),
      }

      const input: RecoveryInput = {
        bugRecord: {
          id: 'bug-high-context',
          type: 'verify-failure',
          severity: 'medium',
          source: 'verify-gate',
          description: '验证失败',
          context: {},
          timestamp: Date.now(),
        },
      }

      const decision = planner.decideRecoveryAction(highQualityContext, input)

      expect(decision.confidence).toBeGreaterThan(0.7)
    })
  })

  describe('配置影响决策', () => {
    test('配置应该影响动作选择', () => {
      // 创建禁用重试的 planner
      const noRetryPlanner = new RecoveryPlanner({
        preferRetryForToolFailures: false,
      })

      const context: RecoveryContext = { timestamp: Date.now() }

      const input: RecoveryInput = {
        bugRecord: {
          id: 'bug-tool',
          type: 'tool-failure',
          severity: 'medium',
          source: 'tool-execution',
          description: '工具失败',
          context: {},
          timestamp: Date.now(),
        },
      }

      const decision = noRetryPlanner.decideRecoveryAction(context, input)

      // 禁用重试后，工具失败应该直接中止
      expect(decision.action).toBe('abort')
    })

    test('阈值配置应该生效', () => {
      // 创建低阈值的 planner
      const lowThresholdPlanner = new RecoveryPlanner({
        rollbackThreshold: 2, // 降低回滚阈值
      })

      const context: RecoveryContext = { timestamp: Date.now() }

      const input: RecoveryInput = {
        bugRecord: {
          id: 'bug-threshold',
          type: 'verify-failure',
          severity: 'medium',
          source: 'verify-gate',
          description: '验证失败',
          context: {},
          timestamp: Date.now(),
        },
        failureHistory: {
          recentFailures: 2,
          sameTypeFailures: 2, // 达到 rollbackThreshold (2)
        },
      }

      const decision = lowThresholdPlanner.decideRecoveryAction(context, input)

      // 达到降低后的阈值，应该回滚或升级
      expect(['rollback', 'escalate']).toContain(decision.action)
    })
  })

  describe('置信度计算', () => {
    test('置信度应该在合理范围内', () => {
      const context: RecoveryContext = { timestamp: Date.now() }

      const input: RecoveryInput = {
        bugRecord: {
          id: 'bug-confidence',
          type: 'verify-failure',
          severity: 'medium',
          source: 'verify-gate',
          description: '测试',
          context: {},
          timestamp: Date.now(),
        },
      }

      const decision = planner.decideRecoveryAction(context, input)

      expect(decision.confidence).toBeGreaterThanOrEqual(0.1)
      expect(decision.confidence).toBeLessThanOrEqual(1.0)
    })

    test('明确原因应该提高置信度', () => {
      const wellDefinedContext: RecoveryContext = { timestamp: Date.now() }

      const wellDefinedInput: RecoveryInput = {
        bugRecord: {
          id: 'bug-well-defined',
          type: 'verify-failure', // 明确定义的原因
          severity: 'medium',
          source: 'verify-gate',
          description: '验证失败',
          context: {},
          timestamp: Date.now(),
        },
      }

      const unknownInput: RecoveryInput = {
        bugRecord: {
          id: 'bug-unknown',
          type: 'other', // 未知原因
          severity: 'medium',
          source: 'unknown',
          description: '未知失败',
          context: {},
          timestamp: Date.now(),
        },
      }

      const wellDefinedDecision = planner.decideRecoveryAction(wellDefinedContext, wellDefinedInput)
      const unknownDecision = planner.decideRecoveryAction(wellDefinedContext, unknownInput)

      // 明确定义的原因应该有更高的置信度
      expect(wellDefinedDecision.confidence).toBeGreaterThan(unknownDecision.confidence)
    })
  })
})