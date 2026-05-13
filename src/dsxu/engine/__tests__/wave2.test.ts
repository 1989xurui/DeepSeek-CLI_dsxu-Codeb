/**
 * Wave 2 测试：Token Estimation + Memory Extractor + Cache Monitor
 */

import { describe, it, expect, vi } from 'vitest'

// ── Token Estimator (#15) ──

import {
  estimateTokens,
  estimateMessageTokens,
  estimateAllTokens,
  calculateTokenBudget,
  calculateBudgetedMaxTokens,
  tokenAccuracyMonitor,
  calibrateFromResponse,
} from '../token-estimator'
import {
  DEEPSEEK_CONTEXT_WINDOW,
  getBudgetKillThreshold,
  getBudgetTriggerRatio,
  shouldTriggerBudgetCompaction,
  getSafetyMargin,
} from '../model-limits'
import type { Message, LLMResponse } from '../types'

describe('Token Estimator', () => {
  it('should estimate English text tokens', () => {
    const tokens = estimateTokens('Hello world, this is a test.')
    expect(tokens).toBeGreaterThan(5)
    expect(tokens).toBeLessThan(20)
  })

  it('should estimate Chinese text tokens', () => {
    const tokens = estimateTokens('你好世界，这是一个测试。')
    expect(tokens).toBeGreaterThan(3)
    expect(tokens).toBeLessThan(15)
  })

  it('should handle empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('should estimate message tokens with overhead', () => {
    const msg: Message = { role: 'user', content: 'Hello' }
    const tokens = estimateMessageTokens(msg)
    expect(tokens).toBeGreaterThan(4)  // At least role overhead
  })

  it('should estimate messages with tool calls', () => {
    const msg: Message = {
      role: 'assistant',
      content: 'Let me check',
      toolCalls: [{ id: 'tc-1', name: 'Bash', arguments: { command: 'ls -la' } }],
    }
    const tokens = estimateMessageTokens(msg)
    expect(tokens).toBeGreaterThan(10)
  })

  it('should estimate all messages', () => {
    const msgs: Message[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ]
    const total = estimateAllTokens(msgs)
    expect(total).toBeGreaterThan(8)
  })
})

describe('Token Budget', () => {
  it('should calculate V4 window-aware budget for deepseek-chat compatibility alias', () => {
    const msgs: Message[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' },
    ]
    const budget = calculateTokenBudget(msgs, 'deepseek-chat')

    expect(budget.maxContext).toBe(DEEPSEEK_CONTEXT_WINDOW)
    expect(budget.usedTokens).toBeGreaterThan(0)
    expect(budget.remainingTokens).toBeLessThan(DEEPSEEK_CONTEXT_WINDOW)
    expect(budget.usagePercent).toBeLessThan(0.01)  // Tiny messages
    expect(budget.shouldCompact).toBe(false)
    expect(budget.isNearLimit).toBe(false)
  })

  it('should keep V4 long context below warning threshold without early compact', () => {
    const longButHealthyMsg: Message = { role: 'user', content: 'x'.repeat(350_000) }
    const budget = calculateTokenBudget([longButHealthyMsg], 'deepseek-chat')

    expect(budget.maxContext).toBe(DEEPSEEK_CONTEXT_WINDOW)
    expect(budget.shouldCompact).toBe(false)
  })

  it('should flag shouldCompact only near V4 route-aware threshold', () => {
    // 1M context x 0.7 = ~734K tokens needed. At 0.28 tok/char this is ~2.63M chars.
    const bigMsg: Message = { role: 'user', content: 'x'.repeat(2_700_000) }
    const budget = calculateTokenBudget([bigMsg], 'deepseek-v4-flash')

    expect(budget.shouldCompact).toBe(true)
  })

  it('should map deepseek-reasoner compatibility alias to V4 window, not old 128K', () => {
    const msgs: Message[] = [
      { role: 'user', content: 'Reason about this bug deeply' },
    ]
    const budget = calculateTokenBudget(msgs, 'deepseek-reasoner')
    expect(budget.maxContext).toBe(DEEPSEEK_CONTEXT_WINDOW)
  })

  it('should clamp max_tokens to stay within V4 prompt + output + margin window', () => {
    const bigMsg: Message = { role: 'user', content: 'x'.repeat(3_500_000) }
    const result = calculateBudgetedMaxTokens([bigMsg], 'deepseek-v4-flash', 8192, new Date('2026-04-13T12:00:00+08:00'))

    expect(result.contextLimit).toBe(DEEPSEEK_CONTEXT_WINDOW)
    expect(result.safetyMargin).toBe(2_000)
    expect(result.promptTokens + result.maxTokens + result.safetyMargin).toBeLessThanOrEqual(DEEPSEEK_CONTEXT_WINDOW)
  })

  it('should use stricter night trigger ratio and kill threshold in Beijing off-peak', () => {
    const night = new Date('2026-04-13T01:00:00+08:00')
    expect(getBudgetTriggerRatio(night)).toBe(0.65)
    expect(getBudgetKillThreshold(night)).toBe(2)
  })

  it('should trigger budget compaction earlier at night', () => {
    const promptTokens = 700_000
    const day = new Date('2026-04-13T12:00:00+08:00')
    const night = new Date('2026-04-13T01:00:00+08:00')

    expect(shouldTriggerBudgetCompaction('deepseek-chat', promptTokens, day)).toBe(false)
    expect(shouldTriggerBudgetCompaction('deepseek-chat', promptTokens, night)).toBe(true)
  })

  it('should apply model-specific safety margins', () => {
    const day = new Date('2026-04-13T12:00:00+08:00')
    const chatMargin = getSafetyMargin(day, 'deepseek-chat', 'normal')
    const reasonerMargin = getSafetyMargin(day, 'deepseek-v4-pro', 'normal')

    // Pro/reasoner route should have higher safety margin (1.5x).
    expect(reasonerMargin).toBeGreaterThan(chatMargin)
  })

  it('should apply scenario-specific safety adjustments', () => {
    const day = new Date('2026-04-13T12:00:00+08:00')
    const normalMargin = getSafetyMargin(day, 'deepseek-chat', 'normal')
    const codeMargin = getSafetyMargin(day, 'deepseek-chat', 'code_generation')
    const reasoningMargin = getSafetyMargin(day, 'deepseek-chat', 'reasoning')

    expect(codeMargin).toBeGreaterThan(normalMargin) // +500
    expect(reasoningMargin).toBeGreaterThan(normalMargin) // +1000
  })

  it('should provide degradation strategies when over budget', () => {
    // 模拟超预算情况：prompt很大，请求的输出也很大
    const bigMsg: Message = { role: 'user', content: 'x'.repeat(3_800_000) } // ~1.06M tokens
    const result = calculateBudgetedMaxTokens([bigMsg], 'deepseek-v4-flash', 393_216)

    expect(result.overBudget).toBe(true)
    expect(result.degradationStrategy).toBeDefined()
    expect(['reduce_output', 'compress_input', 'emergency']).toContain(result.degradationStrategy)
  })

  it('should apply special strategy for reasoner model', () => {
    const bigMsg: Message = { role: 'user', content: 'x'.repeat(3_500_000) }
    const result = calculateBudgetedMaxTokens([bigMsg], 'deepseek-v4-pro', 65_536)

    expect(result.reasonerStrategyApplied).toBe(true)
    // reasoner should handle high output limits differently
    expect(result.maxTokens).toBeLessThanOrEqual(result.modelMaxOutput)
  })

  it('should suggest compact threshold when input compression needed', () => {
    const bigMsg: Message = { role: 'user', content: 'x'.repeat(3_800_000) }
    const result = calculateBudgetedMaxTokens([bigMsg], 'deepseek-v4-flash', 393_216)

    if (result.degradationStrategy === 'compress_input' || result.degradationStrategy === 'emergency') {
      expect(result.suggestedCompactThreshold).toBeDefined()
      expect(result.suggestedCompactThreshold).toBeLessThan(1.0)
      expect(result.suggestedCompactThreshold).toBeGreaterThan(0)
    }
  })
})

describe('Token Accuracy Monitor', () => {
  it('should track calibration samples', () => {
    tokenAccuracyMonitor.reset()

    calibrateFromResponse(100, {
      content: '', toolCalls: [], stopReason: 'end_turn',
      usage: { inputTokens: 110, outputTokens: 50 },
    })

    const stats = tokenAccuracyMonitor.getStats()
    expect(stats.samples).toBe(1)
    expect(stats.avgDeviationPercent).toBeLessThan(20)
  })

  it('should detect high deviation', () => {
    tokenAccuracyMonitor.reset()

    // 50% deviation
    calibrateFromResponse(100, {
      content: '', toolCalls: [], stopReason: 'end_turn',
      usage: { inputTokens: 200, outputTokens: 50 },
    })

    const stats = tokenAccuracyMonitor.getStats()
    expect(stats.highDeviationCount).toBe(1)
  })
})

// ── Memory Extractor (#2, #3) ──

import {
  extractMemories,
  extractFromCompactSummary,
  MemoryStore,
} from '../memory-extractor'
import type { Memory } from '../memory-extractor'

function mockLLMCall(content: string) {
  return async () => ({
    content,
    toolCalls: [] as any[],
    stopReason: 'end_turn' as const,
    usage: { inputTokens: 50, outputTokens: 25 },
  })
}

describe('extractMemories', () => {
  it('should extract memories from conversation', async () => {
    const llm = mockLLMCall(
      `{"type":"bug_fix","title":"Fix auth token expiry","content":"Added token refresh logic in auth.ts line 42","files":["src/auth.ts"],"tags":["auth","token"],"quality":0.8}
{"type":"user_preference","title":"User prefers vitest","content":"User explicitly chose vitest over jest for testing","files":[],"tags":["testing"],"quality":0.7}`
    )

    const msgs: Message[] = [
      { role: 'user', content: 'Fix the auth bug, the token keeps expiring' },
      { role: 'assistant', content: 'I found the issue in auth.ts, the token refresh was missing' },
      { role: 'user', content: 'Use vitest for tests, not jest' },
      { role: 'assistant', content: 'OK, I will use vitest. Here is the fix...' },
      { role: 'user', content: 'Great, run the tests' },
    ]

    const result = await extractMemories(msgs, llm, 'session-1')

    expect(result.memories).toHaveLength(2)
    expect(result.memories[0].type).toBe('bug_fix')
    expect(result.memories[0].title).toBe('Fix auth token expiry')
    expect(result.memories[0].quality).toBe(0.8)
    expect(result.filteredCount).toBe(0)
  })

  it('should filter low quality memories', async () => {
    const llm = mockLLMCall(
      `{"type":"general","title":"High quality","content":"Important info","files":[],"tags":[],"quality":0.9}
{"type":"general","title":"Low quality","content":"Trivial","files":[],"tags":[],"quality":0.3}`
    )

    const msgs: Message[] = [
      { role: 'user', content: 'Question about something important that needs a long explanation' },
      { role: 'assistant', content: 'Here is the detailed answer with lots of context and information' },
      { role: 'user', content: 'Thanks for explaining that in detail, very helpful' },
      { role: 'assistant', content: 'You are welcome! Let me know if you need more help' },
      { role: 'user', content: 'One more question about the implementation details' },
    ]

    const result = await extractMemories(msgs, llm, 'session-1', 0.6)

    expect(result.memories).toHaveLength(1)
    expect(result.memories[0].title).toBe('High quality')
    expect(result.filteredCount).toBe(1)
  })

  it('should skip short conversations', async () => {
    const llm = mockLLMCall('should not be called')

    const result = await extractMemories(
      [{ role: 'user', content: 'hi' }],
      llm,
      'session-1',
    )

    expect(result.memories).toHaveLength(0)
  })

  it('should handle LLM failure gracefully', async () => {
    const failingLLM = async () => { throw new Error('API down') }

    const msgs: Message[] = Array.from({ length: 5 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Message ${i} with some content to make it long enough`,
    }))

    const result = await extractMemories(msgs, failingLLM as any, 'session-1')
    expect(result.memories).toHaveLength(0)  // Graceful degradation
  })

  it('should handle malformed LLM output', async () => {
    const llm = mockLLMCall(
      `Some non-JSON preamble
{"type":"bug_fix","title":"Valid","content":"OK","files":[],"tags":[],"quality":0.8}
{invalid json here}
just text`
    )

    const msgs: Message[] = Array.from({ length: 5 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Message ${i} with enough content to extract`,
    }))

    const result = await extractMemories(msgs, llm, 'session-1')
    expect(result.memories).toHaveLength(1)  // Only the valid one
  })
})

describe('extractFromCompactSummary', () => {
  it('should extract from summary text', async () => {
    const llm = mockLLMCall(
      `{"type":"project_pattern","title":"API pattern","content":"REST API uses express middleware","files":["src/api/"],"tags":["api"],"quality":0.7}`
    )

    const memories = await extractFromCompactSummary(
      'The conversation discussed REST API design using express middleware for authentication.',
      llm,
      'session-1',
    )

    expect(memories).toHaveLength(1)
    expect(memories[0].type).toBe('project_pattern')
  })

  it('should return empty for short summaries', async () => {
    const llm = mockLLMCall('should not be called')
    const memories = await extractFromCompactSummary('Short.', llm, 'session-1')
    expect(memories).toHaveLength(0)
  })
})

describe('MemoryStore', () => {
  it('should add and search memories', () => {
    const store = new MemoryStore()

    const mem: Memory = {
      id: 'mem-1',
      type: 'bug_fix',
      title: 'Fix auth token',
      content: 'Token refresh was missing in auth.ts',
      files: ['src/auth.ts'],
      tags: ['auth', 'token'],
      quality: 0.8,
      timestamp: new Date().toISOString(),
      sessionId: 'session-1',
    }

    store.add(mem)
    expect(store.getAll()).toHaveLength(1)

    const results = store.search('auth token')
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('Fix auth token')
  })

  it('should deduplicate by title + type', () => {
    const store = new MemoryStore()

    const base: Memory = {
      id: 'mem-1', type: 'bug_fix', title: 'Fix X', content: 'Old',
      files: [], tags: [], quality: 0.7, timestamp: '', sessionId: 's1',
    }

    store.add(base)
    store.add({ ...base, id: 'mem-2', content: 'Updated' })

    expect(store.getAll()).toHaveLength(1)
    expect(store.getAll()[0].content).toBe('Updated')
  })

  it('should return stats by type', () => {
    const store = new MemoryStore()
    const base = {
      id: '', files: [], tags: [], quality: 0.8, timestamp: '', sessionId: 's1',
    }

    store.add({ ...base, id: '1', type: 'bug_fix', title: 'Fix A', content: 'A' })
    store.add({ ...base, id: '2', type: 'bug_fix', title: 'Fix B', content: 'B' })
    store.add({ ...base, id: '3', type: 'user_preference', title: 'Pref', content: 'C' })

    const stats = store.getStats()
    expect(stats.total).toBe(3)
    expect(stats.byType['bug_fix']).toBe(2)
    expect(stats.byType['user_preference']).toBe(1)
  })

  it('should call persist callback', async () => {
    const persistFn = vi.fn().mockResolvedValue(undefined)
    const store = new MemoryStore(persistFn)

    await store.add({
      id: '1', type: 'general', title: 'T', content: 'C',
      files: [], tags: [], quality: 0.8, timestamp: '', sessionId: 's1',
    })

    expect(persistFn).toHaveBeenCalledTimes(1)
  })
})

// ── Cache Monitor (#16) ──

import { CacheMonitor } from '../cache-monitor'

describe('CacheMonitor', () => {
  it('should track cache hits', () => {
    const monitor = new CacheMonitor()

    monitor.recordResponse({
      content: '', toolCalls: [], stopReason: 'end_turn',
      usage: { inputTokens: 1000, outputTokens: 100, cacheHit: true },
    })

    const stats = monitor.getStats()
    expect(stats.totalRequests).toBe(1)
    expect(stats.cacheHits).toBe(1)
    expect(stats.hitRate).toBe(1)
    expect(stats.consecutiveMisses).toBe(0)
  })

  it('should track cache misses', () => {
    const monitor = new CacheMonitor()

    monitor.recordResponse({
      content: '', toolCalls: [], stopReason: 'end_turn',
      usage: { inputTokens: 1000, outputTokens: 100, cacheHit: false },
    })

    const stats = monitor.getStats()
    expect(stats.cacheMisses).toBe(1)
    expect(stats.consecutiveMisses).toBe(1)
  })

  it('should reset consecutive misses on hit', () => {
    const monitor = new CacheMonitor()
    const miss = { content: '', toolCalls: [] as any[], stopReason: 'end_turn' as const, usage: { inputTokens: 100, outputTokens: 10 } }
    const hit = { ...miss, usage: { inputTokens: 100, outputTokens: 10, cacheHit: true } }

    monitor.recordResponse(miss)
    monitor.recordResponse(miss)
    expect(monitor.getStats().consecutiveMisses).toBe(2)

    monitor.recordResponse(hit)
    expect(monitor.getStats().consecutiveMisses).toBe(0)
  })

  it('should alert on consecutive misses', () => {
    const alertFn = vi.fn()
    const monitor = new CacheMonitor({ onAlert: alertFn })
    const miss = { content: '', toolCalls: [] as any[], stopReason: 'end_turn' as const, usage: { inputTokens: 100, outputTokens: 10 } }

    // Need 5 consecutive misses for alert callback
    for (let i = 0; i < 5; i++) {
      monitor.recordResponse(miss)
    }

    expect(alertFn).toHaveBeenCalledTimes(1)
    // shouldAlert requires > 10 total requests and < 30% hit rate
    // Send more misses to exceed the 10-request threshold
    for (let i = 0; i < 6; i++) {
      monitor.recordResponse(miss)
    }
    expect(monitor.getStats().shouldAlert).toBe(true)
  })

  it('should trigger onCacheMiss after 2 misses', () => {
    const missFn = vi.fn()
    const monitor = new CacheMonitor({ onCacheMiss: missFn })
    const miss = { content: '', toolCalls: [] as any[], stopReason: 'end_turn' as const, usage: { inputTokens: 100, outputTokens: 10 } }

    monitor.recordResponse(miss)
    expect(missFn).not.toHaveBeenCalled()

    monitor.recordResponse(miss)
    expect(missFn).toHaveBeenCalledTimes(1)
  })

  it('should detect L1 hash change', () => {
    const monitor = new CacheMonitor()
    monitor.setL1Hash('abc123')
    monitor.setL1Hash('def456')  // Changed!

    const events = monitor.getBreakEvents()
    expect(events).toHaveLength(1)
    expect(events[0].reason).toContain('L1 prefix hash changed')
  })

  it('should diagnose issues', () => {
    const monitor = new CacheMonitor()
    const miss = { content: '', toolCalls: [] as any[], stopReason: 'end_turn' as const, usage: { inputTokens: 100, outputTokens: 10 } }

    // All misses → low hit rate
    for (let i = 0; i < 15; i++) {
      monitor.recordResponse(miss)
    }

    const issues = monitor.diagnose()
    expect(issues.some(i => i.includes('Low cache hit rate'))).toBe(true)
    expect(issues.some(i => i.includes('consecutive cache misses'))).toBe(true)
  })

  it('should report normal when healthy', () => {
    const monitor = new CacheMonitor()
    const issues = monitor.diagnose()
    expect(issues).toContain('Cache performance normal')
  })

  it('should calculate estimated savings', () => {
    const monitor = new CacheMonitor()
    const hit = { content: '', toolCalls: [] as any[], stopReason: 'end_turn' as const, usage: { inputTokens: 10000, outputTokens: 100, cacheHit: true } }

    monitor.recordResponse(hit)

    const stats = monitor.getStats()
    expect(stats.estimatedSavings).toBeGreaterThan(0)
    expect(stats.totalCachedTokens).toBeGreaterThan(0)
  })
})

// ── Auto Dream Integrator ──

import { AutoDreamIntegrator } from '../memory-extractor'

describe('AutoDreamIntegrator', () => {
  it('should initialize with default config', () => {
    const store = new MemoryStore()
    const integrator = new AutoDreamIntegrator(store)

    const status = integrator.getStatus()
    expect(status.enabled).toBe(true)
    expect(status.isRunning).toBe(false)
    expect(status.pendingCount).toBe(0)
    expect(status.config.intervalMs).toBe(30000)
    expect(status.config.batchSize).toBe(10)
    expect(status.config.qualityThreshold).toBe(0.7)
  })

  it('should start and stop integration', () => {
    const store = new MemoryStore()
    const integrator = new AutoDreamIntegrator(store)

    integrator.start()
    let status = integrator.getStatus()
    expect(status.isRunning).toBe(true)

    integrator.stop()
    status = integrator.getStatus()
    expect(status.isRunning).toBe(false)
  })

  it('should add memories for integration', () => {
    const store = new MemoryStore()
    const integrator = new AutoDreamIntegrator(store)

    const memories = [
      {
        id: 'mem-1',
        type: 'technical_decision' as const,
        title: 'Test Memory 1',
        content: 'Content 1',
        files: [],
        tags: [],
        quality: 0.8,
        timestamp: new Date().toISOString(),
        sessionId: 'session-1'
      },
      {
        id: 'mem-2',
        type: 'bug_fix' as const,
        title: 'Test Memory 2',
        content: 'Content 2',
        files: [],
        tags: [],
        quality: 0.6, // Below threshold
        timestamp: new Date().toISOString(),
        sessionId: 'session-1'
      }
    ]

    integrator.addMemories(memories)
    const status = integrator.getStatus()
    expect(status.pendingCount).toBe(1) // Only memory 1 should be added (quality >= 0.7)
  })

  it('should update config', () => {
    const store = new MemoryStore()
    const integrator = new AutoDreamIntegrator(store)

    integrator.updateConfig({
      enabled: false,
      intervalMs: 60000,
      batchSize: 5,
      qualityThreshold: 0.8
    })

    const status = integrator.getStatus()
    expect(status.enabled).toBe(false)
    expect(status.config.intervalMs).toBe(60000)
    expect(status.config.batchSize).toBe(5)
    expect(status.config.qualityThreshold).toBe(0.8)
  })

  it('should handle disabled state', () => {
    const store = new MemoryStore()
    const integrator = new AutoDreamIntegrator(store, { enabled: false })

    integrator.start() // Should not start when disabled
    const status = integrator.getStatus()
    expect(status.isRunning).toBe(false)

    const memories = [{
      id: 'mem-1',
      type: 'technical_decision' as const,
      title: 'Test Memory',
      content: 'Content',
      files: [],
      tags: [],
      quality: 0.9,
      timestamp: new Date().toISOString(),
      sessionId: 'session-1'
    }]

    integrator.addMemories(memories)
    expect(integrator.getStatus().pendingCount).toBe(0) // Should not add when disabled
  })
})
