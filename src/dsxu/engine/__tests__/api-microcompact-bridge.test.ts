import { describe, expect, it } from 'vitest'

import { resolveAPIMicrocompactBridge } from '../api-microcompact-bridge'
import { DEEPSEEK_CONTEXT_WINDOW } from '../model-limits'

describe('resolveAPIMicrocompactBridge', () => {
  it('should clamp local fallback trigger to DeepSeek V4 window-aware trigger ratio', () => {
    const result = resolveAPIMicrocompactBridge({
      estimatedTokens: 700_000,
      modelContextLimit: DEEPSEEK_CONTEXT_WINDOW,
      date: new Date('2026-04-13T12:00:00+08:00'),
      contextManagement: {
        edits: [
          {
            type: 'clear_tool_uses_20250919',
            trigger: { type: 'input_tokens', value: 900_000 },
            clear_at_least: { type: 'input_tokens', value: 637_856 },
          },
        ],
      },
    })

    expect(result.configuredTriggerTokens).toBe(900_000)
    expect(result.targetTokens).toBe(Math.floor(DEEPSEEK_CONTEXT_WINDOW * 0.25))
    expect(result.localFallbackTriggerTokens).toBe(Math.floor(DEEPSEEK_CONTEXT_WINDOW * 0.75))
    expect(result.shouldPreCompact).toBe(false)
  })

  it('should apply lower night fallback ratio without returning to old 128K limits', () => {
    const result = resolveAPIMicrocompactBridge({
      estimatedTokens: 700_000,
      modelContextLimit: DEEPSEEK_CONTEXT_WINDOW,
      date: new Date('2026-04-13T01:00:00+08:00'),
      contextManagement: {
        edits: [
          {
            type: 'clear_tool_uses_20250919',
            trigger: { type: 'input_tokens', value: 900_000 },
            clear_at_least: { type: 'input_tokens', value: 637_856 },
          },
        ],
      },
    })

    expect(result.targetTokens).toBe(Math.floor(DEEPSEEK_CONTEXT_WINDOW * 0.25))
    expect(result.localFallbackTriggerTokens).toBe(Math.floor(DEEPSEEK_CONTEXT_WINDOW * 0.65))
    expect(result.shouldPreCompact).toBe(true)
  })

  it('should honor configured trigger while deriving target from context window', () => {
    const result = resolveAPIMicrocompactBridge({
      estimatedTokens: 720_000,
      modelContextLimit: DEEPSEEK_CONTEXT_WINDOW,
      date: new Date('2026-04-13T12:00:00+08:00'),
      contextManagement: {
        edits: [
          {
            type: 'clear_tool_uses_20250919',
            trigger: { type: 'input_tokens', value: 700_000 },
            clear_at_least: { type: 'input_tokens', value: 437_856 },
          },
        ],
      },
    })

    expect(result.configuredTriggerTokens).toBe(700_000)
    expect(result.targetTokens).toBe(Math.floor(DEEPSEEK_CONTEXT_WINDOW * 0.25))
    expect(result.localFallbackTriggerTokens).toBe(700_000)
    expect(result.shouldPreCompact).toBe(true)
  })
})
