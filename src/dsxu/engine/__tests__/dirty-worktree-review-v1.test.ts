import { existsSync } from 'fs'
import { describe, expect, test } from 'bun:test'
import { buildDirtyWorktreeReview } from '../dirty-worktree-review-v1'
import { buildV18DirtyQuarantineLedger } from '../v18-dirty-quarantine-ledger'
import { runDirtyWorktreeReviewHarness } from '../../integration/harness/dirty-worktree-review-v1-harness'

const LEGACY_PRODUCT = ['cl', 'aude'].join('')

describe('RC-04 - Dirty Worktree Review V1', () => {
  test('groups dirty ledger entries into review batches without allowing cleanup', () => {
    const ledger = buildV18DirtyQuarantineLedger({
      nowIso: '2026-05-12T00:00:00.000Z',
      lines: [
        ' M src/dsxu/engine/release-test-gate.ts',
        '?? docs/DSXU_V18_PROGRESS_20260506.md',
        ' M scripts/guards/check-protected.ts',
        ` D start-${LEGACY_PRODUCT}.ps1`,
        '?? tmp_v18_full_audit.txt',
      ],
    })
    const review = buildDirtyWorktreeReview(ledger)

    expect(review.schemaVersion).toBe('dsxu.dirty-worktree-review.v1')
    expect(review.status).toBe('PARTIAL')
    expect(review.total).toBe(5)
    expect(review.canCloseDirtyGate).toBe(false)
    expect(review.mustNotStageOrRestore).toBe(true)
    expect(review.batches.map(batch => batch.id)).toEqual(['DWR-01', 'DWR-02', 'DWR-03', 'DWR-04', 'DWR-05'])
    expect(review.batches.every(batch => batch.canAutoClose === false)).toBe(true)
    expect(review.batches.find(batch => batch.id === 'DWR-04')?.samplePaths.join('\n')).not.toContain(LEGACY_PRODUCT)
    expect(review.nextAction).toBe('normal-mainline-review')
    expect(review.safeguards.join('\n')).toContain('does not stage')
  })

  test('blocks unknown dirty paths before release claims', () => {
    const ledger = buildV18DirtyQuarantineLedger({
      nowIso: '2026-05-12T00:00:00.000Z',
      lines: ['?? strange/new-file.txt'],
    })
    const review = buildDirtyWorktreeReview(ledger)

    expect(review.status).toBe('BLOCKED')
    expect(review.unknownDirtyCount).toBe(1)
    expect(review.batches.find(batch => batch.id === 'DWR-99')?.redlines).toContain('unknown dirty paths remain')
    expect(review.nextAction).toBe('classify-unknown-dirty')
  })

  test('passes only when dirty ledger is closed', () => {
    const ledger = buildV18DirtyQuarantineLedger({
      nowIso: '2026-05-12T00:00:00.000Z',
      lines: [],
    })
    const review = buildDirtyWorktreeReview(ledger)

    expect(review.status).toBe('PASS')
    expect(review.canCloseDirtyGate).toBe(true)
    expect(review.mustNotStageOrRestore).toBe(false)
    expect(review.batches).toEqual([])
    expect(review.nextAction).toBe('dirty-gate-closed')
  })

  test('writes current dirty worktree review without changing git state', async () => {
    const review = await runDirtyWorktreeReviewHarness()

    expect(review.evidencePath).toContain('dirty-worktree-review.evidence.json')
    expect(review.tracePath).toContain('dirty-worktree-review.trace.json')
    expect(existsSync(review.evidencePath)).toBe(true)
    expect(existsSync(review.tracePath)).toBe(true)
    expect(review.total).toBeGreaterThan(0)
    expect(review.status).toBe('PARTIAL')
    expect(review.unknownDirtyCount).toBe(0)
    expect(review.mainlineDirtyReviewStatus).toBe('PARTIAL')
    expect(review.mainlineDirtyReviewBatchCount).toBeGreaterThanOrEqual(5)
    expect(review.canCloseDirtyGate).toBe(false)
    expect(review.mustNotStageOrRestore).toBe(true)
    expect(review.batches.length).toBeGreaterThanOrEqual(5)
  }, 60_000)
})
