import { describe, expect, test } from 'bun:test'
import { DeepSeekAdapter } from '../deepseek-adapter'

describe('DeepSeek strict tool gateway evidence', () => {
  test('marks strict provider tool calls as strict_schema and fallback text calls as fallback', async () => {
    const strictResponse = new Response(JSON.stringify({
      id: 'chatcmpl-strict',
      model: 'deepseek-v4-flash',
      choices: [
        {
          finish_reason: 'tool_calls',
          message: {
            role: 'assistant',
            content: '',
            tool_calls: [
              {
                id: 'call-1',
                type: 'function',
                function: {
                  name: 'Read',
                  arguments: JSON.stringify({ file_path: 'src/index.ts' }),
                },
              },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }))
    const strict = await (DeepSeekAdapter as any).handleJSON(
      strictResponse,
      undefined,
      'test-request',
      'request-1',
      new Map(),
    )

    expect(strict.content[0]).toMatchObject({
      type: 'tool_use',
      name: 'Read',
      schemaPath: 'strict_schema',
    })

    const fallback = DeepSeekAdapter.extractToolUsesFromTextWithEvidence(
      '<Bash>{"command":"bun test"}</Bash>',
      { allowedNames: ['Bash'] },
    )
    expect(fallback).toHaveLength(1)
    expect(fallback[0]).toMatchObject({
      name: 'Bash',
      schemaPath: 'xml_fallback',
    })
    expect(fallback[0].fallbackReason).toContain('fallback instead of strict function call')
  })

  test('bounded JSON scavenge is observable and cannot call hidden tools', () => {
    const text = [
      '{"name":"MCPDocs","input":{"query":"secret docs"}}',
      '{"name":"Read","input":{"file_path":"src/dsxu/engine/tool-catalog-v1.ts"}}',
    ].join('\n')
    const recovered = DeepSeekAdapter.extractToolUsesFromTextWithEvidence(text, {
      allowedNames: ['Read'],
      maxCalls: 2,
      maxInputChars: 4096,
    })

    expect(recovered).toHaveLength(1)
    expect(recovered[0]).toMatchObject({
      name: 'Read',
      schemaPath: 'json_scavenge',
    })
    expect(recovered[0].fallbackReason).toContain('bounded JSON scavenge')
    expect(recovered.map(item => item.name)).not.toContain('MCPDocs')
  })
})
