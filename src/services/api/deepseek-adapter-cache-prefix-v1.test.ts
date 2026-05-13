import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { SYSTEM_PROMPT_DYNAMIC_BOUNDARY } from '../../constants/prompts.js';
import { DeepSeekAdapter } from './deepseek-adapter.js';

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.DEEPSEEK_API_KEY;
const originalBaseUrl = process.env.DEEPSEEK_BASE_URL;
const originalTraceFile = process.env.DSXU_ROUTE_TRACE_FILE;
let tmpRoot: string | null = null;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalApiKey === undefined) delete process.env.DEEPSEEK_API_KEY;
  else process.env.DEEPSEEK_API_KEY = originalApiKey;
  if (originalBaseUrl === undefined) delete process.env.DEEPSEEK_BASE_URL;
  else process.env.DEEPSEEK_BASE_URL = originalBaseUrl;
  if (originalTraceFile === undefined) delete process.env.DSXU_ROUTE_TRACE_FILE;
  else process.env.DSXU_ROUTE_TRACE_FILE = originalTraceFile;
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

describe('DeepSeek adapter prompt-prefix cache payload', () => {
  test('normalizes system text blocks to a DeepSeek-native stable text prefix', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
    process.env.DEEPSEEK_BASE_URL = 'https://deepseek.local';
    tmpRoot = mkdtempSync(join(tmpdir(), 'dsxu-deepseek-prefix-'));
    const tracePath = join(tmpRoot, 'route.jsonl');
    process.env.DSXU_ROUTE_TRACE_FILE = tracePath;
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
  });
});
