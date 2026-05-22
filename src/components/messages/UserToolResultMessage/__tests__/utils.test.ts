import { describe, expect, test } from 'bun:test'
import { buildDsxuToolResultCompactCard } from '../utils'

describe('buildDsxuToolResultCompactCard', () => {
  test('summarizes canonical successful tool results without replaying full output', () => {
    const card = buildDsxuToolResultCompactCard({
      toolName: 'Bash',
      param: {
        type: 'tool_result',
        tool_use_id: 'toolu_1',
        content: [
          {
            type: 'text',
            text: 'schemaVersion=dsxu.runtime-event.v1\ncanonicalToolResult=true\noutputFile=tmp/run.log',
          },
        ],
      },
    })

    expect(card?.text).toContain('Tool result: Bash')
    expect(card?.text).toContain('status=ok')
    expect(card?.text).toContain('canonical=yes')
    expect(card?.text).toContain('artifact=tmp/run.log')
    expect(card?.dimColor).toBe(true)
  })

  test('does not add duplicate chrome for small ordinary results', () => {
    const card = buildDsxuToolResultCompactCard({
      toolName: 'Bash',
      param: {
        type: 'tool_result',
        tool_use_id: 'toolu_small',
        content: 'ok',
      },
    })

    expect(card).toBeNull()
  })

  test('marks large ordinary results as compact without copying output', () => {
    const longOutput = Array.from({ length: 20 }, (_, index) => `line-${index}`).join('\n')
    const card = buildDsxuToolResultCompactCard({
      toolName: 'PowerShell',
      param: {
        type: 'tool_result',
        tool_use_id: 'toolu_large',
        content: longOutput,
      },
    })

    expect(card?.text).toContain('Tool result: PowerShell')
    expect(card?.text).toContain('compact=yes')
    expect(card?.text).toContain('lines=20')
    expect(card?.text).not.toContain('line-19')
  })

  test('surfaces error result state compactly', () => {
    const card = buildDsxuToolResultCompactCard({
      toolName: 'Read',
      param: {
        type: 'tool_result',
        tool_use_id: 'toolu_2',
        is_error: true,
        content: 'DSXU tool state: permission_blocked\ncannot read outside owner scope',
      },
    })

    expect(card?.text).toContain('status=error')
    expect(card?.text).toContain('state=permission_blocked')
    expect(card?.color).toBe('red')
  })
})
