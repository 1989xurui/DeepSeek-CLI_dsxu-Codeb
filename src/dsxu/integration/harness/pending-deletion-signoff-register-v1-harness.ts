import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  buildPendingDeletionSignoffRegister,
  type PendingDeletionSignoffRegister,
  validatePendingDeletionReviewManifest,
} from '../../engine/pending-deletion-signoff-register-v1'
import { runOwnerGitClosureBoardHarness } from './owner-git-closure-board-v1-harness'

export type PendingDeletionSignoffRegisterHarnessResult = PendingDeletionSignoffRegister & {
  evidencePath: string
  tracePath: string
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''))
}

export async function runPendingDeletionSignoffRegisterHarness(options: {
  evidenceDir?: string
  targetReferenceManifestPath?: string
  pendingDeletionReviewManifestPath?: string
} = {}): Promise<PendingDeletionSignoffRegisterHarnessResult> {
  const evidenceDir = options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'pending-deletion-signoff-register-v1')
  await mkdir(evidenceDir, { recursive: true })
  const evidencePath = join(evidenceDir, 'pending-deletion-signoff-register.evidence.json')
  const tracePath = join(evidenceDir, 'pending-deletion-signoff-register.trace.json')
  const board = await runOwnerGitClosureBoardHarness({
    evidenceDir: join(evidenceDir, 'owner-git-closure-board'),
    targetReferenceManifestPath: options.targetReferenceManifestPath,
  })
  const reviewManifest = options.pendingDeletionReviewManifestPath
    ? validatePendingDeletionReviewManifest(await readJson(options.pendingDeletionReviewManifestPath))
    : undefined
  const register = buildPendingDeletionSignoffRegister(board, { reviewManifest })
  const result: PendingDeletionSignoffRegisterHarnessResult = {
    ...register,
    evidencePath,
    tracePath,
  }

  await writeJson(tracePath, { board, reviewManifest, register })
  await writeJson(evidencePath, result)
  return result
}
