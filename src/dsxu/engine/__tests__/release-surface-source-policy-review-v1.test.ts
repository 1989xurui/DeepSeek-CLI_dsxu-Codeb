import { describe, expect, test } from 'bun:test'
import { buildReleaseSurfaceSourcePolicyReviewState } from '../release-surface-source-policy-review-v1'
import type { V18OpenSourceCleanExportManifestEntry } from '../open-source-package-gate'

const rewriteEntry: V18OpenSourceCleanExportManifestEntry = {
  path: 'docs/DSXU_V18_V19_MERGED_AUDIT_20260510_CLEAN.md',
  present: true,
  provenance: 'canonical-planning-source',
  releasePolicy: 'rewrite-or-exclude',
  reason: 'canonical planning docs require release export policy review',
}

describe('Release Surface Source Policy Review V1', () => {
  test('keeps rewrite-or-exclude findings partial until an explicit review manifest is provided', () => {
    const state = buildReleaseSurfaceSourcePolicyReviewState([rewriteEntry], null)

    expect(state.schemaVersion).toBe('dsxu.release-surface-source-policy-review-state.v1')
    expect(state.status).toBe('NOT_PROVIDED')
    expect(state.requiredCount).toBe(1)
    expect(state.reviewedCount).toBe(0)
    expect(state.missingPaths).toEqual([rewriteEntry.path])
  })

  test('passes only when current rewrite-or-exclude entries are signed for rewrite or exclusion', () => {
    const state = buildReleaseSurfaceSourcePolicyReviewState([rewriteEntry], {
      schemaVersion: 'dsxu.release-surface-source-policy-review.v1',
      reviewId: 'release-surface-source-policy-review-20260513',
      generatedAt: '2026-05-13T00:00:00.000Z',
      decisions: [
        {
          path: rewriteEntry.path,
          releasePolicy: 'rewrite-or-exclude',
          provenance: 'canonical-planning-source',
          decision: 'exclude-from-clean-export',
          owner: 'Release Surface',
          rationale: 'canonical audit source remains in repo evidence, not in release payload',
          exportInstruction: 'exclude this audit report from clean export artifacts',
          evidence: ['open-source-package-gate-20260507.evidence.json'],
        },
      ],
    })

    expect(state.status).toBe('PASS')
    expect(state.signedCount).toBe(1)
    expect(state.acceptedDecisions[0]?.decision).toBe('exclude-from-clean-export')
    expect(state.redlines).toEqual([])
  })

  test('blocks stale source policy decisions that no longer match the package gate surface', () => {
    const state = buildReleaseSurfaceSourcePolicyReviewState([rewriteEntry], {
      schemaVersion: 'dsxu.release-surface-source-policy-review.v1',
      reviewId: 'release-surface-source-policy-review-20260513',
      generatedAt: '2026-05-13T00:00:00.000Z',
      decisions: [
        {
          path: 'docs/old-clean-report.md',
          releasePolicy: 'rewrite-or-exclude',
          decision: 'exclude-from-clean-export',
          owner: 'Release Surface',
          rationale: 'stale path should not close current review',
          exportInstruction: 'exclude stale path',
          evidence: ['open-source-package-gate-20260507.evidence.json'],
        },
      ],
    })

    expect(state.status).toBe('BLOCKED')
    expect(state.stalePaths).toEqual(['docs/old-clean-report.md'])
    expect(state.missingPaths).toEqual([rewriteEntry.path])
  })
})
