/**
 * Reviewer Recovery Harness 测试
 * 验证审核拒绝场景的恢复决策
 */

import { RecoveryDecisionFactory } from '../../../dsxu/engine/recovery/integration'
import { bugBrainHooks } from '../../../dsxu/engine/bug-brain/integration'
import { defaultBugBrain } from '../../../dsxu/engine/bug-brain/index'

describe('Reviewer Recovery Harness', () => {
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

  describe('审核拒绝场景', () => {
    test('代码质量审核拒绝应该重新规划', () => {
      const bug = bugBrainHooks.reviewerSubagent.recordReviewerRejection(
        '代码可读性不足',
        {
          subagentType: 'code-quality',
          criteria: ['readability', 'maintainability', 'complexity'],
          score: 0.65,
          threshold: 0.8,
          error: new Error('分数低于阈值'),
        }
      )

      const decision = recoveryFactory.createDecisionFromBugRecord(bug, {
        sessionId: 'code-review-session',
        taskType: 'code-refactoring',
      })

      expect(decision.reason).toBe('reviewer-rejection')
      expect(decision.action).toBe('replan')
      expect(decision.context.sessionId).toBe('code-review-session')
      expect(decision.context.taskType).toBe('code-refactoring')
      expect(decision.input.bugRecord?.context.environment?.subagentType).toBe('code-quality')
    })

    test('测试覆盖率审核拒绝应该重新规划', () => {
      const bug = bugBrainHooks.reviewerSubagent.recordReviewerRejection(
        '测试覆盖率不足',
        {
          subagentType: 'test-coverage',
          criteria: ['unit-test', 'integration-test', 'edge-cases'],
          score: 0.7,
          threshold: 0.9,
        }
      )

      const decision = recoveryFactory.createDecisionFromBugRecord(bug)

      expect(decision.reason).toBe('reviewer-rejection')
      expect(decision.action).toBe('replan')
      expect(decision.input.bugRecord?.context.environment?.subagentType).toBe('test-coverage')
    })

    test('安全审核拒绝应该请求人工干预', () => {
      const bug = bugBrainHooks.reviewerSubagent.recordReviewerRejection(
        '安全漏洞检测',
        {
          subagentType: 'security',
          criteria: ['vulnerability', 'authentication', 'authorization'],
          score: 0.4,
          threshold: 0.8,
        }
      )

      const decision = recoveryFactory.createDecisionFromBugRecord(bug, {
        taskPriority: 'critical',
      })

      expect(decision.reason).toBe('reviewer-rejection')
      expect(decision.action).toBe('ask-human') // 安全相关应该请求人工
      expect(decision.context.taskPriority).toBe('critical')
    })
  })

  describe('Verify Review Chain 拒绝', () => {
    test('验证链审核失败应该重新规划', () => {
      const bug = bugBrainHooks.verifyReviewChain.recordReviewFailure(
        '多阶段验证未通过',
        {
          reviewStage: 'final',
          reviewerType: 'expert',
          feedback: '整体架构需要优化',
          error: new Error('综合评分不足'),
        }
      )

      const decision = recoveryFactory.createDecisionFromBugRecord(bug, {
        memorySummary: '多次验证失败历史',
      })

      expect(decision.reason).toBe('reviewer-rejection')
      expect(decision.action).toBe('replan')
      expect(decision.context.memorySummary).toBe('多次验证失败历史')
      expect(decision.input.bugRecord?.context.environment?.reviewStage).toBe('final')
    })
  })

  describe('重复审核拒绝', () => {
    test('同一代码多次审核拒绝应该升级处理', () => {
      // 创建多个审核拒绝
      const bug1 = bugBrainHooks.reviewerSubagent.recordReviewerRejection('拒绝1', {
        subagentType: 'code-quality',
        score: 0.6,
      })
      const bug2 = bugBrainHooks.reviewerSubagent.recordReviewerRejection('拒绝2', {
        subagentType: 'code-quality',
        score: 0.55,
      })
      const bug3 = bugBrainHooks.reviewerSubagent.recordReviewerRejection('拒绝3', {
        subagentType: 'code-quality',
        score: 0.5,
      })

      // 基于最后一个 bug 创建决策
      const decision = recoveryFactory.createDecisionFromBugRecord(bug3)

      expect(decision.reason).toBe('reviewer-rejection')
      expect(['escalate', 'ask-human']).toContain(decision.action) // 重复拒绝应该升级
      expect(decision.input.failureHistory?.sameTypeFailures).toBe(3)
    })

    test('不同审核类型重复拒绝应该重新规划', () => {
      // 创建不同类型的审核拒绝
      const bug1 = bugBrainHooks.reviewerSubagent.recordReviewerRejection('质量拒绝', {
        subagentType: 'code-quality',
      })
      const bug2 = bugBrainHooks.reviewerSubagent.recordReviewerRejection('测试拒绝', {
        subagentType: 'test-coverage',
      })
      const bug3 = bugBrainHooks.verifyReviewChain.recordReviewFailure('验证链拒绝', {})

      const decision = recoveryFactory.createDecisionFromBugRecord(bug3)

      expect(decision.reason).toBe('reviewer-rejection')
      expect(decision.action).toBe('replan') // 不同类型可能还是重新规划
    })
  })

  describe('上下文影响审核恢复', () => {
    test('高质量上下文应该提高重新规划置信度', () => {
      const bug = bugBrainHooks.reviewerSubagent.recordReviewerRejection('审核拒绝', {})

      const highQualityContext = {
        memoryAvailability: 'high',
        graphCoverage: 'full',
        contextHygieneScore: 0.85,
        memorySummary: '有类似成功案例',
      }

      const decision = recoveryFactory.createDecisionFromBugRecord(bug, highQualityContext)

      expect(decision.confidence).toBeGreaterThan(0.7)
      expect(decision.action).toBe('replan')
    })

    test('低质量上下文应该倾向于人工干预', () => {
      const bug = bugBrainHooks.reviewerSubagent.recordReviewerRejection('审核拒绝', {})

      const lowQualityContext = {
        memoryAvailability: 'low',
        graphCoverage: 'minimal',
        contextHygieneScore: 0.3,
        memorySummary: '无相关经验',
      }

      const decision = recoveryFactory.createDecisionFromBugRecord(bug, lowQualityContext)

      expect(decision.action).toBe('ask-human') // 低质量上下文应该请求人工
    })
  })

  describe('恢复计划生成', () => {
    test('审核拒绝应该生成代码改进计划', () => {
      const bug = bugBrainHooks.reviewerSubagent.recordReviewerRejection(
        '代码质量需要改进',
        {
          subagentType: 'code-quality',
          criteria: ['readability', 'maintainability'],
          score: 0.6,
          threshold: 0.8,
        }
      )

      const decision = recoveryFactory.createDecisionFromBugRecord(bug)
      const plan = recoveryFactory.generateRecoveryPlan(decision)

      expect(plan.steps.length).toBeGreaterThan(0)
      expect(plan.steps.some(step =>
        step.description.includes('分析') || step.description.includes('失败原因')
      )).toBe(true)
      expect(plan.steps.some(step =>
        step.description.includes('改进') || step.description.includes('代码质量')
      )).toBe(true)
      expect(plan.fallbackAction).toBe('ask-human')
    })

    test('安全审核拒绝应该生成安全修复计划', () => {
      const bug = bugBrainHooks.reviewerSubagent.recordReviewerRejection(
        '发现安全漏洞',
        {
          subagentType: 'security',
          criteria: ['vulnerability'],
          score: 0.3,
          threshold: 0.8,
        }
      )

      const decision = recoveryFactory.createDecisionFromBugRecord(bug)
      const plan = recoveryFactory.generateRecoveryPlan(decision)

      // 安全相关计划应该有特殊步骤
      expect(plan.steps.some(step =>
        step.description.includes('安全') ||
        step.description.includes('漏洞') ||
        step.description.includes('修复')
      )).toBe(true)
    })
  })

  describe('端到端审核恢复流程', () => {
    test('完整审核恢复流程', () => {
      // 1. 记录审核拒绝
      const bug = bugBrainHooks.reviewerSubagent.recordReviewerRejection(
        '端到端测试拒绝',
        {
          subagentType: 'code-quality',
          criteria: ['readability', 'performance'],
          score: 0.5,
          threshold: 0.75,
          sessionId: 'e2e-session',
          taskId: 'e2e-task',
        }
      )

      // 2. 分析 bug
      const analysis = defaultBugBrain.analyzeBug(bug.id)
      expect(analysis).toBeDefined()

      // 3. 创建恢复决策
      const decision = recoveryFactory.createDecisionFromBugRecord(bug, {
        sessionId: 'e2e-session',
        taskId: 'e2e-task',
        taskPriority: 'high',
      })

      expect(decision.reason).toBe('reviewer-rejection')
      expect(decision.action).toBe('replan')

      // 4. 生成恢复计划
      const plan = recoveryFactory.generateRecoveryPlan(decision)

      expect(plan.steps.length).toBeGreaterThan(0)
      expect(plan.estimatedDuration).toBeGreaterThan(0)

      // 5. 验证决策历史
      const history = recoveryFactory.getDecisionHistory()
      expect(history.length).toBe(1)
      expect(history[0].decisionId).toBe(decision.decisionId)
    })
  })
})