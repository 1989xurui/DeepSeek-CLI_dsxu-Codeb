import { mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, test } from 'bun:test'
import { buildDeleteReviewReplacementEvidence } from '../dsxu-v7-delete-review-replacement-evidence'

describe('V7 delete-review replacement evidence', () => {
  test('keeps replacement-covered rows observe-only without mutation approval', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-v7-delete-replacement-'))
    const deleteReviewPath = join(dir, 'delete-review.json')
    const command = 'bun test replacement.test.ts'
    await writeFile(deleteReviewPath, JSON.stringify({
      summary: { deleteReviewRows: 2 },
      rows: [
        {
          path: 'src/commands/bridge/bridge.tsx',
          owner: 'Runtime Service Owner',
          replacementOwner: 'DSXU Provider Alias / Provider Contract',
          replacementEvidence: ['package.json'],
          requiredTests: [command],
          ownerSignoff: false,
          userDeletionApproval: false,
          deleteReady: false,
          status: 'observe',
          blockers: ['owner signoff missing', 'user deletion approval missing'],
        },
        {
          path: 'src/services/swe-bench/index.ts',
          owner: 'Evidence / Eval SWE Owner',
          replacementOwner: 'Evidence / Eval SWE Owner',
          replacementEvidence: ['package.json'],
          requiredTests: [command],
          ownerSignoff: false,
          userDeletionApproval: false,
          deleteReady: false,
          status: 'observe',
          blockers: ['owner signoff missing', 'user deletion approval missing'],
        },
      ],
    }), 'utf8')

    const report = await buildDeleteReviewReplacementEvidence({
      deleteReviewPath,
      generatedAt: '2026-05-19T00:00:00.000Z',
      commandResults: {
        [command]: {
          command,
          status: 'PASS',
          exitCode: 0,
          durationMs: 12,
          keyOutput: ['pass'],
        },
      },
      referenceResults: {
        'src/commands/bridge/bridge.tsx': [
          {
            pattern: './bridge.js',
            file: 'src/commands/bridge/index.ts',
            line: 12,
            text: "load: () => import('./bridge.js')",
            classification: 'runtime-source',
          },
        ],
        'src/services/swe-bench/index.ts': [
          {
            pattern: 'src/services/swe-bench',
            file: 'docs/example.md',
            line: 1,
            text: 'doc-only',
            classification: 'script-or-package',
          },
        ],
      },
    })

    expect(report.status).toBe('PASS_DSXU_V7_DELETE_REVIEW_REPLACEMENT_EVIDENCE')
    expect(report.summary.rows).toBe(2)
    expect(report.summary.deleteReadyRows).toBe(0)
    expect(report.summary.mutationAllowedRows).toBe(0)
    expect(report.summary.replacementEvidenceRows).toBe(2)
    expect(report.summary.activeRuntimeReferenceRows).toBe(1)
    expect(report.rows.every(row => row.deleteReady === false && row.mutationAllowed === false)).toBe(true)
    expect(report.rows[0]?.status).toBe('observe-active-runtime-reference')
    expect(report.rows[1]?.status).toBe('observe-replacement-covered')
  })

  test('blocks when replacement tests fail or evidence paths are missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-v7-delete-replacement-blocked-'))
    const deleteReviewPath = join(dir, 'delete-review.json')
    const command = 'bun test missing.test.ts'
    await writeFile(deleteReviewPath, JSON.stringify({
      summary: { deleteReviewRows: 1 },
      rows: [
        {
          path: 'src/legacy.ts',
          owner: 'Owner Review Queue',
          replacementOwner: 'Owner Review Queue',
          replacementEvidence: ['missing/replacement.ts'],
          requiredTests: [command],
          ownerSignoff: false,
          userDeletionApproval: false,
          deleteReady: false,
          status: 'observe',
          blockers: [],
        },
      ],
    }), 'utf8')

    const report = await buildDeleteReviewReplacementEvidence({
      deleteReviewPath,
      generatedAt: '2026-05-19T00:00:00.000Z',
      commandResults: {
        [command]: {
          command,
          status: 'FAIL',
          exitCode: 1,
          durationMs: 12,
          keyOutput: ['fail'],
        },
      },
      referenceResults: {
        'src/legacy.ts': [],
      },
    })

    expect(report.status).toBe('BLOCKED_DSXU_V7_DELETE_REVIEW_REPLACEMENT_EVIDENCE')
    expect(report.summary.failedCommands).toBe(1)
    expect(report.summary.replacementEvidenceRows).toBe(0)
    expect(report.blockers).toEqual(expect.arrayContaining([
      'one or more focused replacement test commands failed',
      'one or more rows are missing replacement evidence paths',
    ]))
  })
})
