/**
 * R5-25 voyage-code-3 + 持久向量库 — G4 蒸馏校验器
 *
 * 用法: bun run scripts/distill/g4-check-r25.ts
 */

import { resolve } from 'path';

const ROOT = resolve(import.meta.dir, '..', '..');

// Mock embedding: 生成确定性伪向量
function mockEmbedFn(dimension: number = 8) {
  return async (req: { texts: string[]; inputType: string }) => {
    const vectors = req.texts.map((text, i) => {
      // 基于文本内容生成确定性向量
      const vec: number[] = [];
      for (let d = 0; d < dimension; d++) {
        let val = 0;
        for (let c = 0; c < text.length; c++) {
          val += text.charCodeAt(c) * (d + 1) * (c + 1);
        }
        vec.push(Math.sin(val) * 0.5 + 0.5); // normalize to [0, 1]
      }
      // Normalize to unit vector
      const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
      return vec.map(v => v / (norm || 1));
    });
    return { vectors };
  };
}

async function main() {
  const mod = await import(resolve(ROOT, 'src/services/embedding'));
  const { VectorStore, chunkSourceCode } = mod;

  let passed = 0;
  let failed = 0;

  function check(id: string, condition: boolean, msg: string = '') {
    if (condition) { console.log(`  ✅ ${id}`); passed++; }
    else { console.log(`  ❌ ${id}: ${msg}`); failed++; }
  }

  // ── chunkSourceCode ──
  const tsSource = `export function add(a: number, b: number): number {
  return a + b;
}

export function subtract(a: number, b: number): number {
  return a - b;
}

export class Calculator {
  value: number = 0;

  add(n: number) {
    this.value += n;
    return this;
  }

  reset() {
    this.value = 0;
    return this;
  }
}`;

  const chunks = chunkSourceCode(tsSource, 'calc.ts', 'typescript');
  check('chunk-01', chunks.length >= 2, `should have >=2 chunks, got ${chunks.length}`);
  check('chunk-02', chunks.some(c => c.symbol === 'add'), 'should detect add function');
  check('chunk-03', chunks.some(c => c.symbol === 'Calculator'), 'should detect Calculator class');
  check('chunk-04', chunks.every(c => c.file === 'calc.ts'), 'all chunks should have correct file');
  check('chunk-05', chunks.every(c => c.language === 'typescript'), 'all chunks should have correct language');

  // Python chunking
  const pySource = `def hello(name):
    print(f"Hello {name}")

class Greeter:
    def __init__(self, name):
        self.name = name
    def greet(self):
        print(f"Hello {self.name}")`;

  const pyChunks = chunkSourceCode(pySource, 'greet.py', 'python');
  check('chunk-06', pyChunks.length >= 2, `python should have >=2 chunks, got ${pyChunks.length}`);

  // ── VectorStore ──
  const mockEmbed = mockEmbedFn(8);

  const store = new VectorStore({ mockMode: true, dimension: 8, mockEmbed });
  await store.init();

  // Upsert
  await store.upsert([
    { id: 'c1', file: 'a.ts', startLine: 1, endLine: 5, symbol: 'add', language: 'typescript', content: 'function add(a, b) { return a + b; }' },
    { id: 'c2', file: 'b.ts', startLine: 1, endLine: 5, symbol: 'subtract', language: 'typescript', content: 'function subtract(a, b) { return a - b; }' },
    { id: 'c3', file: 'c.ts', startLine: 1, endLine: 10, symbol: 'UserService', language: 'typescript', content: 'class UserService { constructor(private db: Database) { this.db = db; } async getUser(id: string) { return this.db.findOne(id); } }' },
  ]);

  // Stats
  const stats = await store.stats();
  check('store-01', stats.chunks === 3, `should have 3 chunks, got ${stats.chunks}`);
  check('store-02', stats.files === 3, `should have 3 files, got ${stats.files}`);
  check('store-03', stats.sizeBytes > 0, 'sizeBytes should be > 0');

  // Search
  const results = await store.search('function add return', 2);
  check('store-04', results.length <= 2, `should return <=2 results, got ${results.length}`);
  check('store-05', results.length > 0, 'should return at least 1 result');
  check('store-06', results.every(r => r.score >= 0 && r.score <= 1.01), 'scores should be in [0, 1]');

  // Delete
  await store.delete('a.ts');
  const stats2 = await store.stats();
  check('store-07', stats2.chunks === 2, `after delete should have 2 chunks, got ${stats2.chunks}`);

  // Search after delete
  const results2 = await store.search('add function', 5);
  check('store-08', results2.every(r => r.chunk.file !== 'a.ts'), 'deleted file should not appear');

  // Not initialized error
  const store2 = new VectorStore({ mockMode: true, mockEmbed });
  try {
    await store2.search('test');
    check('store-09', false, 'should throw when not initialized');
  } catch (e: any) {
    check('store-09', e.message.includes('not initialized'), 'should mention not initialized');
  }

  console.log(`\n  R5-25 G4: ${passed}/${passed + failed} passed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
