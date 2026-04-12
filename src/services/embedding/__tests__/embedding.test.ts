import { describe, test, expect, beforeEach } from 'bun:test';
import { VectorStore, chunkSourceCode } from '../index';
import type { EmbedRequest, EmbedResponse, CodeChunk } from '../contract';

// ── Mock embed ─────────────────────────────────────────────────────

/** Deterministic mock: hash text into a fixed-length vector */
function mockEmbed(req: EmbedRequest): Promise<EmbedResponse> {
  const vectors = req.texts.map(text => {
    const vec = new Array(16).fill(0);
    for (let i = 0; i < text.length; i++) {
      vec[i % 16] += text.charCodeAt(i) / 1000;
    }
    // Normalize
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    return norm > 0 ? vec.map(v => v / norm) : vec;
  });
  return Promise.resolve({ vectors });
}

// ── chunkSourceCode ────────────────────────────────────────────────

describe('chunkSourceCode', () => {
  test('detects TypeScript functions', () => {
    const source = [
      'export function add(a: number, b: number): number {',
      '  return a + b;',
      '}',
      '',
      'export function sub(a: number, b: number): number {',
      '  return a - b;',
      '}',
    ].join('\n');

    const chunks = chunkSourceCode(source, 'math.ts', 'typescript');
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    const symbols = chunks.map(c => c.symbol).filter(Boolean);
    expect(symbols).toContain('add');
    expect(symbols).toContain('sub');
  });

  test('detects Python classes and functions', () => {
    const source = [
      'class Calculator:',
      '    def add(self, a, b):',
      '        return a + b',
      '',
      '    def sub(self, a, b):',
      '        return a - b',
    ].join('\n');

    const chunks = chunkSourceCode(source, 'calc.py', 'python');
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    const symbols = chunks.map(c => c.symbol).filter(Boolean);
    expect(symbols).toContain('Calculator');
  });

  test('chunks have correct file and language', () => {
    const chunks = chunkSourceCode('function foo() { return 1; }', 'f.ts', 'typescript');
    for (const c of chunks) {
      expect(c.file).toBe('f.ts');
      expect(c.language).toBe('typescript');
    }
  });

  test('empty source returns at least one chunk', () => {
    const chunks = chunkSourceCode('', 'empty.ts', 'typescript');
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });
});

// ── VectorStore ────────────────────────────────────────────────────

describe('VectorStore', () => {
  let store: VectorStore;

  beforeEach(async () => {
    store = new VectorStore({ mockMode: true, mockEmbed, dimension: 16 });
    await store.init();
  });

  test('init sets store to initialized state', async () => {
    // Should not throw on subsequent operations
    const stats = await store.stats();
    expect(stats.chunks).toBe(0);
  });

  test('not-initialized error before init', async () => {
    const uninit = new VectorStore({ mockMode: true, mockEmbed });
    expect(() => (uninit as any).ensureInit()).toThrow(/not initialized/i);
  });

  test('upsert adds chunks', async () => {
    const chunks: CodeChunk[] = [
      { id: 'c1', file: 'a.ts', startLine: 1, endLine: 5, language: 'typescript', content: 'function add(a, b) { return a + b; }' },
      { id: 'c2', file: 'a.ts', startLine: 6, endLine: 10, language: 'typescript', content: 'function sub(a, b) { return a - b; }' },
    ];
    await store.upsert(chunks);

    const stats = await store.stats();
    expect(stats.chunks).toBe(2);
    expect(stats.files).toBe(1);
  });

  test('search returns results ranked by similarity', async () => {
    const chunks: CodeChunk[] = [
      { id: 'c1', file: 'a.ts', startLine: 1, endLine: 5, language: 'typescript', content: 'function add numbers together' },
      { id: 'c2', file: 'b.ts', startLine: 1, endLine: 5, language: 'typescript', content: 'class user authentication handler' },
    ];
    await store.upsert(chunks);

    const results = await store.search('add numbers', 10);
    expect(results.length).toBe(2);
    // Results sorted by score descending
    expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
  });

  test('delete removes all chunks for a file', async () => {
    const chunks: CodeChunk[] = [
      { id: 'c1', file: 'a.ts', startLine: 1, endLine: 5, language: 'typescript', content: 'hello world' },
      { id: 'c2', file: 'b.ts', startLine: 1, endLine: 5, language: 'typescript', content: 'foo bar' },
    ];
    await store.upsert(chunks);
    await store.delete('a.ts');

    const stats = await store.stats();
    expect(stats.chunks).toBe(1);
    expect(stats.files).toBe(1);
  });

  test('stats returns correct sizeBytes > 0', async () => {
    await store.upsert([
      { id: 'c1', file: 'a.ts', startLine: 1, endLine: 2, language: 'typescript', content: 'some code content here' },
    ]);
    const stats = await store.stats();
    expect(stats.sizeBytes).toBeGreaterThan(0);
  });

  test('search on empty store returns empty array', async () => {
    const results = await store.search('anything');
    expect(results.length).toBe(0);
  });

  test('upsert with existing id overwrites', async () => {
    await store.upsert([
      { id: 'c1', file: 'a.ts', startLine: 1, endLine: 2, language: 'typescript', content: 'version 1' },
    ]);
    await store.upsert([
      { id: 'c1', file: 'a.ts', startLine: 1, endLine: 2, language: 'typescript', content: 'version 2' },
    ]);
    const stats = await store.stats();
    expect(stats.chunks).toBe(1);
  });
});
