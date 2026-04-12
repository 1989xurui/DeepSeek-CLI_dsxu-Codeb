import { describe, test, expect } from 'bun:test';
import { createAllAdapters, FilesystemAdapter, GitAdapter } from '../index';
import type { McpAdapterConfig } from '../base';

const mockConfig: McpAdapterConfig = {
  mockInvoke: async (toolName, args) => ({ tool: toolName, args, mocked: true }),
  mockHealthCheck: async () => true,
};

describe('R5-32 MCP Adapters', () => {
  test('createAllAdapters returns 5 adapters', () => {
    const adapters = createAllAdapters(mockConfig);
    expect(adapters.length).toBe(5);
  });

  test('all adapter names are unique', () => {
    const adapters = createAllAdapters(mockConfig);
    const names = adapters.map(a => a.name);
    expect(new Set(names).size).toBe(5);
  });

  test('each adapter has at least 3 tools', async () => {
    const adapters = createAllAdapters(mockConfig);
    for (const adapter of adapters) {
      const tools = await adapter.listTools();
      expect(tools.length).toBeGreaterThanOrEqual(3);
    }
  });

  test('FilesystemAdapter has read/write/glob tools', async () => {
    const fs = new FilesystemAdapter(mockConfig);
    const tools = await fs.listTools();
    const names = tools.map(t => t.name);
    expect(names).toContain('read');
    expect(names).toContain('write');
    expect(names).toContain('glob');
  });

  test('GitAdapter has log/diff/blame tools', async () => {
    const git = new GitAdapter(mockConfig);
    const tools = await git.listTools();
    const names = tools.map(t => t.name);
    expect(names).toContain('log');
    expect(names).toContain('diff');
    expect(names).toContain('blame');
  });

  test('healthCheck returns true with mock', async () => {
    const adapters = createAllAdapters(mockConfig);
    for (const adapter of adapters) {
      const ok = await adapter.healthCheck();
      expect(ok).toBe(true);
    }
  });

  test('invoke with mock returns mocked result', async () => {
    const fs = new FilesystemAdapter(mockConfig);
    const result = await fs.invoke('read', { path: '/test.ts' });
    expect(result.mocked).toBe(true);
    expect(result.tool).toBe('read');
  });

  test('tools have inputSchema defined', async () => {
    const adapters = createAllAdapters(mockConfig);
    for (const adapter of adapters) {
      const tools = await adapter.listTools();
      for (const tool of tools) {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
      }
    }
  });

  test('tools have description defined', async () => {
    const adapters = createAllAdapters(mockConfig);
    for (const adapter of adapters) {
      const tools = await adapter.listTools();
      for (const tool of tools) {
        expect(typeof tool.description).toBe('string');
        expect(tool.description.length).toBeGreaterThan(0);
      }
    }
  });

  test('adapter names match expected set', () => {
    const adapters = createAllAdapters(mockConfig);
    const names = new Set(adapters.map(a => a.name));
    expect(names.has('filesystem')).toBe(true);
    expect(names.has('git')).toBe(true);
    expect(names.has('postgres')).toBe(true);
    expect(names.has('slack')).toBe(true);
    expect(names.has('github')).toBe(true);
  });
});
