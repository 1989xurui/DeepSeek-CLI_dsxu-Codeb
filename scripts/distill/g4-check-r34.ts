/**
 * R5-34 Document ingestion — G4 checker
 * bun run scripts/distill/g4-check-r34.ts
 */
import { resolve } from 'path';
const ROOT = resolve(import.meta.dir, '..', '..');

async function main() {
  const { ingest } = await import(resolve(ROOT, 'src/services/ingestion'));
  let p = 0, f = 0;
  const ck = (id: string, ok: boolean, m = '') => { if (ok) { console.log(`  ✅ ${id}`); p++; } else { console.log(`  ❌ ${id}: ${m}`); f++; } };

  // markdown
  const r1 = await ingest(
    { url: 'https://example.com/doc.md', format: 'markdown', namespace: 'test' },
    { mockFetcher: async () => '# Title\nContent 1\n## Section\nContent 2\n### Sub\nContent 3' }
  );
  ck('md-01', r1.chunksCreated >= 2, `markdown should have >=2 chunks, got ${r1.chunksCreated}`);
  ck('md-02', r1.bytesProcessed > 0, 'bytes > 0');
  ck('md-03', r1.durationMs >= 0, 'duration >= 0');

  // html
  const r2 = await ingest(
    { url: 'https://example.com/page.html', format: 'html', namespace: 'test' },
    { mockFetcher: async () => '<html><body><p>Para 1</p><div>Block 1</div><section>Sec 1</section></body></html>' }
  );
  ck('html-01', r2.chunksCreated >= 2, `html should have >=2 chunks, got ${r2.chunksCreated}`);

  // auto-detect
  const r3 = await ingest(
    { url: 'https://example.com/readme.md', format: 'auto', namespace: 'test' },
    { mockFetcher: async () => '# Hello\nWorld\n## More\nStuff' }
  );
  ck('auto-01', r3.chunksCreated >= 1, 'auto-detect md should work');

  // mock parser
  const r4 = await ingest(
    { url: 'https://example.com/custom', format: 'openapi', namespace: 'api' },
    {
      mockFetcher: async () => 'openapi: 3.0\npaths:\n  /users:\n    get: ...',
      mockParser: (content, format) => ['chunk1', 'chunk2', 'chunk3'],
    }
  );
  ck('custom-01', r4.chunksCreated === 3, `mock parser should return 3, got ${r4.chunksCreated}`);

  // empty content
  const r5 = await ingest(
    { url: 'https://example.com/empty', format: 'markdown', namespace: 'test' },
    { mockFetcher: async () => '' }
  );
  ck('empty-01', r5.chunksCreated === 0, `empty should have 0 chunks, got ${r5.chunksCreated}`);
  ck('empty-02', r5.bytesProcessed === 0, 'empty should have 0 bytes');

  // pdf format (passthrough)
  const r6 = await ingest(
    { url: 'https://example.com/paper.pdf', format: 'pdf', namespace: 'papers' },
    { mockFetcher: async () => 'PDF content here...' }
  );
  ck('pdf-01', r6.chunksCreated >= 1, 'pdf should have at least 1 chunk');

  console.log(`\n  R5-34 G4: ${p}/${p + f} passed\n`);
  process.exit(f > 0 ? 1 : 0);
}
main();
