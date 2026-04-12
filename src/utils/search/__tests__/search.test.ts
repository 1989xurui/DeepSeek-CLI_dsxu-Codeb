import { describe, test, expect } from 'bun:test';
import {
  search,
  buildIndex,
  searchBM25,
  tokenize,
  isAstGrepPattern,
} from '../index';
import type { SearchHit, BM25Index } from '../contract';

// ── tokenize ───────────────────────────────────────────────────────

describe('tokenize', () => {
  test('splits on non-alphanumeric characters', () => {
    const tokens = tokenize('hello world foo-bar');
    expect(tokens).toContain('hello');
    expect(tokens).toContain('world');
    expect(tokens).toContain('foo');
    expect(tokens).toContain('bar');
  });

  test('lowercases all tokens', () => {
    const tokens = tokenize('Hello WORLD FooBar');
    for (const t of tokens) {
      expect(t).toBe(t.toLowerCase());
    }
  });

  test('filters out single-char tokens', () => {
    const tokens = tokenize('a bb c dd');
    expect(tokens).not.toContain('a');
    expect(tokens).toContain('bb');
    expect(tokens).not.toContain('c');
    expect(tokens).toContain('dd');
  });
});

// ── BM25 ───────────────────────────────────────────────────────────

describe('BM25', () => {
  const docs = [
    { file: 'a.ts', line: 1, content: 'function add numbers together' },
    { file: 'b.ts', line: 5, content: 'class user authentication handler' },
    { file: 'c.ts', line: 10, content: 'function multiply numbers fast' },
  ];

  let index: BM25Index;

  test('buildIndex creates valid index', () => {
    index = buildIndex(docs);
    expect(index.N).toBe(3);
    expect(index.documents.length).toBe(3);
    expect(index.avgDl).toBeGreaterThan(0);
  });

  test('search returns ranked results for matching query', () => {
    index = buildIndex(docs);
    const hits = searchBM25(index, 'function numbers');
    expect(hits.length).toBeGreaterThan(0);
    // a.ts and c.ts both match "function" and "numbers"
    const files = hits.map(h => h.file);
    expect(files).toContain('a.ts');
    expect(files).toContain('c.ts');
    // Results should be sorted by score descending
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i].score).toBeLessThanOrEqual(hits[i - 1].score);
    }
  });

  test('empty query returns no results', () => {
    index = buildIndex(docs);
    const hits = searchBM25(index, '');
    expect(hits.length).toBe(0);
  });

  test('all hits have tier = bm25', () => {
    index = buildIndex(docs);
    const hits = searchBM25(index, 'function');
    for (const h of hits) {
      expect(h.tier).toBe('bm25');
    }
  });

  test('query with no matching tokens returns empty', () => {
    index = buildIndex(docs);
    const hits = searchBM25(index, 'zzzzxxyy');
    expect(hits.length).toBe(0);
  });
});

// ── isAstGrepPattern ───────────────────────────────────────────────

describe('isAstGrepPattern', () => {
  test('detects $$$ pattern', () => {
    expect(isAstGrepPattern('function $$$')).toBe(true);
  });

  test('detects $VAR metavariable', () => {
    expect(isAstGrepPattern('$FUNC($ARG)')).toBe(true);
  });

  test('plain identifier is not ast-grep pattern', () => {
    expect(isAstGrepPattern('myFunction')).toBe(false);
  });

  test('plain phrase is not ast-grep pattern', () => {
    expect(isAstGrepPattern('search query text')).toBe(false);
  });
});

// ── search (unified) ───────────────────────────────────────────────

describe('search', () => {
  const astHit: SearchHit = { file: 'x.ts', line: 1, col: 0, context: 'match', score: 1.0, tier: 'ast-grep' };
  const rgHit: SearchHit = { file: 'y.ts', line: 2, col: 0, context: 'rg match', score: 0.5, tier: 'ripgrep' };
  const bm25Hit: SearchHit = { file: 'z.ts', line: 3, col: 0, context: 'bm25 match', score: 0.7, tier: 'bm25' };

  test('ast-grep pattern triggers ast-grep tier', async () => {
    const hits = await search(
      { query: '$FUNC($$$)' },
      {
        mockAstGrep: async () => [astHit, astHit, astHit, astHit, astHit],
      },
    );
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].tier).toBe('ast-grep');
  });

  test('single identifier triggers ripgrep tier', async () => {
    const hits = await search(
      { query: 'myFunction' },
      {
        mockRipgrep: async () => [rgHit],
      },
    );
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some(h => h.tier === 'ripgrep')).toBe(true);
  });

  test('forcedTier uses only that tier', async () => {
    const hits = await search(
      { query: 'anything', forcedTier: 'ripgrep' },
      {
        mockRipgrep: async () => [rgHit],
        mockAstGrep: async () => { throw new Error('should not be called'); },
      },
    );
    expect(hits.length).toBe(1);
    expect(hits[0].tier).toBe('ripgrep');
  });

  test('dedup keeps highest score for same file:line', async () => {
    const lowHit: SearchHit = { ...rgHit, score: 0.1 };
    const highHit: SearchHit = { ...rgHit, score: 0.9, tier: 'bm25' };
    const index = buildIndex([{ file: 'y.ts', line: 2, content: 'rg match some content' }]);

    const hits = await search(
      { query: 'some multi word query' },
      {
        mockAstGrep: async () => [],
        mockBm25Index: index,
        mockRipgrep: async () => [lowHit],
      },
    );
    // Should not have duplicate file:line entries
    const keys = hits.map(h => `${h.file}:${h.line}`);
    const unique = new Set(keys);
    expect(keys.length).toBe(unique.size);
  });
});
