import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  buildPendingDeletionReview,
  type PendingDeletionReview,
} from '../../engine/pending-deletion-review-v1'
import { runV18OpenSourcePackageGateHarness } from '../../engine/v18-open-source-package-gate'

export type PendingDeletionReviewHarnessResult = PendingDeletionReview & {
  evidencePath: string
  tracePath: string
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function runPendingDeletionReviewHarness(options: {
  evidenceDir?: string
} = {}): Promise<PendingDeletionReviewHarnessResult> {
  const evidenceDir = options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'pending-deletion-review-v1')
  await mkdir(evidenceDir, { recursive: true })
  const evidencePath = join(evidenceDir, 'pending-deletion-review.evidence.json')
  const tracePath = join(evidenceDir, 'pending-deletion-review.trace.json')

  const packageGate = await runV18OpenSourcePackageGateHarness({
    evidenceDir: join(evidenceDir, 'package-gate'),
  })
  const review = buildPendingDeletionReview(packageGate.pendingDeletionClosure)
  const result: PendingDeletionReviewHarnessResult = {
    ...review,
    evidencePath,
    tracePath,
  }

  await writeJson(tracePath, { packageGate, review })
  await writeJson(evidencePath, result)
  return result
}
