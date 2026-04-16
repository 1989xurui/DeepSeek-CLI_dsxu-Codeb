/**
 * AgentSummaryManager 测试
 */

import { describe, it, expect } from 'vitest'
import { AgentSummaryManager } from '../session'
import type { QueryResult, QueryEvent } from '../types'

describe('AgentSummaryManager', () => {
  it('应该创建和更新摘要', () => {
    const manager = new AgentSummaryManager()
    const summary = manager.createSummary(
      'test-agent-1',
      'parent-session-1',
      'running',
      ['发现了一些东西'],
      ['执行了操作1', '执行了操作2'],
      [],
      { totalTurns: 5, toolsUsed: ['Read', 'Write'], success: true }
    )

    expect(summary.agentId).toBe('test-agent-1')
    expect(summary.parentSessionId).toBe('parent-session-1')
    expect(summary.status).toBe('running')
    expect(summary.keyFindings).toEqual(['发现了一些东西'])
    expect(summary.actions).toEqual(['执行了操作1', '执行了操作2'])
    expect(summary.metadata.totalTurns).toBe(5)
    expect(summary.metadata.toolsUsed).toEqual(['Read', 'Write'])

    // 更新摘要
    const updated = manager.updateSummary('parent-session-1', 'test-agent-1', {
      status: 'completed',
      endedAt: Date.now() + 1000,
      metadata: { totalTurns: 10, success: true }
    })

    expect(updated).toBe(true)
    const retrieved = manager.getAgentSummary('parent-session-1', 'test-agent-1')
    expect(retrieved?.status).toBe('completed')
    expect(retrieved?.metadata.totalTurns).toBe(10)
  })

  it('应该生成标准摘要文本', () => {
    const manager = new AgentSummaryManager()
    const summary = manager.createSummary(
      'test-agent-2',
      'parent-session-2',
      'completed',
      ['关键发现1', '关键发现2'],
      ['操作1', '操作2'],
      ['错误1'],
      { totalTurns: 8, toolsUsed: ['Read', 'Edit', 'Bash'], success: true }
    )

    const text = manager.generateSummaryText(summary)
    expect(text).toContain('# 智能体摘要: test-agent-2')
    expect(text).toContain('状态: completed')
    expect(text).toContain('关键发现')
    expect(text).toContain('执行操作')
    expect(text).toContain('错误信息')
    expect(text).toContain('使用工具: Read, Edit, Bash')
  })

  it('应该从查询结果生成摘要', () => {
    const manager = new AgentSummaryManager()

    const mockResult: QueryResult = {
      finalMessage: '任务完成，成功修复了bug',
      exitReason: 'end_turn',
      turns: 15,
      totalUsage: { inputTokens: 1000, outputTokens: 500 },
      finalGear: 2,
      messages: []
    }

    const mockEvents: QueryEvent[] = [
      { type: 'tool_start', toolName: 'Read', toolUseId: '1', input: { file_path: 'test.ts' } },
      { type: 'tool_start', toolName: 'Edit', toolUseId: '2', input: { file_path: 'test.ts', old_string: 'old', new_string: 'new' } },
      { type: 'tool_result', toolName: 'Read', toolUseId: '1', result: { toolUseId: '1', content: 'file content', isError: false } },
      { type: 'tool_result', toolName: 'Edit', toolUseId: '2', result: { toolUseId: '2', content: 'file edited', isError: false } },
      { type: 'error', error: new Error('测试错误'), recoverable: true }
    ]

    const summary = manager.generateSummaryFromQueryResult(
      'query-agent-1',
      'parent-session-3',
      mockResult,
      mockEvents
    )

    expect(summary.agentId).toBe('query-agent-1')
    expect(summary.parentSessionId).toBe('parent-session-3')
    expect(summary.status).toBe('completed')
    expect(summary.keyFindings[0]).toContain('最终结果: 任务完成')
    expect(summary.actions).toContain('执行了 2 次工具调用')
    expect(summary.errors).toContain('遇到 1 个错误')
    expect(summary.metadata.toolsUsed).toEqual(['Read', 'Edit'])
    expect(summary.metadata.totalTurns).toBe(15)
    expect(summary.metadata.performance?.toolCalls).toBe(2)
    expect(summary.metadata.performance?.tokensUsed).toBe(1500)
  })

  it('应该处理不同的退出原因', () => {
    const manager = new AgentSummaryManager()

    const testCases = [
      { exitReason: 'max_turns' as const, expectedStatus: 'timeout' as const },
      { exitReason: 'aborted' as const, expectedStatus: 'aborted' as const },
      { exitReason: 'max_errors' as const, expectedStatus: 'failed' as const },
      { exitReason: 'end_turn' as const, expectedStatus: 'completed' as const }
    ]

    for (const testCase of testCases) {
      const result: QueryResult = {
        finalMessage: '测试消息',
        exitReason: testCase.exitReason,
        turns: 10,
        totalUsage: { inputTokens: 500, outputTokens: 250 },
        finalGear: 2,
        messages: []
      }

      const summary = manager.generateSummaryFromQueryResult(
        `agent-${testCase.exitReason}`,
        'parent-session',
        result
      )

      expect(summary.status).toBe(testCase.expectedStatus)
    }
  })

  it('应该管理会话摘要列表', () => {
    const manager = new AgentSummaryManager()

    // 为同一个会话创建多个摘要
    manager.createSummary('agent-1', 'session-1', 'completed', [], [], [])
    manager.createSummary('agent-2', 'session-1', 'failed', [], [], [])
    manager.createSummary('agent-3', 'session-2', 'running', [], [], [])

    const session1Summaries = manager.getSessionSummaries('session-1')
    expect(session1Summaries.length).toBe(2)
    expect(session1Summaries.map(s => s.agentId)).toEqual(['agent-1', 'agent-2'])

    const session2Summaries = manager.getSessionSummaries('session-2')
    expect(session2Summaries.length).toBe(1)
    expect(session2Summaries[0].agentId).toBe('agent-3')

    const nonExistent = manager.getSessionSummaries('session-3')
    expect(nonExistent.length).toBe(0)
  })

  it('应该支持不同的摘要模板', () => {
    const minimalManager = new AgentSummaryManager({ template: 'minimal' })
    const standardManager = new AgentSummaryManager({ template: 'standard' })

    const summary = minimalManager.createSummary(
      'minimal-agent',
      'session-1',
      'failed',
      ['关键发现'],
      [],
      ['发生了错误']
    )

    const minimalText = minimalManager.generateSummaryText(summary)
    const standardText = standardManager.generateSummaryText(summary)

    expect(minimalText).toMatch(/^Agent minimal-agent: failed/)
    expect(standardText).toContain('# 智能体摘要: minimal-agent')
    expect(standardText).toContain('状态: failed')
    expect(standardText).toContain('错误信息')
  })

  it('应该截断过长的摘要', () => {
    const manager = new AgentSummaryManager({ maxLength: 100 })

    const longFinding = 'a'.repeat(200)
    const summary = manager.createSummary(
      'long-agent',
      'session-1',
      'completed',
      [longFinding],
      [],
      []
    )

    const text = manager.generateSummaryText(summary)
    expect(text.length).toBeLessThanOrEqual(103) // 100 + '...'
    expect(text.endsWith('...')).toBe(true)
  })
})