import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  buildDirtyWorktreeReview,
  type DirtyWorktreeReview,
} from '../../engine/dirty-worktree-review-v1'
import { buildMainlineDirtyReview } from '../../engine/mainline-dirty-review-v1'
import { runV18DirtyQuarantineLedgerHarness } from '../../engine/v18-dirty-quarantine-ledger'

export type DirtyWorktreeReviewHarnessResult = DirtyWorktreeReview & {
  evidencePath: string
  tracePath: string
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function runDirtyWorktreeReviewHarness(options: {
  evidenceDir?: string
} = {}): Promise<DirtyWorktreeReviewHarnessResult> {
  const evidenceDir = options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'dirty-worktree-review-v1')
  await mkdir(evidenceDir, { recursive: true })
  const evidencePath = join(evidenceDir, 'dirty-worktree-review.evidence.json')
  const tracePath = join(evidenceDir, 'dirty-worktree-review.trace.json')

  const ledger = await runV18DirtyQuarantineLedgerHarness({
    evidenceDir: join(evidenceDir, 'dirty-ledger'),
  })
  const review = buildDirtyWorktreeReview(ledger)
  const mainlineDirtyReview = buildMainlineDirtyReview(ledger)
  const result: DirtyWorktreeReviewHarnessResult = {
    ...review,
    mainlineDirtyReviewStatus: mainlineDirtyReview.status,
    mainlineDirtyReviewBatchCount: mainlineDirtyReview.batchCount,
    evidencePath,
    tracePath,
  }

  await writeJson(join(evidenceDir, 'mainline-dirty-review.evidence.json'), mainlineDirtyReview)
  await writeJson(tracePath, { ledger, review: result, mainlineDirtyReview })
  await writeJson(evidencePath, result)
  return result
}
