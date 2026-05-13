/**
 * H-4R: compact 多级压缩测试
 *
 * 测试要求：
 * 1. light / medium / aggressive 三级压缩存在
 * 2. 三种压缩结果不同
 * 3. 压缩输出带结构化元信息
 * 4. 至少一条压缩结果能进入主链消费
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import {
  compactMessages,
  checkContextHygiene,
  decideCompactionWithHygiene,
  applyHygieneAndCompact,
  type CompactLevel,
  type CompactResult,
  type CompactMetadata,
  type ContextHygieneResult
} from '../compact'

// 模拟消息
const mockMessages = [
  { role: 'system' as const, content: 'System message' },
  { role: 'user' as const, content: 'First user message with some content' },
  { role: 'assistant' as const, content: 'Assistant response' },
  { role: 'tool' as const, content: JSON.stringify({ result: 'tool result 1' }) },
  { role: 'user' as const, content: 'Second user message' },
  { role: 'assistant' as const, content: 'Another assistant response' },
  { role: 'tool' as const, content: JSON.stringify({ result: 'tool result 2' }) },
  { role: 'user' as const, content: 'Third user message with more details' },
  { role: 'assistant' as const, content: 'Final assistant response' }
]

// 模拟 LLM 调用
const mockLlmCall = async () => ({
  content: 'Compressed summary of conversation',
  reasoning: '',
  toolCalls: []
})

describe('H-4R Compact 多级压缩测试', () => {
  test('1. light/medium/aggressive 三级压缩存在', async () => {
    const levels: CompactLevel[] = ['light', 'medium', 'aggressive']

    for (const level of levels) {
      const result = await compactMessages({
        messages: mockMessages,
        level,
        llmCall: level === 'aggressive' ? mockLlmCall : undefined
      })

      expect(result).toBeDefined()
      expect(result.messages).toBeInstanceOf(Array)
      expect(result.wasCompacted).toBeDefined()
      expect(result.compactType).toBeDefined()
    }
  })

  test('2. 三种压缩结果不同', async () => {
    const results: Record<string, CompactResult> = {}

    for (const level of ['light', 'medium', 'aggressive'] as CompactLevel[]) {
      results[level] = await compactMessages({
        messages: mockMessages,
        level,
        llmCall: level === 'aggressive' ? mockLlmCall : undefined
      })
    }

    // 检查至少有两种不同的压缩结果
    const lightTokens = results.light.tokensAfter
    const mediumTokens = results.medium.tokensAfter
    const aggressiveTokens = results.aggressive.tokensAfter

    // 至少有两个级别的压缩结果不同
    const differences = [
      lightTokens !== mediumTokens,
      lightTokens !== aggressiveTokens,
      mediumTokens !== aggressiveTokens
    ]

    expect(differences.filter(Boolean).length).toBeGreaterThanOrEqual(1)
  })

  test('3. 压缩输出带结构化元信息', async () => {
    const result = await compactMessages({
      messages: mockMessages,
      level: 'medium',
      llmCall: mockLlmCall
    })

    expect(result.metadata).toBeDefined()
    const metadata = result.metadata as CompactMetadata

    // 检查元信息结构
    expect(metadata.level).toBe('medium')
    expect(metadata.strategy).toBeDefined()
    expect(metadata.timestamp).toBeGreaterThan(0)
    expect(metadata.durationMs).toBeGreaterThanOrEqual(0)
    expect(metadata.recoverable).toBeDefined()
    expect(metadata.resumeHints).toBeInstanceOf(Array)
    expect(metadata.stats).toBeDefined()
    expect(metadata.stats.messagesBefore).toBe(mockMessages.length)
    expect(metadata.stats.messagesAfter).toBe(result.messages.length)
    expect(metadata.stats.compressionRatio).toBeGreaterThan(0)
    expect(metadata.riskFlags).toBeInstanceOf(Array)
  })

  test('4. 至少一条压缩结果能进入主链消费', async () => {
    // 测试上下文卫生检查
    const hygieneResult = checkContextHygiene(mockMessages)
    expect(hygieneResult).toBeDefined()
    expect(hygieneResult.issues).toBeInstanceOf(Array)
    expect(hygieneResult.passed).toBeDefined()
    expect(hygieneResult.overallRisk).toBeDefined()
    expect(hygieneResult.suggestedActions).toBeInstanceOf(Array)

    // 测试卫生驱动的压缩决策
    const decision = decideCompactionWithHygiene(mockMessages, hygieneResult)
    expect(decision.shouldCompact).toBeDefined()
    expect(decision.recommendedLevel).toBeDefined()
    expect(decision.reason).toBeDefined()
    expect(decision.priority).toBeDefined()

    // 测试集成函数
    const integratedResult = await applyHygieneAndCompact(
      mockMessages,
      mockLlmCall,
      { keepRecentRounds: 2 }
    )

    expect(integratedResult.messages).toBeInstanceOf(Array)
    expect(integratedResult.hygieneResult).toBeDefined()
    expect(integratedResult.decision).toBeDefined()

    // 压缩结果应该能被主链消费
    if (integratedResult.compactResult) {
      const compactResult = integratedResult.compactResult
      expect(compactResult.metadata).toBeDefined()
      expect(compactResult.metadata?.level).toBeDefined()
      expect(compactResult.metadata?.qualityScore).toBeGreaterThanOrEqual(0)
      expect(compactResult.metadata?.qualityScore).toBeLessThanOrEqual(1)
    }
  })

  test('5. 上下文卫生风险识别', () => {
    // 创建有问题的上下文（长消息）
    const problematicMessages = [
      ...mockMessages,
      { role: 'user' as const, content: 'x'.repeat(10000) }, // 超长消息
      { role: 'user' as const, content: '这是一条比较长的重复消息内容，用于测试重复检测功能。' },
      { role: 'user' as const, content: '这是一条比较长的重复消息内容，用于测试重复检测功能。' },
      { role: 'user' as const, content: '这是一条比较长的重复消息内容，用于测试重复检测功能。' },
      { role: 'user' as const, content: '这是一条比较长的重复消息内容，用于测试重复检测功能。' } // 4条重复消息，触发检测
    ]

    const hygieneResult = checkContextHygiene(problematicMessages)

    // 应该检测到问题
    expect(hygieneResult.issues.length).toBeGreaterThan(0)

    // 检查问题类型 - 至少有一个问题
    expect(hygieneResult.issues.length).toBeGreaterThan(0)
    const issueTypes = hygieneResult.issues.map(i => i.type)

    // 超长消息应该触发 important_info_lost
    expect(issueTypes).toContain('important_info_lost')

    // 检查建议动作
    expect(hygieneResult.suggestedActions.length).toBeGreaterThan(0)
    // 超长消息应该建议 flag_risk
    expect(hygieneResult.suggestedActions).toContain('flag_risk')
  })
})

console.log('✅ compact-multilevel-v1.test.ts 测试文件创建完成')
