import { describe, expect, test } from 'bun:test'
import {
  buildToolUseSummaryPromptItems,
  createDeterministicToolUseSummary,
} from '../../../services/toolUseSummary/toolUseSummaryGenerator'

describe('DSXU tool-use summary governance', () => {
  test('preserves tool, file, result, failure, and next-step recovery hints', () => {
    const items = buildToolUseSummaryPromptItems([
      {
        name: 'Edit',
        input: {
          file_path: 'src/example.ts',
          old_string: 'return false',
          new_string: 'return true',
        },
        output: {
          status: 'success',
          file: 'src/example.ts',
          result: 'applied 1 replacement',
          nextAction: 'run bun test src/example.test.ts',
        },
      },
      {
        name: 'Bash',
        input: {
          command: 'bun test src/example.test.ts',
        },
        output: {
          status: 'failed',
          exitCode: 1,
          failure: 'expected true but received false',
          nextAction: 'read failing assertion before retrying',
        },
      },
    ])

    expect(items).toHaveLength(2)
    expect(items[0].name).toBe('Edit')
    expect(items[0].input).toContain('src/example.ts')
    expect(items[0].output).toContain('applied 1 replacement')
    expect(items[0].output).toContain('nextAction')
    expect(items[1].name).toBe('Bash')
    expect(items[1].output).toContain('failed')
    expect(items[1].output).toContain('read failing assertion')
  })

  test('redacts credentials from nested tool input and output before model-visible summary prompts', () => {
    const items = buildToolUseSummaryPromptItems([
      {
        name: 'MCPTool',
        input: {
          server: 'private',
          authorization: 'Bearer v10-secret-token',
          nested: {
            apiKey: 'sk-v10-tool-summary-secret',
            cookie: 'session=secret',
          },
        },
        output: {
          text: 'lookup ok; Bearer abc.def.ghi; apiKey sk-v10-output-secret',
          password: 'do-not-show',
        },
      },
    ])

    const joined = `${items[0].input}\n${items[0].output}`

    expect(joined).toContain('[redacted]')
    expect(joined).not.toContain('v10-secret-token')
    expect(joined).not.toContain('sk-v10-tool-summary-secret')
    expect(joined).not.toContain('sk-v10-output-secret')
    expect(joined).not.toContain('do-not-show')
    expect(joined).not.toContain('abc.def.ghi')
  })

  test('deterministic fallback is concise and never claims verification evidence', () => {
    const summary = createDeterministicToolUseSummary([
      { name: 'Read', input: { file_path: 'a.ts' }, output: 'read ok' },
      { name: 'Edit', input: { file_path: 'a.ts' }, output: 'edit ok' },
      { name: 'Bash', input: { command: 'bun test' }, output: 'failed' },
    ])

    expect(summary).toBe('Ran 3 tools: Read, Edit, Bash')
    expect(summary).not.toMatch(/PASS|verified|successfully completed/i)
  })
})
