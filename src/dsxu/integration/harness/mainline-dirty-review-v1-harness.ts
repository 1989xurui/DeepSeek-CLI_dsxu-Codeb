import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  buildMainlineDirtyReview,
  type MainlineDirtyReview,
} from '../../engine/mainline-dirty-review-v1'
import { buildLegacyMainlineDirtyReview } from '../../engine/legacy-mainline-dirty-review-v1'
import { runV18DirtyQuarantineLedgerHarness } from '../../engine/v18-dirty-quarantine-ledger'

export type MainlineDirtyReviewHarnessResult = MainlineDirtyReview & {
  evidencePath: string
  tracePath: string
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function runMainlineDirtyReviewHarness(options: {
  evidenceDir?: string
} = {}): Promise<MainlineDirtyReviewHarnessResult> {
  const evidenceDir = options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'mainline-dirty-review-v1')
  await mkdir(evidenceDir, { recursive: true })
  const evidencePath = join(evidenceDir, 'mainline-dirty-review.evidence.json')
  const tracePath = join(evidenceDir, 'mainline-dirty-review.trace.json')

  const ledger = await runV18DirtyQuarantineLedgerHarness({
    evidenceDir: join(evidenceDir, 'dirty-ledger'),
  })
  const legacyMainlineReview = buildLegacyMainlineDirtyReview(ledger)
  const review = buildMainlineDirtyReview(ledger, {
    legacyMainlineReviewStatus: legacyMainlineReview.status,
    legacyMainlineReviewBatchCount: legacyMainlineReview.batchCount,
  })
  const result: MainlineDirtyReviewHarnessResult = {
    ...review,
    evidencePath,
    tracePath,
  }

  await writeJson(join(evidenceDir, 'legacy-mainline-dirty-review.evidence.json'), legacyMainlineReview)
  await writeJson(tracePath, { ledger, review: result, legacyMainlineReview })
  await writeJson(evidencePath, result)
  return result
}
