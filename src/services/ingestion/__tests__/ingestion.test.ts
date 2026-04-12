/**
 * R5-34 Document Ingestion — bun:test unit tests
 */
import { describe, test, expect } from 'bun:test';
import { ingest } from '../index';

describe('R5-34: markdown ingestion', () => {
  test('splits markdown by headings', async () => {
    const r = await ingest(
      { url: 'https://example.com/doc.md', format: 'markdown', namespace: 'test' },
      { mockFetcher: async () => '# Title\nContent 1\n## Section\nContent 2\n### Sub\nContent 3' }
    );
    expect(r.chunksCreated).toBeGreaterThanOrEqual(2);
    expect(r.bytesProcessed).toBeGreaterThan(0);
  });

  test('durationMs >= 0', async () => {
    const r = await ingest(
      { url: 'https://example.com/doc.md', format: 'markdown', namespace: 'test' },
      { mockFetcher: async () => '# Hello\nWorld' }
    );
    expect(r.durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe('R5-34: html ingestion', () => {
  test('splits html by block elements', async () => {
    const r = await ingest(
      { url: 'https://example.com/page.html', format: 'html', namespace: 'test' },
      { mockFetcher: async () => '<html><body><p>Para 1</p><div>Block 1</div><section>Sec 1</section></body></html>' }
    );
    expect(r.chunksCreated).toBeGreaterThanOrEqual(2);
  });
});

describe('R5-34: auto-detect format', () => {
  test('.md URL detected as markdown', async () => {
    const r = await ingest(
      { url: 'https://example.com/readme.md', format: 'auto', namespace: 'test' },
      { mockFetcher: async () => '# Hello\nWorld\n## More\nStuff' }
    );
    expect(r.chunksCreated).toBeGreaterThanOrEqual(1);
  });

  test('html content detected as html', async () => {
    const r = await ingest(
      { url: 'https://example.com/unknown', format: 'auto', namespace: 'test' },
      { mockFetcher: async () => '<html><body><p>P1</p><div>D1</div></body></html>' }
    );
    expect(r.chunksCreated).toBeGreaterThanOrEqual(1);
  });
});

describe('R5-34: mock parser', () => {
  test('custom parser is used', async () => {
    const r = await ingest(
      { url: 'https://example.com/api', format: 'openapi', namespace: 'api' },
      {
        mockFetcher: async () => 'openapi: 3.0\npaths:\n  /users:\n    get: ...',
        mockParser: (_content, _format) => ['c1', 'c2', 'c3'],
      }
    );
    expect(r.chunksCreated).toBe(3);
  });
});

describe('R5-34: empty content', () => {
  test('empty string yields 0 chunks', async () => {
    const r = await ingest(
      { url: 'https://example.com/empty', format: 'markdown', namespace: 'test' },
      { mockFetcher: async () => '' }
    );
    expect(r.chunksCreated).toBe(0);
    expect(r.bytesProcessed).toBe(0);
  });
});

describe('R5-34: pdf passthrough', () => {
  test('pdf content as single chunk', async () => {
    const r = await ingest(
      { url: 'https://example.com/paper.pdf', format: 'pdf', namespace: 'papers' },
      { mockFetcher: async () => 'PDF content here...' }
    );
    expect(r.chunksCreated).toBeGreaterThanOrEqual(1);
  });
});
