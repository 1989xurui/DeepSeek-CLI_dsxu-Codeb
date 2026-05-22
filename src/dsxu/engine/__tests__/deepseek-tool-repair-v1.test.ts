import { describe, expect, test } from 'bun:test'
import { DeepSeekAdapter } from '../../../services/api/deepseek-adapter'

describe('V26 DeepSeek tool repair absorption', () => {
  test('scavenges raw JSON and OpenAI-style tool calls from reasoning/content text', () => {
    const rawJson = DeepSeekAdapter.extractToolUsesFromText(
      '{"name":"Read","arguments":{"file_path":"src/query.ts"}}',
      { allowedNames: ['Read'], maxCalls: 2, maxInputChars: 1_000 },
    )
    const openAiStyle = DeepSeekAdapter.extractToolUsesFromText(
      '{"type":"function","function":{"name":"Bash","arguments":"{\\"command\\":\\"bun test src/dsxu/engine/__tests__/deepseek-tool-repair-v1.test.ts\\"}"}}',
      { allowedNames: ['Bash'], maxCalls: 2, maxInputChars: 1_000 },
    )

    expect(rawJson).toHaveLength(1)
    expect(rawJson[0]).toMatchObject({
      name: 'Read',
      input: { file_path: 'src/query.ts' },
    })
    expect(openAiStyle).toHaveLength(1)
    expect(openAiStyle[0]).toMatchObject({
      name: 'Bash',
      input: { command: 'bun test src/dsxu/engine/__tests__/deepseek-tool-repair-v1.test.ts' },
    })
  })

  test('keeps JSON scavenge bounded by allowed tool names, max calls, and input budget', () => {
    const calls = DeepSeekAdapter.extractToolUsesFromText(
      [
        '{"name":"Read","arguments":{"file_path":"src/a.ts"}}',
        '```json',
        '{"name":"Bash","arguments":{"command":"bun test"}}',
        '```',
        '```json',
        '{"name":"PowerShell","arguments":{"command":"Get-ChildItem"}}',
        '```',
      ].join('\n'),
      { allowedNames: ['Read', 'Bash'], maxCalls: 1, maxInputChars: 2_000 },
    )
    const budgetedOut = DeepSeekAdapter.extractToolUsesFromText(
      '{"name":"Read","arguments":{"file_path":"src/a.ts"}}',
      { allowedNames: ['Read'], maxCalls: 1, maxInputChars: 10 },
    )

    expect(calls).toHaveLength(1)
    expect(calls[0]?.name).toBe('Read')
    expect(budgetedOut).toHaveLength(0)
  })

  test('repairs recoverable truncated JSON and fails closed for unrecoverable JSON payloads', () => {
    const [repaired] = DeepSeekAdapter.extractToolUsesFromText(
      '<tool_call name="Bash">{"command":"bun test src/dsxu/engine/__tests__/deepseek-tool-repair-v1.test.ts</tool_call>',
    )
    const [invalid] = DeepSeekAdapter.extractToolUsesFromText(
      '<tool_call name="Bash">{"command":</tool_call>',
    )

    expect(repaired).toMatchObject({
      name: 'Bash',
      input: { command: 'bun test src/dsxu/engine/__tests__/deepseek-tool-repair-v1.test.ts' },
    })
    expect(invalid).toMatchObject({
      name: 'Bash',
      input: {
        __dsxu_repair_error: 'unrecoverable_json_payload',
      },
    })
    expect(invalid?.input).not.toHaveProperty('command')
  })

  test('plans DeepSeek schema flattening and nests arguments back before dispatch', () => {
    const schema = {
      type: 'object',
      properties: {
        file: { type: 'string' },
        patch: {
          type: 'object',
          properties: {
            range: {
              type: 'object',
              properties: {
                startLine: { type: 'number' },
                endLine: { type: 'number' },
              },
            },
            replacement: { type: 'string' },
          },
        },
      },
    }

    const plan = DeepSeekAdapter.planDeepSeekToolSchemaFlattening(schema)
    const nested = DeepSeekAdapter.nestDeepSeekFlattenedArguments({
      file: 'src/query.ts',
      patch__range__startLine: 10,
      patch__range__endLine: 12,
      patch__replacement: 'after',
      untouchedExtra: true,
    }, plan)

    expect(plan.shouldFlatten).toBe(true)
    expect(plan.maxDepth).toBe(3)
    expect(plan.mappings.map(mapping => mapping.flatKey)).toEqual([
      'file',
      'patch__range__startLine',
      'patch__range__endLine',
      'patch__replacement',
    ])
    expect(nested).toEqual({
      file: 'src/query.ts',
      patch: {
        range: {
          startLine: 10,
          endLine: 12,
        },
        replacement: 'after',
      },
      untouchedExtra: true,
    })
  })

  test('uses flattened schema in DeepSeek tool emission path and nests returned args', () => {
    const schema = {
      type: 'object',
      required: ['file', 'patch'],
      properties: {
        file: { type: 'string' },
        patch: {
          type: 'object',
          required: ['range'],
          properties: {
            range: {
              type: 'object',
              required: ['startLine'],
              properties: {
                startLine: { type: 'number' },
                endLine: { type: 'number' },
              },
            },
            replacement: { type: 'string' },
          },
        },
      },
    }
    const plans = DeepSeekAdapter.buildDeepSeekToolSchemaPlans([
      { name: 'EditComplex', input_schema: schema },
    ])
    const parameters = DeepSeekAdapter.getDeepSeekToolParameters(
      { name: 'EditComplex', input_schema: schema },
      plans,
    )
    const nested = DeepSeekAdapter.nestDeepSeekToolArguments('EditComplex', {
      file: 'src/query.ts',
      patch__range__startLine: 10,
      patch__range__endLine: 12,
      patch__replacement: 'after',
    }, plans)

    expect(plans.get('EditComplex')?.shouldFlatten).toBe(true)
    expect(Object.keys(parameters.properties as Record<string, unknown>)).toContain('patch__range__startLine')
    expect(parameters.required).toEqual(['file', 'patch__range__startLine'])
    expect(nested).toEqual({
      file: 'src/query.ts',
      patch: {
        range: {
          startLine: 10,
          endLine: 12,
        },
        replacement: 'after',
      },
    })
  })
})
