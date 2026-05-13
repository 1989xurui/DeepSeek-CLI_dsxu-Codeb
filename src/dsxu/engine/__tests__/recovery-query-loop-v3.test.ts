import { createRecoveryBridge } from '../query-loop'
import type {
  RecoveryReason,
  RecoveryAction,
  RecoveryDecision,
  RecoveryContext,
} from '../query-loop'

describe('Recovery Query Loop V3 Integration', () => {
  test('query-loop 或最小桥接层能够消费 RecoveryDecision', () => {
    const bridge = createRecoveryBridge()

    // 测试桥接函数存在
    expect(bridge).toBeDefined()
    expect(typeof bridge.getRecoveryDecisionForQueryLoop).toBe('function')
    expect(typeof bridge.quickRecoveryDecision).toBe('function')
    expect(typeof bridge.shouldTriggerRecovery).toBe('function')

    // 测试获取恢复决策
    const decision = bridge.getRecoveryDecisionForQueryLoop({
      failureCount: 1,
      lastError: '测试错误',
      bugDescription: 'query-loop 测试bug',
    })

    expect(decision).toBeDefined()
    expect(decision.action).toBeDefined()
    expect(decision.reason).toBeDefined()
    expect(decision.confidence).toBeGreaterThan(0)

    // 验证决策类型
    expect(['retry', 'replan', 'rollback', 'abort', 'ask-human']).toContain(decision.action)
  })

  test('verify/tool/context/repeated-failure 中至少 2 类能被主链拿到', () => {
    const bridge = createRecoveryBridge()

    // 测试 verify-failure
    const verifyDecision = bridge.quickRecoveryDecision('verify-failure', 1)
    expect(verifyDecision.reason).toBe('verify-failure')
    expect(verifyDecision.action).toBeDefined()

    // 测试 tool-failure
    const toolDecision = bridge.quickRecoveryDecision('tool-failure', 2)
    expect(toolDecision.reason).toBe('tool-failure')
    expect(toolDecision.action).toBeDefined()

    // 测试 context-insufficiency
    const contextDecision = bridge.quickRecoveryDecision('context-insufficiency', 1)
    expect(contextDecision.reason).toBe('context-insufficiency')
    expect(contextDecision.action).toBeDefined()

    // 测试 repeated-failure
    const repeatedDecision = bridge.quickRecoveryDecision('repeated-failure', 4)
    expect(repeatedDecision.reason).toBe('repeated-failure')
    expect(repeatedDecision.action).toBeDefined()

    // 验证至少2种类型能正常工作
    const decisions = [verifyDecision, toolDecision, contextDecision, repeatedDecision]
    const uniqueReasons = new Set(decisions.map(d => d.reason))
    expect(uniqueReasons.size).toBeGreaterThanOrEqual(2)
  })

  test('不要求完整执行恢复，只要求"主链可接"', () => {
    const bridge = createRecoveryBridge()

    // 测试恢复触发检查
    expect(bridge.shouldTriggerRecovery(0)).toBe(false)
    expect(bridge.shouldTriggerRecovery(1)).toBe(true)
    expect(bridge.shouldTriggerRecovery(0, 'some failure')).toBe(true)
    expect(bridge.shouldTriggerRecovery(0, 'success')).toBe(false)

    // 测试不同类型输入的决策生成
    const testCases = [
      {
        input: {
          failureCount: 1,
          lastError: '验证失败',
          verification: { passed: false, errors: ['测试失败'] },
          bugDescription: '验证失败场景',
        },
        expectedReason: 'verify-failure' as RecoveryReason,
      },
      {
        input: {
          failureCount: 2,
          lastError: '工具执行超时',
          bugDescription: '工具失败场景',
        },
        expectedReason: 'tool-failure' as RecoveryReason,
      },
      {
        input: {
          failureCount: 3,
          lastError: '上下文不足',
          bugDescription: '上下文不足场景',
        },
        expectedReason: 'context-insufficiency' as RecoveryReason,
      },
    ]

    // 验证每个测试用例都能生成决策
    for (const testCase of testCases) {
      const decision = bridge.getRecoveryDecisionForQueryLoop(testCase.input)
      expect(decision).toBeDefined()
      expect(decision.reason).toBeDefined()
      expect(decision.action).toBeDefined()

      // 验证决策包含必要信息
      expect(decision.confidence).toBeGreaterThanOrEqual(0.2)
      expect(decision.confidence).toBeLessThanOrEqual(1)

      if (decision.message) {
        expect(typeof decision.message).toBe('string')
      }
    }

    // 验证导出类型可用
    const testReason: RecoveryReason = 'reviewer-rejection'
    const testAction: RecoveryAction = 'replan'

    expect(testReason).toBe('reviewer-rejection')
    expect(testAction).toBe('replan')

    // 验证决策接口
    const testDecision: RecoveryDecision = {
      action: testAction,
      reason: testReason,
      confidence: 0.7,
    }

    expect(testDecision.action).toBe('replan')
    expect(testDecision.reason).toBe('reviewer-rejection')
  })

  test('桥接层完整性验证', () => {
    const bridge = createRecoveryBridge()

    // 验证所有桥接函数都返回预期类型
    const shouldTrigger = bridge.shouldTriggerRecovery(1, 'error')
    expect(typeof shouldTrigger).toBe('boolean')

    const quickDecision = bridge.quickRecoveryDecision('verify-failure', 1)
    expect(quickDecision).toHaveProperty('action')
    expect(quickDecision).toHaveProperty('reason')
    expect(quickDecision).toHaveProperty('confidence')

    const contextDecision = bridge.getRecoveryDecisionForQueryLoop({
      failureCount: 2,
      lastError: '综合错误',
      reviewer: { accepted: false, feedback: '需要改进' },
      bugDescription: '桥接完整性测试',
    })

    expect(contextDecision).toBeDefined()
    expect(contextDecision.reason).toBeDefined()

    // 验证决策逻辑一致性
    expect(contextDecision.confidence).toBeGreaterThan(0)
    expect(contextDecision.confidence).toBeLessThanOrEqual(1)

    // 验证元数据
    expect(contextDecision.metadata).toBeDefined()
    expect(contextDecision.metadata).toHaveProperty('timestamp')
  })
})