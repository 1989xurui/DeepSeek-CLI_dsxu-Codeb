/**
 * R5-26 ExperienceStore — G4 蒸馏校验器
 * 用法: bun run scripts/distill/g4-check-r26.ts
 */
import { resolve } from 'path';
const ROOT = resolve(import.meta.dir, '..', '..');

function mockEmbed(dim = 8) {
  return async (texts: string[]) => texts.map(t => {
    const v: number[] = [];
    for (let d = 0; d < dim; d++) {
      let val = 0;
      for (let c = 0; c < t.length; c++) val += t.charCodeAt(c) * (d + 1) * (c + 1);
      v.push(Math.sin(val));
    }
    const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    return v.map(x => x / n);
  });
}

async function main() {
  const mod = await import(resolve(ROOT, 'src/services/experience'));
  const { ExperienceStore, injectExperienceContext } = mod;
  let passed = 0, failed = 0;

  function check(id: string, ok: boolean, msg = '') {
    if (ok) { console.log(`  ✅ ${id}`); passed++; }
    else { console.log(`  ❌ ${id}: ${msg}`); failed++; }
  }

  const store = new ExperienceStore({ mockMode: true, mockEmbed: mockEmbed() });
  await store.init();

  // add + stats
  const id1 = await store.add({ ts: 1, taskId: 't1', taskDescription: 'Fix null check in parser', taskType: 'debugging', plan: 'Add null guard', patches: [], testResults: [{ name: 'test1', result: 'pass' }], staticIssues: 0, criticVerdict: 'pass', finalScore: 90, durationMs: 5000, tokensUsed: 1000, outcome: 'success' });
  check('add-01', typeof id1 === 'string' && id1.length > 0, 'should return id');

  const id2 = await store.add({ ts: 2, taskId: 't2', taskDescription: 'Refactor database layer', taskType: 'complex-reasoning', plan: 'Extract interface', patches: [], testResults: [{ name: 'test1', result: 'fail' }], staticIssues: 2, criticVerdict: 'reject', criticReason: 'Broke existing API', finalScore: 30, durationMs: 8000, tokensUsed: 2000, outcome: 'failure' });

  const stats = await store.stats();
  check('stats-01', stats.total === 2, `expected 2, got ${stats.total}`);
  check('stats-02', stats.successRate === 0.5, `expected 0.5, got ${stats.successRate}`);

  // retrieve
  const results = await store.retrieve('null check bug fix', 2);
  check('retrieve-01', results.length > 0, 'should return results');
  check('retrieve-02', results.length <= 2, 'should respect k limit');

  // retrieve with filter
  const successOnly = await store.retrieve('any query', 5, { outcome: 'success' });
  check('retrieve-03', successOnly.every(r => r.outcome === 'success'), 'filter should work');

  // feedback
  await store.feedback(id1, 0.9);
  const updated = await store.retrieve('null check', 1);
  check('feedback-01', updated.length > 0, 'should still retrieve after feedback');

  // self-rag injection
  const prompt = await injectExperienceContext(store, 'Fix parser bug', 'You are a helpful assistant.', 2);
  check('rag-01', prompt.includes('You are a helpful assistant'), 'should contain base prompt');
  check('rag-02', prompt.includes('ExperienceStore Context'), 'should contain experience context');

  // empty store rag
  const emptyStore = new ExperienceStore({ mockMode: true, mockEmbed: mockEmbed() });
  await emptyStore.init();
  const emptyPrompt = await injectExperienceContext(emptyStore, 'test', 'base prompt');
  check('rag-03', emptyPrompt === 'base prompt', 'empty store should return base prompt only');

  // not initialized
  const badStore = new ExperienceStore({ mockMode: true });
  try { await badStore.add({ ts: 0, taskId: '', taskDescription: '', taskType: 'default', plan: '', patches: [], testResults: [], staticIssues: 0, criticVerdict: 'pass', finalScore: 0, durationMs: 0, tokensUsed: 0, outcome: 'success' }); check('init-01', false, 'should throw'); } catch { check('init-01', true); }

  console.log(`\n  R5-26 G4: ${passed}/${passed + failed} passed\n`);
  process.exit(failed > 0 ? 1 : 0);
}
main();
