import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { DeepSeekAdapter } from './deepseek-adapter.js';
import { DeepSeekTrajectoryStore } from './deepseek-trajectory-store.js';

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.DEEPSEEK_API_KEY;
const originalBaseUrl = process.env.DEEPSEEK_BASE_URL;
const originalTrajectoryFile = process.env.DSXU_DEEPSEEK_TRAJECTORY_FILE;
let tmpRoot: string | null = null;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalApiKey === undefined) delete process.env.DEEPSEEK_API_KEY;
  else process.env.DEEPSEEK_API_KEY = originalApiKey;
  if (originalBaseUrl === undefined) delete process.env.DEEPSEEK_BASE_URL;
  else process.env.DEEPSEEK_BASE_URL = originalBaseUrl;
  if (originalTrajectoryFile === undefined) delete process.env.DSXU_DEEPSEEK_TRAJECTORY_FILE;
  else process.env.DSXU_DEEPSEEK_TRAJECTORY_FILE = originalTrajectoryFile;
  if (tmpRoot && existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true, force: true });
  tmpRoot = null;
});

function readJsonl(path: string): Array<Record<string, unknown>> {
  return readFileSync(path, 'utf8')
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

describe('DeepSeek trajectory store', () => {
  test('summarizes thinking, tool use, tool result, usage and cache without raw content', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-deepseek-key';
    process.env.DEEPSEEK_BASE_URL = 'https://deepseek.local';
    tmpRoot = mkdtempSync(join(tmpdir(), 'dsxu-deepseek-trajectory-'));
    const tracePath = join(tmpRoot, 'trajectory.jsonl');
    process.env.DSXU_DEEPSEEK_TRAJECTORY_FILE = tracePath;

    let capturedBody: Record<string, unknown> | undefined;
    globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      capturedBody = JSON.parse(String(init?.body ?? '{}'));
      return new Response(
        JSON.stringify({
          id: 'chatcmpl-trajectory-test',
          model: 'deepseek-v4-flash',
          choices: [
            {
              finish_reason: 'tool_calls',
              message: {
                role: 'assistant',
                reasoning_content: 'private reasoning should never be persisted verbatim',
                content: 'sensitive final text should be hashed only',
                tool_calls: [
                  {
                    id: 'tool-2',
                    type: 'function',
                    function: {
                      name: 'Read',
                      arguments: JSON.stringify({
                        file_path: 'D:/private/source.ts',
                        note: 'argument value should not leak',
                      }),
                    },
                  },
                ],
              },
            },
          ],
          usage: {
            prompt_tokens: 1000,
            completion_tokens: 50,
            prompt_cache_hit_tokens: 750,
            prompt_cache_miss_tokens: 250,
            completion_tokens_details: { reasoning_tokens: 15 },
          },
        }),
        { status: 200, headers: { 'x-request-id': 'trajectory-request-id' } },
      );
    }) as typeof fetch;

    await DeepSeekAdapter.transformRequest(
      {
        model: 'deepseek-v4-flash',
        max_tokens: 2048,
        stream: false,
        messages: [
          {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool-1',
                name: 'Bash',
                input: { command: 'echo raw command should hash only' },
              },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool-1',
                content: 'raw tool result should never be persisted verbatim',
              },
              { type: 'text', text: 'continue after tool result' },
            ],
          },
        ],
        system: 'system prompt must be summarized only',
      },
      {
        dsxuRouteInput: {
          workflowKind: 'feature',
          role: 'coder',
          retryAfterFailure: true,
        },
      },
    );

    expect(capturedBody?.model).toBe('deepseek-v4-flash');
    const rawTrace = readFileSync(tracePath, 'utf8');
    expect(rawTrace).not.toContain('test-deepseek-key');
    expect(rawTrace).not.toContain('private reasoning should never be persisted verbatim');
    expect(rawTrace).not.toContain('sensitive final text should be hashed only');
    expect(rawTrace).not.toContain('raw tool result should never be persisted verbatim');
    expect(rawTrace).not.toContain('argument value should not leak');

    const records = readJsonl(tracePath);
    expect(records.map(record => record.event)).toEqual([
      'request_plan',
      'request_messages',
      'json_response',
      'response_usage',
    ]);
    expect(records.every(record => record.redacted === true)).toBe(true);
    expect(new Set(records.map(record => record.requestTag)).size).toBe(1);

    const requestMessages = records.find(record => record.event === 'request_messages')!;
    expect(requestMessages.toolResultCount).toBe(1);
    expect(JSON.stringify(requestMessages)).toContain('contentHash');
    expect(JSON.stringify(requestMessages)).toContain('assistantToolCalls');

    const jsonResponse = records.find(record => record.event === 'json_response')!;
    expect(JSON.stringify(jsonResponse)).toContain('"argumentKeys":["file_path","note"]');
    expect(JSON.stringify(jsonResponse)).toContain('"rawContentStored":false');

    const usage = records.find(record => record.event === 'response_usage')!;
    expect(usage.requestId).toBe('trajectory-request-id');
    expect(usage.usage).toMatchObject({
      input_tokens: 1000,
      output_tokens: 50,
      cache_read_input_tokens: 750,
      cache_creation_input_tokens: 250,
      reasoning_tokens: 15,
    });
  });

  test('does not write trajectory evidence unless explicitly enabled', () => {
    delete process.env.DSXU_DEEPSEEK_TRAJECTORY_FILE;
    DeepSeekTrajectoryStore.append({
      event: 'request_plan',
      requestTag: 'disabled',
      modelName: 'deepseek-v4-flash',
    });
    expect(DeepSeekTrajectoryStore.tracePath()).toBeNull();
  });
});
