import { createHash } from 'crypto';
import { readFile, writeFile, mkdir, readdir, unlink } from 'fs/promises';
import { join } from 'path';

export interface Snapshot {
  id: string;
  ts: number;
  milestone?: string;
  r5Id?: string;
  commitHash: string;
  benchScore?: number;
  description: string;
  fileHashes: Record<string, string>;
}

export interface SnapshotConfig {
  snapshotDir?: string;
  maxSnapshots?: number;
  mockGitOps?: {
    getCommitHash: () => Promise<string>;
    stash: (msg: string) => Promise<void>;
    restore: (commitHash: string) => Promise<void>;
  };
  mockFileHasher?: (files: string[]) => Promise<Record<string, string>>;
}

const DEFAULT_DIR = '.dsxu/snapshots';

export async function createSnapshot(
  opts: { milestone?: string; r5Id?: string; description: string; benchScore?: number; files?: string[] },
  config?: SnapshotConfig
): Promise<Snapshot> {
  const dir = config?.snapshotDir ?? DEFAULT_DIR;
  await mkdir(dir, { recursive: true });

  const ts = Date.now();
  const id = `dsxu-snapshot-${opts.milestone ?? 'manual'}-${opts.r5Id ?? 'none'}-${ts}`;

  let commitHash: string;
  if (config?.mockGitOps) {
    commitHash = await config.mockGitOps.getCommitHash();
  } else {
    const { execSync } = await import('child_process');
    commitHash = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  }

  let fileHashes: Record<string, string>;
  if (config?.mockFileHasher && opts.files) {
    fileHashes = await config.mockFileHasher(opts.files);
  } else {
    fileHashes = {};
    for (const file of opts.files ?? []) {
      try {
        const content = await readFile(file, 'utf-8');
        fileHashes[file] = createHash('sha256').update(content).digest('hex');
      } catch {
        // ignore missing files
      }
    }
  }

  const snapshot: Snapshot = {
    id,
    ts,
    milestone: opts.milestone,
    r5Id: opts.r5Id,
    commitHash,
    benchScore: opts.benchScore,
    description: opts.description,
    fileHashes,
  };

  await writeFile(join(dir, `${id}.json`), JSON.stringify(snapshot, null, 2));
  return snapshot;
}

export async function listSnapshots(
  filter?: { milestone?: string },
  config?: SnapshotConfig
): Promise<Snapshot[]> {
  const dir = config?.snapshotDir ?? DEFAULT_DIR;
  try {
    const files = await readdir(dir);
    const snapshots: Snapshot[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const content = await readFile(join(dir, file), 'utf-8');
        const snap = JSON.parse(content) as Snapshot;
        if (filter?.milestone && snap.milestone !== filter.milestone) continue;
        snapshots.push(snap);
      } catch {
        // Retry once to tolerate concurrent create/write race in tests.
        try {
          await new Promise((resolve) => setTimeout(resolve, 5));
          const content = await readFile(join(dir, file), 'utf-8');
          const snap = JSON.parse(content) as Snapshot;
          if (filter?.milestone && snap.milestone !== filter.milestone) continue;
          snapshots.push(snap);
        } catch {
          // skip malformed snapshot files instead of failing the whole list
        }
      }
    }

    return snapshots.sort((a, b) => b.ts - a.ts);
  } catch {
    return [];
  }
}

export async function restoreSnapshot(
  id: string,
  opts?: { dryRun?: boolean },
  config?: SnapshotConfig
): Promise<{ filesChanged: number; ok: boolean }> {
  const dir = config?.snapshotDir ?? DEFAULT_DIR;
  const snapPath = join(dir, `${id}.json`);

  const content = await readFile(snapPath, 'utf-8');
  const snap = JSON.parse(content) as Snapshot;

  if (opts?.dryRun) {
    return { filesChanged: Object.keys(snap.fileHashes ?? {}).length, ok: true };
  }

  if (config?.mockGitOps) {
    await config.mockGitOps.restore(snap.commitHash);
  } else {
    const { execSync } = await import('child_process');
    execSync('git stash', { encoding: 'utf-8' });
    execSync(`git checkout ${snap.commitHash}`, { encoding: 'utf-8' });
  }

  return { filesChanged: Object.keys(snap.fileHashes ?? {}).length, ok: true };
}

export async function cleanupSnapshots(config?: SnapshotConfig): Promise<number> {
  const dir = config?.snapshotDir ?? DEFAULT_DIR;
  const max = config?.maxSnapshots ?? 50;

  const all = await listSnapshots(undefined, config);
  if (all.length <= max) return 0;

  const milestoneSnaps = all.filter((s) => s.milestone);
  const nonMilestone = all.filter((s) => !s.milestone);

  const keepNonMilestone = Math.max(0, max - milestoneSnaps.length);
  const toDelete = nonMilestone.slice(keepNonMilestone);

  for (const snap of toDelete) {
    try {
      await unlink(join(dir, `${snap.id}.json`));
    } catch {
      // ignore delete errors
    }
  }

  return toDelete.length;
}
