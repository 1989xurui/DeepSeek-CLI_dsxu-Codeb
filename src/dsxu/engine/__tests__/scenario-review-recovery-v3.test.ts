import { ScenarioReviewRecoveryV3Harness } from '../../integration/harness/scenario-review-recovery-v3-harness'

describe('Scenario Review Recovery V3', () => {
  const harness = new ScenarioReviewRecoveryV3Harness()

  test('reviewer rejection 进入 Bug Brain', () => {
    const result = harness.runReviewRecoveryScenario({
      filePath: '/src/auth/validator.ts',
      reviewerFeedback: 'Security vulnerability: potential SQL injection',
      severity: 'high',
      failureCount: 1,
      sessionSummary: '安全评审会话',
    })

    // 验证 Bug Brain 分类
    expect(result.bugBrainResult).toBeDefined()
    expect(result.bugBrainResult.category).toBeDefined()
    expect(typeof result.bugBrainResult.category).toBe('string')

    // 验证分类合理
    expect(['security-issue', 'performance-issue', 'logic-error', 'code-quality-issue', 'style-issue'])
      .toContain(result.bugBrainResult.category)

    // 验证优先级
    expect(result.bugBrainResult.priority).toBeGreaterThanOrEqual(1)
    expect(result.bugBrainResult.priority).toBeLessThanOrEqual(3)

    // 验证建议动作
    expect(result.bugBrainResult.suggestedActions).toBeDefined()
    expect(Array.isArray(result.bugBrainResult.suggestedActions)).toBe(true)
    expect(result.bugBrainResult.suggestedActions.length).toBeGreaterThan(0)
  })

  test('Recovery Planner 给出 replan / ask-human / rollback 之一', () => {
    const result = harness.runReviewRecoveryScenario({
      filePath: '/src/data/processor.ts',
      reviewerFeedback: 'Performance issue: inefficient algorithm',
      severity: 'medium',
      failureCount: 2,
      sessionSummary: '性能评审会话',
    })

    // 验证 Recovery 决策
    expect(result.recoveryDecision).toBeDefined()
    expect(result.recoveryDecision.action).toBeDefined()
    expect(result.recoveryDecision.reason).toBeDefined()

    // 验证决策是 replan, ask-human 或 rollback 之一
    expect(['replan', 'ask-human', 'rollback']).toContain(result.recoveryDecision.action)

    // 验证原因
    expect(result.recoveryDecision.reason).toBe('reviewer-rejection')

    // 验证置信度
    expect(result.recoveryDecision.confidence).toBeGreaterThan(0.2)
    expect(result.recoveryDecision.confidence).toBeLessThanOrEqual(1)
  })

  test('结构化记录完整', () => {
    const result = harness.runReviewRecoveryScenario({
      filePath: '/src/ui/components/Button.tsx',
      reviewerFeedback: 'Code style: inconsistent naming',
      severity: 'low',
      failureCount: 1,
      sessionSummary: 'UI组件评审',
    })

    const decision = result.recoveryDecision

    // 验证基本结构
    expect(decision).toHaveProperty('action')
    expect(decision).toHaveProperty('reason')
    expect(decision).toHaveProperty('confidence')

    // 验证元数据
    expect(decision.metadata).toBeDefined()
    expect(typeof decision.metadata).toBe('object')
    expect(decision.metadata).toHaveProperty('timestamp')
    expect(typeof decision.metadata.timestamp).toBe('number')

    // 验证可选字段
    if (decision.message !== undefined) {
      expect(typeof decision.message).toBe('string')
      expect(decision.message.length).toBeGreaterThan(0)
    }

    // 验证 Context Routing 结果
    expect(result.contextRouting).toBeDefined()
    expect(result.contextRouting.bestMatch).toBeDefined()
    expect(result.contextRouting.bestMatch?.relevance).toBeGreaterThan(0.5)
  })

  test('reviewer / rollback 输入点被消费', () => {
    const result = harness.runReviewRecoveryScenario({
      filePath: '/src/core/engine.ts',
      reviewerFeedback: 'Architecture issue: tight coupling detected',
      severity: 'high',
      failureCount: 3,
      sessionSummary: '架构评审会话',
    })

    // 验证 DSXU 吸收线
    expect(result.dsxuInputsHit).toBeDefined()
    expect(Array.isArray(result.dsxuInputsHit)).toBe(true)

    // 验证必须包含 reviewer 输入点
    expect(result.dsxuInputsHit).toContain('verify/reviewer')

    // 验证可能包含的其他输入点
    const validInputs = ['session/memory', 'compact/retrieval', 'verify/reviewer', 'structured-decision']
    result.dsxuInputsHit.forEach(input => {
      expect(validInputs).toContain(input)
    })

    // 验证至少命中2个输入点
    expect(result.dsxuInputsHit.length).toBeGreaterThanOrEqual(2)
  })

  test('场景覆盖至少4类主线模块', () => {
    const result = harness.runReviewRecoveryScenario({
      filePath: '/src/integration/api.ts',
      reviewerFeedback: 'Integration issue: missing error handling',
      severity: 'medium',
      failureCount: 2,
      sessionSummary: '集成测试评审',
    })

    // 验证模块覆盖
    expect(result.modules).toBeDefined()
    expect(Array.isArray(result.modules)).toBe(true)
    expect(result.modules.length).toBeGreaterThanOrEqual(4)

    // 验证包含必要模块
    const requiredModules = ['Bug Brain', 'Context Routing', 'Recovery Planner', 'Session/Memory']
    const hasRequiredModules = requiredModules.every(module => result.modules.includes(module))
    expect(hasRequiredModules).toBe(true)

    // 验证场景完成状态
    expect(result.completed).toBeDefined()
    expect(typeof result.completed).toBe('boolean')

    // 验证 Context Routing 有效性
    expect(result.contextRouting.routedContexts.length).toBeGreaterThan(0)
    expect(result.contextRouting.bestMatch?.relevance).toBeGreaterThan(0.5)
  })
})