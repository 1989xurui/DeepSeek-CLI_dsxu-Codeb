import { describe, test, expect } from 'bun:test';
import { handleRequest } from '../index';
import type { LspRequest, LspMethod } from '../contract';

function makeReq(method: LspMethod, overrides: Partial<LspRequest['params']> = {}): LspRequest {
  return {
    method,
    params: {
      textDocument: { uri: 'file:///test.ts' },
      position: { line: 10, character: 5 },
      ...overrides,
    },
  };
}

describe('R5-31 LSP Server', () => {
  test('hover returns markdown contents', async () => {
    const res = await handleRequest(makeReq('hover'));
    expect(res.method).toBe('hover');
    expect(res.result.contents.kind).toBe('markdown');
    expect(res.durationMs).toBeGreaterThanOrEqual(0);
  });

  test('completion returns items array', async () => {
    const res = await handleRequest(makeReq('completion'));
    expect(res.method).toBe('completion');
    expect(res.result.items.length).toBeGreaterThanOrEqual(1);
    expect(res.result.isIncomplete).toBe(false);
  });

  test('codeAction returns actions array', async () => {
    const res = await handleRequest(makeReq('codeAction'));
    expect(res.method).toBe('codeAction');
    expect(Array.isArray(res.result)).toBe(true);
    expect(res.result.length).toBeGreaterThan(0);
    expect(res.result[0].title).toBeDefined();
  });

  test('diagnostics returns diagnostics for uri', async () => {
    const res = await handleRequest(makeReq('diagnostics'));
    expect(res.method).toBe('diagnostics');
    expect(res.result.uri).toBe('file:///test.ts');
    expect(Array.isArray(res.result.diagnostics)).toBe(true);
  });

  test('references returns array', async () => {
    const res = await handleRequest(makeReq('references'));
    expect(res.method).toBe('references');
    expect(Array.isArray(res.result)).toBe(true);
  });

  test('definition returns location', async () => {
    const res = await handleRequest(makeReq('definition'));
    expect(res.method).toBe('definition');
    expect(res.result.uri).toBe('file:///test.ts');
    expect(res.result.range).toBeDefined();
  });

  test('mockHandler overrides default handling', async () => {
    const res = await handleRequest(makeReq('hover'), {
      mockHandler: async (req) => ({ custom: true, method: req.method }),
    });
    expect(res.result.custom).toBe(true);
    expect(res.result.method).toBe('hover');
  });

  test('all methods return durationMs >= 0', async () => {
    const methods: LspMethod[] = ['hover', 'completion', 'codeAction', 'diagnostics', 'references', 'definition'];
    for (const method of methods) {
      const res = await handleRequest(makeReq(method));
      expect(res.durationMs).toBeGreaterThanOrEqual(0);
    }
  });
});
