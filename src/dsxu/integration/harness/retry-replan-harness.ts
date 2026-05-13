/**
 * Retry/Replan Harness 测试
 * 验证重试和重新规划场景的恢复决策
 */

import { RecoveryDecisionFactory } from '../../../dsxu/engine/recovery/integration'
import { bugBrainHooks } from '../../../dsxu/engine/bug-brain/integration'
import { defaultBugBrain } from '../../../dsxu/engine/bug-brain/index'

describe('Retry/Replan Recovery Harness', () => {
  let recoveryFactory: RecoveryDecisionFactory

  beforeEach(() => {
    // 创建新的 factory 避免历史累积
    recoveryFactory = new RecoveryDecisionFactory({
      debug: false,
      logDecisions: false,
    })

    // 清空 bug brain 记录
    const bugBrain = defaultBugBrain as any
    bugBrain.records.clear()
    bugBrain.patterns.clear()
    bugBrain.fixPatterns.clear()
  })

  describe('重试场景', () => {
    test('工具失败首次应该重试', () => {
      const bug = bugBrainHooks.toolExecution.recordToolFailure(
        'Git 命令执行失败',
        {
          toolName: 'git',
          parameters: { command: 'push' },
          error: new Error('网络连接超时'),
        }
      )

      const decision = recoveryFactory.createDecisionFromBugRecord(bug, {
        sessionId: 'retry-session',
        memoryAvailability: 'high',
      })

      expect(decision.reason).toBe('tool-failure')
      expect(decision.action).toBe('retry')
      expect(decision.confidence).toBeGreaterThan(0.6)
      expect(decision.context.sessionId).toBe('retry-session')
    })

    test('验证失败首次应该重试', () => {
      const bug = bugBrainHooks.verifyGate.recordVerifyFailure(
        '代码格式检查失败',
        {
          code: 'function test() {}',
          filePath: '/src/test.js',
          error: new Error('缺少分号'),
        }
      )

      const decision = recoveryFactory.createDecisionFromBugRecord(bug)

      expect(decision.reason).toBe('verify-failure')
      expect(decision.action).toBe('retry')
    })

    test('超时失败应该重试', () => {
      const bug = bugBrainHooks.toolExecution.recordToolFailure(
        'API 调用超时',
        {
          toolName: 'http',
          parameters: { url: 'https://api.example.com' },
          timeout: true,
        }
      )

      // 修改 bug 类型为 timeout（模拟）
      bug.type = 'execution-timeout'

      const decision = recoveryFactory.createDecisionFromBugRecord(bug)

      expect(decision.reason).toBe('timeout')
      expect(decision.action).toBe('retry')
    })
  })

  describe('重新规划场景', () => {
    test('审核拒绝应该重新规划', () => {
      const bug = bugBrainHooks.reviewerSubagent.recordReviewerRejection(
        '代码质量审核未通过',
        {
          subagentType: 'code-quality',
          criteria: ['readability', 'maintainability'],
          score: 0.6,
          threshold: 0.8,
        }
      )

      const decision = recoveryFactory.createDecisionFromBugRecord(bug, {
        taskPriority: 'high',
      })

      expect(decision.reason).toBe('reviewer-rejection')
      expect(decision.action).toBe('replan')
      expect(decision.context.taskPriority).toBe('high')
    })

    test('上下文不足应该重新规划', () => {
      const bug = bugBrainHooks.contextRouting.recordContextInsufficiency(
        '缺少用户历史上下文',
        {
          requiredContext: ['user-history', 'preferences', 'past-actions'],
          availableContext: ['user-history'],
          routingDecision: 'fallback',
        }
      )

      const decision = recoveryFactory.createDecisionFromBugRecord(bug)

      expect(decision.reason).toBe('context-insufficiency')
      expect(decision.action).toBe('replan')
    })

    test('图检索未命中应该重新规划', () => {
      const bug = bugBrainHooks.graphRetrieval.recordRetrievalMiss(
        '未找到相关代码示例',
        {
          query: 'React 高阶组件模式',
          expectedResults: 5,
          actualResults: 0,
          relevanceThreshold: 0.7,
        }
      )

      const decision = recoveryFactory.createDecisionFromBugRecord(bug, {
        graphCoverage: 'minimal',
      })

      expect(decision.reason).toBe('graph-retrieval-miss')
      expect(decision.action).toBe('replan')
      expect(decision.context.graphCoverage).toBe('minimal')
    })
  })

  describe('重试到重新规划的转换', () => {
    test('重复验证失败应该从重试转为重新规划', () => {
      // 创建多个验证失败
      const bug1 = bugBrainHooks.verifyGate.recordVerifyFailure('失败1', {})
      const bug2 = bugBrainHooks.verifyGate.recordVerifyFailure('失败2', {})
      const bug3 = bugBrainHooks.verifyGate.recordVerifyFailure('失败3', {})

      // 基于最后一个 bug 创建决策（有失败历史）
      const decision = recoveryFactory.createDecisionFromBugRecord(bug3)

      expect(decision.reason).toBe('verify-failure')
      expect(decision.action).toBe('replan') // 重复失败应该重新规划
      expect(decision.input.failureHistory?.sameTypeFailures).toBe(3)
    })

    test('重复工具失败应该从重试转为中止', () => {
      // 创建多个工具失败
      const bug1 = bugBrainHooks.toolExecution.recordToolFailure('失败1', {})
      const bug2 = bugBrainHooks.toolExecution.recordToolFailure('失败2', {})
      const bug3 = bugBrainHooks.toolExecution.recordToolFailure('失败3', {})

      const decision = recoveryFactory.createDecisionFromBugRecord(bug3)

      expect(decision.reason).toBe('tool-failure')
      expect(decision.action).toBe('abort') // 重复工具失败应该中止
    })
  })

  describe('恢复计划生成', () => {
    test('重试动作应该生成重试计划', () => {
      const bug = bugBrainHooks.toolExecution.recordToolFailure('工具失败', {})
      const decision = recoveryFactory.createDecisionFromBugRecord(bug)
      const plan = recoveryFactory.generateRecoveryPlan(decision)

      expect(plan.steps.length).toBeGreaterThan(0)
      expect(plan.steps.some(step =>
        step.action.includes('retry') || step.description.includes('重试')
      )).toBe(true)
      expect(plan.estimatedDuration).toBeGreaterThan(0)
    })

    test('重新规划动作应该生成重新规划计划', () => {
      const bug = bugBrainHooks.reviewerSubagent.recordReviewerRejection('审核拒绝', {})
      const decision = recoveryFactory.createDecisionFromBugRecord(bug)
      const plan = recoveryFactory.generateRecoveryPlan(decision)

      expect(plan.steps.some(step =>
        step.action.includes('analyze') || step.description.includes('分析')
      )).toBe(true)
      expect(plan.steps.some(step =>
        step.action.includes('generate') || step.description.includes('生成')
      )).toBe(true)
    })
  })

  describe('上下文质量影响', () => {
    test('高质量上下文应该提高重试置信度', () => {
      const bug = bugBrainHooks.verifyGate.recordVerifyFailure('验证失败', {})

      const highQualityContext = {
        memoryAvailability: 'high',
        graphCoverage: 'full',
        contextHygieneScore: 0.9,
      }

      const decision = recoveryFactory.createDecisionFromBugRecord(bug, highQualityContext)

      expect(decision.confidence).toBeGreaterThan(0.7)
      expect(decision.action).toBe('retry')
    })

    test('低质量上下文应该降低重试倾向', () => {
      const bug = bugBrainHooks.verifyGate.recordVerifyFailure('验证失败', {})

      const lowQualityContext = {
        memoryAvailability: 'low',
        graphCoverage: 'minimal',
        contextHygieneScore: 0.2,
      }

      const decision = recoveryFactory.createDecisionFromBugRecord(bug, lowQualityContext)

      // 低质量上下文可能选择重新规划而不是重试
      expect(decision.action).toBe('replan')
    })
  })
})