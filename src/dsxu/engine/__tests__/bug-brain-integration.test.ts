/**
 * Bug Brain 集成钩子测试
 */

import { bugBrainHooks, quickRecordBug } from '../bug-brain/integration'
import { defaultBugBrain } from '../bug-brain'

describe('BugBrain 集成钩子', () => {
  beforeEach(() => {
    // 清空默认实例的记录
    const bugBrain = defaultBugBrain as any
    bugBrain.records.clear()
    bugBrain.patterns.clear()
    bugBrain.fixPatterns.clear()
  })

  describe('Verify Gate 钩子', () => {
    test('应该记录验证失败', () => {
      const bug = bugBrainHooks.verifyGate.recordVerifyFailure(
        '代码格式验证失败',
        {
          code: 'const x = 1',
          filePath: '/test/file.ts',
          rule: 'indent',
          error: new Error('缩进错误'),
        }
      )

      expect(bug).toBeDefined()
      expect(bug.type).toBe('verify-failure')
      expect(bug.severity).toBe('medium')
      expect(bug.source).toBe('verify-gate')
      expect(bug.context.codeSnippet).toBe('const x = 1')
      expect(bug.context.filePath).toBe('/test/file.ts')
      expect(bug.context.errorStack).toContain('缩进错误')
    })
  })

  describe('Verify Review Chain 钩子', () => {
    test('应该记录审核失败', () => {
      const bug = bugBrainHooks.verifyReviewChain.recordReviewFailure(
        '代码审核未通过',
        {
          reviewStage: 'initial',
          reviewerType: 'expert',
          feedback: '代码质量不足',
          error: new Error('审核失败'),
        }
      )

      expect(bug).toBeDefined()
      expect(bug.type).toBe('reviewer-rejection')
      expect(bug.severity).toBe('medium')
      expect(bug.source).toBe('verify-review-chain')
      expect(bug.context.environment?.reviewStage).toBe('initial')
      expect(bug.context.userInput).toBe('代码质量不足')
    })
  })

  describe('Reviewer Subagent 钩子', () => {
    test('应该记录审核拒绝', () => {
      const bug = bugBrainHooks.reviewerSubagent.recordReviewerRejection(
        '子代理拒绝修改',
        {
          subagentType: 'code-quality',
          criteria: ['readability', 'maintainability'],
          score: 0.6,
          threshold: 0.8,
          error: new Error('分数低于阈值'),
        }
      )

      expect(bug).toBeDefined()
      expect(bug.type).toBe('reviewer-rejection')
      expect(bug.severity).toBe('low')
      expect(bug.source).toBe('reviewer-subagent')
      expect(bug.context.environment?.subagentType).toBe('code-quality')
      expect(bug.context.environment?.score).toBe(0.6)
    })
  })

  describe('Memory 钩子', () => {
    test('应该记录内存失败', () => {
      const bug = bugBrainHooks.memory.recordMemoryFailure(
        '内存读取失败',
        {
          memoryType: 'working',
          operation: 'read',
          key: 'user:123:preferences',
          error: new Error('键不存在'),
        }
      )

      expect(bug).toBeDefined()
      expect(bug.type).toBe('memory-insufficiency')
      expect(bug.severity).toBe('low')
      expect(bug.source).toBe('memory')
      expect(bug.context.environment?.memoryType).toBe('working')
      expect(bug.context.environment?.key).toBe('user:123:preferences')
    })
  })

  describe('Episode Memory 钩子', () => {
    test('应该记录片段内存失败', () => {
      const bug = bugBrainHooks.episodeMemory.recordEpisodeFailure(
        '片段存储失败',
        {
          episodeId: 'episode-123',
          stage: 'storage',
          error: new Error('存储空间不足'),
        }
      )

      expect(bug).toBeDefined()
      expect(bug.type).toBe('memory-insufficiency')
      expect(bug.severity).toBe('medium')
      expect(bug.source).toBe('episode-memory')
      expect(bug.context.environment?.episodeId).toBe('episode-123')
    })
  })

  describe('Graph Retrieval 钩子', () => {
    test('应该记录检索失败', () => {
      const bug = bugBrainHooks.graphRetrieval.recordRetrievalMiss(
        '图检索未找到相关节点',
        {
          query: '用户认证',
          expectedResults: 5,
          actualResults: 0,
          relevanceThreshold: 0.7,
        }
      )

      expect(bug).toBeDefined()
      expect(bug.type).toBe('graph-retrieval-miss')
      expect(bug.severity).toBe('low')
      expect(bug.source).toBe('graph-retrieval')
      expect(bug.context.retrievalContext?.query).toBe('用户认证')
      expect(bug.context.retrievalContext?.retrievedNodes).toBe(0)
    })
  })

  describe('Tool Execution 钩子', () => {
    test('应该记录工具执行失败', () => {
      const bug = bugBrainHooks.toolExecution.recordToolFailure(
        '工具执行错误',
        {
          toolName: 'git',
          parameters: { command: 'commit' },
          error: new Error('提交失败'),
        }
      )

      expect(bug).toBeDefined()
      expect(bug.type).toBe('tool-failure')
      expect(bug.severity).toBe('medium')
      expect(bug.source).toBe('tool-execution')
      expect(bug.context.environment?.toolName).toBe('git')
    })

    test('应该将超时标记为高严重性', () => {
      const bug = bugBrainHooks.toolExecution.recordToolFailure(
        '工具执行超时',
        {
          toolName: 'npm',
          parameters: { command: 'install' },
          timeout: true,
        }
      )

      expect(bug).toBeDefined()
      expect(bug.type).toBe('tool-failure')
      expect(bug.severity).toBe('high')
      expect(bug.context.environment?.timeout).toBe(true)
    })
  })

  describe('Context Routing 钩子', () => {
    test('应该记录上下文不足', () => {
      const bug = bugBrainHooks.contextRouting.recordContextInsufficiency(
        '上下文信息不足，无法路由',
        {
          requiredContext: ['user-intent', 'task-history'],
          availableContext: ['user-intent'],
          routingDecision: 'fallback',
        }
      )

      expect(bug).toBeDefined()
      expect(bug.type).toBe('context-insufficiency')
      expect(bug.severity).toBe('medium')
      expect(bug.source).toBe('context-routing')
      expect(bug.context.environment?.requiredContext).toEqual(['user-intent', 'task-history'])
      expect(bug.context.environment?.availableContext).toEqual(['user-intent'])
    })
  })

  describe('快速记录工具', () => {
    test('应该能够快速记录bug', () => {
      const bug = quickRecordBug(
        'verify-failure',
        'high',
        'verify-gate',
        '快速验证失败',
        {
          codeSnippet: 'test code',
          filePath: '/test.ts',
        }
      )

      expect(bug).toBeDefined()
      expect(bug.type).toBe('verify-failure')
      expect(bug.severity).toBe('high')
      expect(bug.source).toBe('verify-gate')
      expect(bug.description).toBe('快速验证失败')
    })
  })

  describe('集成验证', () => {
    test('所有钩子应该使用同一个BugBrain实例', () => {
      const bug1 = bugBrainHooks.verifyGate.recordVerifyFailure('测试1', {})
      const bug2 = bugBrainHooks.toolExecution.recordToolFailure('测试2', {})
      const bug3 = quickRecordBug('reviewer-rejection', 'low', 'reviewer-subagent', '测试3', {})

      const allBugs = defaultBugBrain.getAllBugs()
      expect(allBugs).toHaveLength(3)

      const bugIds = allBugs.map(b => b.id)
      expect(bugIds).toContain(bug1.id)
      expect(bugIds).toContain(bug2.id)
      expect(bugIds).toContain(bug3.id)
    })

    test('应该能够通过默认实例访问所有记录', () => {
      bugBrainHooks.memory.recordMemoryFailure('内存测试', {})
      bugBrainHooks.graphRetrieval.recordRetrievalMiss('检索测试', {})

      const stats = defaultBugBrain.getStatistics()
      expect(stats.totalBugs).toBe(2)
      expect(stats.bySource.memory).toBe(1)
      expect(stats.bySource['graph-retrieval']).toBe(1)
    })
  })
})