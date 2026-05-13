import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  buildDeferredProductAbsorptionRegister,
  type DeferredProductAbsorptionRegister,
  validateDeferredProductAbsorptionReviewManifest,
} from '../../engine/deferred-product-absorption-register-v1'
import { runOwnerGitClosureBoardHarness } from './owner-git-closure-board-v1-harness'

export type DeferredProductAbsorptionRegisterHarnessResult = DeferredProductAbsorptionRegister & {
  evidencePath: string
  tracePath: string
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function readJsonIfExists(path: string): Promise<unknown | null> {
  try {
    return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''))
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return null
    throw error
  }
}

export async function runDeferredProductAbsorptionRegisterHarness(options: {
  evidenceDir?: string
  targetReferenceManifestPath?: string
  deferredProductReviewManifestPath?: string
} = {}): Promise<DeferredProductAbsorptionRegisterHarnessResult> {
  const evidenceDir = options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'deferred-product-absorption-register-v1')
  await mkdir(evidenceDir, { recursive: true })
  const evidencePath = join(evidenceDir, 'deferred-product-absorption-register.evidence.json')
  const tracePath = join(evidenceDir, 'deferred-product-absorption-register.trace.json')
  const board = await runOwnerGitClosureBoardHarness({
    evidenceDir: join(evidenceDir, 'owner-git-closure-board'),
    targetReferenceManifestPath: options.targetReferenceManifestPath,
    deferredProductReviewManifestPath: options.deferredProductReviewManifestPath,
  })
  const deferredProductReviewManifestPath = options.deferredProductReviewManifestPath ??
    join(process.cwd(), '.dsxu', 'trace', 'deferred-product-absorption-reviewed-v1', 'deferred-product-absorption-review-manifest.json')
  const deferredProductReviewInput = await readJsonIfExists(deferredProductReviewManifestPath)
  const deferredProductReviewManifest = deferredProductReviewInput
    ? validateDeferredProductAbsorptionReviewManifest(deferredProductReviewInput)
    : undefined
  const register = buildDeferredProductAbsorptionRegister(board, { reviewManifest: deferredProductReviewManifest })
  const result: DeferredProductAbsorptionRegisterHarnessResult = {
    ...register,
    evidencePath,
    tracePath,
  }

  await writeJson(tracePath, { board, deferredProductReviewManifest, register })
  await writeJson(evidencePath, result)
  return result
}
