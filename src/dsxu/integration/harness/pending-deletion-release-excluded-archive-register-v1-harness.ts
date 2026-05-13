import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  buildPendingDeletionReleaseExcludedArchiveRegister,
  type PendingDeletionReleaseExcludedArchiveRegister,
} from '../../engine/pending-deletion-release-excluded-archive-register-v1'
import { runPendingDeletionReviewLanesRegisterHarness } from './pending-deletion-review-lanes-register-v1-harness'

export type PendingDeletionReleaseExcludedArchiveRegisterHarnessResult =
  PendingDeletionReleaseExcludedArchiveRegister & {
    evidencePath: string
    tracePath: string
  }

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function runPendingDeletionReleaseExcludedArchiveRegisterHarness(options: {
  evidenceDir?: string
} = {}): Promise<PendingDeletionReleaseExcludedArchiveRegisterHarnessResult> {
  const evidenceDir = options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'pending-deletion-release-excluded-archive-register-v1')
  await mkdir(evidenceDir, { recursive: true })
  const evidencePath = join(evidenceDir, 'pending-deletion-release-excluded-archive-register.evidence.json')
  const tracePath = join(evidenceDir, 'pending-deletion-release-excluded-archive-register.trace.json')
  const lanesRegister = await runPendingDeletionReviewLanesRegisterHarness({
    evidenceDir: join(evidenceDir, 'pending-deletion-review-lanes-register'),
  })
  const register = buildPendingDeletionReleaseExcludedArchiveRegister(lanesRegister)
  const result: PendingDeletionReleaseExcludedArchiveRegisterHarnessResult = {
    ...register,
    evidencePath,
    tracePath,
  }

  await writeJson(tracePath, { lanesRegister, register })
  await writeJson(evidencePath, result)
  return result
}
