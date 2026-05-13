import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  buildOwnerGitSignoffRegister,
  type OwnerGitSignoffRegister,
  validateOwnerGitSignoffReviewManifest,
} from '../../engine/owner-git-signoff-register-v1'
import { runOwnerGitClosureBoardHarness } from './owner-git-closure-board-v1-harness'

export type OwnerGitSignoffRegisterHarnessResult = OwnerGitSignoffRegister & {
  evidencePath: string
  tracePath: string
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''))
}

export async function runOwnerGitSignoffRegisterHarness(options: {
  evidenceDir?: string
  targetReferenceManifestPath?: string
  ownerGitReviewManifestPath?: string
} = {}): Promise<OwnerGitSignoffRegisterHarnessResult> {
  const evidenceDir = options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'owner-git-signoff-register-v1')
  await mkdir(evidenceDir, { recursive: true })
  const evidencePath = join(evidenceDir, 'owner-git-signoff-register.evidence.json')
  const tracePath = join(evidenceDir, 'owner-git-signoff-register.trace.json')
  const board = await runOwnerGitClosureBoardHarness({
    evidenceDir: join(evidenceDir, 'owner-git-closure-board'),
    targetReferenceManifestPath: options.targetReferenceManifestPath,
  })
  const reviewManifest = options.ownerGitReviewManifestPath
    ? validateOwnerGitSignoffReviewManifest(await readJson(options.ownerGitReviewManifestPath))
    : undefined
  const register = buildOwnerGitSignoffRegister(board, { reviewManifest })
  const result: OwnerGitSignoffRegisterHarnessResult = {
    ...register,
    evidencePath,
    tracePath,
  }

  await writeJson(tracePath, { board, reviewManifest, register })
  await writeJson(evidencePath, result)
  return result
}
