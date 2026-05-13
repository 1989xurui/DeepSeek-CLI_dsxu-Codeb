import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  buildPendingDeletionReviewLanesRegister,
  type PendingDeletionReviewLanesRegister,
} from '../../engine/pending-deletion-review-lanes-register-v1'
import { runPendingDeletionSignoffRegisterHarness } from './pending-deletion-signoff-register-v1-harness'

export type PendingDeletionReviewLanesRegisterHarnessResult = PendingDeletionReviewLanesRegister & {
  evidencePath: string
  tracePath: string
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function runPendingDeletionReviewLanesRegisterHarness(options: {
  evidenceDir?: string
  targetReferenceManifestPath?: string
  pendingDeletionReviewManifestPath?: string
} = {}): Promise<PendingDeletionReviewLanesRegisterHarnessResult> {
  const evidenceDir = options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'pending-deletion-review-lanes-register-v1')
  await mkdir(evidenceDir, { recursive: true })
  const evidencePath = join(evidenceDir, 'pending-deletion-review-lanes-register.evidence.json')
  const tracePath = join(evidenceDir, 'pending-deletion-review-lanes-register.trace.json')
  const signoffRegister = await runPendingDeletionSignoffRegisterHarness({
    evidenceDir: join(evidenceDir, 'pending-deletion-signoff-register'),
    targetReferenceManifestPath: options.targetReferenceManifestPath,
    pendingDeletionReviewManifestPath: options.pendingDeletionReviewManifestPath,
  })
  const register = buildPendingDeletionReviewLanesRegister(signoffRegister)
  const result: PendingDeletionReviewLanesRegisterHarnessResult = {
    ...register,
    evidencePath,
    tracePath,
  }

  await writeJson(tracePath, { signoffRegister, register })
  await writeJson(evidencePath, result)
  return result
}
