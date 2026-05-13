/**
 * Recovery Planner 集成测试
 * 测试与 Bug Brain 等模块的集成
 */

import { RecoveryDecisionFactory } from '../recovery/integration'
import { defaultBugBrain } from '../bug-brain'
import { bugBrainHooks } from '../bug-brain/integration'

describe('Recovery Planner Integration', () => {
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

  describe('与 Bug Brain 集成', () => {
    test('应该基于 Bug Record 创建恢复决策', () => {
      // 创建测试 bug
      const bug = bugBrainHooks.verifyGate.recordVerifyFailure(
        '代码格式验证失败',
        {
          code: 'const x = 1',
          filePath: '/test/file.ts',
          error: new Error('缩进错误'),
        }
      )

      // 基于 bug record 创建恢复决策
      const decision = recoveryFactory.createDecisionFromBugRecord(bug, {
        sessionId: 'test-session',
        taskId: 'test-task',
      })

      expect(decision).toBeDefined()
      expect(decision.reason).toBe('verify-failure')
      expect(decision.context.sessionId).toBe('test-session')
      expect(decision.input.bugRecord?.id).toBe(bug.id)
      expect(['retry', 'replan']).toContain(decision.action)
    })

    test('应该基于 Bug Pattern 创建恢复决策', () => {
      // 创建多个相同类型的 bug 以生成 pattern
      bugBrainHooks.verifyGate.recordVerifyFailure('失败1', {})
      bugBrainHooks.verifyGate.recordVerifyFailure('失败2', {})
      bugBrainHooks.verifyGate.recordVerifyFailure('失败3', {})

      const patterns = defaultBugBrain.getPatterns()
      expect(patterns.length).toBeGreaterThan(0)

      const pattern = patterns[0]

      // 基于 bug pattern 创建恢复决策
      const decision = recoveryFactory.createDecisionFromBugPattern(pattern, {
        memoryAvailability: 'high',
      })

      expect(decision).toBeDefined()
      expect(decision.reason).toBe('verify-failure')
      expect(decision.context.memoryAvailability).toBe('high')
      expect(decision.input.bugPattern?.patternId).toBe(pattern.patternId)
    })

    test('应该基于 Fix Pattern 创建恢复计划', () => {
      // 创建 bug 和 fix pattern
      const bug = bugBrainHooks.reviewerSubagent.recordReviewerRejection('审核拒绝', {})

      // 触发 pattern 检测（需要多个相同类型的 bug）
      bugBrainHooks.reviewerSubagent.recordReviewerRejection('审核拒绝2', {})
      bugBrainHooks.reviewerSubagent.recordReviewerRejection('审核拒绝3', {})

      const fixPatterns = defaultBugBrain.getFixPatterns()
      expect(fixPatterns.length).toBeGreaterThan(0)

      const fixPattern = fixPatterns[0]

      // 创建决策
      const decision = recoveryFactory.createDecisionFromBugRecord(bug)

      // 基于 fix pattern 创建恢复计划
      const plan = recoveryFactory.createPlanFromFixPattern(fixPattern, decision)

      expect(plan).toBeDefined()
      expect(plan.decisionId).toBe(decision.decisionId)
      expect(plan.steps.length).toBeGreaterThan(0)
      expect(plan.steps.some(step =>
        step.description.includes('analyze') || step.action.includes('analyze')
      )).toBe(true)
    })
  })

  describe('上下文提取', () => {
    test('应该从 Bug Context 提取恢复上下文', () => {
      const bug = bugBrainHooks.verifyGate.recordVerifyFailure(
        '测试',
        {
          code: 'test',
          sessionId: 'extract-session',
          taskId: 'extract-task',
          compactLevel: 'light',
        }
      )

      const decision = recoveryFactory.createDecisionFromBugRecord(bug)

      expect(decision.context.sessionId).toBe('extract-session')
      expect(decision.context.taskId).toBe('extract-task')
      expect(decision.context.compactLevel).toBe('light')
    })

    test('应该合并额外上下文', () => {
      const bug = bugBrainHooks.toolExecution.recordToolFailure('工具失败', {})

      const additionalContext = {
        sessionId: 'extra-session',
        taskPriority: 'high' as const,
        memorySummary: '测试内存摘要',
      }

      const decision = recoveryFactory.createDecisionFromBugRecord(bug, additionalContext)

      expect(decision.context.sessionId).toBe('extra-session')
      expect(decision.context.taskPriority).toBe('high')
      expect(decision.context.memorySummary).toBe('测试内存摘要')
    })
  })

  describe('失败历史计算', () => {
    test('应该计算正确的失败历史', () => {
      // 创建多个 bug 记录
      const bug1 = bugBrainHooks.verifyGate.recordVerifyFailure('失败1', {})
      const bug2 = bugBrainHooks.verifyGate.recordVerifyFailure('失败2', {})
      const bug3 = bugBrainHooks.toolExecution.recordToolFailure('工具失败', {})

      // 基于第一个 bug 创建决策
      const decision = recoveryFactory.createDecisionFromBugRecord(bug1)

      expect(decision.input.failureHistory).toBeDefined()
      expect(decision.input.failureHistory?.sameTypeFailures).toBe(2) // 两个 verify-failure
      expect(decision.input.failureHistory?.recentFailures).toBe(3) // 总共三个失败
    })
  })

  describe('决策历史', () => {
    test('应该记录决策历史', () => {
      // 先清理历史（通过创建新的 factory）
      const freshFactory = new (require('../recovery/integration').RecoveryDecisionFactory)({
        debug: false,
        logDecisions: false,
      })

      const bug1 = bugBrainHooks.verifyGate.recordVerifyFailure('失败1', {})
      const bug2 = bugBrainHooks.reviewerSubagent.recordReviewerRejection('拒绝1', {})

      const decision1 = freshFactory.createDecisionFromBugRecord(bug1)
      const decision2 = freshFactory.createDecisionFromBugRecord(bug2)

      const history = freshFactory.getDecisionHistory()

      expect(history.length).toBe(2)
      expect(history.map(d => d.decisionId)).toContain(decision1.decisionId)
      expect(history.map(d => d.decisionId)).toContain(decision2.decisionId)
    })
  })

  describe('端到端场景', () => {
    test('完整流程：bug记录 → 分析 → 决策 → 计划', () => {
      // 1. 记录 bug
      const bug = bugBrainHooks.contextRouting.recordContextInsufficiency(
        '上下文不足',
        {
          requiredContext: ['A', 'B', 'C'],
          availableContext: ['A'],
          sessionId: 'e2e-session',
          taskId: 'e2e-task',
        }
      )

      // 2. 分析 bug（通过 bug brain）
      const analysis = defaultBugBrain.analyzeBug(bug.id)
      expect(analysis).toBeDefined()

      // 3. 创建恢复决策
      const decision = recoveryFactory.createDecisionFromBugRecord(bug, {
        sessionId: 'e2e-session',
        taskId: 'e2e-task',
      })

      expect(decision.reason).toBe('context-insufficiency')
      expect(decision.action).toBe('replan')

      // 4. 生成恢复计划
      const plan = recoveryFactory.generateRecoveryPlan(decision)

      expect(plan).toBeDefined()
      expect(plan.steps.length).toBeGreaterThan(0)
      expect(plan.steps.some(step =>
        step.description.includes('gather') || step.action.includes('gather')
      )).toBe(true)

      // 5. 验证决策历史（使用新的 factory 避免累积）
      const freshFactory = new (require('../recovery/integration').RecoveryDecisionFactory)({
        debug: false,
        logDecisions: false,
      })

      // 重新创建决策
      const freshDecision = freshFactory.createDecisionFromBugRecord(bug)
      const freshHistory = freshFactory.getDecisionHistory()
      expect(freshHistory.length).toBe(1)
      expect(freshHistory[0].decisionId).toBe(freshDecision.decisionId)
    })

    test('重复失败场景应该触发升级', () => {
      // 创建多个相同类型的失败
      const bug1 = bugBrainHooks.verifyGate.recordVerifyFailure('失败1', {})
      const bug2 = bugBrainHooks.verifyGate.recordVerifyFailure('失败2', {})
      const bug3 = bugBrainHooks.verifyGate.recordVerifyFailure('失败3', {})
      const bug4 = bugBrainHooks.verifyGate.recordVerifyFailure('失败4', {})

      // 基于最后一个 bug 创建决策（有多次失败历史）
      const decision = recoveryFactory.createDecisionFromBugRecord(bug4)

      // 重复失败应该触发升级或回滚
      expect(['rollback', 'escalate', 'ask-human']).toContain(decision.action)
      expect(decision.input.failureHistory?.sameTypeFailures).toBe(4)
    })
  })
})