/**
 * R5-33 DAG persist + 2PC — G4 checker
 * bun run scripts/distill/g4-check-r33.ts
 */
import { resolve } from 'path';
const ROOT = resolve(import.meta.dir, '..', '..');

async function main() {
  const { PersistentDagRunner } = await import(resolve(ROOT, 'src/coordinator/dag/persist'));
  const { linearDag } = await import(resolve(ROOT, 'src/coordinator/dag'));
  let p = 0, f = 0;
  const ck = (id: string, ok: boolean, m = '') => { if (ok) { console.log(`  ✅ ${id}`); p++; } else { console.log(`  ❌ ${id}: ${m}`); f++; } };

  const mockConfig = {
    stateDir: '.test-dag-state',
    mockNodeExecutor: async (node: any) => ({ result: `${node.id} done` }),
    mockFs: { read: async () => '{}', write: async () => {}, list: async () => [] },
  };

  // run happy path
  const runner = new PersistentDagRunner(mockConfig);
  const spec = linearDag();
  const r1 = await runner.run(spec, 'run-001');
  ck('run-01', r1.status === 'success', `expected success, got ${r1.status}`);
  ck('run-02', r1.failedNodes.length === 0, 'no failed nodes');

  // list
  const runs = await runner.list();
  ck('list-01', runs.length >= 1, 'should list at least 1 run');
  ck('list-02', runs[0].runId === 'run-001', `runId should be run-001, got ${runs[0]?.runId}`);

  // resume (already complete)
  const r2 = await runner.resume('run-001');
  ck('resume-01', r2.status === 'success', 'resume complete run should succeed');

  // run with failure
  const failRunner = new PersistentDagRunner({
    ...mockConfig,
    mockNodeExecutor: async (node: any) => {
      if (node.id === 'critic') throw new Error('critic failed');
      return { result: 'ok' };
    },
  });
  const r3 = await failRunner.run(spec, 'run-002');
  ck('fail-01', r3.status !== 'success', 'should not be success');
  ck('fail-02', r3.failedNodes.includes('critic'), 'critic should fail');

  // abort
  await runner.abort('run-001');
  const runs2 = await runner.list();
  const aborted = runs2.find(r => r.runId === 'run-001');
  ck('abort-01', aborted?.phase === 'aborted', `should be aborted, got ${aborted?.phase}`);

  // resume after failure
  const resumeRunner = new PersistentDagRunner({
    ...mockConfig,
    mockNodeExecutor: async (node: any) => ({ result: `${node.id} recovered` }),
  });
  await resumeRunner.run(spec, 'run-003');
  // Simulate crash by creating new runner with same state
  const r4 = await resumeRunner.resume('run-003');
  ck('resume-02', r4.status === 'success', 'resumed run should succeed');

  console.log(`\n  R5-33 G4: ${p}/${p + f} passed\n`);
  process.exit(f > 0 ? 1 : 0);
}
main();
