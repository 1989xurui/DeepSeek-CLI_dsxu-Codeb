import { mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, test } from 'bun:test'
import { buildDeleteReviewBoard } from '../dsxu-delete-review-board'

describe('V7 delete review board', () => {
  test('keeps delete-review rows in observe state without deletion approval', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-delete-review-'))
    const ownerDecisionPath = join(dir, 'owners.json')
    await writeFile(ownerDecisionPath, JSON.stringify({
      rows: [
        { path: 'src/commands/bridge/index.ts', owner: 'Runtime Service Owner', decision: 'delete-review' },
        { path: 'src/coordinator/dag/runner.ts', owner: 'PlanGraph / Work-State Owner', decision: 'delete-review' },
      ],
    }), 'utf8')

    const report = await buildDeleteReviewBoard({
      ownerDecisionPath,
      generatedAt: '2026-05-19T00:00:00.000Z',
    })

    expect(report.status).toBe('PASS_DSXU_DELETE_REVIEW_BOARD')
    expect(report.summary.deleteReviewRows).toBe(2)
    expect(report.summary.deleteReadyRows).toBe(0)
    expect(report.summary.ownerSignoffRows).toBe(0)
    expect(report.summary.userDeletionApprovalRows).toBe(0)
    expect(report.rows.every(row => row.status === 'observe')).toBe(true)
  })
})
