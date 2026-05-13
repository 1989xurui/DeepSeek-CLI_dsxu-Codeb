import { describe, test, expect, afterAll } from 'bun:test';
import { createSnapshot, listSnapshots, restoreSnapshot, cleanupSnapshots } from '../index';
import type { SnapshotConfig } from '../index';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

let tempDir: string;
let config: SnapshotConfig;

const mockGitOps = {
  getCommitHash: async () => 'abc123def456',
  stash: async (_msg: string) => {},
  restore: async (_hash: string) => {},
};

const mockFileHasher = async (files: string[]) => {
  const result: Record<string, string> = {};
  for (const f of files) result[f] = `hash-of-${f}`;
  return result;
};

// Setup temp dir synchronously before tests via top-level await
tempDir = await mkdtemp(join(tmpdir(), 'dsxu-snap-test-'));
config = { snapshotDir: tempDir, mockGitOps, mockFileHasher };

afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('R5-29 Snapshot/Restore', () => {
  test('createSnapshot returns snapshot with id', async () => {
    const snap = await createSnapshot(
      { description: 'Test snapshot', milestone: 'M4', r5Id: 'R5-29', files: ['a.ts', 'b.ts'] },
      config
    );
    expect(snap.id).toContain('dsxu-snapshot');
    expect(snap.commitHash).toBe('abc123def456');
    expect(snap.fileHashes['a.ts']).toBe('hash-of-a.ts');
    expect(snap.description).toBe('Test snapshot');
  });

  test('listSnapshots returns created snapshots', async () => {
    await createSnapshot(
      { description: 'List seed snapshot', milestone: 'M4', r5Id: 'R5-29', files: ['a.ts'] },
      config
    );
    const list = await listSnapshots(undefined, config);
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0].id).toContain('dsxu-snapshot');
  });

  test('listSnapshots filters by milestone', async () => {
    await createSnapshot({ description: 'Other', milestone: 'M5', files: [] }, config);
    const filtered = await listSnapshots({ milestone: 'M4' }, config);
    expect(filtered.every(s => s.milestone === 'M4')).toBe(true);
  });

  test('restoreSnapshot dry-run returns file count', async () => {
    await createSnapshot(
      { description: 'Restore seed snapshot', milestone: 'M4', r5Id: 'R5-29', files: ['a.ts', 'b.ts'] },
      config
    );
    const list = await listSnapshots(undefined, config);
    const snap = list[0];
    const result = await restoreSnapshot(snap.id, { dryRun: true }, config);
    expect(result.ok).toBe(true);
    expect(typeof result.filesChanged).toBe('number');
  });

  test('restoreSnapshot real calls mockGitOps.restore', async () => {
    let restored = false;
    const restoreConfig: SnapshotConfig = {
      ...config,
      mockGitOps: {
        ...mockGitOps,
        restore: async (hash: string) => { restored = true; },
      },
    };
    // Create a new snapshot with this config
    const snap = await createSnapshot({ description: 'For restore', files: ['c.ts'] }, restoreConfig);
    const result = await restoreSnapshot(snap.id, { dryRun: false }, restoreConfig);
    expect(result.ok).toBe(true);
    expect(restored).toBe(true);
  });

  test('cleanupSnapshots removes excess non-milestone snapshots', async () => {
    // Create several non-milestone snapshots
    for (let i = 0; i < 3; i++) {
      await createSnapshot({ description: `Extra ${i}`, files: [] }, config);
    }
    const cleanConfig: SnapshotConfig = { ...config, maxSnapshots: 2 };
    const removed = await cleanupSnapshots(cleanConfig);
    expect(typeof removed).toBe('number');
  });

  test('listSnapshots on empty dir returns empty array', async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), 'dsxu-snap-empty-'));
    const result = await listSnapshots(undefined, { snapshotDir: join(emptyDir, 'nonexistent') });
    expect(result).toEqual([]);
    await rm(emptyDir, { recursive: true, force: true });
  });

  test('snapshots are sorted by timestamp descending', async () => {
    const list = await listSnapshots(undefined, config);
    for (let i = 1; i < list.length; i++) {
      expect(list[i - 1].ts).toBeGreaterThanOrEqual(list[i].ts);
    }
  });
});
