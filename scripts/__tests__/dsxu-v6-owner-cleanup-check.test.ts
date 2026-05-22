import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { buildV6OwnerCleanupCheck } from '../dsxu-v6-owner-cleanup-check'

async function writeMatrix(root: string, rows: unknown[]): Promise<string> {
  const dir = join(root, 'docs', 'generated')
  await mkdir(dir, { recursive: true })
  const path = join(dir, 'DSXU_CAPABILITY_TRUTH_MATRIX_20260519.json')
  await writeFile(path, JSON.stringify({
    schemaVersion: 'dsxu.capability-truth-matrix.v1',
    rows,
  }, null, 2), 'utf8')
  return path
}

describe('V6 owner cleanup check', () => {
  test('assigns owner/action to unclassified rows without allowing product claims', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsxu-v6-owner-cleanup-'))
    const matrixPath = await writeMatrix(root, [
      {
        path: 'README.md',
        kind: 'source',
        capability: 'core-or-unclear',
        primaryLabel: 'unclassified',
        labels: [],
      },
      {
        path: 'src/dsxu/engine/query-loop.ts',
        kind: 'source',
        capability: 'query-loop-default-runtime',
        primaryLabel: 'default-mainline',
        labels: ['default-mainline'],
        defaultMainline: true,
      },
    ])

    const report = await buildV6OwnerCleanupCheck({
      matrixPath,
      generatedAt: '2026-05-19T00:00:00.000Z',
    })

    expect(report.status).toBe('PASS_V6_OWNER_CLEANUP_CHECK')
    expect(report.summary.reviewedRows).toBe(1)
    expect(report.summary.unclassifiedRows).toBe(1)
    expect(report.summary.unclassifiedWithOwnerAction).toBe(1)
    expect(report.summary.claimBlockedRows).toBe(1)
    expect(report.rows[0]).toMatchObject({
      path: 'README.md',
      owner: 'Docs / Release Claim Binder',
      action: 'keep-release-surface',
      claimAllowed: false,
      modelPromptAllowed: false,
    })
  })

  test('blocks experiment/frozen/historical residue if they leak into default mainline', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsxu-v6-owner-cleanup-block-'))
    const matrixPath = await writeMatrix(root, [
      {
        path: 'src/dsxu/engine/prototype-experiment.ts',
        kind: 'source',
        capability: 'query-loop-default-runtime',
        primaryLabel: 'experiment',
        labels: ['default-mainline', 'experiment'],
        defaultMainline: true,
        experiment: true,
      },
      {
        path: 'src/dsxu/engine/legacy-v20-runtime.ts',
        kind: 'source',
        capability: 'query-loop-default-runtime',
        primaryLabel: 'historical-residue',
        labels: ['default-mainline', 'historical-residue'],
        defaultMainline: true,
        historicalResidue: true,
      },
    ])

    const report = await buildV6OwnerCleanupCheck({
      matrixPath,
      generatedAt: '2026-05-19T00:00:00.000Z',
    })

    expect(report.status).toBe('BLOCKED_V6_OWNER_CLEANUP_CHECK')
    expect(report.blockers.join('\n')).toContain('experiment rows exposed to default mainline')
    expect(report.blockers.join('\n')).toContain('historical residue rows exposed to default mainline')
  })
})
