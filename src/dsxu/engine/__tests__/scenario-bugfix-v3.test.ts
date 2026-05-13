import { ScenarioBugfixV3Harness } from '../../integration/harness/scenario-bugfix-v3-harness'

describe('Scenario Bugfix V3', () => {
  const harness = new ScenarioBugfixV3Harness()

  test('verify failure / tool failure 之一进入 Bug Brain', () => {
    const result = harness.runBugfixScenario({
      bugDescription: '单元测试验证失败',
      errorType: 'verify-failure',
      filePath: '/src/utils/validator.ts',
      failureCount: 1,
      sessionId: 'test-session-001',
    })

    // 验证 Bug Brain 分类
    expect(result.bugCategory).toBeDefined()
    expect(typeof result.bugCategory).toBe('string')
    expect(result.bugCategory).not.toBe('unknown-error')

    // 验证错误类型被识别
    expect(result.bugCategory).toMatch(/verification-failure|tool-execution-failure|syntax-error|logic-error/)
  })

  test('Recovery Planner 给出 retry / replan', () => {
    const result = harness.runBugfixScenario({
      bugDescription: '工具执行超时',
      errorType: 'tool-timeout',
      filePath: '/src/formatter/index.ts',
      failureCount: 1, // 改为1次失败，应该返回retry
      sessionId: 'test-session-002',
    })

    // 验证 Recovery 决策
    expect(result.recoveryDecision).toBeDefined()
    expect(result.recoveryDecision.action).toBeDefined()
    expect(result.recoveryDecision.reason).toBeDefined()

    // 验证决策是 retry 或 replan（bug修复场景应该返回这些）
    expect(['retry', 'replan']).toContain(result.recoveryDecision.action)

    // 验证置信度
    expect(result.recoveryDecision.confidence).toBeGreaterThan(0.2)
    expect(result.recoveryDecision.confidence).toBeLessThanOrEqual(1)
  })

  test('RecoveryDecision 结构完整', () => {
    const result = harness.runBugfixScenario({
      bugDescription: '语法错误修复',
      errorType: 'syntax-error',
      filePath: '/src/core/processor.ts',
      failureCount: 1,
      sessionId: 'test-session-003',
    })

    const decision = result.recoveryDecision

    // 验证基本结构
    expect(decision).toHaveProperty('action')
    expect(decision).toHaveProperty('reason')
    expect(decision).toHaveProperty('confidence')

    // 验证类型
    expect(typeof decision.action).toBe('string')
    expect(typeof decision.reason).toBe('string')
    expect(typeof decision.confidence).toBe('number')

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
    if (decision.metadata !== undefined) {
      expect(typeof decision.metadata).toBe('object')
      expect(decision.metadata).toHaveProperty('timestamp')
    }
  })

  test('至少一个 DSXU 输入点被消费', () => {
    const result = harness.runBugfixScenario({
      bugDescription: '逻辑错误修复',
      errorType: 'logic-error',
      filePath: '/src/algorithm/solver.ts',
      failureCount: 3,
      sessionId: 'test-session-004',
    })

    // 验证 DSXU 吸收线
    expect(result.dsxuInputsHit).toBeDefined()
    expect(Array.isArray(result.dsxuInputsHit)).toBe(true)
    expect(result.dsxuInputsHit.length).toBeGreaterThan(0)

    // 验证至少命中一个输入点
    const validInputs = ['session/memory', 'compact/retrieval', 'verify/reviewer', 'structured-decision']
    const hasValidInput = result.dsxuInputsHit.some(input => validInputs.includes(input))
    expect(hasValidInput).toBe(true)

    // 验证场景完成状态
    expect(result.completed).toBeDefined()
    expect(typeof result.completed).toBe('boolean')
  })

  test('场景覆盖至少4类主线模块', () => {
    const result = harness.runBugfixScenario({
      bugDescription: '综合测试场景',
      errorType: 'verify-failure',
      filePath: '/src/test/integration.ts',
      failureCount: 2,
      sessionId: 'test-session-005',
    })

    // 验证模块覆盖
    expect(result.modules).toBeDefined()
    expect(Array.isArray(result.modules)).toBe(true)
    expect(result.modules.length).toBeGreaterThanOrEqual(4)

    // 验证包含必要模块
    const requiredModules = ['Bug Brain', 'Graph Retrieval', 'Recovery Planner', 'Context Routing']
    const hasRequiredModules = requiredModules.every(module => result.modules.includes(module))
    expect(hasRequiredModules).toBe(true)

    // 验证 Graph Retrieval 结果
    expect(result.graphRetrieval).toBeDefined()
    expect(result.graphRetrieval.retrievalScore).toBeGreaterThan(0)
    expect(result.graphRetrieval.retrievalScore).toBeLessThanOrEqual(1)
    expect(Array.isArray(result.graphRetrieval.relatedFiles)).toBe(true)
  })
})