import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  buildPendingDeletionOwnerReviewRollupRegister,
  type PendingDeletionOwnerReviewRollupRegister,
} from '../../engine/pending-deletion-owner-review-rollup-register-v1'
import { buildPendingDeletionControlPlaneReplacementRegister } from '../../engine/pending-deletion-control-plane-replacement-register-v1'
import { buildPendingDeletionOldRootShimReplacementRegister } from '../../engine/pending-deletion-old-root-shim-replacement-register-v1'
import { buildPendingDeletionReleaseExcludedArchiveRegister } from '../../engine/pending-deletion-release-excluded-archive-register-v1'
import { runPendingDeletionReviewLanesRegisterHarness } from './pending-deletion-review-lanes-register-v1-harness'

export type PendingDeletionOwnerReviewRollupRegisterHarnessResult =
  PendingDeletionOwnerReviewRollupRegister & {
    evidencePath: string
    tracePath: string
  }

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function runPendingDeletionOwnerReviewRollupRegisterHarness(options: {
  evidenceDir?: string
  targetReferenceManifestPath?: string
  pendingDeletionReviewManifestPath?: string
} = {}): Promise<PendingDeletionOwnerReviewRollupRegisterHarnessResult> {
  const evidenceDir = options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'pending-deletion-owner-review-rollup-register-v1')
  await mkdir(evidenceDir, { recursive: true })
  const evidencePath = join(evidenceDir, 'pending-deletion-owner-review-rollup-register.evidence.json')
  const tracePath = join(evidenceDir, 'pending-deletion-owner-review-rollup-register.trace.json')
  const source = await runPendingDeletionReviewLanesRegisterHarness({
    evidenceDir: join(evidenceDir, 'pending-deletion-review-lanes-register'),
    targetReferenceManifestPath: options.targetReferenceManifestPath,
    pendingDeletionReviewManifestPath: options.pendingDeletionReviewManifestPath,
  })
  const controlPlane = buildPendingDeletionControlPlaneReplacementRegister(source)
  const releaseExcluded = buildPendingDeletionReleaseExcludedArchiveRegister(source)
  const oldRootShim = buildPendingDeletionOldRootShimReplacementRegister(source)
  const register = buildPendingDeletionOwnerReviewRollupRegister({
    source,
    controlPlane,
    releaseExcluded,
    oldRootShim,
  })
  const result: PendingDeletionOwnerReviewRollupRegisterHarnessResult = {
    ...register,
    evidencePath,
    tracePath,
  }

  await writeJson(tracePath, { source, controlPlane, releaseExcluded, oldRootShim, register })
  await writeJson(evidencePath, result)
  return result
}
