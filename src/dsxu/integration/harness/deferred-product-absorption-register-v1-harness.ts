import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  buildDeferredProductAbsorptionRegister,
  type DeferredProductAbsorptionRegister,
} from '../../engine/deferred-product-absorption-register-v1'
import { runOwnerGitClosureBoardHarness } from './owner-git-closure-board-v1-harness'

export type DeferredProductAbsorptionRegisterHarnessResult = DeferredProductAbsorptionRegister & {
  evidencePath: string
  tracePath: string
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function runDeferredProductAbsorptionRegisterHarness(options: {
  evidenceDir?: string
  targetReferenceManifestPath?: string
} = {}): Promise<DeferredProductAbsorptionRegisterHarnessResult> {
  const evidenceDir = options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'deferred-product-absorption-register-v1')
  await mkdir(evidenceDir, { recursive: true })
  const evidencePath = join(evidenceDir, 'deferred-product-absorption-register.evidence.json')
  const tracePath = join(evidenceDir, 'deferred-product-absorption-register.trace.json')
  const board = await runOwnerGitClosureBoardHarness({
    evidenceDir: join(evidenceDir, 'owner-git-closure-board'),
    targetReferenceManifestPath: options.targetReferenceManifestPath,
  })
  const register = buildDeferredProductAbsorptionRegister(board)
  const result: DeferredProductAbsorptionRegisterHarnessResult = {
    ...register,
    evidencePath,
    tracePath,
  }

  await writeJson(tracePath, { board, register })
  await writeJson(evidencePath, result)
  return result
}
