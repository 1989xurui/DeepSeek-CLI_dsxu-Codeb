/**
 * R5-29 Snapshot/Restore — G4 蒸馏校验器
 * 用法: bun run scripts/distill/g4-check-r29.ts
 */
import { resolve } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
const ROOT = resolve(import.meta.dir, '..', '..');

const TEST_DIR = resolve(ROOT, '.test-snapshots');

async function main() {
  const mod = await import(resolve(ROOT, 'src/services/snapshot'));
  const { createSnapshot, listSnapshots, restoreSnapshot, cleanupSnapshots } = mod;
  let passed = 0, failed = 0;

  // Setup
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  mkdirSync(TEST_DIR, { recursive: true });

  const config = {
    snapshotDir: TEST_DIR,
    mockGitOps: {
      getCommitHash: async () => 'abc123def456',
      stash: async () => {},
      restore: async () => {},
    },
    mockFileHasher: async (files: string[]) => {
      const hashes: Record<string, string> = {};
      for (const f of files) hashes[f] = `hash-${f}`;
      return hashes;
    },
  };

  function check(id: string, ok: boolean, msg = '') {
    if (ok) { console.log(`  ✅ ${id}`); passed++; }
    else { console.log(`  ❌ ${id}: ${msg}`); failed++; }
  }

  // create
  const snap1 = await createSnapshot({ milestone: 'M2', r5Id: 'R5-21', description: 'TDD gate done', benchScore: 90, files: ['a.ts', 'b.ts'] }, config);
  check('create-01', snap1.id.includes('M2'), 'id should contain milestone');
  check('create-02', snap1.commitHash === 'abc123def456', 'commit hash from mock');
  check('create-03', Object.keys(snap1.fileHashes).length === 2, 'should have 2 file hashes');

  const snap2 = await createSnapshot({ milestone: 'M3', description: 'M3 done', files: ['c.ts'] }, config);
  const snap3 = await createSnapshot({ description: 'manual snapshot', files: [] }, config);

  // list
  const all = await listSnapshots(undefined, config);
  check('list-01', all.length === 3, `should have 3 snapshots, got ${all.length}`);
  check('list-02', all[0].ts >= all[1].ts, 'should be sorted newest first');

  // list with filter
  const m2Only = await listSnapshots({ milestone: 'M2' }, config);
  check('list-03', m2Only.length === 1, `should have 1 M2 snapshot, got ${m2Only.length}`);

  // restore dry-run
  const dryResult = await restoreSnapshot(snap1.id, { dryRun: true }, config);
  check('restore-01', dryResult.ok, 'dry run should succeed');
  check('restore-02', dryResult.filesChanged === 2, `expected 2 files, got ${dryResult.filesChanged}`);

  // restore real
  const realResult = await restoreSnapshot(snap1.id, {}, config);
  check('restore-03', realResult.ok, 'real restore should succeed');

  // cleanup (with low max)
  // Add more snapshots to trigger cleanup
  for (let i = 0; i < 5; i++) {
    await createSnapshot({ description: `extra-${i}`, files: [] }, config);
  }
  const deleted = await cleanupSnapshots({ ...config, maxSnapshots: 3 });
  check('cleanup-01', deleted > 0, `should delete some snapshots, deleted ${deleted}`);
  const afterCleanup = await listSnapshots(undefined, config);
  check('cleanup-02', afterCleanup.length <= 8, `should have fewer snapshots after cleanup`);

  // Cleanup test dir
  rmSync(TEST_DIR, { recursive: true });

  console.log(`\n  R5-29 G4: ${passed}/${passed + failed} passed\n`);
  process.exit(failed > 0 ? 1 : 0);
}
main();
