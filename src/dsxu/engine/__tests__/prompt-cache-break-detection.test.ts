import { describe, it, expect, beforeEach } from 'vitest'

import type { LLMResponse, ToolSchema } from '../types'
import {
  recordPromptState,
  checkResponseForCacheBreak,
  notifyCompaction,
  resetPromptCacheBreakDetection,
} from '../prompt-cache-break-detection'

function mkUsage(
  cacheReadTokens: number,
  overrides?: Partial<LLMResponse['usage']>,
): LLMResponse['usage'] {
  return {
    inputTokens: 30_000,
    outputTokens: 400,
    cacheReadTokens,
    cacheCreationTokens: 0,
    cacheHit: cacheReadTokens > 0,
    ...overrides,
  }
}

const TOOL_A: ToolSchema = {
  name: 'Read',
  description: 'Read file',
  inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
}

describe('prompt-cache-break-detection', () => {
  beforeEach(() => {
    resetPromptCacheBreakDetection()
  })

  it('should not report break on first baseline pair', () => {
    recordPromptState({
      querySource: 'repl_main_thread',
      systemPrompt: 'You are DSxu',
      toolSchemas: [TOOL_A],
      model: 'deepseek-chat',
    })
    expect(checkResponseForCacheBreak({
      querySource: 'repl_main_thread',
      usage: mkUsage(20_000),
    })).toBeNull()
  })

  it('should report break with model-change reason when cache read drops hard', () => {
    recordPromptState({
      querySource: 'repl_main_thread',
      systemPrompt: 'You are DSxu',
      toolSchemas: [TOOL_A],
      model: 'deepseek-chat',
    })
    checkResponseForCacheBreak({ querySource: 'repl_main_thread', usage: mkUsage(24_000) })

    recordPromptState({
      querySource: 'repl_main_thread',
      systemPrompt: 'You are DSxu',
      toolSchemas: [TOOL_A],
      model: 'deepseek-reasoner',
    })
    const report = checkResponseForCacheBreak({
      querySource: 'repl_main_thread',
      usage: mkUsage(8_000),
      sinceLastAssistantMs: 60_000,
    })

    expect(report).not.toBeNull()
    expect(report?.reason).toContain('model changed')
    expect(report?.tokenDrop).toBeGreaterThan(2_000)
  })

  it('should not report break for tiny token drop', () => {
    recordPromptState({
      querySource: 'repl_main_thread',
      systemPrompt: 'You are DSxu',
      toolSchemas: [TOOL_A],
      model: 'deepseek-chat',
    })
    checkResponseForCacheBreak({ querySource: 'repl_main_thread', usage: mkUsage(20_000) })

    recordPromptState({
      querySource: 'repl_main_thread',
      systemPrompt: 'You are DSxu',
      toolSchemas: [TOOL_A],
      model: 'deepseek-chat',
    })
    const report = checkResponseForCacheBreak({
      querySource: 'repl_main_thread',
      usage: mkUsage(18_500), // 1500 drop: below threshold
      sinceLastAssistantMs: 60_000,
    })
    expect(report).toBeNull()
  })

  it('should infer TTL reason when no prompt/tool/model changes', () => {
    recordPromptState({
      querySource: 'repl_main_thread',
      systemPrompt: 'Stable prompt',
      toolSchemas: [TOOL_A],
      model: 'deepseek-chat',
    })
    checkResponseForCacheBreak({ querySource: 'repl_main_thread', usage: mkUsage(22_000) })

    recordPromptState({
      querySource: 'repl_main_thread',
      systemPrompt: 'Stable prompt',
      toolSchemas: [TOOL_A],
      model: 'deepseek-chat',
    })
    const report = checkResponseForCacheBreak({
      querySource: 'repl_main_thread',
      usage: mkUsage(10_000),
      sinceLastAssistantMs: 10 * 60 * 1000,
    })

    expect(report).not.toBeNull()
    expect(report?.reason).toContain('possible 5min TTL expiry')
  })

  it('should skip break detection right after compaction notification', () => {
    recordPromptState({
      querySource: 'repl_main_thread',
      systemPrompt: 'Stable prompt',
      toolSchemas: [TOOL_A],
      model: 'deepseek-chat',
    })
    checkResponseForCacheBreak({ querySource: 'repl_main_thread', usage: mkUsage(22_000) })

    notifyCompaction('repl_main_thread')
    recordPromptState({
      querySource: 'repl_main_thread',
      systemPrompt: 'Stable prompt',
      toolSchemas: [TOOL_A],
      model: 'deepseek-chat',
    })
    const report = checkResponseForCacheBreak({
      querySource: 'repl_main_thread',
      usage: mkUsage(7_000),
      sinceLastAssistantMs: 30_000,
    })
    expect(report).toBeNull()
  })
})

