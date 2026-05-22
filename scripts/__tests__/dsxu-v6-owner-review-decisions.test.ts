import { mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, test } from 'bun:test'
import { buildV6OwnerReviewDecisions } from '../dsxu-v6-owner-review-decisions'

describe('V6 owner review decisions', () => {
  test('closes classify-before-claim rows into explicit owner decisions', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-owner-review-'))
    const matrixPath = join(dir, 'matrix.json')
    const cleanupPath = join(dir, 'cleanup.json')

    await writeFile(matrixPath, JSON.stringify({
      rows: [
        {
          path: 'src/coordinator/dag/runner.ts',
          kind: 'source',
          capability: 'core-or-unclear',
          primaryLabel: 'unclassified',
          importedBy: ['src/coordinator/dag/index.ts'],
          referencedByDocs: ['docs/old.md'],
        },
        {
          path: 'src/dsxu/engine/cache-monitor.ts',
          kind: 'dsxu-engine',
          capability: 'provider-model-cost-cache',
          primaryLabel: 'unclassified',
          importedBy: ['src/dsxu/engine/index.ts'],
          referencedByDocs: ['docs/report.md'],
        },
        {
          path: 'README.md',
          kind: 'source',
          capability: 'core-or-unclear',
          primaryLabel: 'unclassified',
        },
        {
          path: 'src/dsxu/integration/harness/verify-failure-harness.ts',
          kind: 'source',
          capability: 'verification-quality-gates',
          primaryLabel: 'unclassified',
          importedBy: ['src/dsxu/engine/__tests__/verify.test.ts'],
        },
        {
          path: 'src/coordinator/voting/index.ts',
          kind: 'source',
          capability: 'agent-task-orchestration',
          primaryLabel: 'unclassified',
        },
      ],
    }), 'utf8')

    await writeFile(cleanupPath, JSON.stringify({
      rows: [
        { path: 'src/coordinator/dag/runner.ts', owner: 'Owner Review Queue', action: 'classify-before-claim', exposure: 'doc-only' },
        { path: 'src/dsxu/engine/cache-monitor.ts', owner: 'Query Loop / Execution Contract', action: 'classify-before-claim', exposure: 'doc-only' },
        { path: 'README.md', owner: 'Docs / Release Claim Binder', action: 'keep-release-surface', exposure: 'not-exposed' },
        { path: 'src/dsxu/integration/harness/verify-failure-harness.ts', owner: 'Runtime Service Owner', action: 'classify-before-claim', exposure: 'doc-only' },
        { path: 'src/coordinator/voting/index.ts', owner: 'Owner Review Queue', action: 'classify-before-claim', exposure: 'doc-only' },
      ],
    }), 'utf8')

    const report = await buildV6OwnerReviewDecisions({
      matrixPath,
      cleanupPath,
      generatedAt: '2026-05-19T00:00:00.000Z',
    })

    expect(report.status).toBe('PASS_V6_OWNER_REVIEW_DECISIONS')
    expect(report.summary.reviewedUnclassifiedRows).toBe(5)
    expect(report.summary.deleteReview).toBe(1)
    expect(report.summary.mainlineOwner).toBe(1)
    expect(report.summary.releaseOnly).toBe(1)
    expect(report.summary.evidenceOnly).toBe(1)
    expect(report.summary.legacy).toBe(1)
    expect(report.summary.claimAllowedRows).toBe(0)
    expect(report.summary.modelPromptAllowedRows).toBe(0)
  })
})
