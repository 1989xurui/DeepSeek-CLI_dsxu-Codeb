import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { SYSTEM_PROMPT_DYNAMIC_BOUNDARY } from '../../constants/prompts.js';
import { globalCacheStats } from '../cache-stats.js';
import { DeepSeekAdapter } from './deepseek-adapter.js';

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.DEEPSEEK_API_KEY;
const originalBaseUrl = process.env.DEEPSEEK_BASE_URL;
const originalTraceFile = process.env.DSXU_ROUTE_TRACE_FILE;
const originalCacheStatsPath = process.env.DSXU_CACHE_STATS_PATH;
let tmpRoot: string | null = null;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalApiKey === undefined) delete process.env.DEEPSEEK_API_KEY;
  else process.env.DEEPSEEK_API_KEY = originalApiKey;
  if (originalBaseUrl === undefined) delete process.env.DEEPSEEK_BASE_URL;
  else process.env.DEEPSEEK_BASE_URL = originalBaseUrl;
  if (originalTraceFile === undefined) delete process.env.DSXU_ROUTE_TRACE_FILE;
  else process.env.DSXU_ROUTE_TRACE_FILE = originalTraceFile;
  (globalCacheStats as any).reset?.();
  (globalCacheStats as any)._hit = 0;
  (globalCacheStats as any)._miss = 0;
  if (originalCacheStatsPath === undefined) delete process.env.DSXU_CACHE_STATS_PATH;
  else process.env.DSXU_CACHE_STATS_PATH = originalCacheStatsPath;
  if (tmpRoot && existsSync(tmpRoot)) {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
  tmpRoot = null;
});

function okChatResponse() {
  return new Response(
    JSON.stringify({
      id: 'chatcmpl-cache-prefix-test',
      model: 'deepseek-v4-flash',
      choices: [
        {
          finish_reason: 'stop',
          message: { role: 'assistant', content: 'ok' },
        },
      ],
      usage: {
        prompt_tokens: 120,
        completion_tokens: 2,
        prompt_cache_hit_tokens: 100,
        prompt_cache_miss_tokens: 20,
      },
    }),
    {
      status: 200,
      headers: { 'x-request-id': 'cache-prefix-test' },
    },
  );
}

function resetCacheStatsForTest() {
  tmpRoot = tmpRoot ?? mkdtempSync(join(tmpdir(), 'dsxu-deepseek-prefix-'));
  process.env.DSXU_CACHE_STATS_PATH = join(tmpRoot, 'cache-stats.json');
  (globalCacheStats as any).reset?.();
  (globalCacheStats as any)._hit = 0;
  (globalCacheStats as any)._miss = 0;
}

describe('DeepSeek adapter prompt-prefix cache payload', () => {
  test('normalizes system text blocks to a DeepSeek-native stable text prefix', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
    process.env.DEEPSEEK_BASE_URL = 'https://deepseek.local';
    tmpRoot = mkdtempSync(join(tmpdir(), 'dsxu-deepseek-prefix-'));
    const tracePath = join(tmpRoot, 'route.jsonl');
    process.env.DSXU_ROUTE_TRACE_FILE = tracePath;
    resetCacheStatsForTest();
    let capturedBody: any;

    globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      capturedBody = JSON.parse(String(init?.body ?? '{}'));
      return okChatResponse();
    }) as typeof fetch;

    await DeepSeekAdapter.transformRequest(
      {
        model: 'deepseek-v4-flash',
        max_tokens: 64,
        stream: false,
        messages: [{ role: 'user', content: 'hello' }],
        system: [
          {
            type: 'text',
            text: 'stable system rules',
            cache_control: { type: 'ephemeral', scope: 'global' },
          },
          {
            type: 'text',
            text: SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
            cache_control: { type: 'ephemeral', scope: 'global' },
          },
          {
            type: 'text',
            text: 'Context Window & Hygiene: dynamic per-turn value',
            cache_control: { type: 'ephemeral', scope: 'org' },
          },
        ],
      },
      {},
    );

    expect(capturedBody.messages[0]).toEqual({
      role: 'system',
      content:
        'stable system rules\n\nContext Window & Hygiene: dynamic per-turn value',
    });
    expect(JSON.stringify(capturedBody.messages[0])).not.toContain(
      'cache_control',
    );
    expect(JSON.stringify(capturedBody.messages[0])).not.toContain(
      SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
    );

    const requestPlan = readFileSync(tracePath, 'utf8')
      .trim()
      .split(/\r?\n/)
      .map(line => JSON.parse(line))
      .find(line => line.event === 'request_plan');
    expect(requestPlan.systemPromptSummary).toMatchObject({
      rawKind: 'array',
      rawBlockCount: 3,
      cacheControlBlockCount: 3,
      boundaryBlockCount: 1,
      normalizedChars:
        'stable system rules\n\nContext Window & Hygiene: dynamic per-turn value'
          .length,
    });
    expect(requestPlan.systemPromptSummary.normalizedHash).toHaveLength(16);

    const responseUsage = readFileSync(tracePath, 'utf8')
      .trim()
      .split(/\r?\n/)
      .map(line => JSON.parse(line))
      .find(line => line.event === 'response_usage');
    expect(responseUsage).toMatchObject({
      inputTokens: 120,
      outputTokens: 2,
      cacheHitInputTokens: 100,
      cacheMissInputTokens: 20,
      cacheHitRatePct: 83.3,
    });
    expect(globalCacheStats.hit).toBe(100);
    expect(globalCacheStats.miss).toBe(20);
  });

  test('preserves thinking tool-call rounds only when thinking mode is enabled', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
    process.env.DEEPSEEK_BASE_URL = 'https://deepseek.local';
    resetCacheStatsForTest();
    let capturedThinkingBody: any;
    let capturedNonThinkingBody: any;

    globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}'));
      if (body.thinking?.type === 'enabled') capturedThinkingBody = body;
      else capturedNonThinkingBody = body;
      return okChatResponse();
    }) as typeof fetch;

    const messages = [
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'inspect route evidence' },
          { type: 'text', text: 'I will inspect the source.' },
          { type: 'tool_use', id: 'toolu-read-1', name: 'Read', input: { file_path: 'src/index.ts' } },
        ],
      },
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'toolu-read-1', content: 'source content' },
          { type: 'text', text: 'Continue.' },
        ],
      },
    ];

    await DeepSeekAdapter.transformRequest(
      {
        model: 'deepseek-v4-flash',
        max_tokens: 64,
        stream: false,
        thinking: { type: 'enabled' },
        messages,
      },
      {},
    );
    await DeepSeekAdapter.transformRequest(
      {
        model: 'deepseek-v4-flash',
        max_tokens: 64,
        stream: false,
        thinking: { type: 'disabled' },
        messages,
      },
      {},
    );

    const thinkingAssistant = capturedThinkingBody.messages.find((message: any) => message.role === 'assistant');
    expect(thinkingAssistant.reasoning_content).toBe('inspect route evidence');
    expect(thinkingAssistant.tool_calls[0]).toMatchObject({
      id: 'toolu-read-1',
      type: 'function',
      function: {
        name: 'Read',
        arguments: JSON.stringify({ file_path: 'src/index.ts' }),
      },
    });
    expect(capturedThinkingBody.messages).toContainEqual({
      role: 'tool',
      tool_call_id: 'toolu-read-1',
      content: 'source content',
    });
    expect(capturedThinkingBody.thinking).toEqual({ type: 'enabled' });

    const nonThinkingAssistant = capturedNonThinkingBody.messages.find((message: any) => message.role === 'assistant');
    expect(nonThinkingAssistant.reasoning_content).toBeUndefined();
    expect(nonThinkingAssistant.tool_calls[0]).toMatchObject({
      id: 'toolu-read-1',
      type: 'function',
      function: {
        name: 'Read',
        arguments: JSON.stringify({ file_path: 'src/index.ts' }),
      },
    });
    expect(capturedNonThinkingBody.messages).toContainEqual({
      role: 'tool',
      tool_call_id: 'toolu-read-1',
      content: 'source content',
    });
    expect(JSON.stringify(capturedNonThinkingBody.messages)).not.toContain(
      'inspect route evidence',
    );
    expect(capturedNonThinkingBody.thinking).toEqual({ type: 'disabled' });
    expect(capturedNonThinkingBody.temperature).toBe(1.0);
  });
});
