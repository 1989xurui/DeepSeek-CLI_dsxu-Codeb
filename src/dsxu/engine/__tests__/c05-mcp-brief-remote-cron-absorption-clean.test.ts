import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createToolMainlineExecutor } from '../tool-mainline-runtime-v1';

function createMockMcpWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), 'dsxu-mcp-'));
  const serverScript = join(dir, 'mock-mcp-server.js');
  const script = `
const store = new Map([['resource://demo', 'initial-content']]);
let buffer = '';

function send(id, result, error) {
  const payload = JSON.stringify(error ? { jsonrpc: '2.0', id, error } : { jsonrpc: '2.0', id, result });
  const framed = 'Content-Length: ' + Buffer.byteLength(payload) + '\\r\\n\\r\\n' + payload;
  process.stdout.write(framed);
}

function handle(msg) {
  const id = msg.id;
  const method = msg.method;
  const params = msg.params || {};

  if (method === 'initialize') return send(id, { protocolVersion: '2024-11-05' });
  if (method === 'tools/list') {
    return send(id, {
      tools: [
        {
          name: 'write_resource',
          description: 'write resource by uri',
          inputSchema: {
            type: 'object',
            properties: { uri: { type: 'string' }, content: { type: 'string' } },
            required: ['uri', 'content'],
          },
        },
      ],
    });
  }
  if (method === 'resources/list') {
    return send(id, { resources: [...store.keys()].map((uri) => ({ uri, name: uri })) });
  }
  if (method === 'resources/read') {
    const uri = String(params.uri || '');
    const text = store.get(uri) || '';
    return send(id, { contents: [{ type: 'text', text }] });
  }
  if (method === 'resources/templates/list') {
    return send(id, { resourceTemplates: [{ uriTemplate: 'resource://{key}', name: 'demo-template' }] });
  }
  if (method === 'resources/templates/read') {
    const key = params.arguments?.key || 'demo';
    const uri = 'resource://' + key;
    const text = store.get(uri) || '';
    return send(id, { contents: [{ type: 'text', text }] });
  }
  if (method === 'tools/call') {
    const name = params.name;
    if (name === 'write_resource') {
      const uri = String(params.arguments?.uri || '');
      const content = String(params.arguments?.content || '');
      store.set(uri, content);
      return send(id, { content: [{ type: 'text', text: 'ok' }], isError: false });
    }
    return send(id, null, { code: -32601, message: 'tool not found' });
  }

  if (method === 'shutdown') return send(id, {});
  return send(id, null, { code: -32601, message: 'method not found' });
}

function consume() {
  while (true) {
    const marker = buffer.indexOf('\\r\\n\\r\\n');
    if (marker < 0) break;
    const header = buffer.slice(0, marker);
    const match = header.match(/Content-Length:\\s*(\\d+)/i);
    if (!match) {
      buffer = buffer.slice(marker + 4);
      continue;
    }
    const len = Number(match[1]);
    const start = marker + 4;
    if (buffer.length < start + len) break;
    const body = buffer.slice(start, start + len);
    buffer = buffer.slice(start + len);
    try {
      const msg = JSON.parse(body);
      if (msg.method) handle(msg);
    } catch {}
  }
}

process.stdin.on('data', (chunk) => {
  buffer += chunk.toString();
  consume();
});
`;
  writeFileSync(serverScript, script, 'utf8');

  const mcpConfig = {
    mcpServers: {
      demo: {
        transport: 'stdio',
        command: 'node',
        args: [serverScript],
        enabled: true,
      },
    },
  };
  writeFileSync(join(dir, '.mcp.json'), JSON.stringify(mcpConfig, null, 2), 'utf8');
  return dir;
}

describe('C05 MCP Brief RemoteTrigger Cron absorption clean', () => {
  const baseContext = {
    sessionId: 'c05-remaining-session',
    cwd: process.cwd(),
    allowedPermissionLevel: 'privileged' as const,
    requireConfirmationForWrite: false,
    denyRules: [],
  };

  test('BriefTool executes summary generation in mainline', async () => {
    const executor = createToolMainlineExecutor();
    const out = await executor.execute({
      toolId: 'BriefTool',
      input: {
        query: 'summarize this task',
        messages: [
          { role: 'user', content: 'please refactor module A' },
          { role: 'assistant', content: 'working on it' },
          { role: 'tool', content: 'Tool: Edit succeeded' },
          { role: 'user', content: 'also add tests' },
          { role: 'assistant', content: 'tests added' },
        ],
      },
      context: baseContext,
    });

    expect(out.allowed).toBeTrue();
    expect((out.result?.content || '').length).toBeGreaterThan(0);
  });

  test('RemoteTriggerTool is accepted and tracked by runtime', async () => {
    const executor = createToolMainlineExecutor();
    const out = await executor.execute({
      toolId: 'RemoteTriggerTool',
      input: { triggerId: 'rt-001', payload: { source: 'test' } },
      context: baseContext,
    });

    expect(out.allowed).toBeTrue();
    expect(out.result?.content).toContain('remote-trigger accepted');
  });

  test('Cron create/list/delete persists to disk across executor instances', async () => {
    const workspace = mkdtempSync(join(tmpdir(), 'dsxu-cron-'));
    const context = { ...baseContext, cwd: workspace, sessionId: 'cron-persist-session' };

    const executorA = createToolMainlineExecutor();
    const create = await executorA.execute({
      toolId: 'CronCreateTool',
      input: { cronId: 'cron-001', schedule: 'FREQ=HOURLY;INTERVAL=2', prompt: 'run audit' },
      context,
    });
    expect(create.allowed).toBeTrue();

    const storePath = join(workspace, '.dsxu', 'cron-jobs.json');
    expect(existsSync(storePath)).toBeTrue();

    const executorB = createToolMainlineExecutor();
    const list = await executorB.execute({ toolId: 'CronListTool', input: {}, context });
    expect(list.allowed).toBeTrue();
    expect(list.result?.content).toContain('cron-001');

    const del = await executorB.execute({
      toolId: 'CronDeleteTool',
      input: { cronId: 'cron-001' },
      context,
    });
    expect(del.allowed).toBeTrue();
    expect(del.result?.content).toContain('cron deleted: cron-001');

    const payload = JSON.parse(readFileSync(storePath, 'utf8'));
    expect(Array.isArray(payload.jobs)).toBeTrue();
    expect(payload.jobs.length).toBe(0);
  });

  test('MCP resource read/write goes through direct server connection', async () => {
    const workspace = createMockMcpWorkspace();
    const context = { ...baseContext, cwd: workspace, sessionId: 'mcp-direct-session' };
    const executor = createToolMainlineExecutor();

    const listResources = await executor.execute({
      toolId: 'ListMcpResourcesTool',
      input: { server: 'demo' },
      context,
    });
    expect(listResources.allowed).toBeTrue();
    expect(listResources.result?.content).toContain('resource://demo');

    const readBefore = await executor.execute({
      toolId: 'ReadMcpResourceTool',
      input: { server: 'demo', uri: 'resource://demo' },
      context,
    });
    expect(readBefore.allowed).toBeTrue();
    expect(readBefore.result?.content).toContain('initial-content');

    const write = await executor.execute({
      toolId: 'WriteMcpResourceTool',
      input: { server: 'demo', mode: 'write', uri: 'resource://demo', content: 'updated-content' },
      context,
    });
    expect(write.allowed).toBeTrue();
    expect(write.result?.isError).toBeFalse();

    const readAfter = await executor.execute({
      toolId: 'ReadMcpResourceTool',
      input: { server: 'demo', uri: 'resource://demo' },
      context,
    });
    expect(readAfter.allowed).toBeTrue();
    expect(readAfter.result?.content).toContain('updated-content');
  });
});
