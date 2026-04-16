/**
 * Forked Agent 测试
 *
 * 测试策略：
 * - Mock LLM（不依赖真实 API）
 * - 测试消息快照隔离
 * - 测试单 fork 限制
 * - 测试超时保护
 * - 测试 transcript 归档
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFork, createForkAgentTool, getActiveForkCount } from '../forked-agent'
import { ToolRegistry } from '../tool-registry'
import { createMockLLMCall } from '../llm-adapter'
import type { LLMResponse, Message, ToolDefinition } from '../types'

// ── Helpers ──

function mockResponse(content: string, toolCalls: LLMResponse['toolCalls'] = []): LLMResponse {
  return {
    content,
    toolCalls,
    stopReason: toolCalls.length > 0 ? 'tool_use' : 'end_turn',
    usage: { inputTokens: 50, outputTokens: 25 },
  }
}

const echoTool: ToolDefinition = {
  name: 'echo',
  description: 'Echo input',
  inputSchema: { type: 'object', properties: { text: { type: 'string' } } },
  execute: async (input) => ({ content: `Echo: ${input.text}` }),
  concurrencySafe: true,
  readOnly: true,
}

function makeRegistry(): ToolRegistry {
  const reg = new ToolRegistry()
  reg.register(echoTool)
  return reg
}

// ── Basic Fork ──

describe('createFork', () => {
  it('should execute a simple fork and return result', async () => {
    const llm = createMockLLMCall([
      mockResponse('Task completed: I found 3 files.'),
    ])

    const result = await createFork(
      'Find all TypeScript files in the project',
      [{ role: 'user', content: 'fix the bug' }],
      llm,
      makeRegistry(),
      { recordTranscript: false },
    )

    expect(result.exitReason).toBe('end_turn')
    expect(result.turns).toBe(1)
    expect(result.finalMessage).toContain('Task completed')
    expect(result.forkId).toMatch(/^fork-/)
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('should execute fork with tool calls', async () => {
    const llm = createMockLLMCall([
      mockResponse('Let me check...', [
        { id: 'tc-1', name: 'echo', arguments: { text: 'hello' } },
      ]),
      mockResponse('Done! Echo returned "hello".'),
    ])

    const result = await createFork(
      'Echo hello using the echo tool',
      [],
      llm,
      makeRegistry(),
      { recordTranscript: false },
    )

    expect(result.exitReason).toBe('end_turn')
    expect(result.turns).toBe(2)
    expect(result.finalMessage).toContain('Done!')
  })

  it('should respect maxTurns', async () => {
    const infiniteResponses = Array.from({ length: 20 }, () =>
      mockResponse('Looping...', [
        { id: `tc-${Math.random()}`, name: 'echo', arguments: { text: 'loop' } },
      ])
    )

    const llm = createMockLLMCall(infiniteResponses)

    const result = await createFork(
      'Loop forever',
      [],
      llm,
      makeRegistry(),
      { maxTurns: 3, recordTranscript: false },
    )

    expect(result.exitReason).toBe('max_turns')
    expect(result.turns).toBeLessThanOrEqual(3)
  })

  it('should handle LLM errors gracefully', async () => {
    const llm = async () => {
      throw new Error('API unavailable')
    }

    const result = await createFork(
      'Do something',
      [],
      llm as any,
      makeRegistry(),
      { recordTranscript: false },
    )

    // Should not throw, should return error result
    expect(result.exitReason).toBe('api_error')
    expect(result.forkId).toMatch(/^fork-/)
  })
})

// ── Message Isolation ──

describe('Fork message isolation', () => {
  it('should not mutate parent messages', async () => {
    const parentMessages: Message[] = [
      { role: 'user', content: 'original question' },
      { role: 'assistant', content: 'original answer' },
    ]

    const originalContent = parentMessages[0].content

    const llm = createMockLLMCall([mockResponse('Fork done.')])

    await createFork(
      'Do a sub-task',
      parentMessages,
      llm,
      makeRegistry(),
      { recordTranscript: false },
    )

    // Parent messages should be unchanged
    expect(parentMessages).toHaveLength(2)
    expect(parentMessages[0].content).toBe(originalContent)
  })

  it('should include parent context summary in fork', async () => {
    let capturedMessages: Message[] = []
    const llm = async (messages: Message[]) => {
      capturedMessages = messages
      return mockResponse('Done.')
    }

    await createFork(
      'Sub-task directive',
      [
        { role: 'user', content: 'Fix the auth bug in login.ts' },
        { role: 'assistant', content: 'I found the issue in line 42...' },
      ],
      llm,
      makeRegistry(),
      { recordTranscript: false },
    )

    // Fork should have system prompt with parent context
    const systemMsg = capturedMessages.find(m => m.role === 'system')
    expect(systemMsg).toBeDefined()
    expect(systemMsg!.content).toContain('sub-agent')
    expect(systemMsg!.content).toContain('auth bug')

    // Fork should have the directive as user message
    const userMsg = capturedMessages.find(m => m.role === 'user')
    expect(userMsg).toBeDefined()
    expect(userMsg!.content).toBe('Sub-task directive')
  })
})

// ── Single Fork Limit ──

describe('Single fork limit', () => {
  it('should track active fork count', async () => {
    expect(getActiveForkCount()).toBe(0)

    const llm = createMockLLMCall([mockResponse('Done.')])
    await createFork('task', [], llm, makeRegistry(), { recordTranscript: false })

    // After completion, count should be back to 0
    expect(getActiveForkCount()).toBe(0)
  })

  it('should reject second concurrent fork', async () => {
    // Create a slow LLM that takes time
    let resolveSlowLLM: (() => void) | null = null
    const slowLLM = () => new Promise<LLMResponse>((resolve) => {
      resolveSlowLLM = () => resolve(mockResponse('Slow done.'))
    })

    const reg = makeRegistry()

    // Start first fork (will hang)
    const fork1Promise = createFork('slow task', [], slowLLM, reg, { recordTranscript: false })

    // Wait a tick for the first fork to start
    await new Promise(r => setTimeout(r, 10))
    expect(getActiveForkCount()).toBe(1)

    // Start second fork → should be rejected
    const fork2 = await createFork('fast task', [], createMockLLMCall([mockResponse('Done.')]), reg, { recordTranscript: false })
    expect(fork2.exitReason).toBe('max_forks')
    expect(fork2.finalMessage).toContain('已有活跃的子任务')

    // Clean up: resolve slow LLM
    resolveSlowLLM?.()
    await fork1Promise
    expect(getActiveForkCount()).toBe(0)
  })
})

// ── ForkAgent Tool ──

describe('createForkAgentTool', () => {
  it('should create a working fork tool', async () => {
    const llm = createMockLLMCall([mockResponse('Sub-task complete!')])
    const reg = makeRegistry()
    const parentMsgs: Message[] = [{ role: 'user', content: 'main task' }]

    const forkTool = createForkAgentTool(
      llm,
      reg,
      () => parentMsgs,
      { recordTranscript: false },
    )

    expect(forkTool.name).toBe('ForkAgent')

    const result = await forkTool.execute(
      { directive: 'Do sub-task' },
      { cwd: '/project', sessionId: 'test', gear: 1 },
    )

    expect(result.content).toContain('Agent Summary')
    expect(result.content).toContain('Sub-task complete!')
    expect(result.content).toContain('success')
  })

  it('should require directive', async () => {
    const forkTool = createForkAgentTool(
      createMockLLMCall([]),
      makeRegistry(),
      () => [],
      { recordTranscript: false },
    )

    const result = await forkTool.execute(
      { directive: '' },
      { cwd: '/project', sessionId: 'test', gear: 1 },
    )

    expect(result.isError).toBe(true)
    expect(result.content).toContain('directive is required')
  })
})

// ── Events ──

describe('Fork events', () => {
  it('should collect events during fork execution', async () => {
    const llm = createMockLLMCall([
      mockResponse('Using tool...', [
        { id: 'tc-1', name: 'echo', arguments: { text: 'test' } },
      ]),
      mockResponse('All done.'),
    ])

    const result = await createFork(
      'Use echo tool',
      [],
      llm,
      makeRegistry(),
      { recordTranscript: false },
    )

    expect(result.events.length).toBeGreaterThan(0)
    expect(result.events.some(e => e.type === 'turn_start')).toBe(true)
    expect(result.events.some(e => e.type === 'tool_result')).toBe(true)
    expect(result.events.some(e => e.type === 'completed')).toBe(true)
  })
})
