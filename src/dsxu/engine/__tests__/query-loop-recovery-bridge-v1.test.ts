import { createRecoveryBridge } from '../query-loop'
import type { RecoveryDecision } from '../recovery/recovery-types-v3'

describe('Query Loop Recovery Bridge V1', () => {
  const recoveryBridge = createRecoveryBridge()

  test('query-loop 能消费 RecoveryDecision', () => {
    // 模拟工具失败场景
    const context = {
      failureCount: 2,
      lastError: 'Tool execution failed: permission denied',
      bugDescription: 'Bash工具执行失败'
    }

    const decision = recoveryBridge.getRecoveryDecisionForQueryLoop(context)

    // 验证返回的是结构化决策
    expect(decision).toBeDefined()
    expect(decision).toHaveProperty('action')
    expect(decision).toHaveProperty('reason')
    expect(decision).toHaveProperty('confidence')

    // 验证决策类型
    expect(typeof decision.action).toBe('string')
    expect(typeof decision.reason).toBe('string')
    expect(typeof decision.confidence).toBe('number')

    // 验证置信度范围
    expect(decision.confidence).toBeGreaterThan(0)
    expect(decision.confidence).toBeLessThanOrEqual(1)

    console.log(`测试通过: query-loop消费RecoveryDecision, 动作: ${decision.action}, 原因: ${decision.reason}, 置信度: ${decision.confidence}`)
  })

  test('verify失败能触发 Recovery Bridge', () => {
    // 模拟验证失败场景
    const context = {
      failureCount: 1,
      lastError: 'Verification failed: test assertions not met',
      verification: {
        passed: false,
        errors: ['Test assertion failed: expected 5 but got 3']
      },
      bugDescription: '单元测试验证失败'
    }

    const decision = recoveryBridge.getRecoveryDecisionForQueryLoop(context)

    // 验证决策存在
    expect(decision).toBeDefined()
    expect(decision.action).toBeDefined()
    expect(decision.reason).toBeDefined()

    // 验证失败类型被识别
    expect(decision.reason).toBe('verify-failure')

    // 验证决策合理
    expect(['retry', 'replan', 'rollback']).toContain(decision.action)

    console.log(`测试通过: verify失败触发RecoveryBridge, 动作: ${decision.action}, 原因: ${decision.reason}`)
  })

  test('tool失败能触发 Recovery Bridge', () => {
    // 模拟工具失败场景
    const context = {
      failureCount: 3,
      lastError: 'Bash tool failed with exit code 1',
      bugDescription: 'Bash工具连续失败'
    }

    const decision = recoveryBridge.getRecoveryDecisionForQueryLoop(context)

    // 验证决策存在
    expect(decision).toBeDefined()
    expect(decision.action).toBeDefined()
    expect(decision.reason).toBeDefined()

    // 验证失败类型被识别（可能是tool-failure或repeated-failure）
    expect(['tool-failure', 'repeated-failure']).toContain(decision.reason)

    // 验证决策合理
    expect(['retry', 'replan', 'rollback', 'ask-human', 'abort']).toContain(decision.action)

    console.log(`测试通过: tool失败触发RecoveryBridge, 动作: ${decision.action}, 原因: ${decision.reason}, 失败次数: ${context.failureCount}`)
  })

  test('context不足能触发 Recovery Bridge', () => {
    // 模拟上下文不足场景
    const context = {
      failureCount: 1,
      lastError: 'Insufficient context for decision making',
      bugDescription: '上下文信息不足，无法做出决策'
    }

    const decision = recoveryBridge.getRecoveryDecisionForQueryLoop(context)

    // 验证决策存在
    expect(decision).toBeDefined()
    expect(decision.action).toBeDefined()
    expect(decision.reason).toBeDefined()

    // 验证失败类型被识别（可能是context-insufficiency或其他）
    expect(decision.reason).toBeDefined()
    expect(typeof decision.reason).toBe('string')

    // 验证决策合理
    expect(['retry', 'replan', 'rollback', 'ask-human', 'abort']).toContain(decision.action)

    console.log(`测试通过: context不足触发RecoveryBridge, 动作: ${decision.action}, 原因: ${decision.reason}`)
  })

  test('结果不是字符串，而是结构化动作', () => {
    // 测试快速决策接口
    const decision = recoveryBridge.quickRecoveryDecision('tool-failure', 2)

    // 验证是结构化对象
    expect(decision).toBeDefined()
    expect(typeof decision).toBe('object')
    expect(Array.isArray(decision)).toBe(false)

    // 验证结构完整
    expect(decision).toHaveProperty('action')
    expect(decision).toHaveProperty('reason')
    expect(decision).toHaveProperty('confidence')

    // 验证原因匹配
    expect(decision.reason).toBe('tool-failure')

    // 验证可选字段
    if (decision.retryCount !== undefined) {
      expect(typeof decision.retryCount).toBe('number')
    }
    if (decision.maxRetries !== undefined) {
      expect(typeof decision.maxRetries).toBe('number')
    }
    if (decision.message !== undefined) {
      expect(typeof decision.message).toBe('string')
    }

    console.log(`测试通过: 结果是结构化动作, 动作: ${decision.action}, 原因: ${decision.reason}, 置信度: ${decision.confidence}`)
  })
})