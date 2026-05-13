/**
 * Context Miss Harness 测试
 * 验证 context-routing 和 graph-retrieval 的失败捕获
 */

import { bugBrainHooks } from '../../../dsxu/engine/bug-brain/integration'
import { defaultBugBrain } from '../../../dsxu/engine/bug-brain/index'

describe('Context Miss Harness', () => {
  beforeEach(() => {
    // 清空默认实例的记录
    const bugBrain = defaultBugBrain as any
    bugBrain.records.clear()
    bugBrain.patterns.clear()
    bugBrain.fixPatterns.clear()
  })

  test('应该捕获 context-routing 上下文不足', () => {
    const bug = bugBrainHooks.contextRouting.recordContextInsufficiency(
      '缺少用户意图上下文，无法确定任务优先级',
      {
        requiredContext: ['user-intent', 'task-history', 'preferences'],
        availableContext: ['user-intent'],
        routingDecision: 'fallback-to-default'
      }
    )

    expect(bug).toBeDefined()
    expect(bug.type).toBe('context-insufficiency')
    expect(bug.source).toBe('context-routing')
    expect(bug.severity).toBe('medium')
    expect(bug.context.environment?.requiredContext).toEqual(['user-intent', 'task-history', 'preferences'])
    expect(bug.context.environment?.availableContext).toEqual(['user-intent'])
  })

  test('应该捕获 graph-retrieval 检索未命中', () => {
    const bug = bugBrainHooks.graphRetrieval.recordRetrievalMiss(
      '未找到相关代码模式',
      {
        query: '用户认证中间件实现',
        expectedResults: 5,
        actualResults: 0,
        relevanceThreshold: 0.7
      }
    )

    expect(bug).toBeDefined()
    expect(bug.type).toBe('graph-retrieval-miss')
    expect(bug.source).toBe('graph-retrieval')
    expect(bug.severity).toBe('low')
    expect(bug.context.retrievalContext?.query).toBe('用户认证中间件实现')
    expect(bug.context.retrievalContext?.retrievedNodes).toBe(0)
  })

  test('应该捕获 memory 读取失败', () => {
    const bug = bugBrainHooks.memory.recordMemoryFailure(
      '工作内存读取失败',
      {
        memoryType: 'working',
        operation: 'read',
        key: 'session:123:current-task',
        error: new Error('Key not found in memory store')
      }
    )

    expect(bug).toBeDefined()
    expect(bug.type).toBe('memory-insufficiency')
    expect(bug.source).toBe('memory')
    expect(bug.context.environment?.memoryType).toBe('working')
  })

  test('应该分析上下文相关bug并提供修复建议', () => {
    const bug = bugBrainHooks.contextRouting.recordContextInsufficiency(
      '测试上下文不足',
      {
        requiredContext: ['A', 'B'],
        availableContext: ['A']
      }
    )

    const analysis = defaultBugBrain.analyzeBug(bug.id)
    expect(analysis).toBeDefined()
    expect(analysis?.confidence).toBeGreaterThan(0)

    // 检查是否有潜在的修复模式
    const fixPatterns = defaultBugBrain.getFixPatterns()
    if (fixPatterns.length > 0) {
      const relevantFix = fixPatterns.find(f =>
        f.steps.some(s => s.action.includes('context') || s.description.includes('上下文'))
      )
      expect(relevantFix).toBeDefined()
    }
  })

  test('混合上下文失败应该正确分类', () => {
    // 记录多种类型的上下文相关失败
    bugBrainHooks.contextRouting.recordContextInsufficiency('不足1', {})
    bugBrainHooks.graphRetrieval.recordRetrievalMiss('检索失败1', {})
    bugBrainHooks.memory.recordMemoryFailure('内存失败1', {})

    const stats = defaultBugBrain.getStatistics()
    expect(stats.byCategory['context-insufficiency']).toBe(1)
    expect(stats.byCategory['graph-retrieval-miss']).toBe(1)
    expect(stats.byCategory['memory-insufficiency']).toBe(1)
  })
})