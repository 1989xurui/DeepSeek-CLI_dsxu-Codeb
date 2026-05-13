/**
 * Repeated Failure Harness 测试
 * 验证重复失败场景的恢复决策
 */

import { RecoveryDecisionFactory } from '../../../dsxu/engine/recovery/integration'
import { bugBrainHooks } from '../../../dsxu/engine/bug-brain/integration'
import { defaultBugBrain } from '../../../dsxu/engine/bug-brain/index'

describe('Repeated Failure Recovery Harness', () => {
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

  describe('重复验证失败', () => {
    test('多次验证失败应该触发重新规划', () => {
      // 创建多个验证失败
      const bug1 = bugBrainHooks.verifyGate.recordVerifyFailure('格式错误1', {
        code: 'const x=1',
        rule: 'indent',
      })
      const bug2 = bugBrainHooks.verifyGate.recordVerifyFailure('格式错误2', {
        code: 'function test(){}',
        rule: 'space',
      })
      const bug3 = bugBrainHooks.verifyGate.recordVerifyFailure('格式错误3', {
        code: 'if(true){console.log()}',
        rule: 'brace',
      })

      // 基于最后一个 bug 创建决策
      const decision = recoveryFactory.createDecisionFromBugRecord(bug3, {
        sessionId: 'repeated-verify-session',
      })

      expect(decision.reason).toBe('verify-failure')
      expect(decision.action).toBe('replan') // 重复验证失败应该重新规划
      expect(decision.input.failureHistory?.sameTypeFailures).toBe(3)
      expect(decision.context.sessionId).toBe('repeated-verify-session')
    })

    test('超过阈值的重复验证失败应该回滚', () => {
      // 创建超过阈值的验证失败
      for (let i = 1; i <= 5; i++) {
        bugBrainHooks.verifyGate.recordVerifyFailure(`失败${i}`, {
          code: `test${i}`,
        })
      }

      const allBugs = defaultBugBrain.getAllBugs()
      const lastBug = allBugs[allBugs.length - 1]

      const decision = recoveryFactory.createDecisionFromBugRecord(lastBug)

      expect(decision.reason).toBe('verify-failure')
      expect(['rollback', 'escalate']).toContain(decision.action) // 超过阈值应该回滚或升级
      expect(decision.input.failureHistory?.sameTypeFailures).toBe(5)
    })
  })

  describe('重复工具失败', () => {
    test('多次工具失败应该中止', () => {
      // 创建多个工具失败
      const bug1 = bugBrainHooks.toolExecution.recordToolFailure('工具失败1', {
        toolName: 'git',
        error: new Error('网络错误'),
      })
      const bug2 = bugBrainHooks.toolExecution.recordToolFailure('工具失败2', {
        toolName: 'git',
        error: new Error('权限错误'),
      })
      const bug3 = bugBrainHooks.toolExecution.recordToolFailure('工具失败3', {
        toolName: 'git',
        error: new Error('未知错误'),
      })

      const decision = recoveryFactory.createDecisionFromBugRecord(bug3)

      expect(decision.reason).toBe('tool-failure')
      expect(decision.action).toBe('abort') // 重复工具失败应该中止
      expect(decision.input.failureHistory?.sameTypeFailures).toBe(3)
    })

    test('关键工具重复失败应该升级', () => {
      // 创建关键工具失败
      const bug1 = bugBrainHooks.toolExecution.recordToolFailure('数据库失败1', {
        toolName: 'database',
        error: new Error('连接失败'),
      })
      const bug2 = bugBrainHooks.toolExecution.recordToolFailure('数据库失败2', {
        toolName: 'database',
        error: new Error('查询超时'),
      })

      const decision = recoveryFactory.createDecisionFromBugRecord(bug2, {
        taskPriority: 'critical',
      })

      expect(decision.reason).toBe('tool-failure')
      expect(decision.action).toBe('escalate') // 关键工具失败应该升级
      expect(decision.context.taskPriority).toBe('critical')
    })
  })

  describe('重复上下文不足', () => {
    test('多次上下文不足应该请求人工', () => {
      // 创建多个上下文不足
      const bug1 = bugBrainHooks.contextRouting.recordContextInsufficiency('不足1', {
        requiredContext: ['A', 'B'],
        availableContext: ['A'],
      })
      const bug2 = bugBrainHooks.contextRouting.recordContextInsufficiency('不足2', {
        requiredContext: ['C', 'D'],
        availableContext: ['C'],
      })
      const bug3 = bugBrainHooks.contextRouting.recordContextInsufficiency('不足3', {
        requiredContext: ['E', 'F'],
        availableContext: ['E'],
      })

      const decision = recoveryFactory.createDecisionFromBugRecord(bug3, {
        memoryAvailability: 'low',
      })

      expect(decision.reason).toBe('context-insufficiency')
      expect(decision.action).toBe('ask-human') // 重复上下文不足应该请求人工
      expect(decision.context.memoryAvailability).toBe('low')
    })
  })

  describe('混合类型重复失败', () => {
    test('不同类型重复失败应该重新规划', () => {
      // 创建不同类型的失败
      const bug1 = bugBrainHooks.verifyGate.recordVerifyFailure('验证失败', {})
      const bug2 = bugBrainHooks.toolExecution.recordToolFailure('工具失败', {})
      const bug3 = bugBrainHooks.contextRouting.recordContextInsufficiency('上下文不足', {})

      const decision = recoveryFactory.createDecisionFromBugRecord(bug3)

      expect(decision.reason).toBe('context-insufficiency')
      expect(decision.action).toBe('replan') // 混合类型可能还是重新规划
      expect(decision.input.failureHistory?.recentFailures).toBe(3)
    })

    test('模式化重复失败应该生成修复模式', () => {
      // 创建模式化的重复失败
      for (let i = 1; i <= 4; i++) {
        bugBrainHooks.verifyGate.recordVerifyFailure(`模式失败${i}`, {
          code: `pattern${i}`,
          rule: 'same-rule',
        })
      }

      // 触发 pattern 检测
      const patterns = defaultBugBrain.getPatterns()
      expect(patterns.length).toBeGreaterThan(0)

      const pattern = patterns[0]
      const fixPatterns = defaultBugBrain.getFixPatterns()
      expect(fixPatterns.length).toBeGreaterThan(0)

      // 基于 pattern 创建决策
      const decision = recoveryFactory.createDecisionFromBugPattern(pattern)

      expect(decision.reason).toBe('verify-failure')
      expect(decision.input.bugPattern?.frequency).toBe(4)
      expect(decision.input.fixPattern).toBeDefined()
    })
  })

  describe('时间相关的重复失败', () => {
    test('短时间内重复失败应该升级', () => {
      const now = Date.now()

      // 模拟短时间内连续失败
      const bug1 = bugBrainHooks.verifyGate.recordVerifyFailure('快速失败1', {})
      const bug2 = bugBrainHooks.verifyGate.recordVerifyFailure('快速失败2', {})

      // 修改时间戳为很近的时间
      Object.defineProperty(bug1, 'timestamp', { value: now - 1000 })
      Object.defineProperty(bug2, 'timestamp', { value: now - 500 })

      const decision = recoveryFactory.createDecisionFromBugRecord(bug2)

      // 短时间内重复失败应该触发更积极的恢复动作
      expect(['rollback', 'escalate', 'ask-human']).toContain(decision.action)
    })

    test('长时间间隔重复失败可能还是重试', () => {
      const oldTime = Date.now() - 24 * 60 * 60 * 1000 // 1天前

      const oldBug = bugBrainHooks.verifyGate.recordVerifyFailure('旧失败', {})
      Object.defineProperty(oldBug, 'timestamp', { value: oldTime })

      const newBug = bugBrainHooks.verifyGate.recordVerifyFailure('新失败', {})

      const decision = recoveryFactory.createDecisionFromBugRecord(newBug)

      // 长时间间隔可能还是重试
      expect(decision.action).toBe('retry')
    })
  })

  describe('恢复计划生成', () => {
    test('重复失败应该生成回滚计划', () => {
      // 创建重复失败
      for (let i = 1; i <= 4; i++) {
        bugBrainHooks.verifyGate.recordVerifyFailure(`重复失败${i}`, {})
      }

      const allBugs = defaultBugBrain.getAllBugs()
      const lastBug = allBugs[allBugs.length - 1]

      const decision = recoveryFactory.createDecisionFromBugRecord(lastBug)
      const plan = recoveryFactory.generateRecoveryPlan(decision)

      expect(plan.steps.length).toBeGreaterThan(0)
      expect(plan.steps.some(step =>
        step.action.includes('rollback') || step.description.includes('回滚')
      )).toBe(true)
      expect(plan.fallbackAction).toBe('ask-human')
    })

    test('升级动作应该生成升级计划', () => {
      const bug = bugBrainHooks.toolExecution.recordToolFailure('关键失败', {
        toolName: 'critical-tool',
      })

      // 模拟需要升级的决策
      const decision = recoveryFactory.createDecisionFromBugRecord(bug, {
        taskPriority: 'critical',
      })

      // 强制设置为升级动作
      decision.action = 'escalate'

      const plan = recoveryFactory.generateRecoveryPlan(decision)

      expect(plan.steps.some(step =>
        step.action.includes('escalate') || step.description.includes('升级')
      )).toBe(true)
    })
  })

  describe('端到端重复失败恢复', () => {
    test('完整重复失败恢复流程', () => {
      // 1. 记录多个重复失败
      const bugs = []
      for (let i = 1; i <= 3; i++) {
        const bug = bugBrainHooks.verifyGate.recordVerifyFailure(`重复失败${i}`, {
          code: `test${i}`,
          sessionId: 'repeat-session',
          taskId: 'repeat-task',
        })
        bugs.push(bug)
      }

      // 2. 检测模式
      const patterns = defaultBugBrain.getPatterns()
      expect(patterns.length).toBeGreaterThan(0)

      // 3. 基于最后一个 bug 创建决策
      const lastBug = bugs[bugs.length - 1]
      const decision = recoveryFactory.createDecisionFromBugRecord(lastBug, {
        sessionId: 'repeat-session',
        taskId: 'repeat-task',
      })

      expect(decision.reason).toBe('verify-failure')
      expect(decision.action).toBe('replan')
      expect(decision.input.failureHistory?.sameTypeFailures).toBe(3)

      // 4. 生成恢复计划
      const plan = recoveryFactory.generateRecoveryPlan(decision)

      expect(plan.steps.length).toBeGreaterThan(0)
      expect(plan.estimatedDuration).toBeGreaterThan(0)

      // 5. 验证历史
      const history = recoveryFactory.getDecisionHistory()
      expect(history.length).toBe(1)
    })
  })
})