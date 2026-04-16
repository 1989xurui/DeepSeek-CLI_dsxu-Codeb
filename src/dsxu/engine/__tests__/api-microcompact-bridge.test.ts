import { describe, expect, it } from 'vitest'

import { resolveAPIMicrocompactBridge } from '../api-microcompact-bridge'

describe('resolveAPIMicrocompactBridge', () => {
  it('should clamp local fallback trigger to DeepSeek budget trigger ratio', () => {
    const result = resolveAPIMicrocompactBridge({
      estimatedTokens: 81_000,
      modelContextLimit: 128_000,
      date: new Date('2026-04-13T12:00:00+08:00'),
      contextManagement: {
        edits: [
          {
            type: 'clear_tool_uses_20250919',
            trigger: { type: 'input_tokens', value: 180_000 },
            clear_at_least: { type: 'input_tokens', value: 140_000 },
          },
        ],
      },
    })

    expect(result.configuredTriggerTokens).toBe(180_000)
    expect(result.targetTokens).toBe(40_000)
    expect(result.localFallbackTriggerTokens).toBe(96_000)
    expect(result.shouldPreCompact).toBe(false)
  })

  it('should pre-compact earlier at night', () => {
    const result = resolveAPIMicrocompactBridge({
      estimatedTokens: 84_000,
      modelContextLimit: 128_000,
      date: new Date('2026-04-13T01:00:00+08:00'),
      contextManagement: {
        edits: [
          {
            type: 'clear_tool_uses_20250919',
            trigger: { type: 'input_tokens', value: 180_000 },
            clear_at_least: { type: 'input_tokens', value: 140_000 },
          },
        ],
      },
    })

    expect(result.localFallbackTriggerTokens).toBe(83_200)
    expect(result.shouldPreCompact).toBe(true)
  })

  it('should honor configured trigger and target from apiMicrocompact', () => {
    const result = resolveAPIMicrocompactBridge({
      estimatedTokens: 72_000,
      modelContextLimit: 128_000,
      date: new Date('2026-04-13T12:00:00+08:00'),
      contextManagement: {
        edits: [
          {
            type: 'clear_tool_uses_20250919',
            trigger: { type: 'input_tokens', value: 70_000 },
            clear_at_least: { type: 'input_tokens', value: 30_000 },
          },
        ],
      },
    })

    expect(result.configuredTriggerTokens).toBe(70_000)
    expect(result.targetTokens).toBe(40_000)
    expect(result.localFallbackTriggerTokens).toBe(70_000)
    expect(result.shouldPreCompact).toBe(true)
  })
})
