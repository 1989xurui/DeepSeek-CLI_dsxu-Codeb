import { describe, expect, test } from 'bun:test'
import {
  MAX_AUTO_EXPAND_SHELL_OUTPUT_CHARS,
  MAX_AUTO_EXPAND_SHELL_OUTPUT_LINES,
  shouldAutoExpandShellOutput,
} from '../ExpandShellOutputContext'

describe('shouldAutoExpandShellOutput', () => {
  test('allows short recent shell output to auto expand', () => {
    expect(shouldAutoExpandShellOutput('one\ntwo\nthree')).toBe(true)
  })

  test('keeps long shell output compact by character budget', () => {
    expect(shouldAutoExpandShellOutput('x'.repeat(MAX_AUTO_EXPAND_SHELL_OUTPUT_CHARS + 1))).toBe(false)
  })

  test('keeps long shell output compact by line budget', () => {
    const output = Array.from(
      { length: MAX_AUTO_EXPAND_SHELL_OUTPUT_LINES + 1 },
      (_, index) => `line-${index}`,
    ).join('\n')

    expect(shouldAutoExpandShellOutput(output)).toBe(false)
  })
})
