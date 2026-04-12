/**
 * R5-32 MCP Adapters — bun:test unit tests
 */
import { describe, test, expect } from 'bun:test';
import {
  createAllAdapters,
  FilesystemAdapter,
  GitAdapter,
  PostgresAdapter,
  SlackAdapter,
  GithubAdapter,
} from '../base';
import type { McpAdapterConfig } from '../base';

const mockConfig: McpAdapterConfig = {
  mockInvoke: async (tool, args) => ({ tool, args, result: 'mock' }),
  mockHealthCheck: async () => true,
};

describe('R5-32: createAllAdapters', () => {
  test('returns 5 adapters', () => {
    const adapters = createAllAdapters(mockConfig);
    expect(adapters).toHaveLength(5);
  });

  test('includes all adapter names', () => {
    const names = createAllAdapters(mockConfig).map(a => a.name);
    expect(names).toContain('filesystem');
    expect(names).toContain('git');
    expect(names).toContain('postgres');
    expect(names).toContain('slack');
    expect(names).toContain('github');
  });
});

describe('R5-32: FilesystemAdapter', () => {
  const fs = new FilesystemAdapter(mockConfig);

  test('name is filesystem', () => {
    expect(fs.name).toBe('filesystem');
  });

  test('listTools returns >=3 tools', async () => {
    const tools = await fs.listTools();
    expect(tools.length).toBeGreaterThanOrEqual(3);
  });

  test('tools have correct shape', async () => {
    const tools = await fs.listTools();
    for (const t of tools) {
      expect(t.name).toBeDefined();
      expect(t.description).toBeDefined();
      expect(t.inputSchema).toBeDefined();
    }
  });

  test('invoke delegates to mockInvoke', async () => {
    const r = await fs.invoke('read', { path: 'test.ts' });
    expect(r.tool).toBe('read');
    expect(r.args).toEqual({ path: 'test.ts' });
  });

  test('healthCheck uses mock', async () => {
    expect(await fs.healthCheck()).toBe(true);
  });
});

describe('R5-32: GitAdapter', () => {
  const git = new GitAdapter(mockConfig);

  test('name is git', () => expect(git.name).toBe('git'));

  test('listTools returns >=3 tools', async () => {
    const tools = await git.listTools();
    expect(tools.length).toBeGreaterThanOrEqual(3);
  });

  test('invoke log', async () => {
    const r = await git.invoke('log', { n: 5 });
    expect(r.tool).toBe('log');
  });
});

describe('R5-32: PostgresAdapter', () => {
  const pg = new PostgresAdapter(mockConfig);

  test('name is postgres', () => expect(pg.name).toBe('postgres'));

  test('listTools returns >=3 tools', async () => {
    const tools = await pg.listTools();
    expect(tools.length).toBeGreaterThanOrEqual(3);
  });

  test('invoke query', async () => {
    const r = await pg.invoke('query', { sql: 'SELECT 1' });
    expect(r.tool).toBe('query');
  });
});

describe('R5-32: SlackAdapter', () => {
  const slack = new SlackAdapter(mockConfig);
  test('name is slack', () => expect(slack.name).toBe('slack'));
  test('has send tool', async () => {
    const tools = await slack.listTools();
    expect(tools.map(t => t.name)).toContain('send');
  });
});

describe('R5-32: GithubAdapter', () => {
  const gh = new GithubAdapter(mockConfig);
  test('name is github', () => expect(gh.name).toBe('github'));
  test('has issues tool', async () => {
    const tools = await gh.listTools();
    expect(tools.map(t => t.name)).toContain('issues');
  });
});

describe('R5-32: no-config fallback', () => {
  test('FilesystemAdapter without mock returns status', async () => {
    const fs = new FilesystemAdapter();
    const r = await fs.invoke('read', {});
    expect(r.status).toBe('not_implemented');
  });

  test('healthCheck without mock for filesystem returns true', async () => {
    const fs = new FilesystemAdapter();
    expect(await fs.healthCheck()).toBe(true);
  });
});
