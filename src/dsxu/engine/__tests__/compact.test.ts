/**
 * Auto Compact 测试
 *
 * 测试策略：
 * - microCompact: 纯逻辑，不需要 LLM
 * - fullCompact: Mock LLM call
 * - autoCompactIfNeeded: 集成测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { microCompact, fullCompact, autoCompactIfNeeded, lightCompact } from '../compact'
import type { CompactConfig } from '../compact'
import type { Message, LLMCallFn, LLMResponse } from '../types'

// ── Helpers ──

function makeToolMsg(content: string, id = 'tc-1'): Message {
  return { role: 'tool', content, toolCallId: id }
}

function makeUserMsg(content: string): Message {
  return { role: 'user', content }
}

function makeAssistantMsg(content: string, toolCalls?: any[]): Message {
  return { role: 'assistant', content, toolCalls }
}

function makeSystemMsg(content: string): Message {
  return { role: 'system', content }
}

/** 生成一长串消息来超过 token 阈值 */
function generateLongConversation(rounds: number): Message[] {
  const msgs: Message[] = [makeSystemMsg('You are a helpful assistant.')]
  for (let i = 0; i < rounds; i++) {
    msgs.push(makeUserMsg(`Question ${i}: ${'x'.repeat(500)}`))
    msgs.push(makeAssistantMsg(`Answer ${i}: ${'y'.repeat(500)}`, [
      { id: `tc-${i}`, name: 'Bash', arguments: { command: 'echo test' } },
    ]))
    msgs.push(makeToolMsg('x'.repeat(1000), `tc-${i}`))
  }
  // Final user + assistant (no tools)
  msgs.push(makeUserMsg('final question'))
  msgs.push(makeAssistantMsg('final answer'))
  return msgs
}

function mockLLMCall(summaryText: string): LLMCallFn {
  return async () => ({
    content: summaryText,
    toolCalls: [],
    stopReason: 'end_turn' as const,
    usage: { inputTokens: 100, outputTokens: 50 },
  })
}

function failingLLMCall(): LLMCallFn {
  return async () => { throw new Error('LLM unavailable') }
}

// ── microCompact ──

describe('microCompact', () => {
  it('should not compact when few tool results', () => {
    const msgs: Message[] = [
      makeUserMsg('hi'),
      makeAssistantMsg('let me check', [{ id: 'tc-1', name: 'Bash', arguments: {} }]),
      makeToolMsg('result 1', 'tc-1'),
    ]

    const result = microCompact(msgs)
    expect(result.wasCompacted).toBe(false)
    expect(result.compactType).toBe('none')
    expect(result.messages).toBe(msgs)  // Same reference (no copy)
  })

  it('should clear old tool results beyond keepRecentToolResults', () => {
    const msgs: Message[] = []
    // 12 tool results: keep last 8, clear first 4
    for (let i = 0; i < 12; i++) {
      msgs.push(makeUserMsg(`q${i}`))
      msgs.push(makeAssistantMsg(`a${i}`, [{ id: `tc-${i}`, name: 'Bash', arguments: {} }]))
      msgs.push(makeToolMsg('x'.repeat(200), `tc-${i}`))  // >100 chars → will be cleared
    }

    const result = microCompact(msgs, 8)

    expect(result.compactType).toBe('micro')
    expect(result.wasCompacted).toBe(true)
    expect(result.tokensAfter).toBeLessThan(result.tokensBefore)

    // First 4 tool results should be cleared
    const toolMsgs = result.messages.filter(m => m.role === 'tool')
    const clearedCount = toolMsgs.filter(m =>
      typeof m.content === 'string' && m.content.includes('cleared by compact')
    ).length
    expect(clearedCount).toBe(4)

    // Last 8 should still have original content
    const keptCount = toolMsgs.filter(m =>
      typeof m.content === 'string' && m.content.startsWith('x')
    ).length
    expect(keptCount).toBe(8)
  })

  it('should not clear short tool results (<100 chars)', () => {
    const msgs: Message[] = []
    for (let i = 0; i < 12; i++) {
      msgs.push(makeUserMsg(`q${i}`))
      msgs.push(makeAssistantMsg(`a${i}`, [{ id: `tc-${i}`, name: 'Bash', arguments: {} }]))
      // Short content (<100 chars) → should NOT be cleared
      msgs.push(makeToolMsg('ok', `tc-${i}`))
    }

    const result = microCompact(msgs, 8)
    // Even though there are >8 tool results, short ones aren't cleared
    const cleared = result.messages.filter(m =>
      typeof m.content === 'string' && m.content.includes('cleared')
    )
    expect(cleared).toHaveLength(0)
  })

  it('should preserve message count (only shrink content)', () => {
    const msgs: Message[] = []
    for (let i = 0; i < 12; i++) {
      msgs.push(makeUserMsg(`q${i}`))
      msgs.push(makeAssistantMsg(`a${i}`, [{ id: `tc-${i}`, name: 'Bash', arguments: {} }]))
      msgs.push(makeToolMsg('x'.repeat(200), `tc-${i}`))
    }

    const result = microCompact(msgs, 8)
    expect(result.messages).toHaveLength(msgs.length)
    expect(result.messagesRemoved).toBe(0)
  })
})

// ── fullCompact ──

describe('fullCompact', () => {
  it('should summarize old messages and keep recent rounds', async () => {
    const msgs = generateLongConversation(10)
    const llm = mockLLMCall('## Summary\nUser asked 10 questions about testing.')

    const result = await fullCompact(msgs, llm, { keepRecentRounds: 3 })

    expect(result.wasCompacted).toBe(true)
    expect(result.compactType).toBe('full')
    expect(result.tokensAfter).toBeLessThan(result.tokensBefore)
    expect(result.messagesRemoved).toBeGreaterThan(0)

    // Should contain conversation_summary
    const summaryMsg = result.messages.find(m =>
      typeof m.content === 'string' && m.content.includes('conversation_summary')
    )
    expect(summaryMsg).toBeDefined()
    expect(summaryMsg!.content).toContain('User asked 10 questions')
  })

  it('should preserve system messages', async () => {
    const msgs = generateLongConversation(10)
    const llm = mockLLMCall('Summary text')

    const result = await fullCompact(msgs, llm)

    // Original system msg + summary system msg
    const systemMsgs = result.messages.filter(m => m.role === 'system')
    expect(systemMsgs.length).toBeGreaterThanOrEqual(2)
    expect(systemMsgs[0].content).toBe('You are a helpful assistant.')
  })

  it('should keep recent N rounds intact', async () => {
    const msgs = generateLongConversation(10)
    const llm = mockLLMCall('Summary')

    const result = await fullCompact(msgs, llm, { keepRecentRounds: 3 })

    // Recent messages should include the last user messages
    const userMsgs = result.messages.filter(m => m.role === 'user')
    // At least 3 user messages (from keepRecentRounds) + "final question"
    expect(userMsgs.length).toBeGreaterThanOrEqual(3)
  })

  it('should call onArchive callback before compacting', async () => {
    const msgs = generateLongConversation(6)
    const llm = mockLLMCall('Summary')
    const onArchive = vi.fn().mockResolvedValue(undefined)

    await fullCompact(msgs, llm, { keepRecentRounds: 2, onArchive })

    expect(onArchive).toHaveBeenCalledTimes(1)
    const [archivedMsgs, summary] = onArchive.mock.calls[0]
    expect(archivedMsgs.length).toBeGreaterThan(0)
    expect(summary).toBe('Summary')
  })

  it('should not fail if onArchive throws', async () => {
    const msgs = generateLongConversation(6)
    const llm = mockLLMCall('Summary')
    const onArchive = vi.fn().mockRejectedValue(new Error('Archive failed'))

    // Should not throw
    const result = await fullCompact(msgs, llm, { keepRecentRounds: 2, onArchive })
    expect(result.wasCompacted).toBe(true)
  })

  it('should not compact if no old messages to compress', async () => {
    const msgs: Message[] = [
      makeUserMsg('hi'),
      makeAssistantMsg('hello'),
    ]
    const llm = mockLLMCall('Summary')

    const result = await fullCompact(msgs, llm, { keepRecentRounds: 3 })

    expect(result.wasCompacted).toBe(false)
    expect(result.compactType).toBe('none')
  })

  it('should fallback to micro-compact on LLM failure', async () => {
    const msgs: Message[] = []
    for (let i = 0; i < 20; i++) {
      msgs.push(makeUserMsg(`q${i}`))
      msgs.push(makeAssistantMsg(`a${i}`, [{ id: `tc-${i}`, name: 'Bash', arguments: {} }]))
      msgs.push(makeToolMsg('x'.repeat(200), `tc-${i}`))
    }

    const result = await fullCompact(msgs, failingLLMCall(), { keepRecentRounds: 3 })

    // Should fallback to micro-compact, not throw
    expect(result.compactType).toBe('micro')
  })

  it('should not split assistant(tool_calls) and tool messages', async () => {
    const msgs = generateLongConversation(10)
    const llm = mockLLMCall('Summary')

    const result = await fullCompact(msgs, llm, { keepRecentRounds: 3 })

    // Check that no tool message appears without its preceding assistant
    const recent = result.messages.filter(m => m.role !== 'system')
    for (let i = 0; i < recent.length; i++) {
      if (recent[i].role === 'tool') {
        // Previous non-system message should be assistant with toolCalls, or another tool
        const prev = recent[i - 1]
        expect(prev).toBeDefined()
        expect(['assistant', 'tool']).toContain(prev.role)
      }
    }
  })
})

// ── autoCompactIfNeeded ──

describe('autoCompactIfNeeded', () => {
  beforeEach(async () => {
    // 重置 CompactionManager 单例状态，确保测试之间隔离
    const { CompactionManager } = await import('../compact')
    const manager = (CompactionManager as any).getInstance()
    manager.reset()
  })

  it('should not compact below threshold', async () => {
    const msgs: Message[] = [
      makeUserMsg('hi'),
      makeAssistantMsg('hello'),
    ]
    const llm = mockLLMCall('Summary')

    const result = await autoCompactIfNeeded(msgs, llm, { autoCompactThreshold: 100_000 })

    expect(result.wasCompacted).toBe(false)
    expect(result.compactType).toBe('none')
  })

  it('should try micro-compact first', async () => {
    // Create messages that are just over threshold but micro-compact can fix
    const msgs: Message[] = []
    for (let i = 0; i < 200; i++) {
      msgs.push(makeUserMsg(`q${i}`))
      msgs.push(makeAssistantMsg(`a${i}`, [{ id: `tc-${i}`, name: 'Bash', arguments: {} }]))
      msgs.push(makeToolMsg('x'.repeat(2000), `tc-${i}`))  // Large tool results
    }

    const llm = mockLLMCall('Summary')

    // Use very low threshold to trigger compact, disable min token protection for test
    const result = await autoCompactIfNeeded(msgs, llm, {
      autoCompactThreshold: 1000,
      minTokensAfterCompact: 0 // Disable protection for test
    })

    // Should have compacted (either micro or full)
    expect(result.wasCompacted).toBe(true)
  })

  it('should escalate to full compact when micro is insufficient', async () => {
    // Create messages where micro-compact won't save enough
    const msgs: Message[] = []
    // Lots of user/assistant messages (not tool results) → micro won't help much
    for (let i = 0; i < 100; i++) {
      msgs.push(makeUserMsg('x'.repeat(500)))
      msgs.push(makeAssistantMsg('y'.repeat(500)))
    }

    const llm = mockLLMCall('Brief summary.')

    const result = await autoCompactIfNeeded(msgs, llm, {
      autoCompactThreshold: 1000,
      minTokensAfterCompact: 0, // Disable protection for test
      enableTieredCompaction: false // Use old strategy for this test
    })

    expect(result.wasCompacted).toBe(true)
    expect(result.compactType).toBe('full')
  })

  it('should use tiered compaction strategy when enabled', async () => {
    // Create messages for tiered compaction test - make sure they exceed threshold
    const msgs: Message[] = []
    for (let i = 0; i < 100; i++) {
      msgs.push(makeUserMsg(`User message ${i} about file /path/to/file${i}.ts `.repeat(10))) // Longer messages
      msgs.push(makeAssistantMsg(`Assistant response ${i} `.repeat(10)))
      if (i % 5 === 0) {
        msgs.push(makeToolMsg(`Tool result for file /path/to/file${i}.ts `.repeat(20), `tc-${i}`))
      }
    }

    const llm = mockLLMCall('Comprehensive summary of conversation.')

    const result = await autoCompactIfNeeded(msgs, llm, {
      autoCompactThreshold: 1000, // Low threshold to ensure compaction
      minTokensAfterCompact: 100, // Low threshold for test
      enableTieredCompaction: true,
      lightCompactThreshold: 0.1, // Very low to trigger light
      fullCompactThreshold: 0.2  // Very low to trigger full
    })

    // Should have compacted with one of the strategies
    expect(result.wasCompacted).toBe(true)
    expect(['micro', 'light', 'full']).toContain(result.compactType)
  })

  it('should respect cooldown period', async () => {

    const msgs: Message[] = []
    // Create enough messages to exceed threshold
    for (let i = 0; i < 20; i++) {
      msgs.push(makeUserMsg('x'.repeat(500)))
      msgs.push(makeAssistantMsg('y'.repeat(500)))
    }

    const llm = mockLLMCall('Summary')

    // First compaction should work
    const result1 = await autoCompactIfNeeded(msgs, llm, {
      autoCompactThreshold: 100,
      minTokensAfterCompact: 0,
      cooldownMs: 1000 // 1 second cooldown
    })

    expect(result1.wasCompacted).toBe(true)

    // Immediate second attempt should be blocked by cooldown
    const result2 = await autoCompactIfNeeded(msgs, llm, {
      autoCompactThreshold: 100,
      minTokensAfterCompact: 0,
      cooldownMs: 1000
    })

    expect(result2.wasCompacted).toBe(false)
    expect(result2.compactType).toBe('none')
  })

  it('should protect minimum tokens after compaction', async () => {
    const msgs: Message[] = [
      makeUserMsg('Short message'),
      makeAssistantMsg('Short response'),
    ]

    const llm = mockLLMCall('Summary')

    // With high minTokensAfterCompact, should not compact
    const result = await autoCompactIfNeeded(msgs, llm, {
      autoCompactThreshold: 10, // Very low threshold to trigger
      minTokensAfterCompact: 10000, // Very high minimum
      enableTieredCompaction: true
    })

    // Should not compact because it would drop below minimum
    expect(result.wasCompacted).toBe(false)
  })
})

describe('lightCompact', () => {
  it('should keep recent rounds and summarize older messages', () => {
    const messages: Message[] = [
      { role: 'system', content: 'System instruction' },
      { role: 'user', content: 'First request' },
      { role: 'assistant', content: 'First response' },
      { role: 'user', content: 'Second request' },
      { role: 'assistant', content: 'Second response' },
      { role: 'user', content: 'Third request' },
      { role: 'assistant', content: 'Third response' },
      { role: 'user', content: 'Fourth request' },
      { role: 'assistant', content: 'Fourth response' },
    ]

    const result = lightCompact(messages, { keepRecentRounds: 3 })

    expect(result.wasCompacted).toBe(true)
    expect(result.compactType).toBe('light')
    // 1 system + 1 summary + 3 rounds (each round has user+assistant = 2 messages) = 1 + 1 + 6 = 8
    expect(result.messages.length).toBe(8)
    expect(result.messages[0].role).toBe('system')
    expect(result.messages[1].role).toBe('system')
    expect(result.messages[1].content).toContain('<light_summary>')
    expect(result.messages[1].content).toContain('Earlier conversation summary:')
    expect(result.messages[2].role).toBe('user')
    expect(result.messages[2].content).toBe('Second request')
  })

  it('should handle tool calls correctly', () => {
    const messages: Message[] = [
      { role: 'user', content: 'First request' },
      { role: 'assistant', content: 'First response', tool_calls: [{ id: '1', type: 'function', function: { name: 'test', arguments: '{}' } }] },
      { role: 'tool', content: 'Tool result', tool_call_id: '1' },
      { role: 'user', content: 'Second request' },
      { role: 'assistant', content: 'Second response' },
      { role: 'user', content: 'Third request' },
      { role: 'assistant', content: 'Third response' },
    ]

    const result = lightCompact(messages, { keepRecentRounds: 2 })

    expect(result.wasCompacted).toBe(true)
    // Should keep the complete tool call sequence (user + assistant + tool)
    expect(result.messages.length).toBe(5) // summary + last 2 rounds (1 summary + 4 messages = 5)
    expect(result.messages[0].role).toBe('system')
    expect(result.messages[0].content).toContain('<light_summary>')
    expect(result.messages[1].role).toBe('user')
    expect(result.messages[1].content).toBe('Second request')
  })

  it('should extract file operations in summary', () => {
    const messages: Message[] = [
      { role: 'user', content: 'Read file: path: "src/test.ts"' },
      { role: 'assistant', content: 'File content' },
      { role: 'user', content: 'Edit file_path: "src/utils.js"' },
      { role: 'assistant', content: 'Edited' },
      { role: 'user', content: 'Recent request' },
      { role: 'assistant', content: 'Recent response' },
    ]

    const result = lightCompact(messages, { keepRecentRounds: 1 })

    expect(result.wasCompacted).toBe(true)
    const summary = result.messages[0].content as string
    expect(summary).toContain('Files mentioned:')
    expect(summary).toContain('src/test.ts')
    expect(summary).toContain('src/utils.js')
  })

  it('should not compact when messages are within keepRecentRounds', () => {
    const messages: Message[] = [
      { role: 'user', content: 'First request' },
      { role: 'assistant', content: 'First response' },
      { role: 'user', content: 'Second request' },
      { role: 'assistant', content: 'Second response' },
    ]

    const result = lightCompact(messages, { keepRecentRounds: 3 })

    expect(result.wasCompacted).toBe(false)
    expect(result.messages).toEqual(messages)
  })

  it('should preserve system messages', () => {
    const messages: Message[] = [
      { role: 'system', content: 'System 1' },
      { role: 'system', content: 'System 2' },
      { role: 'user', content: 'Old request' },
      { role: 'assistant', content: 'Old response' },
      { role: 'user', content: 'Recent request' },
      { role: 'assistant', content: 'Recent response' },
    ]

    const result = lightCompact(messages, { keepRecentRounds: 1 })

    expect(result.wasCompacted).toBe(true)
    // 2 system + 1 summary + 1 round (user+assistant = 2 messages) = 2 + 1 + 2 = 5
    expect(result.messages.length).toBe(5)
    expect(result.messages[0].role).toBe('system')
    expect(result.messages[0].content).toBe('System 1')
    expect(result.messages[1].role).toBe('system')
    expect(result.messages[1].content).toBe('System 2')
    expect(result.messages[2].role).toBe('system')
    expect(result.messages[2].content).toContain('<light_summary>')
    expect(result.messages[3].role).toBe('user')
    expect(result.messages[3].content).toBe('Recent request')
  })

  it('should handle empty messages array', () => {
    const messages: Message[] = []
    const result = lightCompact(messages)
    expect(result.wasCompacted).toBe(false)
    expect(result.messages).toEqual([])
  })

  it('should handle only system messages', () => {
    const messages: Message[] = [
      { role: 'system', content: 'System 1' },
      { role: 'system', content: 'System 2' },
    ]
    const result = lightCompact(messages)
    expect(result.wasCompacted).toBe(false)
    expect(result.messages).toEqual(messages)
  })

  it('should handle messages with array content', () => {
    const messages: Message[] = [
      { role: 'user', content: [{ type: 'text', text: 'First request' }] },
      { role: 'assistant', content: 'First response' },
      { role: 'user', content: [{ type: 'text', text: 'Second request' }] },
      { role: 'assistant', content: 'Second response' },
      { role: 'user', content: [{ type: 'text', text: 'Recent request' }] },
      { role: 'assistant', content: 'Recent response' },
    ]
    const result = lightCompact(messages, { keepRecentRounds: 1 })
    expect(result.wasCompacted).toBe(true)
    expect(result.messages.length).toBe(3) // summary + 1 round
    expect(result.messages[0].role).toBe('system')
    expect(result.messages[0].content).toContain('<light_summary>')
  })

  it('should respect custom keepRecentRounds', () => {
    const messages: Message[] = [
      { role: 'user', content: 'Request 1' },
      { role: 'assistant', content: 'Response 1' },
      { role: 'user', content: 'Request 2' },
      { role: 'assistant', content: 'Response 2' },
      { role: 'user', content: 'Request 3' },
      { role: 'assistant', content: 'Response 3' },
      { role: 'user', content: 'Request 4' },
      { role: 'assistant', content: 'Response 4' },
    ]

    // Test with keepRecentRounds = 2
    const result1 = lightCompact(messages, { keepRecentRounds: 2 })
    expect(result1.wasCompacted).toBe(true)
    expect(result1.messages.length).toBe(5) // summary + 2 rounds (1 summary + 4 messages = 5)

    // Test with keepRecentRounds = 4 (should not compact)
    const result2 = lightCompact(messages, { keepRecentRounds: 4 })
    expect(result2.wasCompacted).toBe(false)
    expect(result2.messages).toEqual(messages)
  })

  it('should include token counts in result', () => {
    const messages: Message[] = [
      { role: 'user', content: 'First request' },
      { role: 'assistant', content: 'First response' },
      { role: 'user', content: 'Second request' },
      { role: 'assistant', content: 'Second response' },
      { role: 'user', content: 'Recent request' },
      { role: 'assistant', content: 'Recent response' },
    ]

    const result = lightCompact(messages, { keepRecentRounds: 1 })
    expect(result.wasCompacted).toBe(true)
    expect(result.tokensBefore).toBeGreaterThan(0)
    expect(result.tokensAfter).toBeGreaterThan(0)
    // Note: light compact may increase tokens if summary is longer than original messages
    expect(result.messagesRemoved).toBe(4) // 2 rounds removed
  })
})
