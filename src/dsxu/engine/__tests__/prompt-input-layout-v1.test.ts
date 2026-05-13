import { describe, expect, test } from 'bun:test'
import {
  computePromptInputMaxVisibleLines,
  MIN_INPUT_VIEWPORT_LINES,
  PROMPT_FOOTER_LINES,
} from '../../../components/PromptInput/layout'

describe('Prompt input fullscreen layout V1', () => {
  test('keeps input viewport within the fullscreen bottom half during resize', () => {
    expect(computePromptInputMaxVisibleLines(40, true)).toBe(15)
    expect(computePromptInputMaxVisibleLines(16, true)).toBe(MIN_INPUT_VIEWPORT_LINES)
    expect(computePromptInputMaxVisibleLines(14, true)).toBe(2)
    expect(computePromptInputMaxVisibleLines(12, true)).toBe(1)
    expect(computePromptInputMaxVisibleLines(40, false)).toBeUndefined()

    for (let rows = 12; rows <= 80; rows += 1) {
      const maxVisibleLines = computePromptInputMaxVisibleLines(rows, true)
      const bottomSlotRows = Math.floor(rows / 2)
      expect(maxVisibleLines).toBeDefined()
      expect(maxVisibleLines! + PROMPT_FOOTER_LINES).toBeLessThanOrEqual(bottomSlotRows)
    }
  })
})
