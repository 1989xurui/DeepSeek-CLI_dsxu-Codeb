import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  buildLegacyMainlineDirtyReview,
  type LegacyMainlineDirtyReview,
} from '../../engine/legacy-mainline-dirty-review-v1'
import { buildToolRuntimeDirtyReview } from '../../engine/tool-runtime-dirty-review-v1'
import { runV18DirtyQuarantineLedgerHarness } from '../../engine/v18-dirty-quarantine-ledger'

export type LegacyMainlineDirtyReviewHarnessResult = LegacyMainlineDirtyReview & {
  evidencePath: string
  tracePath: string
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function runLegacyMainlineDirtyReviewHarness(options: {
  evidenceDir?: string
} = {}): Promise<LegacyMainlineDirtyReviewHarnessResult> {
  const evidenceDir = options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'legacy-mainline-dirty-review-v1')
  await mkdir(evidenceDir, { recursive: true })
  const evidencePath = join(evidenceDir, 'legacy-mainline-dirty-review.evidence.json')
  const tracePath = join(evidenceDir, 'legacy-mainline-dirty-review.trace.json')

  const ledger = await runV18DirtyQuarantineLedgerHarness({
    evidenceDir: join(evidenceDir, 'dirty-ledger'),
  })
  const review = buildLegacyMainlineDirtyReview(ledger)
  const toolRuntimeReview = buildToolRuntimeDirtyReview(ledger)
  const hasToolRuntimeImportUseBlocker =
    toolRuntimeReview.importUseUnknownCallerCount > 0 ||
    toolRuntimeReview.importUseForbiddenClosureCount > 0
  const nextAction =
    review.nextAction === 'review-tool-runtime-migration' && !hasToolRuntimeImportUseBlocker
      ? 'review-legacy-other'
      : review.nextAction
  const result: LegacyMainlineDirtyReviewHarnessResult = {
    ...review,
    toolRuntimeReviewStatus: toolRuntimeReview.status,
    toolRuntimeReviewBatchCount: toolRuntimeReview.batchCount,
    nextAction,
    evidencePath,
    tracePath,
  }

  await writeJson(join(evidenceDir, 'tool-runtime-dirty-review.evidence.json'), toolRuntimeReview)
  await writeJson(tracePath, { ledger, review: result, toolRuntimeReview })
  await writeJson(evidencePath, result)
  return result
}
