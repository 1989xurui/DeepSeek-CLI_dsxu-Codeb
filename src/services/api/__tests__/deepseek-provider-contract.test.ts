import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DeepSeekAdapter } from '../deepseek-adapter'

const originalFetch = globalThis.fetch
const originalApiKey = process.env.DEEPSEEK_API_KEY
const originalBaseUrl = process.env.DEEPSEEK_BASE_URL
const originalTraceFile = process.env.DSXU_ROUTE_TRACE_FILE
let tmpRoot: string | null = null

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalApiKey === undefined) delete process.env.DEEPSEEK_API_KEY
  else process.env.DEEPSEEK_API_KEY = originalApiKey
  if (originalBaseUrl === undefined) delete process.env.DEEPSEEK_BASE_URL
  else process.env.DEEPSEEK_BASE_URL = originalBaseUrl
  if (originalTraceFile === undefined) delete process.env.DSXU_ROUTE_TRACE_FILE
  else process.env.DSXU_ROUTE_TRACE_FILE = originalTraceFile
  if (tmpRoot && existsSync(tmpRoot)) {
    rmSync(tmpRoot, { recursive: true, force: true })
  }
  tmpRoot = null
})

function okResponse(extra: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({
    id: 'chatcmpl-v6-provider-contract',
    model: 'deepseek-v4-flash',
    choices: [{
      finish_reason: 'stop',
      message: {
        role: 'assistant',
        content: 'ok',
        ...extra,
      },
    }],
    usage: {
      prompt_tokens: 200,
      completion_tokens: 40,
      prompt_cache_hit_tokens: 150,
      prompt_cache_miss_tokens: 50,
      completion_tokens_details: {
        reasoning_tokens: 12,
      },
    },
  }), {
    status: 200,
    headers: { 'x-request-id': 'v6-provider-contract' },
  })
}

describe('V6 DeepSeek provider contract', () => {
  test('round-trips thinking, reasoning_content, tool calls, and tool results through the canonical adapter body', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key'
    process.env.DEEPSEEK_BASE_URL = 'https://deepseek.local'
    let capturedBody: any

    globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      capturedBody = JSON.parse(String(init?.body ?? '{}'))
      return okResponse()
    }) as typeof fetch

    await DeepSeekAdapter.transformRequest({
      model: 'deepseek-v4-flash',
      max_tokens: 256,
      stream: false,
      thinking: { type: 'enabled' },
      reasoning_effort: 'high',
      messages: [
        {
          role: 'assistant',
          content: [
            { type: 'thinking', thinking: 'locate source before editing' },
            { type: 'text', text: 'I will inspect the file.' },
            {
              type: 'tool_use',
              id: 'toolu-read-1',
              name: 'Read',
              input: { file_path: 'src/app.ts' },
            },
          ],
        },
        {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'toolu-read-1', content: 'source text' },
            { type: 'text', text: 'continue' },
          ],
        },
      ],
    }, {})

    expect(capturedBody).toMatchObject({
      model: 'deepseek-v4-flash',
      thinking: { type: 'enabled' },
      reasoning_effort: 'high',
      stream: false,
    })
    const assistant = capturedBody.messages.find((message: any) => message.role === 'assistant')
    expect(assistant).toMatchObject({
      reasoning_content: 'locate source before editing',
      tool_calls: [{
        id: 'toolu-read-1',
        type: 'function',
        function: {
          name: 'Read',
          arguments: JSON.stringify({ file_path: 'src/app.ts' }),
        },
      }],
    })
    expect(capturedBody.messages).toContainEqual({
      role: 'tool',
      tool_call_id: 'toolu-read-1',
      content: 'source text',
    })
  })

  test('removes reasoning_content from non-thinking requests and keeps usage/cache evidence in route trace', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key'
    process.env.DEEPSEEK_BASE_URL = 'https://deepseek.local'
    tmpRoot = mkdtempSync(join(tmpdir(), 'dsxu-v6-provider-contract-'))
    const tracePath = join(tmpRoot, 'route.jsonl')
    process.env.DSXU_ROUTE_TRACE_FILE = tracePath
    let capturedBody: any

    globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      capturedBody = JSON.parse(String(init?.body ?? '{}'))
      return okResponse()
    }) as typeof fetch

    const result = await DeepSeekAdapter.transformRequest({
      model: 'deepseek-v4-flash',
      max_tokens: 128,
      stream: false,
      thinking: { type: 'disabled' },
      messages: [{
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'do not leak this in non-thinking mode' },
          { type: 'text', text: 'plain answer' },
        ],
      }],
    }, {})

    expect(capturedBody.thinking).toEqual({ type: 'disabled' })
    expect(capturedBody.temperature).toBe(1)
    expect(JSON.stringify(capturedBody.messages)).not.toContain('do not leak this')
    expect(result.usage).toMatchObject({
      input_tokens: 200,
      output_tokens: 40,
      cache_read_input_tokens: 150,
      cache_creation_input_tokens: 50,
      reasoning_tokens: 12,
      dsxu: expect.objectContaining({
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        prompt_cache_hit_tokens: 150,
        prompt_cache_miss_tokens: 50,
      }),
    })
    const trace = readFileSync(tracePath, 'utf8')
      .trim()
      .split(/\r?\n/)
      .map(line => JSON.parse(line))
    expect(trace.some(line => line.event === 'request_plan' && line.thinkingEnabled === false)).toBe(true)
    expect(trace).toContainEqual(expect.objectContaining({
      event: 'response_usage',
      inputTokens: 200,
      outputTokens: 40,
      cacheHitInputTokens: 150,
      cacheMissInputTokens: 50,
      cacheHitRatePct: 75,
    }))
  })

  test('compiles oversized nested tool schemas to DeepSeek-safe flat schemas and nests returned tool arguments', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key'
    process.env.DEEPSEEK_BASE_URL = 'https://deepseek.local'
    let capturedBody: any

    globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      capturedBody = JSON.parse(String(init?.body ?? '{}'))
      return okResponse({
        content: null,
        tool_calls: [{
          id: 'toolu-complex-1',
          type: 'function',
          function: {
            name: 'ComplexEdit',
            arguments: JSON.stringify({
              patch__target__file_path: 'src/app.ts',
              patch__target__line: 10,
              patch__replacement__text: 'ok',
            }),
          },
        }],
      })
    }) as typeof fetch

    const result = await DeepSeekAdapter.transformRequest({
      model: 'deepseek-v4-flash',
      max_tokens: 128,
      stream: false,
      messages: [{ role: 'user', content: 'edit source' }],
      tools: [{
        name: 'ComplexEdit',
        description: 'apply a structured edit',
        input_schema: {
          type: 'object',
          properties: {
            patch: {
              type: 'object',
              properties: {
                target: {
                  type: 'object',
                  properties: {
                    file_path: { type: 'string' },
                    line: { type: 'number' },
                  },
                  required: ['file_path', 'line'],
                },
                replacement: {
                  type: 'object',
                  properties: {
                    text: { type: 'string' },
                  },
                  required: ['text'],
                },
              },
              required: ['target', 'replacement'],
            },
          },
          required: ['patch'],
        },
      }],
    }, {})

    const parameters = capturedBody.tools[0].function.parameters
    expect(parameters).toMatchObject({
      type: 'object',
      additionalProperties: false,
    })
    expect(parameters.required).toEqual([
      'patch__target__file_path',
      'patch__target__line',
      'patch__replacement__text',
    ])
    expect(result.stop_reason).toBe('tool_use')
    expect(result.content).toContainEqual(expect.objectContaining({
      type: 'tool_use',
      id: 'toolu-complex-1',
      name: 'ComplexEdit',
      input: {
        patch: {
          target: { file_path: 'src/app.ts', line: 10 },
          replacement: { text: 'ok' },
        },
      },
    }))
  })
})
