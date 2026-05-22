import { describe, expect, test } from 'bun:test'
import { buildDSXUReplaceDeleteOwnerReview } from '../replace-delete-owner-review'

describe('DSXU replace/delete owner review', () => {
  test('marks duplicate owner packets ready only when runtime references are gone', () => {
    const review = buildDSXUReplaceDeleteOwnerReview({
      packetId: 'V26-RD-legacy-swe',
      title: 'Legacy SWE owner review',
      targetOwner: 'src/services/swe-bench',
      replacementOwner: 'src/services/eval/swe-bench',
      candidates: [
        {
          path: 'src/services/swe-bench/runner.ts',
          currentOwner: 'legacy SWE-shaped task runner',
          proposedOwner: 'Evidence / benchmark / public challenge',
          reason: 'duplicate benchmark-shaped behavior has no runtime import/use',
          runtimeReferences: [],
          testReferences: [
            {
              path: 'src/services/__tests__/swe-bench.test.ts',
              line: 1,
              excerpt: 'test-only compatibility',
              kind: 'test',
            },
          ],
          docReferences: [],
          replacementEvidence: ['src/services/eval/swe-bench/runner.ts'],
          publicClaimAllowed: false,
        },
      ],
      rule: 'review only; do not stage/delete',
    })

    expect(review.status).toBe('READY_FOR_OWNER_GIT_REPLACE_DELETE_REVIEW')
    expect(review.runtimeReferenceCount).toBe(0)
    expect(review.testReferenceCount).toBe(1)
    expect(review.nextAction).toContain('do not stage/delete')
  })

  test('blocks replace/delete when runtime references remain', () => {
    const review = buildDSXUReplaceDeleteOwnerReview({
      packetId: 'V26-RD-blocked',
      title: 'Blocked owner review',
      targetOwner: 'old-owner',
      replacementOwner: 'new-owner',
      candidates: [
        {
          path: 'old.ts',
          currentOwner: 'old',
          proposedOwner: 'new',
          reason: 'duplicate',
          runtimeReferences: [
            {
              path: 'src/query.ts',
              line: 10,
              excerpt: 'import old',
              kind: 'runtime',
            },
          ],
          testReferences: [],
          docReferences: [],
          replacementEvidence: ['new.ts'],
          publicClaimAllowed: false,
        },
      ],
      rule: 'review only',
    })

    expect(review.status).toBe('BLOCKED_BY_RUNTIME_REFERENCES')
    expect(review.guards).toContain('1 runtime reference(s) still point to the old owner')
  })

  test('tightens next action when no test-only compatibility remains', () => {
    const review = buildDSXUReplaceDeleteOwnerReview({
      packetId: 'V26-RD-no-test-refs',
      title: 'No test refs owner review',
      targetOwner: 'old-owner',
      replacementOwner: 'new-owner',
      candidates: [
        {
          path: 'old-owner/*',
          currentOwner: 'old',
          proposedOwner: 'new',
          reason: 'duplicate',
          runtimeReferences: [],
          testReferences: [],
          docReferences: [],
          replacementEvidence: ['new-owner/index.ts'],
          publicClaimAllowed: false,
        },
      ],
      rule: 'review only',
    })

    expect(review.status).toBe('READY_FOR_OWNER_GIT_REPLACE_DELETE_REVIEW')
    expect(review.nextAction).toContain('historical source only')
    expect(review.nextAction).not.toContain('test-only compatibility')
  })
})
