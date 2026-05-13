import { ScenarioMultiSliceV3Harness } from '../../integration/harness/scenario-multi-slice-v3-harness'

describe('Scenario Multi-Slice V3', () => {
  const harness = new ScenarioMultiSliceV3Harness()

  test('至少两个 slice / task', () => {
    const result = harness.runMultiSliceScenario({
      sessionId: 'test-multi-001',
      slices: [
        {
          id: 'slice-1',
          description: '数据验证任务',
          filePath: '/src/validation/validator.ts',
        },
        {
          id: 'slice-2',
          description: '数据处理任务',
          filePath: '/src/processing/processor.ts',
          dependencies: ['slice-1'],
        },
      ],
    })

    // 验证切片数量
    expect(result.slices).toBeDefined()
    expect(Array.isArray(result.slices)).toBe(true)
    expect(result.slices.length).toBeGreaterThanOrEqual(2)

    // 验证切片结构
    result.slices.forEach(slice => {
      expect(slice).toHaveProperty('id')
      expect(slice).toHaveProperty('description')
      expect(slice).toHaveProperty('filePath')
      expect(slice).toHaveProperty('status')
      expect(['pending', 'running', 'completed', 'failed']).toContain(slice.status)
    })

    // 验证切片ID唯一性
    const sliceIds = result.slices.map(s => s.id)
    const uniqueIds = new Set(sliceIds)
    expect(uniqueIds.size).toBe(sliceIds.length)
  })

  test('graph retrieval / context routing 被使用', () => {
    const result = harness.runMultiSliceScenario({
      sessionId: 'test-multi-002',
      slices: [
        {
          id: 'slice-a',
          description: '配置加载',
          filePath: '/src/config/loader.ts',
        },
        {
          id: 'slice-b',
          description: '缓存初始化',
          filePath: '/src/cache/init.ts',
          dependencies: ['slice-a'],
        },
        {
          id: 'slice-c',
          description: '服务启动',
          filePath: '/src/server/start.ts',
          dependencies: ['slice-a', 'slice-b'],
          shouldFail: true,
          errorType: 'tool-failure',
        },
      ],
    })

    // 验证 Graph Retrieval
    expect(result.crossSliceRetrieval).toBeDefined()
    expect(result.crossSliceRetrieval.crossSliceContexts).toBeDefined()
    expect(Array.isArray(result.crossSliceRetrieval.crossSliceContexts)).toBe(true)

    // 验证跨切片上下文
    expect(result.crossSliceRetrieval.crossSliceContexts.length).toBeGreaterThan(0)
    result.crossSliceRetrieval.crossSliceContexts.forEach(context => {
      expect(context).toHaveProperty('sliceId')
      expect(context).toHaveProperty('context')
      expect(context).toHaveProperty('relevance')
      expect(context.relevance).toBeGreaterThan(0.5)
      expect(context.relevance).toBeLessThanOrEqual(1)
    })

    // 验证依赖图
    expect(result.crossSliceRetrieval.dependencyGraph).toBeDefined()
    expect(typeof result.crossSliceRetrieval.dependencyGraph).toBe('object')
    expect(Object.keys(result.crossSliceRetrieval.dependencyGraph).length).toBeGreaterThan(0)
  })

  test('一个 slice 失败后出现恢复动作', () => {
    const result = harness.runMultiSliceScenario({
      sessionId: 'test-multi-003',
      slices: [
        {
          id: 'slice-x',
          description: '用户认证',
          filePath: '/src/auth/authenticator.ts',
        },
        {
          id: 'slice-y',
          description: '权限检查',
          filePath: '/src/auth/permissions.ts',
          dependencies: ['slice-x'],
          shouldFail: true,
          errorType: 'verify-failure',
        },
        {
          id: 'slice-z',
          description: '日志记录',
          filePath: '/src/logging/logger.ts',
          dependencies: ['slice-x', 'slice-y'],
        },
      ],
    })

    // 验证有切片失败
    const failedSlices = result.slices.filter(slice => slice.status === 'failed')
    expect(failedSlices.length).toBeGreaterThan(0)

    // 验证恢复决策存在
    expect(result.recoveryDecisions).toBeDefined()
    expect(typeof result.recoveryDecisions).toBe('object')

    // 验证失败切片有恢复决策
    failedSlices.forEach(slice => {
      expect(slice.recoveryDecision).toBeDefined()
      expect(result.recoveryDecisions[slice.id]).toBeDefined()

      const decision = slice.recoveryDecision!
      expect(decision.action).toBeDefined()
      expect(decision.reason).toBeDefined()
      expect(decision.confidence).toBeGreaterThan(0.2)

      // 验证恢复动作合理
      expect(['retry', 'replan', 'rollback', 'abort', 'ask-human']).toContain(decision.action)
    })

    // 验证至少有一个恢复决策
    expect(Object.keys(result.recoveryDecisions).length).toBeGreaterThan(0)
  })

  test('session / memory / compact 至少一个输入点被消费', () => {
    const result = harness.runMultiSliceScenario({
      sessionId: 'test-multi-004',
      slices: [
        {
          id: 'slice-1',
          description: '任务A',
          filePath: '/src/task/a.ts',
          shouldFail: true,
          errorType: 'context-insufficiency',
        },
        {
          id: 'slice-2',
          description: '任务B',
          filePath: '/src/task/b.ts',
          dependencies: ['slice-1'],
        },
      ],
    })

    // 验证 DSXU 吸收线
    expect(result.dsxuInputsHit).toBeDefined()
    expect(Array.isArray(result.dsxuInputsHit)).toBe(true)
    expect(result.dsxuInputsHit.length).toBeGreaterThan(0)

    // 验证必须包含 session/memory（multi-slice场景总是有）
    expect(result.dsxuInputsHit).toContain('session/memory')

    // 验证可能包含的其他输入点
    const validInputs = ['session/memory', 'compact/retrieval', 'verify/reviewer', 'structured-decision']
    result.dsxuInputsHit.forEach(input => {
      expect(validInputs).toContain(input)
    })

    // 验证 Session Memory 存在
    expect(result.sessionMemory).toBeDefined()
    expect(result.sessionMemory.sessionId).toBe('test-multi-004')
    expect(result.sessionMemory.slices.length).toBe(2)
    expect(Array.isArray(result.sessionMemory.crossSliceInsights)).toBe(true)

    // 验证至少命中2个输入点
    expect(result.dsxuInputsHit.length).toBeGreaterThanOrEqual(2)
  })

  test('场景覆盖至少4类主线模块', () => {
    const result = harness.runMultiSliceScenario({
      sessionId: 'test-multi-005',
      slices: [
        {
          id: 'slice-alpha',
          description: '初始化模块',
          filePath: '/src/init/module.ts',
        },
        {
          id: 'slice-beta',
          description: '核心处理模块',
          filePath: '/src/core/processor.ts',
          dependencies: ['slice-alpha'],
          shouldFail: true,
          errorType: 'tool-failure',
        },
        {
          id: 'slice-gamma',
          description: '结果输出模块',
          filePath: '/src/output/writer.ts',
          dependencies: ['slice-alpha', 'slice-beta'],
        },
      ],
    })

    // 验证模块覆盖
    expect(result.modules).toBeDefined()
    expect(Array.isArray(result.modules)).toBe(true)
    expect(result.modules.length).toBeGreaterThanOrEqual(4)

    // 验证包含必要模块
    const requiredModules = ['Graph Retrieval', 'Context Routing', 'Session/Memory', 'Recovery Planner']
    const hasRequiredModules = requiredModules.every(module => result.modules.includes(module))
    expect(hasRequiredModules).toBe(true)

    // 验证场景完成状态
    expect(result.completed).toBeDefined()
    expect(typeof result.completed).toBe('boolean')

    // 验证跨切片功能
    expect(result.crossSliceRetrieval.crossSliceContexts.length).toBeGreaterThan(0)
    expect(Object.keys(result.crossSliceRetrieval.dependencyGraph).length).toBe(3)
  })
})