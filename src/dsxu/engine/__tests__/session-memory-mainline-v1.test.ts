/**
 * H-4R: session / memory 主链测试
 *
 * 测试要求：
 * 1. session 能持有结构化 memory
 * 2. memory-extractor 至少能提取 3 类 memory
 * 3. session summary / resume hint 存在
 * 4. runtime-core 至少能拿到一种 session/memory 结构
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import {
  type SessionSnapshot,
  type SessionSummary,
  type SessionResumeHint,
  type ExtractedMemory,
  type MemoryCategory
} from '../session'

import {
  extractMemoriesEnhanced,
  type MemoryCategory as MC,
  MemoryStore
} from '../memory-extractor'

import {
  applyHygieneAndCompact,
  decideCompactionWithHygiene
} from '../compact'

// 模拟消息
const mockMessages = [
  { role: 'system' as const, content: 'You are a helpful assistant' },
  { role: 'user' as const, content: 'Fix the bug in login function' },
  { role: 'assistant' as const, content: 'I found the bug: missing null check' },
  { role: 'tool' as const, content: JSON.stringify({ file: 'src/auth.js', change: 'added null check' }) },
  { role: 'user' as const, content: 'Also improve error handling' },
  { role: 'assistant' as const, content: 'Added better error messages' },
  { role: 'tool' as const, content: JSON.stringify({ file: 'src/auth.js', change: 'enhanced error handling' }) },
  { role: 'user' as const, content: 'What about performance?' },
  { role: 'assistant' as const, content: 'Optimized database queries' },
  { role: 'tool' as const, content: JSON.stringify({ file: 'src/db.js', change: 'added query optimization' }) }
]

// 模拟 LLM 调用 - 返回结构化的记忆提取结果
const mockLlmCall = async (messages: any[]) => {
  // 模拟记忆提取响应
  if (messages.some((m: any) => m.content?.includes('Extract memories'))) {
    return {
      content: `{"type":"bug_fix","title":"Fixed null check in login","content":"Added null check to prevent crashes","files":["src/auth.js"],"tags":["bug","security"],"quality":0.8}
{"type":"technical_decision","title":"Improved error handling","content":"Enhanced error messages for better UX","files":["src/auth.js"],"tags":["ux","error"],"quality":0.7}
{"type":"project_pattern","title":"Database optimization pattern","content":"Optimized queries for better performance","files":["src/db.js"],"tags":["performance","database"],"quality":0.9}
{"type":"user_preference","title":"User prefers detailed errors","content":"User requested better error messages","files":[],"tags":["user-feedback"],"quality":0.6}`,
      reasoning: '',
      toolCalls: []
    }
  }

  // 模拟压缩摘要响应
  return {
    content: 'Compressed summary: Fixed login bug, improved errors, optimized queries',
    reasoning: '',
    toolCalls: []
  }
}

describe('H-4R Session/Memory 主链测试', () => {
  test('1. session 能持有结构化 memory', async () => {
    // 测试记忆提取
    const memoryResult = await extractMemoriesEnhanced(
      mockMessages,
      mockLlmCall,
      'test-session-123'
    )

    // 检查提取的记忆
    expect(memoryResult.extractedMemories).toBeInstanceOf(Array)
    expect(memoryResult.categoryStats).toBeDefined()
    expect(memoryResult.indexHints).toBeInstanceOf(Array)

    // 检查 memory 结构
    if (memoryResult.extractedMemories.length > 0) {
      const memory = memoryResult.extractedMemories[0]
      expect(memory.id).toBeDefined()
      expect(memory.category).toBeDefined()
      expect(memory.title).toBeDefined()
      expect(memory.content).toBeDefined()
      expect(memory.confidence).toBeGreaterThanOrEqual(0)
      expect(memory.confidence).toBeLessThanOrEqual(1)
      expect(memory.relatedFiles).toBeInstanceOf(Array)
      expect(memory.timestamp).toBeGreaterThan(0)
      expect(memory.metadata).toBeDefined()
    }

    // 测试 MemoryStore
    const memoryStore = new MemoryStore()
    for (const memory of memoryResult.extractedMemories) {
      // 转换为 MemoryStore 需要的格式
      const storeMemory = {
        id: memory.id,
        type: memory.metadata?.originalType || 'general',
        category: memory.category as any,
        title: memory.title,
        content: memory.content,
        files: memory.relatedFiles,
        tags: memory.metadata?.tags || [],
        quality: memory.confidence,
        timestamp: new Date(memory.timestamp).toISOString(),
        sessionId: 'test-session-123',
        confidence: memory.confidence,
        metadata: memory.metadata
      }
      await memoryStore.add(storeMemory)
    }

    const allMemories = memoryStore.getAll()
    expect(allMemories.length).toBe(memoryResult.extractedMemories.length)
  })

  test('2. memory-extractor 至少能提取 3 类 memory', async () => {
    const memoryResult = await extractMemoriesEnhanced(
      mockMessages,
      mockLlmCall,
      'test-session-123'
    )

    // 检查提取的记忆数量
    expect(memoryResult.extractedMemories.length).toBeGreaterThanOrEqual(3)

    // 检查分类统计
    const categories = Object.keys(memoryResult.categoryStats) as MemoryCategory[]
    expect(categories.length).toBeGreaterThanOrEqual(3)

    // 检查至少包含几种主要分类
    const expectedCategories: MemoryCategory[] = ['bug', 'decision', 'technical-pattern']
    const foundCategories = expectedCategories.filter(cat =>
      memoryResult.extractedMemories.some(m => m.category === cat)
    )
    expect(foundCategories.length).toBeGreaterThanOrEqual(2)
  })

  test('3. session summary / resume hint 类型存在', () => {
    // 测试类型定义
    const snapshot: SessionSnapshot = {
      sessionId: 'test-session-123',
      timestamp: Date.now(),
      status: 'active',
      messageStats: {
        total: 10,
        user: 3,
        assistant: 3,
        tool: 3,
        system: 1
      },
      extractedMemories: [],
      memoryCategoryStats: {
        'bug': 0, 'decision': 0, 'task-state': 0, 'repo-context': 0,
        'recovery-history': 0, 'technical-pattern': 0, 'user-preference': 0
      },
      resumeHints: [],
      qualityScore: 80
    }

    expect(snapshot.sessionId).toBe('test-session-123')
    expect(snapshot.extractedMemories).toBeInstanceOf(Array)
    expect(snapshot.memoryCategoryStats).toBeDefined()
    expect(snapshot.resumeHints).toBeInstanceOf(Array)

    const summary: SessionSummary = {
      sessionId: 'test-session-123',
      createdAt: Date.now() - 3600000,
      updatedAt: Date.now(),
      title: 'Test Session',
      cwd: '/test',
      status: 'active',
      milestones: [],
      compactHistory: [],
      memoryStats: {
        'bug': 0, 'decision': 0, 'task-state': 0, 'repo-context': 0,
        'recovery-history': 0, 'technical-pattern': 0, 'user-preference': 0
      },
      hygieneHistory: [],
      recoverabilityScore: 80,
      contextQualityScore: 85,
      memoryQualityScore: 75,
      resumeHintSummary: []
    }

    expect(summary.sessionId).toBe('test-session-123')
    expect(summary.memoryStats).toBeDefined()
    expect(summary.recoverabilityScore).toBeGreaterThanOrEqual(0)
    expect(summary.recoverabilityScore).toBeLessThanOrEqual(100)

    const resumeHint: SessionResumeHint = {
      type: 'suggestion',
      content: '建议进行上下文压缩',
      priority: 'medium',
      location: { timestamp: Date.now() }
    }

    expect(resumeHint.type).toBe('suggestion')
    expect(resumeHint.content).toBeDefined()
    expect(resumeHint.priority).toBe('medium')
  })

  test('4. 四模块联动验证', async () => {
    // 1. 上下文卫生检查 + 压缩
    const hygieneCompactResult = await applyHygieneAndCompact(
      mockMessages,
      mockLlmCall,
      { keepRecentRounds: 2 }
    )

    expect(hygieneCompactResult.messages).toBeInstanceOf(Array)
    expect(hygieneCompactResult.hygieneResult).toBeDefined()
    expect(hygieneCompactResult.decision).toBeDefined()

    // 2. 记忆提取
    const memoryResult = await extractMemoriesEnhanced(
      hygieneCompactResult.messages,
      mockLlmCall,
      'test-session-123'
    )

    expect(memoryResult.extractedMemories).toBeInstanceOf(Array)
    expect(memoryResult.categoryStats).toBeDefined()

    // 3. 验证四模块联动：
    // - compact 结果可能存在（如果触发了压缩）
    // 注意：如果消息不够长，可能不会触发压缩
    if (hygieneCompactResult.compactResult) {
      expect(hygieneCompactResult.compactResult.wasCompacted).toBeDefined()
    }

    // - context hygiene 能影响 compact 动作
    expect(hygieneCompactResult.hygieneResult.issues).toBeInstanceOf(Array)

    // - memory-extractor 能工作
    expect(memoryResult.extractedMemories.length).toBeGreaterThan(0)

    // 4. 构建简化的 session snapshot
    const snapshot: SessionSnapshot = {
      sessionId: 'test-session-123',
      timestamp: Date.now(),
      status: 'active',
      messageStats: {
        total: hygieneCompactResult.messages.length,
        user: hygieneCompactResult.messages.filter(m => m.role === 'user').length,
        assistant: hygieneCompactResult.messages.filter(m => m.role === 'assistant').length,
        tool: hygieneCompactResult.messages.filter(m => m.role === 'tool').length,
        system: hygieneCompactResult.messages.filter(m => m.role === 'system').length
      },
      compactState: hygieneCompactResult.compactResult ? {
        compacted: hygieneCompactResult.compactResult.wasCompacted,
        compactType: hygieneCompactResult.compactResult.compactType,
        tokensBefore: hygieneCompactResult.compactResult.tokensBefore,
        tokensAfter: hygieneCompactResult.compactResult.tokensAfter,
        metadata: hygieneCompactResult.compactResult.metadata
      } : undefined,
      hygieneState: {
        riskLevel: hygieneCompactResult.hygieneResult.overallRisk,
        issuesCount: hygieneCompactResult.hygieneResult.issues.length,
        lastCheckTime: Date.now(),
        suggestedActions: hygieneCompactResult.hygieneResult.suggestedActions
      },
      extractedMemories: memoryResult.extractedMemories,
      memoryCategoryStats: memoryResult.categoryStats,
      resumeHints: [
        {
          type: 'suggestion',
          content: `已执行 ${hygieneCompactResult.compactResult?.compactType || '无'} 压缩`,
          priority: 'medium'
        }
      ],
      qualityScore: 75
    }

    // 验证 snapshot 结构
    expect(snapshot.sessionId).toBe('test-session-123')
    expect(snapshot.extractedMemories.length).toBe(memoryResult.extractedMemories.length)
    expect(snapshot.memoryCategoryStats).toEqual(memoryResult.categoryStats)

    // 验证数据一致性
    if (hygieneCompactResult.compactResult) {
      expect(snapshot.compactState?.compacted).toBe(hygieneCompactResult.compactResult.wasCompacted)
    }
  })

  test('5. 卫生驱动的压缩决策', async () => {
    // 测试卫生检查
    const hygieneResult = await (async () => {
      // 简化实现，直接调用函数
      const { checkContextHygiene } = await import('../compact')
      return checkContextHygiene(mockMessages)
    })()

    expect(hygieneResult).toBeDefined()
    expect(hygieneResult.issues).toBeInstanceOf(Array)

    // 测试决策函数
    const decision = decideCompactionWithHygiene(mockMessages, hygieneResult)

    expect(decision).toBeDefined()
    expect(decision.shouldCompact).toBeDefined()
    expect(decision.recommendedLevel).toMatch(/^(light|medium|aggressive)$/)
    expect(decision.reason).toBeDefined()
    expect(decision.priority).toMatch(/^(low|medium|high)$/)

    // 测试集成函数
    const integratedResult = await applyHygieneAndCompact(
      mockMessages,
      mockLlmCall,
      { keepRecentRounds: 2 }
    )

    expect(integratedResult.messages).toBeInstanceOf(Array)
    expect(integratedResult.hygieneResult).toBeDefined()
    expect(integratedResult.decision).toBeDefined()

    // 验证决策与结果一致
    expect(integratedResult.decision.shouldCompact).toBe(decision.shouldCompact)
    expect(integratedResult.decision.recommendedLevel).toBe(decision.recommendedLevel)
  })
})

console.log('✅ session-memory-mainline-v1.test.ts 测试文件创建完成')
