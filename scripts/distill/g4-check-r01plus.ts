/**
 * R5-01+ ast-grep + BM25 三级 fallback — G4 蒸馏校验器
 *
 * 用法: bun run scripts/distill/g4-check-r01plus.ts
 */

import { resolve } from 'path';

const ROOT = resolve(import.meta.dir, '..', '..');

async function main() {
  const mod = await import(resolve(ROOT, 'src/utils/search'));
  const { search, buildIndex, searchBM25, tokenize, isAstGrepPattern } = mod;

  let passed = 0;
  let failed = 0;

  function check(id: string, condition: boolean, msg: string = '') {
    if (condition) { console.log(`  ✅ ${id}`); passed++; }
    else { console.log(`  ❌ ${id}: ${msg}`); failed++; }
  }

  // ── tokenize ──
  const tokens = tokenize('function calculateTotal(items) { return items.reduce(...) }');
  check('tok-01', tokens.includes('function'), 'should tokenize "function"');
  check('tok-02', tokens.includes('calculatetotal'), 'should lowercase');
  check('tok-03', !tokens.includes('{'), 'should exclude punctuation');

  // ── BM25 index + search ──
  const docs = [
    { file: 'a.ts', line: 1, content: 'function add(a, b) { return a + b; }' },
    { file: 'b.ts', line: 1, content: 'function subtract(a, b) { return a - b; }' },
    { file: 'c.ts', line: 1, content: 'class UserService { constructor(private db: Database) {} }' },
    { file: 'd.ts', line: 1, content: 'function multiply(x, y) { return x * y; }' },
    { file: 'e.ts', line: 1, content: 'const divide = (a, b) => b !== 0 ? a / b : 0;' },
  ];
  const index = buildIndex(docs);
  check('bm25-01', index.N === 5, `index should have 5 docs, got ${index.N}`);
  check('bm25-02', index.avgDl > 0, 'avgDl should be > 0');

  const results1 = searchBM25(index, 'function add return', 3);
  check('bm25-03', results1.length > 0, 'should find results');
  check('bm25-04', results1[0].file === 'a.ts', `top result should be a.ts, got ${results1[0]?.file}`);

  const results2 = searchBM25(index, 'UserService Database', 3);
  check('bm25-05', results2.length > 0, 'should find UserService');
  check('bm25-06', results2[0].file === 'c.ts', `top result should be c.ts, got ${results2[0]?.file}`);

  // Empty query
  const results3 = searchBM25(index, '', 3);
  check('bm25-07', results3.length === 0, 'empty query should return no results');

  // ── isAstGrepPattern ──
  check('ast-01', isAstGrepPattern('function $FUNC($$$)'), '$$$  should be ast pattern');
  check('ast-02', isAstGrepPattern('$VAR.map($$$)'), '$VAR should be ast pattern');
  check('ast-03', !isAstGrepPattern('calculateTotal'), 'simple word should not be ast pattern');
  check('ast-04', !isAstGrepPattern('function add'), 'plain text should not be ast pattern');

  // ── search with mocks ──

  // Mock ast-grep returns results → use them
  const hits1 = await search(
    { query: 'function $FUNC($$$)', maxResults: 5 },
    {
      mockAstGrep: async () => [
        { file: 'x.ts', line: 10, col: 0, context: 'function foo()', score: 1.0, tier: 'ast-grep' as const },
        { file: 'y.ts', line: 20, col: 0, context: 'function bar()', score: 1.0, tier: 'ast-grep' as const },
        { file: 'z.ts', line: 30, col: 0, context: 'function baz()', score: 1.0, tier: 'ast-grep' as const },
        { file: 'w.ts', line: 40, col: 0, context: 'function qux()', score: 1.0, tier: 'ast-grep' as const },
        { file: 'v.ts', line: 50, col: 0, context: 'function quux()', score: 1.0, tier: 'ast-grep' as const },
      ],
    }
  );
  check('search-01', hits1.length === 5, `ast pattern with 5 hits should return 5, got ${hits1.length}`);
  check('search-02', hits1[0].tier === 'ast-grep', 'should be ast-grep tier');

  // Single identifier → ripgrep
  const hits2 = await search(
    { query: 'calculateTotal', maxResults: 5 },
    {
      mockRipgrep: async () => [
        { file: 'calc.ts', line: 5, col: 0, context: 'function calculateTotal()', score: 0.8, tier: 'ripgrep' as const },
      ],
    }
  );
  check('search-03', hits2.length === 1, 'single identifier should use ripgrep');
  check('search-04', hits2[0].tier === 'ripgrep', 'tier should be ripgrep');

  // Forced tier
  const hits3 = await search(
    { query: 'anything', forcedTier: 'bm25', maxResults: 5 },
    {
      mockBm25Index: index,
    }
  );
  check('search-05', hits3.every(h => h.tier === 'bm25'), 'forced bm25 should only return bm25 hits');

  // Dedup: same file+line from different tiers
  const hits4 = await search(
    { query: 'test query', maxResults: 5 },
    {
      mockAstGrep: async () => [
        { file: 'dup.ts', line: 10, col: 0, context: 'same line', score: 0.9, tier: 'ast-grep' as const },
      ],
      mockRipgrep: async () => [
        { file: 'dup.ts', line: 10, col: 0, context: 'same line', score: 0.5, tier: 'ripgrep' as const },
      ],
    }
  );
  check('search-06', hits4.filter(h => h.file === 'dup.ts' && h.line === 10).length === 1, 'dedup should merge same file:line');
  check('search-07', hits4.find(h => h.file === 'dup.ts')?.score === 0.9, 'dedup should keep higher score');

  console.log(`\n  R5-01+ G4: ${passed}/${passed + failed} passed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
