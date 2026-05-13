import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  buildPendingDeletionControlPlaneReplacementRegister,
  type PendingDeletionControlPlaneReplacementRegister,
} from '../../engine/pending-deletion-control-plane-replacement-register-v1'
import { runPendingDeletionReviewLanesRegisterHarness } from './pending-deletion-review-lanes-register-v1-harness'

export type PendingDeletionControlPlaneReplacementRegisterHarnessResult =
  PendingDeletionControlPlaneReplacementRegister & {
    evidencePath: string
    tracePath: string
  }

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function runPendingDeletionControlPlaneReplacementRegisterHarness(options: {
  evidenceDir?: string
} = {}): Promise<PendingDeletionControlPlaneReplacementRegisterHarnessResult> {
  const evidenceDir = options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'pending-deletion-control-plane-replacement-register-v1')
  await mkdir(evidenceDir, { recursive: true })
  const evidencePath = join(evidenceDir, 'pending-deletion-control-plane-replacement-register.evidence.json')
  const tracePath = join(evidenceDir, 'pending-deletion-control-plane-replacement-register.trace.json')
  const lanesRegister = await runPendingDeletionReviewLanesRegisterHarness({
    evidenceDir: join(evidenceDir, 'pending-deletion-review-lanes-register'),
  })
  const register = buildPendingDeletionControlPlaneReplacementRegister(lanesRegister)
  const result: PendingDeletionControlPlaneReplacementRegisterHarnessResult = {
    ...register,
    evidencePath,
    tracePath,
  }

  await writeJson(tracePath, { lanesRegister, register })
  await writeJson(evidencePath, result)
  return result
}
