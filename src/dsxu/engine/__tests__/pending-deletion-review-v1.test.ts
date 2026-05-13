import { existsSync } from 'fs'
import { describe, expect, test } from 'bun:test'
import { buildPendingDeletionReview } from '../pending-deletion-review-v1'
import { runPendingDeletionReviewHarness } from '../../integration/harness/pending-deletion-review-v1-harness'
import type { V18PendingDeletionClosure } from '../v18-open-source-package-gate'

function makeClosure(): V18PendingDeletionClosure {
  return {
    total: 3,
    byRule: {
      'legacy-control-plane-shell': 1,
      'legacy-private-state': 1,
      'old-root-shims': 1,
    },
    requiresMainlineReplacementEvidenceCount: 2,
    requiresNormalGitDeletionReviewCount: 1,
    entries: [
      {
        path: 'src/bridge/main.ts',
        ruleId: 'legacy-control-plane-shell',
        requiredAction: 'verify-mainline-replacement-then-commit-deletion',
        restorePolicy: 'do-not-restore-old-runtime-shell',
        reason: 'old control shell is release excluded',
        releaseImpact: 'clean export waits for normal review',
      },
      {
        path: 'dsevo/golden/task.json',
        ruleId: 'legacy-private-state',
        requiredAction: 'review-and-commit-deletion',
        restorePolicy: 'do-not-restore-release-excluded-state',
        reason: 'private state is release excluded',
        releaseImpact: 'clean export waits for normal review',
      },
      {
        path: 'deepseek-proxy.ts',
        ruleId: 'old-root-shims',
        requiredAction: 'verify-mainline-replacement-then-commit-deletion',
        restorePolicy: 'do-not-restore-release-excluded-state',
        reason: 'old root shim is release excluded',
        releaseImpact: 'clean export waits for normal review',
      },
    ],
    safeguards: ['does not stage'],
  }
}

describe('CER-02 - Pending Deletion Review V1', () => {
  test('groups pending deletions into review batches with replacement evidence', () => {
    const review = buildPendingDeletionReview(makeClosure())

    expect(review.schemaVersion).toBe('dsxu.pending-deletion-review.v1')
    expect(review.status).toBe('PARTIAL')
    expect(review.total).toBe(3)
    expect(review.subSliceCount).toBe(3)
    expect(review.canClosePendingDeletionGate).toBe(false)
    expect(review.mustNotStageOrRestore).toBe(true)
    expect(review.batches).toHaveLength(3)
    expect(review.batches.find(batch => batch.id === 'PDR-01')?.replacementEvidence).toContain('control-plane-v1.test.ts')
    expect(review.batches.find(batch => batch.id === 'PDR-01')?.subSlices.map(slice => slice.group)).toEqual(['bridge-ui-debug'])
    expect(review.batches.find(batch => batch.id === 'PDR-01')?.replacementEvidenceStatus).toBe('VERIFIED_FOR_REVIEW')
    expect(review.batches.find(batch => batch.id === 'PDR-01')?.missingReplacementEvidence).toEqual([])
    expect(review.batches.find(batch => batch.id === 'PDR-01')?.replacementEvidenceChecks.every(item => item.status === 'FOUND')).toBe(true)
    expect(review.batches.find(batch => batch.id === 'PDR-01')?.subSlices[0]?.replacementEvidence).toContain('query-loop-visible-copy-v1.test.ts')
    expect(review.batches.find(batch => batch.id === 'PDR-01')?.subSlices[0]?.replacementEvidenceStatus).toBe('VERIFIED_FOR_REVIEW')
    expect(review.batches.find(batch => batch.id === 'PDR-01')?.subSlices[0]?.missingReplacementEvidence).toEqual([])
    expect(review.batches.find(batch => batch.id === 'PDR-02')?.requiredAction).toContain('release-excluded')
    expect(review.batches.find(batch => batch.id === 'PDR-03')?.replacementEvidence).toContain('toolchain-selfcheck-v1.test.ts')
    expect(review.batches.find(batch => batch.id === 'PDR-03')?.subSlices.map(slice => slice.closureDecision)).toEqual(['old-root-shim-delete'])
    expect(review.batches.find(batch => batch.id === 'PDR-03')?.replacementEvidenceStatus).toBe('VERIFIED_FOR_REVIEW')
    expect(review.redlines).toContain('pending deletions remain uncommitted')
    expect(review.safeguards.join('\n')).toContain('does not stage')
  })

  test('blocks a batch when replacement evidence is not available for review', () => {
    const review = buildPendingDeletionReview(makeClosure(), {
      availableReplacementEvidence: ['open-source-package-gate-20260507.evidence.json'],
    })

    expect(review.status).toBe('BLOCKED')
    expect(review.batches.find(batch => batch.id === 'PDR-01')?.replacementEvidenceStatus).toBe('MISSING')
    expect(review.batches.find(batch => batch.id === 'PDR-01')?.subSlices[0]?.replacementEvidenceStatus).toBe('MISSING')
    expect(review.batches.find(batch => batch.id === 'PDR-03')?.missingReplacementEvidence).toContain('toolchain-selfcheck-v1.test.ts')
    expect(review.redlines.join('\n')).toContain('missing replacement evidence')
    expect(review.redlines.join('\n')).toContain('missing sub-slice replacement evidence')
  })

  test('passes only when there are no pending deletions', () => {
    const review = buildPendingDeletionReview({
      total: 0,
      byRule: {},
      requiresMainlineReplacementEvidenceCount: 0,
      requiresNormalGitDeletionReviewCount: 0,
      entries: [],
      safeguards: [],
    })

    expect(review.status).toBe('PASS')
    expect(review.subSliceCount).toBe(0)
    expect(review.canClosePendingDeletionGate).toBe(true)
    expect(review.mustNotStageOrRestore).toBe(false)
    expect(review.redlines).toEqual([])
  })

  test('writes current pending deletion review without changing git state', async () => {
    const review = await runPendingDeletionReviewHarness()

    expect(review.evidencePath).toContain('pending-deletion-review.evidence.json')
    expect(review.tracePath).toContain('pending-deletion-review.trace.json')
    expect(existsSync(review.evidencePath)).toBe(true)
    expect(existsSync(review.tracePath)).toBe(true)
    expect(review.status).toBe('PARTIAL')
    expect(review.total).toBe(69)
    expect(review.subSliceCount).toBeGreaterThan(8)
    expect(review.canClosePendingDeletionGate).toBe(false)
    expect(review.mustNotStageOrRestore).toBe(true)
    expect(review.batches.map(batch => batch.ruleId).sort()).toEqual([
      'legacy-control-plane-shell',
      'legacy-private-state',
      'old-root-shims',
    ].sort())
    expect(review.batches.every(batch => batch.replacementEvidenceStatus === 'VERIFIED_FOR_REVIEW')).toBe(true)
    expect(review.batches.every(batch => batch.subSlices.length > 0)).toBe(true)
    expect(review.batches.flatMap(batch => batch.subSlices).every(slice => slice.count > 0)).toBe(true)
    expect(review.batches.flatMap(batch => batch.subSlices).every(slice => slice.replacementEvidenceStatus === 'VERIFIED_FOR_REVIEW')).toBe(true)
    expect(review.batches.flatMap(batch => batch.subSlices).every(slice => slice.replacementEvidenceChecks.every(item => item.status === 'FOUND'))).toBe(true)
    expect(review.batches.flatMap(batch => batch.subSlices).map(slice => slice.group)).toContain('old-proxy-shims')
    expect(review.batches.every(batch => batch.replacementEvidenceChecks.every(item => item.status === 'FOUND'))).toBe(true)
    expect(review.redlines).toContain('pending deletions remain uncommitted')
  }, 120_000)
})
